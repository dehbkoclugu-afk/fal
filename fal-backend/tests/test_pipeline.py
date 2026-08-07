"""
Uçtan uca boru hattı testleri — gerçek Postgres, taklit LLM.

Burada test edilen şey sıranın kendisi: guardrail → bağlam → üretim → çıktı
taraması → anti-tekrar → tahmin ayıklama → kayıt. Bu sıra bozulursa ürünün
hem güvenlik hem farklılaşma iddiası çöker.
"""

from __future__ import annotations

import json
import uuid

import pytest

from app.core import guardrail, pipeline
from tests.conftest import requires_db

pytestmark = [pytest.mark.asyncio, requires_db]


async def _reading(db, user_id, kind="daily"):
    rid = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO readings (id, user_id, kind) VALUES ($1,$2,$3)",
        rid, user_id, kind)
    return rid


# ------------------------------------------------------------------ guardrail

async def test_kriz_sorusu_fal_uretmiyor(db, user_with_chart, fake_llm, fake_embed):
    """Kriz mesajında LLM'e HİÇ gidilmemeli — 'üret sonra filtrele' değil,
    'hiç üretme'."""
    rid = await _reading(db, user_with_chart)
    with pytest.raises(pipeline.CrisisIntercept) as exc:
        await pipeline.generate_reading(
            db, user_with_chart, rid, "daily",
            {"question": "artık dayanamıyorum yaşamak istemiyorum"})

    assert "183" in exc.value.reply
    assert fake_llm.calls == [], "kriz vakasında LLM çağrıldı"
    status = await db.fetchval("SELECT status FROM readings WHERE id=$1", rid)
    assert status == "blocked"


async def test_kriz_vakasinda_tahmin_kaydedilmiyor(db, user_with_chart,
                                                   fake_llm, fake_embed):
    rid = await _reading(db, user_with_chart)
    with pytest.raises(pipeline.CrisisIntercept):
        await pipeline.generate_reading(db, user_with_chart, rid, "daily",
                                        {"question": "intihar etmek istiyorum"})
    n = await db.fetchval("SELECT count(*) FROM predictions WHERE reading_id=$1", rid)
    assert n == 0


async def test_yas_kapisi_fal_uretmiyor(db, user_with_chart, fake_llm, fake_embed):
    rid = await _reading(db, user_with_chart)
    with pytest.raises(pipeline.ReadingRejected) as exc:
        await pipeline.generate_reading(db, user_with_chart, rid, "daily",
                                        {"question": "aşk falı", "age": 15})
    assert exc.value.code == "minor"
    assert fake_llm.calls == []


async def test_saglik_sorusu_prompta_kisit_ekliyor(db, user_with_chart,
                                                   fake_llm, fake_embed):
    """SOFT_LIMIT fal üretimini durdurmaz ama sistem promptuna kısıt basar."""
    rid = await _reading(db, user_with_chart, "natal")
    await pipeline.generate_reading(db, user_with_chart, rid, "natal",
                                    {"question": "kanser miyim acaba"})
    assert fake_llm.calls, "soft limit üretimi durdurmamalı"
    sistem = str(fake_llm.calls[0]["system"])
    assert "doktora" in sistem


async def _blok_doldur(db):
    from app.core.astro import BirthInput, compute_chart, condition_keys
    for k in condition_keys(compute_chart(BirthInput(1993, 6, 14, 4, 30)))[:8]:
        for v in range(4):
            await db.execute(
                """INSERT INTO content_blocks (key,variant,locale,section,text)
                   VALUES ($1,$2,'tr','genel',$3) ON CONFLICT DO NOTHING""",
                k, v, f"{k} varyant {v} metni.")


