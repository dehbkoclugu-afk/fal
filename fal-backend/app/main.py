"""
FastAPI giriş noktası.

Akış tasarımı: fal isteği HTTP'de üretilmez. 202 dönülür, iş kuyruğa girer,
mobilde "fincanın okunuyor" ritüeli oynar, bitince push gider. Böylece
  - kullanıcı mistik bekleme yaşar (dönüşüme olumlu etki)
  - push izni doğal olarak değer kazanır
  - LLM yükü düzleşir, timeout sorunu kalmaz
"""

from __future__ import annotations

import json
import os
import uuid
from contextlib import asynccontextmanager
from datetime import date, datetime, time, timezone
from typing import Literal

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from redis import asyncio as aioredis
from rq import Queue

from .core import db as dbmod

DB_URL = dbmod.DB_URL
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
MAX_UPLOAD_MB = 8

state: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    state["db"] = await dbmod.create_pool()
    state["redis"] = await aioredis.from_url(REDIS_URL)
    import redis as sync_redis
    state["queue"] = Queue("readings", connection=sync_redis.from_url(REDIS_URL))
    yield
    await state["db"].close()
    await state["redis"].close()


app = FastAPI(title="Fal API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"],
                   allow_headers=["*"])


async def get_user(x_anon_id: str = Header(...)) -> dict:
    """Anonim öncelikli kimlik: kayıt ekranı yok, cihaz kimliği yeter.

    Onboarding'e kayıt koymak ilk ekran dönüşümünü %30-50 düşürür. Sosyal giriş
    sonra, değer gösterildikten sonra önerilir.
    """
    db = state["db"]
    row = await db.fetchrow("SELECT * FROM users WHERE anon_id=$1 AND deleted_at IS NULL",
                            x_anon_id)
    if not row:
        row = await db.fetchrow(
            "INSERT INTO users (anon_id) VALUES ($1) RETURNING *", x_anon_id)
    return dict(row)


# ------------------------------------------------------------------ modeller

class ProfileIn(BaseModel):
    first_name: str | None = None
    tone: str | None = None
    relationship_status: str | None = None
    focus_topic: str | None = None
    locale: str | None = None
    tz_name: str | None = None
    # date/time olarak tiplenmiş: pydantic sınırda parse eder, hatalı girdi 500
    # değil 422 döner ve asyncpg'ye doğru Python tipi gider (str geçilirse
    # $2::date argümanı DataError ile düşer).
    birth_date: date | None = None           # YYYY-MM-DD
    birth_time: time | None = None           # HH:MM
    time_known: bool = True
    place_name: str | None = None
    lat: float | None = None
    lon: float | None = None


class TarotIn(BaseModel):
    # Sınırda doğrula: tarot.draw() bilinmeyen açılımda sessizce three_card'a
    # düşer. Jeton çoktan düşülmüş olacağı için kullanıcı istemediği açılımı
    # ödemiş olur — istemci hatası 422 olarak geri dönmeli.
    spread: Literal["single", "three_card", "situation",
                    "love_five", "celtic_cross"] = "three_card"
    question: str = Field("", max_length=1000)
    seed: str | None = Field(None, max_length=64)


class NatalIn(BaseModel):
    focus: Literal["genel", "ask", "para", "kariyer", "kendim"] = "genel"
    question: str = Field("", max_length=1000)


class VerdictIn(BaseModel):
    verdict: str = Field(pattern="^(hit|miss|partial)$")


class PushTokenIn(BaseModel):
    push_token: str = Field(max_length=200)
    push_optin: bool = True
    active_hour: int = Field(9, ge=0, le=23)


from .core.pricing import COIN_PRICES, DAILY_SPEND_CAP  # noqa: E402


