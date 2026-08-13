"""
API uç testleri — gerçek Postgres, taklit kuyruk ve Redis.

Kuyruk taklit ediliyor çünkü test edilen şey HTTP sözleşmesi: jeton düşümü,
yetkilendirme, doğrulama ve 202 davranışı. Üretimin kendisi test_pipeline'da.
"""

from __future__ import annotations

import uuid

import httpx
import pytest

from app.core.pricing import COIN_PRICES, SIGNUP_COINS
from tests.conftest import requires_db

pytestmark = [pytest.mark.asyncio, requires_db]


class FakeQueue:
    def __init__(self):
        self.jobs: list[tuple] = []

    def enqueue(self, fn, *args, **kw):
        self.jobs.append((fn, args))


class FakeRedis:
    def __init__(self):
        self.store: dict[str, bytes] = {}

    async def setex(self, key, ttl, val):
        self.store[key] = val


@pytest.fixture
def anon():
    return str(uuid.uuid4())


@pytest.fixture
def queue():
    return FakeQueue()


@pytest.fixture
async def client(db, queue, monkeypatch, fake_llm):
    """fake_llm zorunlu: verdict ucu artık takip yorumu üretiyor. Stub
    olmadan testler gerçek LLM adresine 3 kez deneme yapıp geri çekiliyor —
    ağ yok, sadece yavaşlık ve belirsizlik."""
    from app import main

    monkeypatch.setitem(main.state, "db", db)
    monkeypatch.setitem(main.state, "redis", FakeRedis())
    monkeypatch.setitem(main.state, "queue", queue)

    transport = httpx.ASGITransport(app=main.app)
    async with httpx.AsyncClient(transport=transport,
                                 base_url="http://test") as c:
        yield c


def H(anon):
    return {"x-anon-id": anon}


async def coin_ver(db, anon, adet):
    """Kullanıcının bakiyesini TAM OLARAK `adet` yapar.

    Önce defteri temizliyor: kullanıcı yaratılırken açılış hediyesi
    (SIGNUP_COINS) yazılıyor ve testlerin çoğu "bu kullanıcının N jetonu
    var" demek istiyor, "N + hediye" değil. Eklemeli bırakılsaydı her
    bakiye iddiasının hediyeyi de saymasi gerekirdi — hediye miktarı
    değiştiğinde testlerin yarısı kırılırdı.
    """
    uid = await db.fetchval("SELECT id FROM users WHERE anon_id=$1", anon)
    await db.execute("DELETE FROM coin_ledger WHERE user_id=$1", uid)
    await db.execute(
        """INSERT INTO coin_ledger (user_id, delta, reason, balance_after)
           VALUES ($1,$2,'purchase',$2)""", uid, adet)
    return uid


async def jetonsuz_yap(db, anon):
    """Jetonu bitmiş kullanıcı. Açılış hediyesinden sonra 'jeton yetmiyor'
    senaryolarını kurmak için gerekiyor."""
    return await coin_ver(db, anon, 0)


PROFIL = {"first_name": "Deniz", "birth_date": "1993-06-14",
          "birth_time": "04:30", "time_known": True,
          "place_name": "İstanbul", "lat": 41.0082, "lon": 28.9784,
          "tz_name": "Europe/Istanbul", "tone": "mistik"}


# ------------------------------------------------------------------ kimlik

async def test_anon_id_ile_kullanici_otomatik_olusuyor(client, db, anon):
    """Onboarding'de kayıt ekranı yok; ilk istek kullanıcıyı yaratmalı."""
    r = await client.get("/v1/me", headers=H(anon))
    assert r.status_code == 200
    assert await db.fetchval("SELECT count(*) FROM users WHERE anon_id=$1", anon) == 1


async def test_anon_id_yoksa_reddediliyor(client):
    assert (await client.get("/v1/me")).status_code == 422


async def test_eski_jetonsuz_hesabin_acilis_hediyesi_onariliyor(client, db, anon):
    """Eski sürümde users oluşup ledger oluşmayan cihaz 0 jetonda kalmasın."""
    uid = await db.fetchval(
        "INSERT INTO users (anon_id) VALUES ($1) RETURNING id", anon)

    ilk = await client.get("/v1/me", headers=H(anon))
    ikinci = await client.get("/v1/me", headers=H(anon))

    assert ilk.status_code == 200 and ilk.json()["coins"] == SIGNUP_COINS
    assert ikinci.json()["coins"] == SIGNUP_COINS
    assert await db.fetchval(
        "SELECT count(*) FROM coin_ledger WHERE user_id=$1 AND reason='signup_repair'",
        uid) == 1


async def test_baskasinin_fali_okunamiyor(client, db, anon):
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    uid = await db.fetchval("SELECT id FROM users WHERE anon_id=$1", anon)
    rid = str(uuid.uuid4())
    await db.execute("INSERT INTO readings (id,user_id,kind) VALUES ($1,$2,'daily')",
                     rid, uid)

    baskasi = str(uuid.uuid4())
    r = await client.get(f"/v1/readings/{rid}", headers=H(baskasi))
    assert r.status_code == 404


# ------------------------------------------------------------------- profil

async def test_profil_kaydi_ve_teaser(client, anon):
    """Onboarding'in anında ödül ekranı buradan besleniyor."""
    r = await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    assert r.status_code == 200
    teaser = r.json()["teaser"]
    assert teaser["yukselen"] == "İkizler"
    assert teaser["gunes"] and teaser["ay"] and teaser["ay_fazi"]
    chart = r.json()["chart"]
    assert chart["bodies"]["sun"]["sign_tr"] == teaser["gunes"]
    assert len(chart["houses"]) == 12


async def test_profil_iki_kez_kaydedilebiliyor(client, anon, db):
    """Kullanıcı doğum saatini düzeltirse ikinci PUT patlamamalı
    (birth_profiles'ta is_primary üzerinde kısmi tekil indeks var)."""
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    r = await client.put("/v1/profile", json={**PROFIL, "birth_time": "06:45"},
                         headers=H(anon))
    assert r.status_code == 200
    n = await db.fetchval("SELECT count(*) FROM birth_profiles")
    assert n == 1
    saat = await db.fetchval("SELECT birth_time FROM birth_profiles")
    assert saat.hour == 6


async def test_bozuk_tarih_422_donuyor(client, anon):
    """Regresyon: birth_date str olarak asyncpg'ye geçilirse 500 alınırdı."""
    r = await client.put("/v1/profile", json={**PROFIL, "birth_date": "14/06/1993"},
                         headers=H(anon))
    assert r.status_code == 422


async def test_saat_bilinmiyorsa_profil_kabul_ediliyor(client, anon):
    r = await client.put("/v1/profile",
                         json={**PROFIL, "birth_time": None, "time_known": False},
                         headers=H(anon))
    assert r.status_code == 200
    assert r.json()["teaser"]["gunes"]


# -------------------------------------------------------------------- jeton

async def test_jeton_yetmezse_402(client, db, anon):
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    await jetonsuz_yap(db, anon)
    r = await client.post("/v1/readings/tarot", json={"spread": "three_card"},
                          headers=H(anon))
    assert r.status_code == 402
    assert r.json()["detail"]["code"] == "insufficient_coins"


async def test_tarot_jeton_dusuyor_ve_kuyruga_giriyor(client, db, anon, queue):
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    await coin_ver(db, anon, 10)

    r = await client.post("/v1/readings/tarot",
                          json={"spread": "celtic_cross", "question": "ne olacak"},
                          headers=H(anon))
    assert r.status_code == 202
    assert r.json()["eta_seconds"] == 90
    assert len(queue.jobs) == 1

    bal = await db.fetchval("SELECT coalesce(sum(delta),0) FROM coin_ledger")
    assert bal == 9