async def test_kisit_ucretsiz_gunluk_yolunda_da_uygulaniyor(db, user_with_chart,
                                                            fake_llm, fake_embed):
    """Regresyon: ücretsiz kullanıcının günlük yorumu hibrit blok yolundan
    geçiyor ve ayrı bir sistem promptu kullanıyor. Guardrail kısıtı oraya
    taşınmazsa kullanıcıların çoğunluğu için hiç uygulanmamış olur."""
    await _blok_doldur(db)
    fake_llm.queue({"ozet": "a", "metin": "b", "tavsiye": "c", "tahmin": None})
    rid = await _reading(db, user_with_chart, "daily")
    await pipeline.generate_reading(db, user_with_chart, rid, "daily",
                                    {"question": "kanser miyim acaba"})
    assert fake_llm.calls, "hibrit yol LLM'e hiç gitmedi"
    assert "doktora" in str(fake_llm.calls[0]["system"])


# ------------------------------------------------------------- üretim ve kayıt

async def test_natal_fal_ucdan_uca(db, user_with_chart, fake_llm, fake_embed):
    rid = await _reading(db, user_with_chart, "natal")
    out = await pipeline.generate_reading(db, user_with_chart, rid, "natal", {})

    row = await db.fetchrow(
        "SELECT status, output_json, extra_json, cost_usd, embedding "
        "FROM readings WHERE id=$1", rid)
    assert row["status"] == "done"
    # jsonb codec'i sayesinde dict olarak geri geliyor (bkz. core/db.py).
    assert isinstance(row["output_json"], dict)
    assert row["output_json"]["ozet"] == out["ozet"]
    assert row["embedding"] is not None, "anti-tekrar için embedding yazılmalı"
    assert float(row["cost_usd"]) > 0, "maliyet muhasebesi tutulmuyor"

    # Gerçekten hesaplanmış harita gitmiş mi (halüsinasyon değil)
    extra = row["extra_json"]
    assert extra["chart"]["ascendant"]
    assert extra["chart"]["bodies"]["sun"]["sign_tr"]


async def test_dogum_verisi_yoksa_natal_reddediliyor(db, user_id, fake_llm, fake_embed):
    rid = await _reading(db, user_id, "natal")
    with pytest.raises(pipeline.ReadingRejected) as exc:
        await pipeline.generate_reading(db, user_id, rid, "natal", {})
    assert exc.value.code == "no_birth_data"


async def test_llm_e_gercek_gezegen_pozisyonu_gidiyor(db, user_with_chart,
                                                      fake_llm, fake_embed):
    """'LLM'e burç uydurtmuyoruz' iddiasının testi: prompt içinde ephemeris'ten
    gelen somut derece bilgisi bulunmalı."""
    rid = await _reading(db, user_with_chart, "natal")
    await pipeline.generate_reading(db, user_with_chart, rid, "natal", {})
    prompt = fake_llm.calls[0]["user"]
    assert "°" in prompt
    assert "Yükselen" in prompt or "yukselen" in prompt.lower()


# --------------------------------------------------------------- tahmin ayıklama

async def test_tahminler_deftere_yaziliyor(db, user_with_chart, fake_llm, fake_embed):
    """Ana farklılaşma: her yorum doğrulanabilir tahmin nesnesi üretir."""
    rid = await _reading(db, user_with_chart, "natal")
    await pipeline.generate_reading(db, user_with_chart, rid, "natal", {})

    rows = await db.fetch(
        "SELECT topic, claim, confidence, window_start, window_end, user_verdict "
        "FROM predictions WHERE reading_id=$1 ORDER BY window_end", rid)
    assert len(rows) == 2
    assert rows[0]["claim"] == "Beklemediğin bir mesaj alacaksın"
    assert rows[0]["user_verdict"] is None, "tahmin cevaplanmamış başlamalı"
    assert rows[0]["window_end"] > rows[0]["window_start"]


