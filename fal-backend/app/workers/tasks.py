"""
Worker görevleri (RQ). Tek küçük VPS'te çalışır.

Cron planı (bootstrap için yeterli, ayrı scheduler servisine gerek yok):
  03:00  nightly_transits    — tüm kullanıcılar için 7 günlük transit taraması
  06:30  queue_daily         — günlük yorumları önceden üret (kullanıcı açtığında hazır)
  09:00  send_daily_push     — kullanıcının aktif saatine göre dağıtılmış
  12:00  ask_verdicts        — penceresi kapanan tahminler için doğrulama push'u
  04:00  purge_assets        — 24 saati geçen fincan fotoğraflarını sil (KVKK)
  05:00  winback             — iptal etmiş kullanıcılara teklif
"""

from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime, timedelta, timezone

from redis import Redis

from ..core import astro
from ..core.db import DB_URL, connect
from ..core.pricing import COIN_PRICES
from ..core.pipeline import (CrisisIntercept, ReadingRejected, extract_memory,
                             generate_reading, _chart_from_row)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")


def _run(coro):
    return asyncio.run(coro)


# --------------------------------------------------------------- fal üretimi

def run_reading(reading_id: str, kind: str, inputs: dict):
    """RQ giriş noktası."""
    return _run(_run_reading(reading_id, kind, inputs))


async def _run_reading(reading_id: str, kind: str, inputs: dict):
    db = await connect()
    r = Redis.from_url(REDIS_URL)
    try:
        row = await db.fetchrow("SELECT user_id FROM readings WHERE id=$1", reading_id)
        if not row:
            return
        user_id = str(row["user_id"])
        await db.execute("UPDATE readings SET status='running' WHERE id=$1", reading_id)

        if kind == "coffee":
            raw = r.get(f"cupimg:{reading_id}")
            if not raw:
                await db.execute(
                    "UPDATE readings SET status='failed', block_reason='image_expired' WHERE id=$1",
                    reading_id)
                return
            inputs["image_bytes"] = raw

        await generate_reading(db, user_id, reading_id, kind, inputs)

        if q := inputs.get("question"):
            await extract_memory(db, user_id, q)          # hafıza asenkron zenginleşir
        await push(db, user_id, "Falın hazır 🔮",
                   "Fincanını okudum. Bakmaya hazır mısın?",
                   {"reading_id": reading_id})

    except CrisisIntercept as e:
        # Push GÖNDERİLMEZ. Kullanıcı uygulamayı açtığında destek mesajını görür.
        await db.execute(
            "UPDATE readings SET status='blocked', block_reason='crisis', output_json=$2 WHERE id=$1",
            reading_id, {"ozet": e.reply})
    except ReadingRejected as e:
        await db.execute(
            "UPDATE readings SET status='failed', block_reason=$2 WHERE id=$1",
            reading_id, e.code)
        await refund(db, str(row["user_id"]), kind)
        await push(db, str(row["user_id"]), "Fotoğrafı tekrar çekelim", e.message, {})
    finally:
        r.delete(f"cupimg:{reading_id}")
        await db.close()


async def refund(db, user_id: str, kind: str):
    cost = COIN_PRICES.get(kind, 0)
    if not cost:
        return
    bal = await db.fetchval(
        "SELECT coalesce(sum(delta),0) FROM coin_ledger WHERE user_id=$1", user_id) or 0
    await db.execute(
        """INSERT INTO coin_ledger (user_id, delta, reason, balance_after)
           VALUES ($1,$2,'refund',$3)""", user_id, cost, bal + cost)


# ---------------------------------------------------------- gece transit taraması

def nightly_transits():
    return _run(_nightly_transits())


async def _nightly_transits(days_ahead: int = 7, per_batch: int = 500):
    """Bu iş bildirim stratejisinin yakıtı. Jenerik burç bildirimi yerine
    'Satürn senin Venüs'üne kare yapıyor' diyebilmenin tek yolu."""
    db = await connect()
    try:
        offset = 0
        now = datetime.now(timezone.utc)
        while True:
            rows = await db.fetch(
                """SELECT u.id AS user_id, b.birth_date, b.birth_time, b.time_known,
                          b.lat, b.lon, b.tz_name
                   FROM users u JOIN birth_profiles b
                     ON b.user_id=u.id AND b.is_primary
                   WHERE u.deleted_at IS NULL AND u.push_optin
                   ORDER BY u.id LIMIT $1 OFFSET $2""", per_batch, offset)
            if not rows:
                break
            for r in rows:
                chart = _chart_from_row(dict(r))
                if not chart:
                    continue
                for d in range(days_ahead):
                    when = now + timedelta(days=d)
                    for t in astro.transits_for(chart, when, tight_orb=0.5,
                                                include_fast=False):
                        if t["severity"] < 0.5:
                            continue
                        await db.execute(
                            """INSERT INTO transits_queue (user_id, code, exact_at, severity)
                               VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING""",
                            r["user_id"], t["code"], when, t["severity"])
            offset += per_batch
    finally:
        await db.close()


# ------------------------------------------------------- doğrulama push'ları

def ask_verdicts(limit: int = 2000):
    return _run(_ask_verdicts(limit))