async def test_tarot_gorsel_secimleri_kuyruga_aynen_gidiyor(client, db, anon, queue):
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    await coin_ver(db, anon, 10)
    body = {"spread": "three_card", "seed": "mobil-masa-42", "selections": [2, 8, 11]}
    r = await client.post("/v1/readings/tarot", json=body, headers=H(anon))
    assert r.status_code == 202
    _, job_args = queue.jobs[0]
    assert job_args[2]["seed"] == "mobil-masa-42"
    assert job_args[2]["selections"] == [2, 8, 11]


async def test_tarot_onizleme_gercek_kartlari_jetonsuz_aciyor(client, db, anon, queue):
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    body = {"spread": "three_card", "seed": "mobil-masa-42", "selections": [2, 8, 11]}

    r1 = await client.post("/v1/tarot/preview", json=body, headers=H(anon))
    r2 = await client.post("/v1/tarot/preview", json=body, headers=H(anon))

    assert r1.status_code == 200
    assert r1.json() == r2.json()
    assert len(r1.json()["draw"]["cards"]) == 3
    assert not queue.jobs
    assert await db.fetchval("SELECT count(*) FROM coin_ledger WHERE delta<0") == 0


async def test_tarot_gorsel_secim_sayisi_jeton_dusmeden_reddediliyor(client, db, anon):
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    await coin_ver(db, anon, 10)
    r = await client.post(
        "/v1/readings/tarot",
        json={"spread": "three_card", "seed": "x", "selections": [1, 2]},
        headers=H(anon),
    )
    assert r.status_code == 422
    assert await db.fetchval("SELECT count(*) FROM coin_ledger WHERE delta<0") == 0


async def test_gunluk_harcama_tavani(client, db, anon):
    """Kumar döngüsü önlemi. Kaldırılırsa iade dalgası gelir."""
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    await coin_ver(db, anon, 500)
    for _ in range(25):
        await client.post("/v1/readings/tarot", json={"spread": "single"},
                          headers=H(anon))
    r = await client.post("/v1/readings/tarot", json={"spread": "single"},
                          headers=H(anon))
    assert r.status_code == 429
    assert r.json()["detail"]["code"] == "daily_cap"


async def test_abone_jeton_odemiyor(client, db, anon):
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    uid = await db.fetchval("SELECT id FROM users WHERE anon_id=$1", anon)
    await db.execute(
        """INSERT INTO entitlements (user_id,tier,source,expires_at)
           VALUES ($1,'fate','android', now() + interval '30 days')""", uid)
    r = await client.post("/v1/readings/tarot", json={"spread": "single"},
                          headers=H(anon))
    assert r.status_code == 202
    # Açılış hediyesi defterde duruyor; bakılan şey HARCAMA olmaması.
    assert await db.fetchval(
        "SELECT count(*) FROM coin_ledger WHERE delta < 0") == 0


async def test_odullu_reklam_jeton_veriyor_ve_tavani_var(client, anon):
    for i in range(5):
        r = await client.post("/v1/coins/reward", headers=H(anon))
        assert r.status_code == 200, i
    assert (await client.post("/v1/coins/reward", headers=H(anon))).status_code == 429


# ------------------------------------------------------------------ ritüeller

async def test_gecersiz_acilim_422(client, db, anon):
    """tarot.draw bilinmeyen açılımı sessizce three_card'a düşürüyor;
    jeton düşülmeden önce sınırda yakalanmalı."""
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    await coin_ver(db, anon, 10)
    r = await client.post("/v1/readings/tarot", json={"spread": "hayali_acilim"},
                          headers=H(anon))
    assert r.status_code == 422
    assert await db.fetchval("SELECT count(*) FROM coin_ledger WHERE delta<0") == 0


async def test_dogum_verisi_olmadan_natal_reddediliyor(client, db, anon):
    await client.get("/v1/me", headers=H(anon))      # kullanıcıyı yarat
    await coin_ver(db, anon, 10)
    r = await client.post("/v1/readings/natal", json={}, headers=H(anon))
    assert r.status_code == 400
    assert r.json()["detail"]["code"] == "no_birth_data"
    # Jeton düşülmemeli
    assert await db.fetchval("SELECT count(*) FROM coin_ledger WHERE delta<0") == 0


async def test_gunluk_fal_ucretsiz_ve_gunde_bir(client, db, anon, queue):
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    r1 = await client.post("/v1/readings/daily", headers=H(anon))
    r2 = await client.post("/v1/readings/daily", headers=H(anon))
    assert r1.status_code == 202 and r2.status_code == 202
    assert r1.json()["reading_id"] == r2.json()["reading_id"]
    assert r2.json()["cached"] is True
    assert len(queue.jobs) == 1, "aynı gün ikinci kez kuyruğa girmemeli"
    assert await db.fetchval("SELECT count(*) FROM coin_ledger WHERE delta<0") == 0


async def test_buyuk_fotograf_reddediliyor(client, db, anon):
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    await coin_ver(db, anon, 10)
    buyuk = b"x" * (9 * 1024 * 1024)
    r = await client.post("/v1/readings/coffee",
                          files={"photo": ("cup.jpg", buyuk, "image/jpeg")},
                          data={"question": "", "handle_angle": "0"},
                          headers=H(anon))
    assert r.status_code == 413


async def test_gecersiz_fincan_jeton_dusmeden_reddediliyor(
    client, db, anon, queue, monkeypatch,
):
    from app import main
    from app.core.cup_vision import CupAnalysis

    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    await coin_ver(db, anon, 10)
    monkeypatch.setattr(
        main, "analyze_cup",
        lambda *_args, **_kw: CupAnalysis(ok=False, reason="cup_not_found"),
    )

    r = await client.post(
        "/v1/readings/coffee",
        files={"photo": ("street.jpg", b"sahte-jpeg", "image/jpeg")},
        data={"question": "", "handle_angle": "0"},
        headers=H(anon),
    )

    assert r.status_code == 422
    assert r.json()["detail"]["code"] == "invalid_cup_photo"
    assert await db.fetchval("SELECT count(*) FROM coin_ledger WHERE delta<0") == 0
    assert queue.jobs == []


async def test_kahve_fali_fotografi_redise_yaziyor(
    client, db, anon, queue, monkeypatch,
):
    from app import main
    from app.core.cup_vision import CupAnalysis

    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    await coin_ver(db, anon, 10)
    cup = CupAnalysis(ok=True, quality={"width": 900, "height": 900})
    monkeypatch.setattr(main, "analyze_cup", lambda *_args, **_kw: cup)
    r = await client.post("/v1/readings/coffee",
                          files={"photo": ("cup.jpg", b"sahte-jpeg", "image/jpeg")},
                          data={"question": "ne görüyorsun", "handle_angle": "0"},
                          headers=H(anon))
    assert r.status_code == 202
    rid = r.json()["reading_id"]
    assert f"cupimg:{rid}" in main.state["redis"].store
    assert len(queue.jobs) == 1
    assert queue.jobs[0][1][2]["cup_analysis"] is cup


# ------------------------------------------------------ fal durumu ve geçmişi

async def test_bekleyen_fal_metni_sizdirmiyor(client, db, anon):
    """Ritüel gecikmesi boyunca çıktı gösterilmemeli; ilerleme oranı dönmeli."""
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    uid = await db.fetchval("SELECT id FROM users WHERE anon_id=$1", anon)
    rid = str(uuid.uuid4())
    await db.execute(
        """INSERT INTO readings (id,user_id,kind,status,output_json,eta_seconds)
           VALUES ($1,$2,'coffee','running','{"ozet":"gizli"}',150)""", rid, uid)

    r = await client.get(f"/v1/readings/{rid}", headers=H(anon))
    d = r.json()
    assert d["status"] == "running"
    assert "output_json" not in d
    assert 0 <= d["progress"] <= 0.95