async def test_tahmin_penceresi_sinirlaniyor(db, user_with_chart, fake_llm, fake_embed):
    """Aşırı uzun pencere doğrulama döngüsünü öldürür (kullanıcı unutur),
    aşırı kısa pencere haksız 'tutmadı' üretir. 3-45 gün arasına kırpılıyor."""
    fake_llm.queue({
        "ozet": "x", "bolumler": [], "tavsiye": "y", "sembol": "ay",
        "tahminler": [
            {"konu": "ask", "iddia": "cok uzun", "pencere_gun": 900, "guven": "orta"},
            {"konu": "is", "iddia": "cok kisa", "pencere_gun": 1, "guven": "orta"},
            {"konu": "para", "iddia": "bozuk", "pencere_gun": "abc", "guven": "orta"},
            {"konu": "genel", "iddia": "sifir", "pencere_gun": 0, "guven": "orta"},
        ],
    })
    rid = await _reading(db, user_with_chart, "natal")
    await pipeline.generate_reading(db, user_with_chart, rid, "natal", {})

    rows = await db.fetch(
        "SELECT claim, extract(epoch FROM (window_end-window_start))/86400 AS gun "
        "FROM predictions WHERE reading_id=$1", rid)
    gunler = {r["claim"]: round(r["gun"]) for r in rows}
    assert gunler["cok uzun"] == 45
    assert gunler["cok kisa"] == 3
    assert gunler["bozuk"] == 10, "geçersiz pencere varsayılana düşmeli"
    # 0 "belirtilmemiş" sayılır (0 or 10) — kırpma değil varsayılan uygulanır
    assert gunler["sifir"] == 10


async def test_en_fazla_dort_tahmin(db, user_with_chart, fake_llm, fake_embed):
    fake_llm.queue({
        "ozet": "x", "bolumler": [], "tavsiye": "y", "sembol": "ay",
        "tahminler": [{"konu": "ask", "iddia": f"iddia {i}", "pencere_gun": 7,
                       "guven": "orta"} for i in range(9)],
    })
    rid = await _reading(db, user_with_chart, "natal")
    await pipeline.generate_reading(db, user_with_chart, rid, "natal", {})
    n = await db.fetchval("SELECT count(*) FROM predictions WHERE reading_id=$1", rid)
    assert n == 4


# ------------------------------------------------------- çıktı taraması / tekrar

async def test_yasakli_cikti_yeniden_uretiliyor(db, user_with_chart,
                                                fake_llm, fake_embed):
    """LLM kuralı çiğnerse kullanıcıya gitmez, yeniden üretilir."""
    fake_llm.queue({
        "ozet": "Bu yıl kesin olarak öleceksin.", "bolumler": [],
        "tahminler": [], "tavsiye": "", "sembol": "",
    })
    rid = await _reading(db, user_with_chart, "natal")
    out = await pipeline.generate_reading(db, user_with_chart, rid, "natal", {})

    assert len(fake_llm.calls) >= 2, "ihlal edilen çıktı yeniden üretilmedi"
    assert guardrail.scan_output(out["ozet"]) == []
    assert "REDDEDİLDİ" in fake_llm.calls[1]["user"], "modele sebep bildirilmemiş"


async def test_benzer_yorum_yeniden_uretiliyor(db, user_with_chart,
                                               fake_llm, fake_embed):
    """Anti-tekrar: aynı metin iki kez üretilirse ikincisi reddedilip
    yeniden istenmeli. Bu kontrol olmadan kullanıcı 'hep aynı şeyi yazıyor'
    diyerek aboneliği iptal ediyor."""
    rid1 = await _reading(db, user_with_chart, "natal")
    await pipeline.generate_reading(db, user_with_chart, rid1, "natal", {})
    ilk_cagri = len(fake_llm.calls)

    # 2. fal: önce birebir aynı metin (reddedilmeli), sonra farklı metin (kabul)
    farkli = {"ozet": "Bambaşka bir imge: eşikte bekleyen bir kapı.",
              "bolumler": [{"baslik": "Genel", "metin": "Yeni bir zemin kuruluyor."}],
              "tahminler": [], "tavsiye": "Sabret.", "sembol": "kapı"}
    fake_llm.queue(dict(fake_llm.default))   # aynı → too_similar
    fake_llm.queue(farkli)                   # farklı → kabul
    rid2 = await _reading(db, user_with_chart, "natal")
    out = await pipeline.generate_reading(db, user_with_chart, rid2, "natal", {})

    yeni_cagrilar = fake_llm.calls[ilk_cagri:]
    assert len(yeni_cagrilar) >= 2, "tekrar eden yorum yeniden üretilmedi"
    assert "benziyordu" in yeni_cagrilar[1]["user"]
    assert out["ozet"] == farkli["ozet"], "farklı yorum kabul edilmeliydi"


