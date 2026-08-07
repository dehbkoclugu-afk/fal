"""
Fal üretim boru hattı.

Sıra sabittir ve atlanamaz:
  guardrail → bağlam toplama → üretim → çıktı taraması → anti-tekrar → tahmin ayıklama → kayıt

Bu dosya worker içinde çalışır (senkron HTTP yanıtında değil). Kullanıcı
"fincanın okunuyor" animasyonunu görürken iş burada döner. Ritüel gecikmesi
sadece atmosfer değil; kuyruk mimarisine ve maliyet düzleştirmeye izin veriyor.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

from . import astro, blocks, guardrail, prompts, tarot
from .pricing import PAID_TIERS, normalize_tier, normalize_topic
from .cup_vision import SYMBOL_LEXICON_TR, analyze_cup, REJECT_MESSAGES_TR
from .llm import complete, embed, label_symbols, too_similar

MAX_REGEN = 2


class ReadingRejected(Exception):
    def __init__(self, code: str, message: str):
        self.code, self.message = code, message
        super().__init__(message)


class CrisisIntercept(Exception):
    def __init__(self, reply: str):
        self.reply = reply
        super().__init__("crisis")


# ------------------------------------------------------------ bağlam toplayıcı

async def build_user_ctx(db, user_id: str) -> dict:
    row = await db.fetchrow(
        """SELECT u.first_name, u.locale, u.tone, u.relationship_status,
                  u.focus_topic, u.birth_year, e.tier,
                  b.birth_date, b.birth_time, b.time_known, b.lat, b.lon, b.tz_name
           FROM users u
           LEFT JOIN entitlements e ON e.user_id = u.id AND e.expires_at > now()
           LEFT JOIN birth_profiles b ON b.user_id = u.id AND b.is_primary
           WHERE u.id = $1""", user_id)
    if not row:
        raise ReadingRejected("no_user", "Kullanıcı bulunamadı.")
    return dict(row)


def _age_from(row: dict) -> int | None:
    """Profildeki doğum verisinden yaş. Yaş kapısının gerçek kaynağı burası."""
    bd = row.get("birth_date")
    if bd:
        t = datetime.now(timezone.utc).date()
        return t.year - bd.year - ((t.month, t.day) < (bd.month, bd.day))
    if yil := row.get("birth_year"):
        return datetime.now(timezone.utc).year - int(yil)
    return None


async def build_memory_ctx(db, user_id: str, limit: int = 6) -> str:
    """Uzun süreli hafıza — 'hafızası olan danışman' farklılaşmasının kaynağı."""
    rows = await db.fetch(
        """SELECT kind, key, summary FROM memories
           WHERE user_id = $1 ORDER BY salience DESC, last_seen DESC LIMIT $2""",
        user_id, limit)
    if not rows:
        return ""
    return "\n".join(f"- {r['kind']}: {r['key']} → {r['summary']}" for r in rows)


def _chart_from_row(row: dict) -> astro.Chart | None:
    if not row.get("birth_date"):
        return None
    bd, bt = row["birth_date"], row.get("birth_time")
    b = astro.BirthInput(
        year=bd.year, month=bd.month, day=bd.day,
        hour=bt.hour if bt else 12, minute=bt.minute if bt else 0,
        lat=row.get("lat") or 41.0082, lon=row.get("lon") or 28.9784,
        tz_name=row.get("tz_name") or "Europe/Istanbul",
        time_known=bool(row.get("time_known")),
    )
    return astro.compute_chart(b)


async def cache_chart(db, birth_profile_id, chart: astro.Chart) -> None:
    """Hesaplanmış haritayı natal_charts'a yazar.

    Ephemeris hesabı ucuz (~5 ms) ama harita JSON'u analiz için de değerli:
    hangi göstergenin hangi kullanıcıda olduğu, tahmin isabetiyle
    ilişkilendirilebilir hale geliyor. engine_version ile birlikte yazılıyor
    ki motor değişince eski haritalar ayırt edilebilsin.
    """
    if not birth_profile_id:
        return
    await db.execute(
        """INSERT INTO natal_charts (birth_profile_id, chart_json, engine_version)
           VALUES ($1,$2,$3)
           ON CONFLICT (birth_profile_id) DO UPDATE
             SET chart_json=EXCLUDED.chart_json,
                 engine_version=EXCLUDED.engine_version,
                 calculated_at=now()""",
        birth_profile_id, chart.to_dict(),
        chart.meta.get("engine_version", "1.0.0"))


# ------------------------------------------------------------------- ana akış

async def generate_reading(db, user_id: str, reading_id: str, kind: str,
                           inputs: dict) -> dict:
    """kind: coffee | tarot | natal | daily"""
    question = (inputs.get("question") or "").strip()

    # 1) GUARDRAIL — üretimden önce, istisnasız.
    #
    # Kullanıcı bağlamı guardrail'den ÖNCE okunuyor çünkü yaş kapısı profildeki
    # doğum verisine dayanıyor; sadece inputs'a bakmak, kapının yalnızca
    # kullanıcı metinde "16 yaşındayım" yazarsa çalışması demekti. Bu bir DB
    # okuması, üretim değil — sıra kuralı bozulmuyor.
    user = await build_user_ctx(db, user_id)
    yas = inputs.get("age") or _age_from(user)

    g = guardrail.check(question, user_age=yas)
    if g["action"] == guardrail.Action.BLOCK_CRISIS:
        await db.execute(
            "UPDATE readings SET status='blocked', block_reason='crisis' WHERE id=$1",
            reading_id)
        raise CrisisIntercept(g["reply"])
    if g["action"] == guardrail.Action.BLOCK_MINOR:
        raise ReadingRejected("minor", g["reply"])

    # Tek kaynak: pricing.PAID_TIERS. Buradaki liste elle yazıldığında
    # katman tanımı iki yere dağılıyor ve tam olarak Yıldız hatası çıkıyor
    # (model seçimi star'ı ödeyen sayıyor, jeton düşümü saymıyordu).
    tier = "paid" if normalize_tier(user.get("tier")) in PAID_TIERS else "free"
    memory = await build_memory_ctx(db, user_id)
    chart = _chart_from_row(user)

    user_ctx = {
        "ad": user.get("first_name"),
        "iliski": user.get("relationship_status"),
        "odak": user.get("focus_topic"),
    }
    sys = prompts.system_prompt(tier=tier, tone=user.get("tone") or "mistik",
                               extra_note=g.get("note"))

    # 2) RİTÜELE GÖRE BAĞLAM + PROMPT
    extra: dict[str, Any] = {}

    if kind == "coffee":
        img_bytes = inputs["image_bytes"]
        cup = analyze_cup(img_bytes, handle_angle_deg=inputs.get("handle_angle", 0.0))
        if not cup.ok:
            raise ReadingRejected(
                cup.reason, REJECT_MESSAGES_TR.get(cup.reason, "Fotoğrafı tekrar çeker misin?"))
        await label_symbols(cup.blobs, SYMBOL_LEXICON_TR)
        user_msg = prompts.coffee_prompt(cup.llm_context(), user_ctx, memory, question)
        extra = {"cup": cup.to_dict(), "overlay": cup.overlay}

    elif kind == "tarot":
        drawn = tarot.draw(inputs.get("spread", "three_card"), inputs.get("seed"))
        user_msg = prompts.tarot_prompt(tarot.llm_context(drawn), user_ctx, memory, question)
        extra = {"draw": drawn}

    elif kind == "natal":
        if not chart:
            raise ReadingRejected("no_birth_data", "Doğum bilgilerini tamamlaman gerekiyor.")
        user_msg = prompts.natal_prompt(chart.llm_context(), user_ctx,
                                        inputs.get("focus", "genel"), memory)
        extra = {"chart": chart.to_dict()}

    elif kind == "daily":
        if not chart:
            raise ReadingRejected("no_birth_data", "Doğum bilgilerini tamamlaman gerekiyor.")
        today = datetime.now(timezone.utc)
        trs = astro.transits_for(chart, today)[:3]
        day_bucket = today.toordinal()

        # Ücretsiz kullanıcı → hibrit blok üretimi (5x daha ucuz)
        if tier == "free":
            keys = astro.condition_keys(chart)
            # g["note"] burada da geçmek ZORUNDA: ücretsiz günlük yol
            # kullanıcıların çoğunluğunun geçtiği yol ve guardrail'in yumuşak
            # kısıtı (sağlık/hukuk/şiddet) buradan düşerse hiçbir yerde
            # uygulanmamış olur.
            out = await blocks.compose_free(
                db, user_id, user_ctx, keys, user.get("locale") or "tr",
                day_bucket, transits=trs, extra_note=g.get("note"))
            return await _finalize(db, user_id, reading_id, kind,
                                   _normalize_hybrid(out), {"transits": trs},
                                   cost=out.get("_cost", 0.0), tier=tier)

        user_msg = prompts.DAILY_USER.format(
            transits=json.dumps(trs, ensure_ascii=False),
            moon=chart.moon_phase["name_tr"],
            chart_brief=json.dumps(chart.llm_context()["gezegenler"][:4], ensure_ascii=False),
            user=json.dumps(user_ctx, ensure_ascii=False))
        extra = {"transits": trs}
    else:
        raise ReadingRejected("unknown_kind", "Bilinmeyen fal türü.")

    # 3) ÜRETİM + ÇIKTI TARAMASI + ANTİ-TEKRAR
    recent = await db.fetch(
        """SELECT embedding FROM readings
           WHERE user_id=$1 AND status='done' AND embedding IS NOT NULL
           ORDER BY created_at DESC LIMIT 10""", user_id)
    # pgvector codec ndarray[float32] döner; cosine() saf float listesiyle çalışır.
    recent_vecs = [[float(x) for x in r["embedding"]] for r in recent]

    max_tokens = 2400 if tier == "paid" else 900
    total_cost = 0.0
    data = None
    for attempt in range(MAX_REGEN + 1):
        res = await complete(system=sys, user=user_msg,
                             tier="large" if tier == "paid" else "small",
                             max_tokens=max_tokens,
                             temperature=0.95 - attempt * 0.2)
        total_cost += res.cost_usd
        if not res.data:
            continue
        flat = _flatten(res.data)
        if bad := guardrail.scan_output(flat):
            user_msg += f"\n\nÖNCEKİ DENEME REDDEDİLDİ ({', '.join(bad)}). Bu ihlali yapmadan yeniden yaz."
            continue
        vec = await embed(flat)
        if recent_vecs and too_similar(vec, recent_vecs):
            user_msg += ("\n\nÖNCEKİ DENEME kullanıcının geçmiş yorumlarına çok benziyordu. "
                         "Tamamen farklı imge ve açıdan yaz.")
            continue
        data = res.data
        data["_embedding"] = vec
        break

    if data is None:
        raise ReadingRejected("generation_failed",
                              "Şu an yorum üretemedim, birazdan tekrar dene.")
    return await _finalize(db, user_id, reading_id, kind, data, extra,
                           cost=total_cost, tier=tier)


def _normalize_hybrid(out: dict) -> dict:
    """Hibrit çıktıyı standart şemaya çevirir."""
    t = out.get("tahmin")
    return {
        "ozet": out.get("ozet", ""),
        "bolumler": [{"baslik": "Bugün", "metin": out.get("metin", "")}],
        "tahminler": [t] if t else [],
        "tavsiye": out.get("tavsiye", ""),
        "sembol": out.get("sembol", ""),
        "paylasim_cumlesi": out.get("ozet", "")[:140],
    }


def _flatten(data: dict) -> str:
    parts = [data.get("ozet", ""), data.get("tavsiye", "")]
    for b in data.get("bolumler", []) or []:
        parts.append(b.get("metin", ""))
    for t in data.get("tahminler", []) or []:
        parts.append(t.get("iddia", ""))
    return "\n".join(p for p in parts if p)


async def _finalize(db, user_id: str, reading_id: str, kind: str, data: dict,
                    extra: dict, cost: float, tier: str) -> dict:
    """Kaydet + tahminleri ayıkla + hafızayı güncelle."""
    vec = data.pop("_embedding", None)

    await db.execute(
        """UPDATE readings
           SET status='done', output_json=$2, extra_json=$3, cost_usd=$4,
               tier=$5, embedding=$6, delivered_at=now()
           WHERE id=$1""",
        # dict olarak geçiliyor: jsonb codec'i db.init_connection'da kayıtlı
        # (elle json.dumps edilirse çift kodlanır ve sütunda JSON string'i oluşur).
        reading_id, data, extra, cost, tier, vec)

    # TAHMİN AYIKLAMA — doğrulama döngüsünün yakıtı
    now = datetime.now(timezone.utc)
    for t in (data.get("tahminler") or [])[:4]:
        try:
            days = int(t.get("pencere_gun") or 10)
        except (TypeError, ValueError):
            days = 10
        days = max(3, min(45, days))
        await db.execute(
            """INSERT INTO predictions
               (reading_id, user_id, topic, claim, window_start, window_end, confidence)
               VALUES ($1,$2,$3,$4,$5,$6,$7)""",
            reading_id, user_id, normalize_topic(t.get("konu")), t.get("iddia", ""),
            now, now + timedelta(days=days), t.get("guven", "orta"))

    return data


# ------------------------------------------------ doğrulama sonrası takip yorumu

async def verdict_followup(db, user_id: str, prediction_id: str) -> str | None:
    """Kullanıcı "tuttu mu?" sorusunu cevapladıktan sonra tek paragraf yanıt.

    Döngünün kapandığı yer burası. Cevap verip hiçbir karşılık almamak,
    doğrulama mekaniğini bir anket haline getiriyor. Tutmayan tahminde dürüst
    davranmak da tam olarak burada oluyor — ürünün güven iddiası bu paragrafta
    sınanıyor, prompt bunu açıkça söylüyor (prompts.VERIFY_FOLLOWUP).

    Ucuz model kullanılıyor: 4 cümle için büyük modele gitmek gereksiz.
    """
    row = await db.fetchrow(
        """SELECT claim, user_verdict, topic,
                  GREATEST(1, (now()::date - window_start::date)) AS gun
           FROM predictions WHERE id=$1 AND user_id=$2""",
        prediction_id, user_id)
    if not row or not row["user_verdict"]:
        return None

    verdict_tr = {"hit": "tuttu", "miss": "tutmadı",
                  "partial": "kısmen tuttu"}[row["user_verdict"]]
    res = await complete(
        system="Türkçe yaz. SADECE JSON: {\"metin\": \"...\"}",
        user=prompts.VERIFY_FOLLOWUP.format(
            days=row["gun"], claim=row["claim"], verdict=verdict_tr),
        tier="small", max_tokens=350, temperature=0.8)
    metin = (res.data or {}).get("metin")
    if not metin or guardrail.scan_output(metin):
        return None
    return metin


# ------------------------------------------------------ hafıza çıkarımı (asenkron)

MEMORY_SYSTEM = """Kullanıcının fal sorusundan kalıcı bilgi çıkar.