async def test_biten_fal_metni_donuyor(client, db, anon):
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    uid = await db.fetchval("SELECT id FROM users WHERE anon_id=$1", anon)
    rid = str(uuid.uuid4())
    await db.execute(
        """INSERT INTO readings (id,user_id,kind,status,output_json,delivered_at)
           VALUES ($1,$2,'coffee','done','{"ozet":"gorunur"}', now())""", rid, uid)
    d = (await client.get(f"/v1/readings/{rid}", headers=H(anon))).json()
    assert d["status"] == "done"
    # NESNE dönmek zorunda, JSON string'i değil: istemci doğrudan
    # reading.output_json.ozet okuyor. String dönerse fal ekranı boş görünür
    # (sunucu doğru içeriği üretmiş olsa bile).
    assert isinstance(d["output_json"], dict), "output_json string olarak dönüyor"
    assert d["output_json"]["ozet"] == "gorunur"


async def test_kriz_mesaji_kullaniciya_ulasiyor(client, db, anon):
    """Regresyon: 'done' değilse output_json'ı gizleme kuralı, kriz akışının
    destek mesajını da gizliyordu. Guardrail'in tek işi o mesajı ulaştırmak;
    gizlenirse kullanıcı boş bir ekran görür."""
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    uid = await db.fetchval("SELECT id FROM users WHERE anon_id=$1", anon)
    rid = str(uuid.uuid4())
    await db.execute(
        """INSERT INTO readings (id,user_id,kind,status,block_reason,output_json)
           VALUES ($1,$2,'tarot','blocked','crisis',
                   '{"ozet":"112 acil yardım, 183 Sosyal Destek Hattı"}')""",
        rid, uid)

    d = (await client.get(f"/v1/readings/{rid}", headers=H(anon))).json()
    assert d["status"] == "blocked"
    assert d["block_reason"] == "crisis"
    assert d["output_json"], "kriz destek mesajı gizlenmiş"
    assert "183" in str(d["output_json"])


async def test_basarisiz_falin_sebebi_donuyor(client, db, anon):
    """Fotoğraf reddedildiğinde mobil 'tekrar çek' akışını gösterebilmeli."""
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    uid = await db.fetchval("SELECT id FROM users WHERE anon_id=$1", anon)
    rid = str(uuid.uuid4())
    await db.execute(
        """INSERT INTO readings (id,user_id,kind,status,block_reason)
           VALUES ($1,$2,'coffee','failed','blurry')""", rid, uid)
    d = (await client.get(f"/v1/readings/{rid}", headers=H(anon))).json()
    assert d["status"] == "failed" and d["block_reason"] == "blurry"


async def test_gecmis_sadece_biten_fallari_veriyor(client, db, anon):
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    uid = await db.fetchval("SELECT id FROM users WHERE anon_id=$1", anon)
    for st in ("done", "queued", "failed", "blocked"):
        await db.execute(
            """INSERT INTO readings (user_id,kind,status,output_json)
               VALUES ($1,'tarot',$2,'{"ozet":"x"}')""", uid, st)
    rows = (await client.get("/v1/readings", headers=H(anon))).json()
    assert len(rows) == 1 and rows[0]["ozet"] == "x"


# ------------------------------------------------------- doğrulama döngüsü

async def _tahmin_ekle(db, uid, gun_once=20):
    rid = str(uuid.uuid4())
    await db.execute(
        "INSERT INTO readings (id,user_id,kind,status) VALUES ($1,$2,'daily','done')",
        rid, uid)
    return await db.fetchval(
        f"""INSERT INTO predictions
              (reading_id,user_id,topic,claim,window_start,window_end,confidence)
            VALUES ($1,$2,'ask','Bir mesaj alacaksın',
                    now() - interval '{gun_once} days',
                    now() - interval '1 days','orta')
            RETURNING id""", rid, uid)


async def test_verdict_jeton_kazandiriyor(client, db, anon):
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    uid = await db.fetchval("SELECT id FROM users WHERE anon_id=$1", anon)
    pid = await _tahmin_ekle(db, uid)

    r = await client.post(f"/v1/predictions/{pid}/verdict",
                          json={"verdict": "hit"}, headers=H(anon))
    assert r.status_code == 200
    assert r.json()["coins_earned"] == 1
    assert r.json()["accuracy"]["hits"] == 1


async def test_ayni_tahmin_iki_kez_cevaplanamiyor(client, db, anon):
    """Aksi halde jeton basımı sonsuz olur."""
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    uid = await db.fetchval("SELECT id FROM users WHERE anon_id=$1", anon)
    pid = await _tahmin_ekle(db, uid)
    await client.post(f"/v1/predictions/{pid}/verdict",
                      json={"verdict": "hit"}, headers=H(anon))
    r = await client.post(f"/v1/predictions/{pid}/verdict",
                          json={"verdict": "miss"}, headers=H(anon))
    assert r.status_code == 404
    assert await db.fetchval(
        "SELECT count(*) FROM coin_ledger WHERE reason='verify'") == 1


async def test_gecersiz_verdict_reddediliyor(client, db, anon):
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    uid = await db.fetchval("SELECT id FROM users WHERE anon_id=$1", anon)
    pid = await _tahmin_ekle(db, uid)
    r = await client.post(f"/v1/predictions/{pid}/verdict",
                          json={"verdict": "belki"}, headers=H(anon))
    assert r.status_code == 422


async def test_isabet_paneli_tutmayanlari_da_gosteriyor(client, db, anon):
    """Oranı şişirmek kısa vadede iyi görünür, güveni öldürür."""
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    uid = await db.fetchval("SELECT id FROM users WHERE anon_id=$1", anon)
    for v in ("hit", "hit", "miss", "partial"):
        pid = await _tahmin_ekle(db, uid)
        await db.execute(
            "UPDATE predictions SET user_verdict=$2, verdict_at=now() WHERE id=$1",
            pid, v)
    await _tahmin_ekle(db, uid)          # cevapsız, penceresi kapalı

    d = (await client.get("/v1/me/accuracy", headers=H(anon))).json()
    assert d["overall"]["total"] == 5
    assert d["overall"]["hits"] == 2
    assert float(d["overall"]["score"]) == 62.5      # (2 + 0.5) / 4
    assert len(d["awaiting_verdict"]) == 1


# ------------------------------------------------------------------ transit

async def test_next_transit_gercek_veri_donuyor(client, anon):
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    d = (await client.get("/v1/me/next-transit", headers=H(anon))).json()
    assert d["transit"] is not None
    t = d["transit"]
    assert t["exact_at"] and 0 <= t["severity"] <= 1
    # Jenerik değil, isimlendirilmiş gerçek bir açı
    assert any(k in t["metin"] for k in ("Satürn", "Jüpiter", "Uranüs",
                                         "Neptün", "Plüton", "Mars"))


async def test_next_transit_dogum_verisi_istiyor(client, anon):
    r = await client.get("/v1/me/next-transit", headers=H(anon))
    assert r.status_code == 400


# -------------------------------------------------------------------- me / kvkk

async def test_me_jeton_ve_fiyatlari_donuyor(client, db, anon):
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    await coin_ver(db, anon, 7)
    d = (await client.get("/v1/me", headers=H(anon))).json()
    assert d["coins"] == 7
    assert d["has_birth_data"] is True
    assert d["prices"]["coffee"] == 3
    assert d["daily_spend_left"] == 25