async def test_uretim_basarisiz_olursa_reddediliyor(db, user_with_chart,
                                                    fake_llm, fake_embed):
    for _ in range(pipeline.MAX_REGEN + 1):
        fake_llm.queue({"ozet": "Bu yıl kesin olarak öleceksin.", "bolumler": [],
                        "tahminler": [], "tavsiye": "", "sembol": ""})
    rid = await _reading(db, user_with_chart, "natal")
    with pytest.raises(pipeline.ReadingRejected) as exc:
        await pipeline.generate_reading(db, user_with_chart, rid, "natal", {})
    assert exc.value.code == "generation_failed"


# ---------------------------------------------------------------- model kademesi

async def test_ucretsiz_kullanici_kucuk_modele_gidiyor(db, user_with_chart,
                                                       fake_llm, fake_embed):
    rid = await _reading(db, user_with_chart, "natal")
    await pipeline.generate_reading(db, user_with_chart, rid, "natal", {})
    assert fake_llm.calls[0]["tier"] == "small"


async def test_odeyen_kullanici_buyuk_modele_gidiyor(db, user_with_chart,
                                                     fake_llm, fake_embed):
    await db.execute(
        """INSERT INTO entitlements (user_id, tier, source, expires_at)
           VALUES ($1,'fate','android', now() + interval '30 days')""",
        user_with_chart)
    rid = await _reading(db, user_with_chart, "natal")
    await pipeline.generate_reading(db, user_with_chart, rid, "natal", {})
    assert fake_llm.calls[0]["tier"] == "large"
    tier = await db.fetchval("SELECT tier FROM readings WHERE id=$1", rid)
    assert tier == "paid"


async def test_ucretsiz_gunluk_hibrit_yoldan_geciyor(db, user_with_chart,
                                                     fake_llm, fake_embed):
    """Maliyet mimarisinin kalbi: ücretsiz kullanıcının günlük yorumu blok
    kütüphanesinden beslenmeli, büyük modele gitmemeli."""
    from app.core.astro import compute_chart, BirthInput, condition_keys
    keys = condition_keys(compute_chart(BirthInput(1993, 6, 14, 4, 30)))
    for k in keys[:8]:
        for v in range(4):
            await db.execute(
                """INSERT INTO content_blocks (key,variant,locale,section,text)
                   VALUES ($1,$2,'tr','genel',$3)
                   ON CONFLICT DO NOTHING""",
                k, v, f"{k} varyant {v} metni.")

    fake_llm.queue({"ozet": "Bugün sakin.", "metin": "Uzun metin.",
                    "tavsiye": "Bekle.",
                    "tahmin": {"konu": "genel", "iddia": "Bir haber gelecek",
                               "pencere_gun": 7, "guven": "orta"}})
    rid = await _reading(db, user_with_chart, "daily")
    out = await pipeline.generate_reading(db, user_with_chart, rid, "daily", {})

    assert fake_llm.calls[0]["tier"] == "small"
    assert out["ozet"] == "Bugün sakin."
    n = await db.fetchval("SELECT count(*) FROM predictions WHERE reading_id=$1", rid)
    assert n == 1, "hibrit yol da tahmin üretmeli"


# ------------------------------------------------------------------------ hafıza

async def test_hafiza_kaydediliyor_ve_sonraki_fala_giriyor(db, user_with_chart,
                                                           fake_llm, fake_embed):
    """'Hafızası olan danışman' tezinin testi."""
    fake_llm.queue({"items": [{"kind": "person", "key": "Mert",
                               "summary": "Kullanıcının ilgilendiği kişi",
                               "salience": 0.9}]})
    n = await pipeline.extract_memory(db, user_with_chart,
                                      "Mert diye biri var, onunla ne olacak?")
    assert n == 1

    rid = await _reading(db, user_with_chart, "natal")
    await pipeline.generate_reading(db, user_with_chart, rid, "natal", {})
    assert "Mert" in fake_llm.calls[-1]["user"]