async def _charge(db, user_id: str, kind: str) -> None:
    cost = COIN_PRICES.get(kind, 1)
    if cost == 0:
        return
    ent = await db.fetchval(
        "SELECT tier FROM entitlements WHERE user_id=$1 AND expires_at > now()", user_id)
    if ent in ("fate", "yearly"):
        return
    spent = await db.fetchval(
        """SELECT coalesce(-sum(delta),0) FROM coin_ledger
           WHERE user_id=$1 AND delta<0 AND created_at > date_trunc('day', now())""",
        user_id) or 0
    if spent + cost > DAILY_SPEND_CAP:
        raise HTTPException(429, {"code": "daily_cap",
                                  "message": "Bugün için yeterince fal baktık. Yarın devam edelim."})
    bal = await db.fetchval(
        "SELECT coalesce(sum(delta),0) FROM coin_ledger WHERE user_id=$1", user_id) or 0
    if bal < cost:
        raise HTTPException(402, {"code": "insufficient_coins", "need": cost, "have": bal})
    await db.execute(
        """INSERT INTO coin_ledger (user_id, delta, reason, balance_after)
           VALUES ($1,$2,$3,$4)""", user_id, -cost, f"spend_{kind}", bal - cost)


# ------------------------------------------------------------------ endpointler