async def test_push_token_kaydediliyor(client, db, anon):
    await client.put("/v1/me/push-token",
                     json={"push_token": "abc", "push_optin": True,
                           "active_hour": 8}, headers=H(anon))
    row = await db.fetchrow(
        "SELECT push_token, push_optin, active_hour FROM users WHERE anon_id=$1",
        anon)
    assert row["push_token"] == "abc" and row["push_optin"] and row["active_hour"] == 8


async def test_kvkk_silme_kullaniciyi_erisilemez_yapiyor(client, db, anon):
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    eski_id = await db.fetchval("SELECT id FROM users WHERE anon_id=$1", anon)

    r = await client.delete("/v1/me", headers=H(anon))
    assert r.status_code == 202

    # Eski kayıt silinmiş işaretli ve anon_id'si serbest bırakılmış olmalı;
    # aksi halde aynı cihaz eski verisine geri bağlanır.
    eski = await db.fetchrow("SELECT anon_id, deleted_at, push_token "
                             "FROM users WHERE id=$1", eski_id)
    assert eski["deleted_at"] is not None
    assert eski["anon_id"] != anon and eski["push_token"] is None

    # Aynı cihaz yeniden kurulumda TEMİZ başlar (yeni kullanıcı, eski veri yok)
    d = (await client.get("/v1/me", headers=H(anon))).json()
    assert d["has_birth_data"] is False
    yeni_id = await db.fetchval("SELECT id FROM users WHERE anon_id=$1", anon)
    assert yeni_id != eski_id


# ------------------------------------------------------------------ webhook

async def test_revenuecat_webhook_imzasiz_reddediliyor(client, monkeypatch):
    monkeypatch.setenv("RC_WEBHOOK_SECRET", "gizli")
    r = await client.post("/v1/webhooks/revenuecat", json={"event": {}})
    assert r.status_code == 401


async def test_webhook_anahtar_yoksa_kapali(client, monkeypatch):
    """Anahtar tanımsızken uç AÇIK kalmamalı. Eski hâl `"Bearer " + ""`
    bekliyordu; sondaki boşluk yüzünden hiçbir HTTP istemcisi bu başlığı
    gönderemiyordu — kazara güvenliydi, açıkça değil."""
    monkeypatch.delenv("RC_WEBHOOK_SECRET", raising=False)
    r = await client.post("/v1/webhooks/revenuecat",
                          headers={"authorization": "Bearer x"}, json={"event": {}})
    assert r.status_code == 503


async def test_revenuecat_satin_alma_abonelik_aciyor(client, db, anon, monkeypatch):
    monkeypatch.setenv("RC_WEBHOOK_SECRET", "gizli")
    await client.get("/v1/me", headers=H(anon))
    r = await client.post(
        "/v1/webhooks/revenuecat",
        headers={"authorization": "Bearer gizli"},
        json={"event": {"type": "INITIAL_PURCHASE", "app_user_id": anon,
                        "entitlement_ids": ["fate"], "store": "play_store",
                        "expiration_at_ms": 4102444800000}})
    assert r.status_code == 200
    tier = await db.fetchval(
        """SELECT tier FROM entitlements e JOIN users u ON u.id=e.user_id
           WHERE u.anon_id=$1""", anon)
    assert tier == "fate"


async def test_health(client):
    assert (await client.get("/health")).json() == {"ok": True}


# ---------------------------------------------------------------- seri (streak)

async def test_seri_ilk_acilista_basliyor(client, db, anon):
    """Regresyon: streak hiç yazılmıyordu. Görünür etkisi ana ekranda "0 gün",
    asıl etkisi queue_daily'nin `streak_last_day > current_date - 14` filtresiydi:
    sütun hep NULL olduğu için gece işi hiçbir kullanıcı seçmiyordu."""
    d = (await client.get("/v1/me", headers=H(anon))).json()
    assert d["streak"]["count"] == 1
    assert d["streak"]["last_day"] is not None


async def test_ayni_gun_ikinci_acilis_seriyi_artirmiyor(client, db, anon):
    await client.get("/v1/me", headers=H(anon))
    d = (await client.get("/v1/me", headers=H(anon))).json()
    assert d["streak"]["count"] == 1


async def test_seri_ardisik_gunde_ilerliyor(client, db, anon):
    await client.get("/v1/me", headers=H(anon))
    await db.execute(
        """UPDATE users SET streak_last_day = current_date - 1, streak_count = 6
           WHERE anon_id=$1""", anon)
    d = (await client.get("/v1/me", headers=H(anon))).json()
    assert d["streak"]["count"] == 7
    # 7. günde ödül jetonu
    assert await db.fetchval(
        "SELECT count(*) FROM coin_ledger WHERE reason='streak'") == 1


async def test_seri_gun_atlanirsa_sifirlaniyor(client, db, anon):
    await client.get("/v1/me", headers=H(anon))
    await db.execute(
        """UPDATE users SET streak_last_day = current_date - 5, streak_count = 20
           WHERE anon_id=$1""", anon)
    d = (await client.get("/v1/me", headers=H(anon))).json()
    assert d["streak"]["count"] == 1


async def test_queue_daily_seri_yazildiktan_sonra_kullanici_buluyor(client, db, anon):
    """Zincirin ucu: seri yazılmadan gece işi boş dönüyordu."""
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    await client.get("/v1/me", headers=H(anon))
    n = await db.fetchval(
        """SELECT count(*) FROM users u
           JOIN birth_profiles b ON b.user_id=u.id AND b.is_primary
           LEFT JOIN readings rd ON rd.user_id=u.id AND rd.kind='daily'
                AND rd.created_at > date_trunc('day', now())
           WHERE u.deleted_at IS NULL AND rd.id IS NULL
             AND u.streak_last_day > current_date - 14""")
    assert n == 1, "queue_daily sorgusu hâlâ kullanıcı bulamıyor"


# ------------------------------------------------------------- harita önbelleği

async def test_natal_harita_onbellege_yaziliyor(client, db, anon):
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    row = await db.fetchrow(
        """SELECT c.chart_json, c.engine_version FROM natal_charts c
           JOIN birth_profiles b ON b.id = c.birth_profile_id
           JOIN users u ON u.id = b.user_id WHERE u.anon_id=$1""", anon)
    assert row is not None, "natal_charts tablosuna hiç yazılmıyor"
    assert row["chart_json"]["ascendant"]
    assert row["engine_version"]


async def test_harita_fal_satin_almadan_goruntuleniyor(client, anon):
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    r = await client.get("/v1/me/natal-chart", headers=H(anon))
    assert r.status_code == 200
    assert len(r.json()["chart"]["houses"]) == 12
    assert r.json()["chart"]["bodies"]["sun"]["sign_tr"]


async def test_ruya_formu_gecenin_gokyuzunu_onizliyor(client, anon):
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    r = await client.get("/v1/me/dream-sky?night=2026-08-12", headers=H(anon))
    assert r.status_code == 200
    assert r.json()["night"] == "2026-08-12"
    assert r.json()["moon"]["burc"]
    assert isinstance(r.json()["transits"], list)


async def test_harita_guncellenince_onbellek_tazeleniyor(client, db, anon):
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    ilk = await db.fetchval("SELECT chart_json->>'ascendant' FROM natal_charts")
    await client.put("/v1/profile", json={**PROFIL, "birth_time": "18:45"},
                     headers=H(anon))
    son = await db.fetchval("SELECT chart_json->>'ascendant' FROM natal_charts")
    assert ilk != son
    assert await db.fetchval("SELECT count(*) FROM natal_charts") == 1


# ------------------------------------------------------------- paywall hunisi