async def test_kisa_soru_hafizaya_yazilmiyor(db, user_with_chart, fake_llm):
    assert await pipeline.extract_memory(db, user_with_chart, "ne olacak") == 0
    assert fake_llm.calls == []


# ---------------------------------------------------------------- rüya ritüeli

RUYA = ("Rüyamda çocukluğumun evindeydim, merdivenlerden inerken alt katın "
        "su ile dolduğunu gördüm ama korkmadım.")


async def test_ruya_dogum_verisi_olmadan_calisiyor(db, user_id, fake_llm, fake_embed):
    """Rüya, haritasız çalışan TEK ritüel — bu kasıtlı bir ürün kararı.

    Onboarding'i yarıda bırakmış kullanıcının ilk değer anı burası. Doğum
    verisi zorunlu kılınırsa o kullanıcı hiçbir ritüele giremiyor.
    """
    rid = await _reading(db, user_id, "dream")
    await pipeline.generate_reading(db, user_id, rid, "dream", {"dream": RUYA})

    row = await db.fetchrow("SELECT status, output_json FROM readings WHERE id=$1", rid)
    assert row["status"] == "done"
    assert row["output_json"]["ozet"]


async def test_ruya_metni_guardraildan_geciyor(db, user_id, fake_llm, fake_embed):
    """Rüya metni `dream` alanında geliyor; guardrail `question` üzerinden
    çalışıyor. Bağlanmazsa bu uç, guardrail'in tamamen atlandığı tek giriş
    noktası olurdu."""
    rid = await _reading(db, user_id, "dream")
    with pytest.raises(pipeline.CrisisIntercept):
        await pipeline.generate_reading(
            db, user_id, rid, "dream",
            {"dream": "Rüyamdan uyandım ve artık dayanamıyorum yaşamak istemiyorum."})
    assert fake_llm.calls == [], "kriz vakasında LLM çağrıldı"


async def test_ruya_haritayla_gokyuzu_baglami_tasiyor(db, user_with_chart,
                                                      fake_llm, fake_embed):
    """Harita varsa yorum o gecenin Ay'ına ve transitlerine dayanmalı —
    ürünün 'uydurmuyoruz, hesaplıyoruz' tezi rüyada da geçerli."""
    rid = await _reading(db, user_with_chart, "dream")
    await pipeline.generate_reading(db, user_with_chart, rid, "dream",
                                    {"dream": RUYA, "dream_date": "2026-08-06"})

    prompt = fake_llm.calls[0]["user"]
    assert "Boğa burcunda Son Dördün" in prompt, prompt[:400]

    extra = await db.fetchval("SELECT extra_json FROM readings WHERE id=$1", rid)
    assert extra["moon"]["burc"] == "Boğa"
    assert extra["dream_night"] == "2026-08-06"


async def test_ruya_metni_prompta_birebir_giriyor(db, user_id, fake_llm, fake_embed):
    """Rüya sözlüğü yerine kullanıcının kendi sahnesine bağlanması,
    anlatının prompta girmesine bağlı."""
    rid = await _reading(db, user_id, "dream")
    await pipeline.generate_reading(db, user_id, rid, "dream", {"dream": RUYA})
    assert RUYA in fake_llm.calls[0]["user"]


async def test_cok_kisa_ruya_reddediliyor(db, user_id, fake_llm, fake_embed):
    rid = await _reading(db, user_id, "dream")
    with pytest.raises(pipeline.ReadingRejected) as exc:
        await pipeline.generate_reading(db, user_id, rid, "dream", {"dream": "uçtum"})
    assert exc.value.code == "dream_too_short"
    assert fake_llm.calls == []