Çıkar: kişi adları ve ilişkileri, tekrarlayan endişeler, hedefler, önemli olaylar.
Çıkarma: geçici duygular, fal içeriğinin kendisi, hassas sağlık verisi.

SADECE JSON: {"items": [{"kind": "person|concern|goal|event",
                         "key": "kısa etiket", "summary": "1 cümle",
                         "salience": 0.0-1.0}]}
Bilgi yoksa boş liste dön."""


async def extract_memory(db, user_id: str, question: str) -> int:
    if not question or len(question) < 12:
        return 0
    res = await complete(system=MEMORY_SYSTEM, user=question, tier="nano",
                         max_tokens=400, temperature=0.2)
    items = (res.data or {}).get("items", [])
    n = 0
    for it in items[:5]:
        if not it.get("key"):
            continue
        await db.execute(
            """INSERT INTO memories (user_id, kind, key, summary, salience, last_seen)
               VALUES ($1,$2,$3,$4,$5, now())
               ON CONFLICT (user_id, kind, key)
               DO UPDATE SET summary=EXCLUDED.summary,
                             salience=GREATEST(memories.salience, EXCLUDED.salience),
                             last_seen=now()""",
            user_id, it.get("kind", "concern"), it["key"][:80],
            it.get("summary", "")[:300], float(it.get("salience", 0.5)))
        n += 1
    return n