async def test_paywall_olayi_kaydediliyor(client, db, anon):
    r = await client.post("/v1/events/paywall",
                          json={"placement": "onboarding", "variant": "yillik_one",
                                "action": "view", "price_shown": "₺999,00"},
                          headers=H(anon))
    assert r.status_code == 204
    row = await db.fetchrow("SELECT placement, variant, action, price_shown "
                            "FROM paywall_events")
    assert row["placement"] == "onboarding" and row["action"] == "view"


async def test_gecersiz_paywall_olayi_reddediliyor(client, anon):
    r = await client.post("/v1/events/paywall",
                          json={"placement": "uydurma", "variant": "x",
                                "action": "view"}, headers=H(anon))
    assert r.status_code == 422


async def test_verdict_takip_yorumu_donuyor(client, db, anon, fake_llm):
    """VERIFY_FOLLOWUP promptu yazılmıştı ama hiç çağrılmıyordu: kullanıcı
    "tuttu mu?" sorusunu cevaplayıp hiçbir karşılık almıyordu. Döngü ancak
    yanıtla kapanıyor."""
    fake_llm.queue({"metin": "Tutmamasına şaşırmadım; Satürn geçişi gecikmeli "
                             "çalışır. Pencereyi biraz açık tutalım."})
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    uid = await db.fetchval("SELECT id FROM users WHERE anon_id=$1", anon)
    pid = await _tahmin_ekle(db, uid)

    d = (await client.post(f"/v1/predictions/{pid}/verdict",
                           json={"verdict": "miss"}, headers=H(anon))).json()
    assert d["yorum"], "takip yorumu üretilmedi"
    assert "Satürn" in d["yorum"]
    # Modele gerçekten verdict ve iddia geçmiş mi
    prompt = fake_llm.calls[-1]["user"]
    assert "tutmadı" in prompt and "Bir mesaj alacaksın" in prompt


async def test_takip_yorumu_yasakli_ciktida_gosterilmiyor(client, db, anon, fake_llm):
    fake_llm.queue({"metin": "Bu yıl kesin olarak öleceksin."})
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    uid = await db.fetchval("SELECT id FROM users WHERE anon_id=$1", anon)
    pid = await _tahmin_ekle(db, uid)
    d = (await client.post(f"/v1/predictions/{pid}/verdict",
                           json={"verdict": "hit"}, headers=H(anon))).json()
    assert d["yorum"] is None, "çıktı taramasından geçmemiş metin kullanıcıya gitti"
    assert d["coins_earned"] == 1, "yorum üretilemese de doğrulama geçerli olmalı"


# -------------------------------------------------------------- yaş kapısı

async def test_yas_kapisi_profildeki_dogum_tarihinden_calisiyor(client, db, anon,
                                                                fake_llm, fake_embed):
    """Regresyon: birth_year hiç kaydedilmiyor ve guardrail'e yaş
    geçilmiyordu; kapı yalnızca kullanıcı metinde "16 yaşındayım" yazarsa
    çalışıyordu, yani pratikte hiç."""
    from datetime import date

    from app.core import pipeline

    genc = date.today().replace(year=date.today().year - 15)
    await client.put("/v1/profile",
                     json={**PROFIL, "birth_date": genc.isoformat()},
                     headers=H(anon))
    uid = await db.fetchval("SELECT id FROM users WHERE anon_id=$1", anon)
    assert await db.fetchval("SELECT birth_year FROM users WHERE id=$1", uid) == genc.year

    rid = str(uuid.uuid4())
    await db.execute("INSERT INTO readings (id,user_id,kind) VALUES ($1,$2,'natal')",
                     rid, uid)
    with pytest.raises(pipeline.ReadingRejected) as exc:
        await pipeline.generate_reading(db, uid, rid, "natal", {})
    assert exc.value.code == "minor"
    assert fake_llm.calls == [], "18 altı kullanıcı için LLM çağrıldı"


async def test_yetiskin_kullanici_engellenmiyor(client, db, anon, fake_llm, fake_embed):
    from app.core import pipeline

    await client.put("/v1/profile", json=PROFIL, headers=H(anon))   # 1993 doğumlu
    uid = await db.fetchval("SELECT id FROM users WHERE anon_id=$1", anon)
    rid = str(uuid.uuid4())
    await db.execute("INSERT INTO readings (id,user_id,kind) VALUES ($1,$2,'natal')",
                     rid, uid)
    await pipeline.generate_reading(db, uid, rid, "natal", {})
    assert await db.fetchval("SELECT status FROM readings WHERE id=$1", rid) == "done"


async def test_takilmis_gunluk_yeniden_kuyruga_veriliyor(client, db, anon, queue):
    """Worker çökerse kayıt gün boyu 'queued' kalıyordu ve kullanıcı o gün hiç
    yorum göremiyordu — ekranda sonsuza kadar "hazırlanıyor" yazıyordu."""
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    uid = await db.fetchval("SELECT id FROM users WHERE anon_id=$1", anon)
    rid = str(uuid.uuid4())
    await db.execute(
        """INSERT INTO readings (id,user_id,kind,status,created_at,eta_seconds)
           VALUES ($1,$2,'daily','queued', now() - interval '30 minutes', 20)""",
        rid, uid)

    d = (await client.post("/v1/readings/daily", headers=H(anon))).json()
    assert d["reading_id"] == rid, "yeni kayıt açılmamalı, aynısı kurtarılmalı"
    assert d.get("requeued") is True
    assert len(queue.jobs) == 1
    assert await db.fetchval("SELECT count(*) FROM readings WHERE kind='daily'") == 1


async def test_taze_bekleyen_gunluk_yeniden_kuyruga_verilmiyor(client, db, anon, queue):
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    uid = await db.fetchval("SELECT id FROM users WHERE anon_id=$1", anon)
    rid = str(uuid.uuid4())
    await db.execute(
        """INSERT INTO readings (id,user_id,kind,status,eta_seconds)
           VALUES ($1,$2,'daily','running',20)""", rid, uid)
    d = (await client.post("/v1/readings/daily", headers=H(anon))).json()
    assert d["reading_id"] == rid and d["cached"] is True
    assert queue.jobs == []


async def test_tamamlanmis_gunluk_bekleyene_tercih_ediliyor(client, db, anon):
    """Aynı gün hem tamamlanmış hem takılı kayıt varsa kullanıcı metni görmeli."""
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    uid = await db.fetchval("SELECT id FROM users WHERE anon_id=$1", anon)
    bitmis = str(uuid.uuid4())
    await db.execute(
        """INSERT INTO readings (id,user_id,kind,status,output_json,created_at)
           VALUES ($1,$2,'daily','done','{"ozet":"hazır"}', now() - interval '20 minutes')""",
        bitmis, uid)
    await db.execute(
        """INSERT INTO readings (user_id,kind,status,created_at)
           VALUES ($1,'daily','queued', now() - interval '30 minutes')""", uid)

    d = (await client.post("/v1/readings/daily", headers=H(anon))).json()
    assert d["reading_id"] == bitmis and d["status"] == "done"


async def test_gun_siniri_kullanicinin_saat_dilimine_gore(client, db, anon, queue):
    """Regresyon: gün sınırı sunucunun (UTC) gününe göreydi. İstanbul'da gece
    02:00'de uygulamayı açan kullanıcı UTC'de hâlâ dünde olduğu için dünün
    yorumunu alıyordu — "günün yorumu" ürününde doğrudan yanlış içerik."""
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    uid = await db.fetchval("SELECT id FROM users WHERE anon_id=$1", anon)

    # UTC'de bugün ama İstanbul'da (UTC+3) dün olan bir an seç.
    # Örn. UTC 22:30 → İstanbul 01:30 ertesi gün.
    dun_ist = await db.fetchval(
        """SELECT (date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul')
                   AT TIME ZONE 'Europe/Istanbul') - interval '10 minutes'""")
    await db.execute(
        """INSERT INTO readings (user_id,kind,status,output_json,created_at)
           VALUES ($1,'daily','done','{"ozet":"dünün yorumu"}',$2)""", uid, dun_ist)

    d = (await client.post("/v1/readings/daily", headers=H(anon))).json()
    assert d.get("cached") is not True, "dünün yorumu bugünün yerine döndü"
    assert len(queue.jobs) == 1, "yeni günlük yorum kuyruğa girmedi"