@app.put("/v1/profile")
async def upsert_profile(p: ProfileIn, user=Depends(get_user)):
    db = state["db"]
    await db.execute(
        """UPDATE users SET first_name=coalesce($2,first_name),
             tone=coalesce($3,tone), relationship_status=coalesce($4,relationship_status),
             focus_topic=coalesce($5,focus_topic), locale=coalesce($6,locale),
             tz_name=coalesce($7,tz_name)
           WHERE id=$1""",
        user["id"], p.first_name, p.tone, p.relationship_status,
        p.focus_topic, p.locale, p.tz_name)

    if p.birth_date:
        await db.execute(
            """INSERT INTO birth_profiles
                 (user_id, label, is_primary, birth_date, birth_time, time_known,
                  place_name, lat, lon, tz_name)
               VALUES ($1,'ben',true,$2,$3,$4,$5,$6,$7,$8)
               ON CONFLICT (user_id) WHERE is_primary DO UPDATE SET
                 birth_date=EXCLUDED.birth_date, birth_time=EXCLUDED.birth_time,
                 time_known=EXCLUDED.time_known, place_name=EXCLUDED.place_name,
                 lat=EXCLUDED.lat, lon=EXCLUDED.lon, tz_name=EXCLUDED.tz_name""",
            user["id"], p.birth_date, p.birth_time, p.time_known,
            p.place_name, p.lat, p.lon, p.tz_name or "Europe/Istanbul")

    # Onboarding'de anında ödül: yükselen burcu hemen döndür (bırakma oranını düşürür)
    teaser = None
    if p.birth_date:
        from .core import astro
        d, t = p.birth_date, p.birth_time
        chart = astro.compute_chart(astro.BirthInput(
            d.year, d.month, d.day,
            t.hour if t else 12, t.minute if t else 0,
            p.lat or 41.0082, p.lon or 28.9784,
            p.tz_name or "Europe/Istanbul", p.time_known))
        teaser = {
            "yukselen": astro.SIGNS_TR[int(chart.ascendant // 30)],
            "gunes": chart.bodies["sun"].sign_tr,
            "ay": chart.bodies["moon"].sign_tr,
            "ay_fazi": chart.moon_phase["name_tr"],
        }
    return {"ok": True, "teaser": teaser}


@app.post("/v1/readings/coffee", status_code=202)
async def coffee(photo: UploadFile = File(...), question: str = Form(""),
                 handle_angle: float = Form(0.0), user=Depends(get_user)):
    raw = await photo.read()
    if len(raw) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(413, "Fotoğraf çok büyük.")
    db = state["db"]
    await _charge(db, user["id"], "coffee")
    rid = str(uuid.uuid4())
    await db.execute(
        """INSERT INTO readings (id, user_id, kind, input_json, eta_seconds)
           VALUES ($1,$2,'coffee',$3,$4)""",
        rid, user["id"], json.dumps({"question": question}), 150)
    # Görüntü Redis'te geçici tutulur (24 saat TTL) — kalıcı depoya yazmıyoruz
    await state["redis"].setex(f"cupimg:{rid}", 86400, raw)
    state["queue"].enqueue("app.workers.tasks.run_reading", rid, "coffee",
                           {"question": question, "handle_angle": handle_angle})
    return {"reading_id": rid, "eta_seconds": 150, "status": "queued"}


@app.post("/v1/readings/tarot", status_code=202)
async def tarot_reading(body: TarotIn, user=Depends(get_user)):
    db = state["db"]
    await _charge(db, user["id"], "tarot")
    rid = str(uuid.uuid4())
    await db.execute(
        """INSERT INTO readings (id, user_id, kind, input_json, eta_seconds)
           VALUES ($1,$2,'tarot',$3,90)""",
        rid, user["id"], json.dumps(body.model_dump()))
    state["queue"].enqueue("app.workers.tasks.run_reading", rid, "tarot",
                           body.model_dump())
    return {"reading_id": rid, "eta_seconds": 90, "status": "queued"}


async def _require_birth(db, user_id) -> None:
    ok = await db.fetchval(
        "SELECT 1 FROM birth_profiles WHERE user_id=$1 AND is_primary", user_id)
    if not ok:
        raise HTTPException(400, {"code": "no_birth_data",
                                  "message": "Önce doğum bilgilerini tamamla."})


@app.post("/v1/readings/natal", status_code=202)
async def natal_reading(body: NatalIn, user=Depends(get_user)):
    db = state["db"]
    await _require_birth(db, user["id"])
    await _charge(db, user["id"], "natal")
    rid = str(uuid.uuid4())
    await db.execute(
        """INSERT INTO readings (id, user_id, kind, input_json, eta_seconds)
           VALUES ($1,$2,'natal',$3,120)""",
        rid, user["id"], json.dumps(body.model_dump()))
    state["queue"].enqueue("app.workers.tasks.run_reading", rid, "natal",
                           body.model_dump())
    return {"reading_id": rid, "eta_seconds": 120, "status": "queued"}


@app.post("/v1/readings/daily", status_code=202)
async def daily_reading(user=Depends(get_user)):
    """Günün yorumu. Ücretsiz (jeton düşmez) ve günde bir üretilir.

    Aynı gün ikinci kez istenirse mevcut kayıt döner — hem maliyet hem
    tutarlılık için: kullanıcı günü içinde iki farklı yorum görmemeli.
    """
    db = state["db"]
    await _require_birth(db, user["id"])
    mevcut = await db.fetchrow(
        """SELECT id, eta_seconds, status FROM readings
           WHERE user_id=$1 AND kind='daily' AND status <> 'failed'
             AND created_at > date_trunc('day', now())
           ORDER BY created_at DESC LIMIT 1""", user["id"])
    if mevcut:
        return {"reading_id": str(mevcut["id"]),
                "eta_seconds": mevcut["eta_seconds"],
                "status": mevcut["status"], "cached": True}

    rid = str(uuid.uuid4())
    await db.execute(
        """INSERT INTO readings (id, user_id, kind, eta_seconds)
           VALUES ($1,$2,'daily',20)""", rid, user["id"])
    state["queue"].enqueue("app.workers.tasks.run_reading", rid, "daily", {})
    return {"reading_id": rid, "eta_seconds": 20, "status": "queued"}


@app.get("/v1/readings/{rid}")
async def get_reading(rid: str, user=Depends(get_user)):
    row = await state["db"].fetchrow(
        """SELECT id, kind, status, block_reason, output_json, extra_json,
                  eta_seconds, created_at, delivered_at
           FROM readings WHERE id=$1 AND user_id=$2""", rid, user["id"])
    if not row:
        raise HTTPException(404, "Bulunamadı.")
    d = dict(row)
    if d["status"] != "done":
        elapsed = (datetime.now(timezone.utc) - d["created_at"]).total_seconds()
        d["progress"] = min(0.95, elapsed / max(1, d["eta_seconds"]))
        d.pop("output_json", None)
    return d


@app.get("/v1/readings")
async def history(limit: int = 20, user=Depends(get_user)):
    rows = await state["db"].fetch(
        """SELECT id, kind, status, output_json->>'ozet' AS ozet, created_at
           FROM readings WHERE user_id=$1 AND status='done'
           ORDER BY created_at DESC LIMIT $2""", user["id"], min(limit, 50))
    return [dict(r) for r in rows]


@app.post("/v1/predictions/{pid}/verdict")
async def verdict(pid: str, body: VerdictIn, user=Depends(get_user)):
    """Doğrulama döngüsü — ürünün ana farkı. Jetonla ödüllendir, geri dönüşü besle."""
    db = state["db"]
    upd = await db.fetchrow(
        """UPDATE predictions SET user_verdict=$3, verdict_at=now()
           WHERE id=$1 AND user_id=$2 AND user_verdict IS NULL
           RETURNING claim, topic""", pid, user["id"], body.verdict)
    if not upd:
        raise HTTPException(404, "Tahmin bulunamadı veya zaten yanıtlanmış.")
    bal = await db.fetchval(
        "SELECT coalesce(sum(delta),0) FROM coin_ledger WHERE user_id=$1", user["id"]) or 0
    await db.execute(
        """INSERT INTO coin_ledger (user_id, delta, reason, ref_id, balance_after)
           VALUES ($1,1,'verify',$2,$3)""", user["id"], pid, bal + 1)
    acc = await db.fetchrow("SELECT * FROM user_accuracy WHERE user_id=$1", user["id"])
    return {"ok": True, "coins_earned": 1, "accuracy": dict(acc) if acc else None}


@app.get("/v1/me/accuracy")
async def accuracy(user=Depends(get_user)):
    """Kişisel isabet paneli — paylaşılabilir ekranın verisi."""
    db = state["db"]
    acc = await db.fetchrow("SELECT * FROM user_accuracy WHERE user_id=$1", user["id"])
    by_topic = await db.fetch(
        """SELECT topic, count(*) total,
                  count(*) FILTER (WHERE user_verdict='hit') hits
           FROM predictions WHERE user_id=$1 AND user_verdict IS NOT NULL
           GROUP BY topic ORDER BY total DESC""", user["id"])
    pending = await db.fetch(
        """SELECT id, claim, topic, window_end FROM predictions
           WHERE user_id=$1 AND user_verdict IS NULL AND window_end < now()
           ORDER BY window_end LIMIT 5""", user["id"])
    return {"overall": dict(acc) if acc else None,
            "by_topic": [dict(r) for r in by_topic],
            "awaiting_verdict": [dict(r) for r in pending]}


@app.get("/v1/me")
async def me(user=Depends(get_user)):
    """Ana ekranın tek çağrısı: profil + jeton + abonelik + streak.

    Ayrı uçlara bölmemek kasıtlı — ana ekran açılışında üç ayrı istek,
    yavaş bağlantıda görünür gecikme demek.
    """
    db = state["db"]
    bal = await db.fetchval(
        "SELECT coalesce(sum(delta),0) FROM coin_ledger WHERE user_id=$1",
        user["id"]) or 0
    spent = await db.fetchval(
        """SELECT coalesce(-sum(delta),0) FROM coin_ledger
           WHERE user_id=$1 AND delta<0 AND created_at > date_trunc('day', now())""",
        user["id"]) or 0
    ent = await db.fetchrow(
        """SELECT tier, expires_at, will_renew FROM entitlements
           WHERE user_id=$1 AND expires_at > now()""", user["id"])
    birth = await db.fetchval(
        "SELECT 1 FROM birth_profiles WHERE user_id=$1 AND is_primary", user["id"])
    return {
        "first_name": user["first_name"],
        "tone": user["tone"],
        "locale": user["locale"],
        "has_birth_data": bool(birth),
        "coins": int(bal),
        "daily_spend_left": max(0, DAILY_SPEND_CAP - int(spent)),
        "prices": COIN_PRICES,
        "entitlement": dict(ent) if ent else None,
        "streak": {"count": user["streak_count"], "last_day": user["streak_last_day"]},
        "push_optin": user["push_optin"],
    }


@app.get("/v1/me/next-transit")
async def next_transit(user=Depends(get_user)):
    """Bildirim izni istenmeden ÖNCE gösterilecek gerçek transit.

    "Bildirimlere izin ver" ile "14 Ağustos'ta Merkür senin iletişim evine
    giriyor, haber vereyim mi" arasındaki opt-in farkı ~%40 → ~%70. Bu uç
    olmadan onboarding/notifications ekranı jenerik bir izin ekranına düşer.
    """
    db = state["db"]
    row = await db.fetchrow(
        """SELECT birth_date, birth_time, time_known, lat, lon, tz_name
           FROM birth_profiles WHERE user_id=$1 AND is_primary""", user["id"])
    if not row:
        raise HTTPException(400, {"code": "no_birth_data",
                                  "message": "Önce doğum bilgilerini tamamla."})

    from .core.astro import BODIES, next_notable_transits
    from .core.pipeline import _chart_from_row
    chart = _chart_from_row(dict(row))
    hits = next_notable_transits(chart, datetime.now(timezone.utc), days=120, top=3)
    if not hits:
        return {"transit": None}

    h = hits[0]
    isim = {k: tr for k, _code, tr in BODIES}
    return {
        "transit": {
            "code": h["code"],
            "exact_at": h["exact_at"],
            "severity": h["severity"],
            "house": h["house_touched"],
            "metin": (f"{isim.get(h['transit'], h['transit'])}, "
                      f"{isim.get(h['natal'], h['natal'])} konumuna "
                      f"{h['aspect_tr']} yapıyor"),
        }
    }


@app.put("/v1/me/push-token")
async def set_push_token(body: PushTokenIn, user=Depends(get_user)):
    await state["db"].execute(
        """UPDATE users SET push_token=$2, push_optin=$3, active_hour=$4
           WHERE id=$1""",
        user["id"], body.push_token, body.push_optin, body.active_hour)
    return {"ok": True}


@app.delete("/v1/me", status_code=202)
async def delete_me(user=Depends(get_user)):
    """KVKK silme talebi. Uygulama içinden çalışır durumda olmak zorunda.

    Soft delete + gece işi kalıcı siler; anon_id serbest bırakılır ki aynı
    cihaz yeniden kurulumda temiz başlasın.
    """
    await state["db"].execute(
        """UPDATE users SET deleted_at=now(), push_token=NULL, push_optin=false,
             anon_id = 'deleted:' || id::text
           WHERE id=$1""", user["id"])
    return {"ok": True, "message": "Verilerin silinmek üzere işaretlendi."}


@app.post("/v1/coins/reward")
async def reward_coins(user=Depends(get_user)):
    """Ödüllü reklam karşılığı jeton.

    Günlük tavan var: ödüllü reklam sınırsız olursa hem eCPM düşer hem de
    jeton ekonomisi anlamsızlaşır.
    """
    db = state["db"]
    bugun = await db.fetchval(
        """SELECT count(*) FROM coin_ledger
           WHERE user_id=$1 AND reason='rewarded_ad'
             AND created_at > date_trunc('day', now())""", user["id"]) or 0
    if bugun >= 5:
        raise HTTPException(429, {"code": "reward_cap",
                                  "message": "Bugünlük ödül hakkın doldu."})
    bal = await db.fetchval(
        "SELECT coalesce(sum(delta),0) FROM coin_ledger WHERE user_id=$1",
        user["id"]) or 0
    await db.execute(
        """INSERT INTO coin_ledger (user_id, delta, reason, balance_after)
           VALUES ($1,1,'rewarded_ad',$2)""", user["id"], bal + 1)
    return {"ok": True, "coins": int(bal) + 1}


@app.post("/v1/webhooks/revenuecat")
async def rc_webhook(payload: dict, authorization: str = Header("")):
    if authorization != f"Bearer {os.getenv('RC_WEBHOOK_SECRET','')}":
        raise HTTPException(401, "unauthorized")
    ev = payload.get("event", {})
    app_user_id = ev.get("app_user_id")
    etype = ev.get("type")
    if not app_user_id:
        return {"ok": True}
    db = state["db"]
    uid = await db.fetchval("SELECT id FROM users WHERE anon_id=$1", app_user_id)
    if not uid:
        return {"ok": True}
    if etype in ("INITIAL_PURCHASE", "RENEWAL", "PRODUCT_CHANGE", "UNCANCELLATION"):
        tier = (ev.get("entitlement_ids") or ["star"])[0]
        exp_ms = ev.get("expiration_at_ms")
        await db.execute(
            """INSERT INTO entitlements (user_id, tier, source, rc_app_user, expires_at, will_renew)
               VALUES ($1,$2,$3,$4, to_timestamp($5/1000.0), true)
               ON CONFLICT (user_id) DO UPDATE SET tier=EXCLUDED.tier,
                 expires_at=EXCLUDED.expires_at, will_renew=true, updated_at=now()""",
            uid, tier, ev.get("store", "unknown"), app_user_id, exp_ms)
    elif etype in ("CANCELLATION", "EXPIRATION"):
        await db.execute(
            "UPDATE entitlements SET will_renew=false, updated_at=now() WHERE user_id=$1", uid)
    return {"ok": True}


@app.get("/health")
async def health():
    return {"ok": True}