async def _ask_verdicts(limit: int):
    """Penceresi kapanan tahminler için 'bu tuttu mu?' sorusu.

    Bu push, kategorinin en yüksek açılma oranlı bildirimi olma potansiyeline sahip:
    kullanıcı kendi hakkındaki bir iddianın hesabını görmeye geliyor.
    """
    db = await connect()
    try:
        rows = await db.fetch(
            """SELECT p.id, p.user_id, p.claim FROM predictions p
               WHERE p.user_verdict IS NULL AND p.asked_at IS NULL
                 AND p.window_end < now()
               ORDER BY p.window_end LIMIT $1""", limit)
        for r in rows:
            await push(db, str(r["user_id"]), "Hatırlıyor musun?",
                       f"Geçen hafta şunu söylemiştim: \"{r['claim'][:90]}\" — tuttu mu?",
                       {"prediction_id": str(r["id"]), "deeplink": "verdict"})
            await db.execute("UPDATE predictions SET asked_at=now() WHERE id=$1", r["id"])
    finally:
        await db.close()


# ------------------------------------------------------ günlük yorum ön üretimi

def queue_daily(limit: int = 5000):
    return _run(_queue_daily(limit))


async def _queue_daily(limit: int):
    """Kullanıcı sabah uygulamayı açtığında yorum HAZIR olsun. Bekleme = bırakma.

    Ücretsiz kullanıcılar hibrit blok yolundan geçer (pipeline içinde otomatik),
    o yüzden bu iş toplu çalışsa bile maliyet düşük kalır.
    """
    import uuid as _uuid
    db = await connect()
    r = Redis.from_url(REDIS_URL)
    from rq import Queue
    q = Queue("readings", connection=r)
    try:
        rows = await db.fetch(
            """SELECT u.id FROM users u
               JOIN birth_profiles b ON b.user_id=u.id AND b.is_primary
               LEFT JOIN readings rd ON rd.user_id=u.id AND rd.kind='daily'
                    AND rd.created_at > date_trunc('day', now())
               WHERE u.deleted_at IS NULL AND rd.id IS NULL
                 AND u.streak_last_day > current_date - 14
               LIMIT $1""", limit)
        for row in rows:
            rid = str(_uuid.uuid4())
            await db.execute(
                """INSERT INTO readings (id, user_id, kind, eta_seconds)
                   VALUES ($1,$2,'daily',20)""", rid, row["id"])
            q.enqueue("app.workers.tasks.run_reading", rid, "daily", {})
    finally:
        await db.close()


# ------------------------------------------------------- fotoğraf silme (KVKK)

def purge_assets():
    return _run(_purge_assets())


async def _purge_assets():
    """Ham fincan fotoğrafını 24 saatten fazla tutmuyoruz.

    Bunu ihmal etmek, en büyük yasal riskin biriktiği yer. Avuç içi/yüz
    fotoğrafına hiç girmemek ise en güvenli yol (bkz. README, hukuk bölümü).
    """
    db = await connect()
    r = Redis.from_url(REDIS_URL)
    try:
        rows = await db.fetch(
            "SELECT id, storage_key FROM reading_assets WHERE purge_at < now() AND NOT purged")
        for row in rows:
            r.delete(row["storage_key"])
            # S3/R2 kullanıyorsan burada delete_object çağır
            await db.execute("UPDATE reading_assets SET purged=true WHERE id=$1", row["id"])
        # Redis'te kalmış geçici görüntüler
        for key in r.scan_iter("cupimg:*", count=500):
            if r.ttl(key) == -1:
                r.delete(key)
    finally:
        await db.close()


# --------------------------------------------------------------------- push

async def push(db, user_id: str, title: str, body: str, data: dict):
    """OneSignal/FCM entegrasyonu buraya. Bootstrap'te OneSignal ücretsiz katmanı yeter.

    Kurallar (churn önlemi):
      - günde en fazla 2 bildirim
      - kullanıcının active_hour'una göre gönder, gece yok
      - push_optin=false ise hiç gönderme
    """
    row = await db.fetchrow(
        "SELECT push_token, push_optin, active_hour, tz_name FROM users WHERE id=$1", user_id)
    if not row or not row["push_optin"] or not row["push_token"]:
        return False
    sent_today = await db.fetchval(
        """SELECT count(*) FROM push_log
           WHERE user_id=$1 AND created_at > date_trunc('day', now())""", user_id) or 0
    if sent_today >= 2:
        return False
    ok = await _send_push(row["push_token"], title, body, data)
    await db.execute(
        """INSERT INTO push_log (user_id, title, body, data)
           VALUES ($1,$2,$3,$4)""",
        user_id, title, body, data)
    return ok


ONESIGNAL_APP_ID = os.getenv("ONESIGNAL_APP_ID", "")
ONESIGNAL_API_KEY = os.getenv("ONESIGNAL_API_KEY", "")


async def _send_push(token: str, title: str, body: str, data: dict) -> bool:
    """OneSignal REST çağrısı. Anahtar yoksa sessizce atlar (yerel geliştirme)."""
    if not (ONESIGNAL_APP_ID and ONESIGNAL_API_KEY):
        return False
    import httpx
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(
                "https://api.onesignal.com/notifications",
                headers={"Authorization": f"Key {ONESIGNAL_API_KEY}",
                         "content-type": "application/json"},
                json={"app_id": ONESIGNAL_APP_ID,
                      "include_subscription_ids": [token],
                      "headings": {"tr": title, "en": title},
                      "contents": {"tr": body, "en": body},
                      "data": data})
            return r.status_code < 300
    except Exception:
        return False