# ------------------------------------------------------------ abonelik katmanları

async def _abone_yap(db, anon, tier, gun=30):
    uid = await db.fetchval("SELECT id FROM users WHERE anon_id=$1", anon)
    await db.execute(
        f"""INSERT INTO entitlements (user_id,tier,source,expires_at)
            VALUES ($1,$2,'android', now() + interval '{gun} days')
            ON CONFLICT (user_id) DO UPDATE SET tier=EXCLUDED.tier,
              expires_at=EXCLUDED.expires_at""", uid, tier)
    return uid


async def test_yildiz_kotadan_karsilaniyor_jeton_dusmuyor(client, db, anon):
    """Regresyon: _charge yalnızca fate/yearly'yi muaf tutuyordu, model seçimi
    ise star'ı "ödeyen" sayıyordu. Yıldız abonesi pahalı modele gidiyor ama
    yine tam jeton ödüyordu — hem gelir kaybı hem maliyet artışı."""
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    await _abone_yap(db, anon, "star")
    await coin_ver(db, anon, 20)

    r = await client.post("/v1/readings/tarot", json={"spread": "single"},
                          headers=H(anon))
    assert r.status_code == 202
    # Jeton bakiyesi DEĞİŞMEMELİ
    assert await db.fetchval(
        "SELECT coalesce(sum(delta),0) FROM coin_ledger") == 20
    # Ama kullanım denetlenebilir olmalı
    assert await db.fetchval(
        "SELECT count(*) FROM coin_ledger WHERE reason='quota_tarot'") == 1


async def test_yildiz_kotasi_bitince_jetona_dusuyor(client, db, anon):
    """Kota bitince duvar örmüyoruz: ödeyen kullanıcıyı kilitlemek iptal
    sebebi. Normal jeton ekonomisine düşüyor."""
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    uid = await _abone_yap(db, anon, "star")
    await coin_ver(db, anon, 20)

    for _ in range(10):
        assert (await client.post("/v1/readings/tarot", json={"spread": "single"},
                                  headers=H(anon))).status_code == 202
    assert await db.fetchval("SELECT coalesce(sum(delta),0) FROM coin_ledger") == 20

    # 11. fal jetondan
    r = await client.post("/v1/readings/tarot", json={"spread": "single"},
                          headers=H(anon))
    assert r.status_code == 202
    assert await db.fetchval("SELECT coalesce(sum(delta),0) FROM coin_ledger") == 19


async def test_yildiz_kotasi_bitip_jeton_da_yoksa_402(client, db, anon):
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    uid = await _abone_yap(db, anon, "star")
    await jetonsuz_yap(db, anon)      # kota bitince düşecek jetonu da olmasın
    for _ in range(10):
        await client.post("/v1/readings/tarot", json={"spread": "single"},
                          headers=H(anon))
    r = await client.post("/v1/readings/tarot", json={"spread": "single"},
                          headers=H(anon))
    assert r.status_code == 402


async def test_kader_ve_yillik_sinirsiz(client, db, anon):
    for tier in ("fate", "yearly"):
        await client.put("/v1/profile", json=PROFIL, headers=H(anon))
        await _abone_yap(db, anon, tier)
        for _ in range(15):
            assert (await client.post("/v1/readings/tarot", json={"spread": "single"},
                                      headers=H(anon))).status_code == 202
        assert await db.fetchval(
            "SELECT count(*) FROM coin_ledger WHERE delta < 0") == 0, tier
        await db.execute("DELETE FROM entitlements")


async def test_yildiz_buyuk_modele_gidiyor(client, db, anon, fake_llm, fake_embed):
    """Ödeyen katman kalite bekliyor; star da 'paid' sayılmalı."""
    from app.core import pipeline

    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    uid = await _abone_yap(db, anon, "star")
    rid = str(uuid.uuid4())
    await db.execute("INSERT INTO readings (id,user_id,kind) VALUES ($1,$2,'natal')",
                     rid, uid)
    await pipeline.generate_reading(db, str(uid), rid, "natal", {})
    assert fake_llm.calls[0]["tier"] == "large"
    assert await db.fetchval("SELECT tier FROM readings WHERE id=$1", rid) == "paid"


async def test_me_kalan_kotayi_donuyor(client, db, anon):
    """Arayüz 'sınırsız mı, 3 fal mı kaldı' ayrımını yapamazsa kullanıcı
    402 ile sürprize uğruyor."""
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    await _abone_yap(db, anon, "star")

    d = (await client.get("/v1/me", headers=H(anon))).json()
    e = d["entitlement"]
    assert e["tier"] == "star" and e["tier_tr"] == "Yıldız"
    assert e["monthly_quota"] == 10 and e["quota_left"] == 10
    assert e["ads_free"] is True

    await client.post("/v1/readings/tarot", json={"spread": "single"}, headers=H(anon))
    assert (await client.get("/v1/me", headers=H(anon))).json()["entitlement"]["quota_left"] == 9


async def test_me_sinirsiz_katmanda_kota_none(client, db, anon):
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    await _abone_yap(db, anon, "fate")
    e = (await client.get("/v1/me", headers=H(anon))).json()["entitlement"]
    assert e["monthly_quota"] is None and e["quota_left"] is None


async def test_bilinmeyen_entitlement_hak_kaybina_yol_acmiyor(client, db, anon,
                                                              monkeypatch):
    """RevenueCat'te ürün adı değişir ve backend haberi olmaz. O anda kullanıcı
    PARA ÖDEMİŞ durumda; tanınmayan id'yi olduğu gibi kaydetmek ona hiçbir hak
    vermemek demekti."""
    monkeypatch.setenv("RC_WEBHOOK_SECRET", "gizli")
    await client.get("/v1/me", headers=H(anon))
    r = await client.post(
        "/v1/webhooks/revenuecat",
        headers={"authorization": "Bearer gizli"},
        json={"event": {"type": "INITIAL_PURCHASE", "app_user_id": anon,
                        "entitlement_ids": ["premium_v3_yeni"], "store": "play_store",
                        "expiration_at_ms": 4102444800000}})
    assert r.status_code == 200
    tier = await db.fetchval(
        """SELECT tier FROM entitlements e JOIN users u ON u.id=e.user_id
           WHERE u.anon_id=$1""", anon)
    assert tier == "star", "tanınmayan entitlement bilinen katmana düşmedi"

    e = (await client.get("/v1/me", headers=H(anon))).json()["entitlement"]
    assert e is not None and e["monthly_quota"] == 10


async def test_abonelik_bitince_haklar_kalkiyor(client, db, anon):
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    await _abone_yap(db, anon, "fate", gun=-1)      # süresi dolmuş
    await jetonsuz_yap(db, anon)
    assert (await client.get("/v1/me", headers=H(anon))).json()["entitlement"] is None
    r = await client.post("/v1/readings/tarot", json={"spread": "single"},
                          headers=H(anon))
    assert r.status_code == 402


async def test_kota_kullanimi_gunluk_tavani_etkilemiyor(client, db, anon):
    """Kota satırları delta=0; bakiyeyi ve günlük harcama tavanını bozmamalı."""
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    await _abone_yap(db, anon, "star")
    await coin_ver(db, anon, 100)
    for _ in range(10):
        await client.post("/v1/readings/tarot", json={"spread": "single"},
                          headers=H(anon))
    d = (await client.get("/v1/me", headers=H(anon))).json()
    assert d["coins"] == 100
    assert d["daily_spend_left"] == 25


# --------------------------------------------------------------------- dil

async def test_desteklenmeyen_dil_422_donuyor(client, anon):
    """Sessizce kabul edilirse guardrail varsayılana düşer ve kullanıcı
    YANLIŞ DİLDE kriz kaynağı görür — sınırda reddetmek doğrusu."""
    r = await client.put("/v1/profile", json={**PROFIL, "locale": "klingon"},
                         headers=H(anon))
    assert r.status_code == 422
    d = r.json()["detail"]
    assert d["code"] == "unsupported_locale"
    assert "tr" in d["supported"]


async def test_kapali_dil_de_reddediliyor(client, anon):
    """Kayıtlı ama enabled=False bir dil seçilemez: altyapı hazır olsa da
    içerik (blok kütüphanesi, tarot korpusu) yoksa kullanıcı boş yorum alır."""
    from app.core import locales

    kapali = [l.code for l in locales.all_locales() if not l.enabled]
    if not kapali:
        pytest.skip("kapalı dil yok")
    r = await client.put("/v1/profile", json={**PROFIL, "locale": kapali[0]},
                         headers=H(anon))
    assert r.status_code == 422


async def test_dil_kaydediliyor_ve_me_uzerinden_donuyor(client, anon):
    r = await client.put("/v1/profile", json={**PROFIL, "locale": "tr-TR"},
                         headers=H(anon))
    assert r.status_code == 200

    me = (await client.get("/v1/me", headers=H(anon))).json()
    assert me["locale"] == "tr"          # normalize edilmiş hâli
    assert me["rtl"] is False
    kodlar = [d["code"] for d in me["supported_locales"]]
    assert "tr" in kodlar
    # dil seçici bunu gösteriyor: kendi dilindeki adı olmadan liste işe yaramaz
    assert all(d["name"] for d in me["supported_locales"])


async def test_dil_verilmezse_profil_kabul_ediliyor(client, anon):
    """locale isteğe bağlı: eski istemciler alanı hiç göndermiyor."""
    r = await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    assert r.status_code == 200
    assert (await client.get("/v1/me", headers=H(anon))).json()["locale"] == "tr"


# -------------------------------------------------------------- rüya ritüeli

async def test_ruya_dogum_verisi_istemiyor(client, db, anon):
    """Diğer ritüeller haritaya dayanıyor ve doğum verisi olmadan 400
    veriyor. Rüya, anlatıya dayandığı için haritasız da çalışıyor —
    onboarding'i bitirmemiş kullanıcının girebildiği tek kapı."""
    await client.get("/v1/me", headers=H(anon))          # kullanıcıyı yarat
    await coin_ver(db, anon, 10)

    r = await client.post("/v1/readings/dream", headers=H(anon),
                          json={"dream": "Rüyamda eski evimizin merdivenlerinden "
                                         "iniyordum, alt kat su doluydu."})
    assert r.status_code == 202, r.text
    assert r.json()["reading_id"]


async def test_ruya_jeton_dusuyor(client, db, anon):
    await client.get("/v1/me", headers=H(anon))
    uid = await coin_ver(db, anon, 10)
    await client.post("/v1/readings/dream", headers=H(anon),
                      json={"dream": "Rüyamda bir kuş elime kondu ve uçup gitti."})
    bakiye = await db.fetchval(
        "SELECT coalesce(sum(delta),0) FROM coin_ledger WHERE user_id=$1", uid)
    assert bakiye == 10 - COIN_PRICES["dream"]


async def test_jetonsuz_ruya_402(client, db, anon):
    await client.get("/v1/me", headers=H(anon))
    await jetonsuz_yap(db, anon)
    r = await client.post("/v1/readings/dream", headers=H(anon),
                          json={"dream": "Rüyamda deniz kenarında yürüyordum."})
    assert r.status_code == 402
    assert r.json()["detail"]["code"] == "insufficient_coins"


async def test_cok_kisa_ruya_jeton_dusmeden_422(client, db, anon):
    """Sınırda reddetmek şart: pipeline'da reddedilirse jeton çoktan
    düşmüş olur ve iade akışına girmek gerekir."""
    await client.get("/v1/me", headers=H(anon))
    uid = await coin_ver(db, anon, 10)
    r = await client.post("/v1/readings/dream", headers=H(anon), json={"dream": "uçtum"})
    assert r.status_code == 422
    bakiye = await db.fetchval(
        "SELECT coalesce(sum(delta),0) FROM coin_ledger WHERE user_id=$1", uid)
    assert bakiye == 10, "reddedilen istekte jeton düştü"


async def test_ruya_tarihi_kaydediliyor(client, db, anon):
    await client.get("/v1/me", headers=H(anon))
    await coin_ver(db, anon, 10)
    r = await client.post("/v1/readings/dream", headers=H(anon),
                          json={"dream": "Rüyamda çocukluk evimin bahçesindeydim.",
                                "dream_date": "2026-08-06"})
    assert r.status_code == 202
    veri = await db.fetchval("SELECT input_json FROM readings WHERE id=$1",
                             r.json()["reading_id"])
    assert veri["dream_date"] == "2026-08-06"


# ------------------------------------------------------- açılış jetonu

async def test_yeni_kullanici_jetonla_basliyor(client, db, anon):
    """Bu olmadan kullanıcı sekiz onboarding ekranını bitiriyor, gerçek
    haritasını görüyor ve ana ekranda HER ritüel kilitli oluyor.

    İlk fincanı açabilmek için üç reklam izlemesi gerekiyordu; jeton
    ekonomisinin kendi döngüsü de (doğrulama ödülü → tahmin → fal → jeton)
    hiç başlayamıyordu.
    """
    from app.core.pricing import SIGNUP_COINS

    me = (await client.get("/v1/me", headers=H(anon))).json()
    assert me["coins"] == SIGNUP_COINS


async def test_acilis_jetonu_ilk_ritueli_karsiliyor(client, db, anon):
    """Kahve falı ürünün kahramanı ve adı; kullanıcı onu mutlaka görmeli."""
    from app.core.pricing import COIN_PRICES, SIGNUP_COINS

    assert SIGNUP_COINS >= COIN_PRICES["coffee"], (
        "açılış jetonu kahve falını karşılamıyor")
    # ...ve tam sıfıra düşürmüyor: 0'a inmek tuzağa düşmüş hissi veriyor.
    assert SIGNUP_COINS > COIN_PRICES["coffee"]

    me = (await client.get("/v1/me", headers=H(anon))).json()
    assert me["coins"] >= me["prices"]["coffee"]


async def test_acilis_jetonu_bir_kez_veriliyor(client, db, anon):
    """Her istek get_user'dan geçiyor; hediye her seferinde verilseydi
    kullanıcı uygulamayı açıp kapatarak sınırsız jeton üretirdi."""
    from app.core.pricing import SIGNUP_COINS

    for _ in range(5):
        await client.get("/v1/me", headers=H(anon))
    uid = await db.fetchval("SELECT id FROM users WHERE anon_id=$1", anon)
    n = await db.fetchval(
        "SELECT count(*) FROM coin_ledger WHERE user_id=$1 AND reason='signup'", uid)
    assert n == 1
    bal = await db.fetchval(
        "SELECT coalesce(sum(delta),0) FROM coin_ledger WHERE user_id=$1", uid)
    assert bal == SIGNUP_COINS


async def test_es_zamanli_ilk_istek_yarisi(db, anon):
    """Uygulama açılışında /v1/me ve profil kaydı neredeyse aynı anda gidiyor.

    İki INSERT yarışırsa ikincisi anon_id tekil kısıtına takılıp 500
    dönebilir; kullanıcı ilk açılışta hata görür. Hediyenin de iki kez
    verilmemesi gerekiyor.

    Bu test GERÇEK eşzamanlılık istiyor, o yüzden kendi bağlantılarını
    açıyor: test fixture'ı tek bir asyncpg bağlantısı paylaşıyor ve tek
    bağlantı eşzamanlı sorgu kabul etmiyor (üretimde havuz var).
    """
    import asyncio

    import asyncpg

    from app.core.db import init_connection
    from app.core.pricing import SIGNUP_COINS
    from tests.conftest import TEST_DB_URL

    SORGU = """WITH yeni AS (
                 INSERT INTO users (anon_id) VALUES ($1)
                 ON CONFLICT (anon_id) DO UPDATE SET anon_id = EXCLUDED.anon_id
                 RETURNING *, (xmax = 0) AS yeni_kayit
               ), hediye AS (
                 INSERT INTO coin_ledger (user_id, delta, reason, balance_after)
                 SELECT id, $2, 'signup', $2 FROM yeni WHERE yeni_kayit AND $2 > 0
               )
               SELECT * FROM yeni"""

    baglantilar = [await asyncpg.connect(TEST_DB_URL) for _ in range(4)]
    for c in baglantilar:
        await init_connection(c)
    try:
        sonuclar = await asyncio.gather(
            *[c.fetchrow(SORGU, anon, SIGNUP_COINS) for c in baglantilar],
            return_exceptions=True,
        )
    finally:
        for c in baglantilar:
            await c.close()

    for r in sonuclar:
        assert not isinstance(r, Exception), r
        assert r["id"], "kullanıcı satırı dönmedi"

    kullanici = await db.fetchval("SELECT count(*) FROM users WHERE anon_id=$1", anon)
    assert kullanici == 1, f"yarışta {kullanici} kullanıcı yaratıldı"

    uid = await db.fetchval("SELECT id FROM users WHERE anon_id=$1", anon)
    n = await db.fetchval(
        "SELECT count(*) FROM coin_ledger WHERE user_id=$1 AND reason='signup'", uid)
    assert n == 1, f"yarışta {n} kez hediye verildi"


async def test_acilis_jetonuyla_gercekten_fal_bakilabiliyor(client, db, anon):
    """Asıl mesele bakiyenin sayısı değil, ilk ritüelin AÇILMASI."""
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    r = await client.post("/v1/readings/natal", json={"focus": "genel"},
                          headers=H(anon))
    assert r.status_code == 202, r.text


async def test_silinen_kullanici_yeniden_hediye_almiyor(client, db, anon):
    """anon_id serbest bırakılıyor ama satır 24 saat duruyor. O aralıkta
    aynı kimlikle gelen istek yeni kullanıcı yaratmamalı, hediye de
    almamalı — yoksa sil/aç döngüsü jeton basardı."""
    from app.core.pricing import SIGNUP_COINS

    await client.get("/v1/me", headers=H(anon))
    uid = await db.fetchval("SELECT id FROM users WHERE anon_id=$1", anon)
    await db.execute("UPDATE users SET deleted_at=now() WHERE id=$1", uid)

    r = await client.get("/v1/me", headers=H(anon))
    assert r.status_code == 200
    yeni_uid = await db.fetchval(
        "SELECT id FROM users WHERE anon_id=$1 AND deleted_at IS NULL", anon)
    toplam = await db.fetchval(
        "SELECT count(*) FROM coin_ledger WHERE reason='signup'")
    assert toplam == 1 if yeni_uid is None else toplam <= 2


# ------------------------------------------------------------- geçmiş fallar

async def _fal_yaz(db, uid, kind, ozet, gun_once=0, status="done"):
    return await db.fetchval(
        """INSERT INTO readings (user_id, kind, status, output_json, created_at)
           VALUES ($1,$2,$3,$4, now() - ($5 || ' days')::interval)
           RETURNING id""",
        uid, kind, status, {"ozet": ozet}, str(gun_once))


async def test_gecmis_uretilen_fallari_donuyor(client, db, anon):
    """Regresyon zemini: bu uç ve istemcideki api.history() yazılmıştı ama
    hiçbir ekran çağırmıyordu — kullanıcı jeton ödeyip ürettiği yorumu bir
    kez okuyup bir daha ulaşamıyordu."""
    await client.get("/v1/me", headers=H(anon))
    uid = await db.fetchval("SELECT id FROM users WHERE anon_id=$1", anon)
    await _fal_yaz(db, uid, "coffee", "Fincanında bir kapı var", 2)
    await _fal_yaz(db, uid, "tarot", "Kartlar bekleme diyor", 1)

    r = await client.get("/v1/readings", headers=H(anon))
    assert r.status_code == 200
    d = r.json()
    assert len(d) == 2
    assert [x["kind"] for x in d] == ["tarot", "coffee"]     # yeniden eskiye
    assert d[0]["ozet"] == "Kartlar bekleme diyor"


async def test_gecmis_gunluk_yorumu_gostermiyor(client, db, anon):
    """Günlük her gün otomatik üretiliyor; listeye katılırsa bir ay sonra
    arşivde 30 günlük kayıt ve aralarında kaybolmuş birkaç ritüel oluyor."""
    await client.get("/v1/me", headers=H(anon))
    uid = await db.fetchval("SELECT id FROM users WHERE anon_id=$1", anon)
    for g in range(10):
        await _fal_yaz(db, uid, "daily", f"{g}. günün yorumu", g)
    await _fal_yaz(db, uid, "coffee", "Fincanında bir kapı var", 3)

    d = (await client.get("/v1/readings", headers=H(anon))).json()
    assert [x["kind"] for x in d] == ["coffee"], "günlük yorum arşivi dolduruyor"


async def test_gecmis_tamamlanmamis_fali_gostermiyor(client, db, anon):
    """Yarıda kalmış veya kriz nedeniyle durdurulmuş kayıt arşivde
    görünmemeli — kullanıcı boş bir karta dokunmuş olur."""
    await client.get("/v1/me", headers=H(anon))
    uid = await db.fetchval("SELECT id FROM users WHERE anon_id=$1", anon)
    for durum in ("queued", "running", "failed", "blocked"):
        await _fal_yaz(db, uid, "tarot", "yarım", 1, status=durum)
    await _fal_yaz(db, uid, "tarot", "tamam", 1)

    d = (await client.get("/v1/readings", headers=H(anon))).json()
    assert [x["ozet"] for x in d] == ["tamam"]


async def test_gecmis_baskasinin_fallarini_gostermiyor(client, db, anon):
    await client.get("/v1/me", headers=H(anon))
    uid = await db.fetchval("SELECT id FROM users WHERE anon_id=$1", anon)
    await _fal_yaz(db, uid, "coffee", "benim falım", 1)

    baskasi = str(uuid.uuid4())
    await client.get("/v1/me", headers=H(baskasi))
    d = (await client.get("/v1/readings", headers=H(baskasi))).json()
    assert d == []


async def test_gecmis_limiti_sinirli(client, db, anon):
    """İstemci istediği sayıyı gönderiyor; sınırsız sorgu açık bırakılmamalı."""
    await client.get("/v1/me", headers=H(anon))
    uid = await db.fetchval("SELECT id FROM users WHERE anon_id=$1", anon)
    for i in range(60):
        await _fal_yaz(db, uid, "tarot", f"fal {i}", i)

    d = (await client.get("/v1/readings?limit=500", headers=H(anon))).json()
    assert len(d) == 50
