"""
Worker görevleri (RQ). Tek küçük VPS'te çalışır.

Cron planı (bootstrap için yeterli, ayrı scheduler servisine gerek yok):
  03:00  nightly_transits    — tüm kullanıcılar için 7 günlük transit taraması
  06:30  queue_daily         — günlük yorumları önceden üret (kullanıcı açtığında hazır)
  09:00  send_daily_push     — kullanıcının aktif saatine göre dağıtılmış
  12:00  ask_verdicts        — penceresi kapanan tahminler için doğrulama push'u
  04:00  purge_assets        — 24 saati geçen fincan fotoğraflarını sil (KVKK)
  05:00  winback             — iptal etmiş kullanıcılara teklif
  04:30  purge_deleted_users — KVKK silme talebini kalıcı hale getir
  saatlik check_push_receipts — Expo push teslim makbuzlarını doğrula
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from redis import Redis

from ..core import astro
from ..core.db import DB_URL, connect
from ..core.pricing import COIN_PRICES
from ..core.pipeline import (CrisisIntercept, ReadingRejected, extract_memory,
                             generate_reading, _chart_from_row)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

log = logging.getLogger(__name__)


def _run(coro):
    return asyncio.run(coro)


# --------------------------------------------------------------- fal üretimi

# Bildirim metni ritüele göre. Tek metin ("Fincanını okudum") tarot, doğum
# haritası ve rüya için de gönderiliyordu — kullanıcı hiç çekmediği bir
# fincandan haber alıyordu.
_HAZIR_PUSH = {
    "coffee": ("Falın hazır 🔮", "Fincanını okudum. Bakmaya hazır mısın?"),
    "tarot":  ("Kartların hazır 🔮", "Açılımını yorumladım. Bakmaya hazır mısın?"),
    "natal":  ("Haritan hazır ✨", "Doğum haritanı çözdüm. Seni bekliyor."),
    "dream":  ("Rüyan yorumlandı 🌙", "Anlattığın rüyaya baktım. Hazır olduğunda seni bekliyor."),
    "daily":  ("Günün yorumu hazır ✨", "Bugün için haritanda ne var, bakalım mı?"),
    "_":      ("Falın hazır 🔮", "Yorumun hazır. Bakmaya hazır mısın?"),
}

_HATA_PUSH = {
    "coffee": "Fotoğrafı tekrar çekelim",
    "dream":  "Rüyanı tekrar anlatalım",
    "_":      "Bu sefer olmadı",
}


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

        # Hafıza: rüya ritüelinde serbest metin `dream` alanında. Sadece
        # `question`'a bakmak, rüyaları hafızanın tamamen dışında bırakırdı
        # — oysa tekrar eden rüya motifi, hatırlanmaya en değer şey.
        if q := (inputs.get("question") or inputs.get("dream")):
            await extract_memory(db, user_id, q)          # hafıza asenkron zenginleşir
        baslik, metin = _HAZIR_PUSH.get(kind, _HAZIR_PUSH["_"])
        await push(db, user_id, baslik, metin, {"reading_id": reading_id})

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
        # Hata başlığı da ritüele göre: rüyası reddedilen kullanıcıya
        # "fotoğrafı tekrar çekelim" demek anlamsız bir mesaj.
        await push(db, str(row["user_id"]),
                   _HATA_PUSH.get(kind, _HATA_PUSH["_"]), e.message, {})
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


# ------------------------------------------------------ transit bildirimleri

# Bildirim metni gezegen + açı koduna göre kuruluyor. LLM'e yazdırmıyoruz:
# bildirim başlığı 40 karakter, üretmesi 0,001 $ etmez ama 100k kullanıcıda
# günde 100 $ eder. Ayrıca sabit metin ölçülebilir (A/B test edilebilir).
TRANSIT_METIN = {
    "saturn": ("Satürn", "Bugün acele karar verme; sınırlarını gözden geçir."),
    "jupiter": ("Jüpiter", "Kapı aralanıyor. İstemekten çekinme."),
    "uranus": ("Uranüs", "Beklenmedik bir haber gelebilir; esnek kal."),
    "neptune": ("Neptün", "Bugün netlik arama, hissettiğini not et."),
    "pluto": ("Plüton", "Bırakman gereken şey kendini gösteriyor."),
    "mars": ("Mars", "Enerjin yüksek ama kısa fitilli. Tartışmaya girme."),
}
NATAL_TR = {
    "sun": "özüne", "moon": "duygularına", "mercury": "zihnine",
    "venus": "kalbine", "mars": "iradene", "jupiter": "şansına",
    "saturn": "sorumluluklarına", "uranus": "özgürlüğüne",
    "neptune": "hayallerine", "pluto": "gücüne",
}


def _code_coz(code: str) -> tuple[str, str]:
    """'saturn_square_venus' -> ('saturn', 'venus'). Açı adı ortada."""
    p = code.split("_")
    return (p[0], p[-1]) if len(p) >= 3 else (p[0], "")


def send_daily_push(limit: int = 5000):
    return _run(_send_daily_push(limit))


async def _send_daily_push(limit: int):
    """transits_queue'daki kayda değer transitleri bildirime çevirir.

    Bu iş yazılmadığı sürece nightly_transits her gece satır üretip duruyordu
    ama kimse okumuyordu: "Satürn senin Venüs'üne kare yapıyor" vaadi hiç
    gönderilmiyordu, yani bildirim stratejisinin tamamı ölüydü.

    Kurallar (churn önlemi): kullanıcının aktif saatinde, günde en fazla 2
    bildirim (push() uyguluyor), gece yok, opt-in yoksa hiç.
    """
    db = await connect()
    try:
        rows = await db.fetch(
            """SELECT t.id, t.user_id, t.code, t.severity,
                      u.first_name, u.active_hour, u.tz_name
               FROM transits_queue t
               JOIN users u ON u.id = t.user_id
               WHERE t.notified_at IS NULL
                 AND u.deleted_at IS NULL AND u.push_optin
                 AND t.exact_at BETWEEN now() AND now() + interval '2 days'
               ORDER BY t.severity DESC
               LIMIT $1""", limit)

        simdi = datetime.now(timezone.utc)
        for r in rows:
            # Kullanıcının yerel saatine göre gönder; gece bildirimi opt-out üretir.
            try:
                yerel = simdi.astimezone(ZoneInfo(r["tz_name"] or "Europe/Istanbul"))
            except Exception:
                yerel = simdi
            if yerel.hour != (r["active_hour"] or 9):
                continue

            transit, natal = _code_coz(r["code"])
            meta = TRANSIT_METIN.get(transit)
            if not meta:
                continue
            ad, tavsiye = meta
            hedef = NATAL_TR.get(natal, "haritana")
            ok = await push(
                db, str(r["user_id"]),
                f"{ad} {hedef} dokunuyor",
                f"{r['first_name'] or 'Merhaba'} — {tavsiye}",
                {"deeplink": "daily", "transit": r["code"]})
            if ok:
                await db.execute(
                    "UPDATE transits_queue SET notified_at=now() WHERE id=$1",
                    r["id"])
    finally:
        await db.close()


# ------------------------------------------------------------------- winback

def winback(limit: int = 2000):
    return _run(_winback(limit))


async def _winback(limit: int):
    """Aboneliği bitmiş kullanıcıya tek seferlik dönüş teklifi.

    3/14/30. günlerde bir kez. Aynı teklifi tekrar göndermek opt-out üretir;
    push_log'da aynı kampanya+gün kaydı varsa atlanıyor.
    """
    db = await connect()
    try:
        rows = await db.fetch(
            """SELECT e.user_id, u.first_name,
                      (current_date - e.expires_at::date) AS gun
               FROM entitlements e
               JOIN users u ON u.id = e.user_id
               WHERE e.expires_at < now()
                 AND u.deleted_at IS NULL AND u.push_optin
                 AND (current_date - e.expires_at::date) IN (3, 14, 30)
               LIMIT $1""", limit)
        for r in rows:
            zaten = await db.fetchval(
                """SELECT 1 FROM push_log
                   WHERE user_id=$1 AND data->>'kampanya'='winback'
                     AND data->>'gun'=$2""",
                r["user_id"], str(r["gun"]))
            if zaten:
                continue
            await push(db, str(r["user_id"]), "Defterin seni bekliyor",
                       f"{r['first_name'] or 'Merhaba'} — bıraktığın yerden "
                       "devam edebilirsin.",
                       {"deeplink": "paywall", "kampanya": "winback",
                        "gun": str(r["gun"])})
    finally:
        await db.close()


# ------------------------------------------------------- fotoğraf silme (KVKK)

def purge_deleted_users(grace_hours: int = 24):
    return _run(_purge_deleted_users(grace_hours))


async def _purge_deleted_users(grace_hours: int):
    """KVKK silme talebini KALICI hale getirir.

    DELETE /v1/me yalnızca `deleted_at` işaretliyor ve anon_id'yi serbest
    bırakıyordu; bu iş yazılmadığı sürece kullanıcının doğum verisi, fal
    geçmişi, tahminleri ve hafızası veritabanında süresiz kalıyordu.
    "Sildim" deyip saklamak, silme talebini karşılamamak demek.

    Kısa bekleme (varsayılan 24 saat) yanlışlıkla silme talebi için değil —
    anon_id zaten serbest bırakıldığı için kullanıcı geri dönemez — operasyon
    için: aynı gün içinde fark edilen bir hata (yanlış toplu güncelleme gibi)
    yedekten dönmeden düzeltilebilsin.

    users satırı silinince şema ON DELETE CASCADE ile birth_profiles,
    natal_charts, readings, predictions, memories, coin_ledger, entitlements,
    push_log, transits_queue kayıtlarını da götürüyor.
    """
    db = await connect()
    try:
        silinen = await db.fetch(
            f"""DELETE FROM users
                WHERE deleted_at IS NOT NULL
                  AND deleted_at < now() - interval '{int(grace_hours)} hours'
                RETURNING id""")
        if silinen:
            log.info("KVKK: %d kullanıcı kalıcı silindi", len(silinen))
        return len(silinen)
    finally:
        await db.close()


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
    """Expo Push Service üzerinden bildirim gönder.

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
    # Sağlayıcıya gönderim denemesi. Dönüş değeri "teslim edildi mi" DEĞİL,
    # "kullanıcının günlük bildirim kotasını harcadık mı" sorusunu yanıtlıyor.
    #
    # Neden: çağıranlar bu değere bakıp tekrar göndermemek için işaret koyuyor
    # (transits_queue.notified_at). Sağlayıcı anahtarı yokken _send_push False
    # dönüyordu; sonuç olarak hiçbir transit işaretlenmiyor ve aynı bildirim
    # her turda yeniden kuyruğa giriyordu.
    ticket = await _send_push(row["push_token"], title, body, data)
    log_data = {**data, "gonderildi": bool(ticket)}
    if isinstance(ticket, str):
        # 15+ dakika sonra receipt sorgusu bu kimlikle teslimi doğrular.
        # Token yalnızca o receipt işlenene kadar tutulur; sonra log'dan çıkar.
        log_data["expo_ticket_id"] = ticket
        log_data["expo_token"] = row["push_token"]
    await db.execute(
        """INSERT INTO push_log (user_id, title, body, data)
           VALUES ($1,$2,$3,$4)""",
        user_id, title, body, log_data)
    return True


EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts"


async def _expo_post(url: str, payload: dict) -> dict | None:
    """Expo Push API çağrısı; geçici 429/5xx ve ağ hatalarında üç kez dene."""
    import httpx

    for deneme in range(3):
        try:
            async with httpx.AsyncClient(timeout=15) as c:
                r = await c.post(
                    url,
                    headers={"accept": "application/json",
                             "content-type": "application/json"},
                    json=payload,
                )
            if r.status_code == 429 or r.status_code >= 500:
                if deneme < 2:
                    await asyncio.sleep(2 ** deneme)
                    continue
                return None
            if r.status_code >= 300:
                return None
            cevap = r.json()
            return cevap if isinstance(cevap, dict) else None
        except Exception:
            if deneme < 2:
                await asyncio.sleep(2 ** deneme)
                continue
            return None
    return None


async def _send_push(token: str, title: str, body: str, data: dict) -> str | None:
    """ExpoPushToken gönder; kabul edilen bildirimin receipt kimliğini döndür."""
    cevap = await _expo_post(
        EXPO_PUSH_URL,
        {"to": token, "title": title, "body": body, "data": data,
         "priority": "default", "channelId": "default"},
    )
    ticket = (cevap or {}).get("data")
    if isinstance(ticket, list):
        ticket = ticket[0] if ticket else None
    if not isinstance(ticket, dict) or ticket.get("status") != "ok":
        return None
    kimlik = ticket.get("id")
    return kimlik if isinstance(kimlik, str) and kimlik else None


def check_push_receipts(limit: int = 200):
    """RQ/scheduler giriş noktası: 15 dakikadan eski push'ların teslimini doğrula."""
    return _run(_check_push_receipts(limit))


async def _check_push_receipts(limit: int = 200) -> int:
    db = await connect()
    try:
        # Expo receipt'leri 24 saatten sonra temizliyor. O pencere kaçmışsa
        # artık kullanamayacağımız cihaz tokenını push_log'da sonsuza kadar
        # tutma; sonucu "expired" diye görünür bırak ve geçici tokenı sil.
        await db.execute(
            """UPDATE push_log
               SET data=(data - 'expo_token') || '{"expo_receipt_status":"expired"}'::jsonb
               WHERE data ? 'expo_ticket_id'
                 AND NOT data ? 'expo_receipt_status'
                 AND created_at <= now() - interval '23 hours'""")
        rows = await db.fetch(
            """SELECT id, user_id, data
               FROM push_log
               WHERE data ? 'expo_ticket_id'
                 AND NOT data ? 'expo_receipt_status'
                 AND created_at <= now() - interval '15 minutes'
                 AND created_at > now() - interval '23 hours'
               ORDER BY created_at
               LIMIT $1""", limit)
        if not rows:
            return 0

        ids = [r["data"]["expo_ticket_id"] for r in rows]
        cevap = await _expo_post(EXPO_RECEIPTS_URL, {"ids": ids})
        receipts = (cevap or {}).get("data")
        if not isinstance(receipts, dict):
            return 0

        islenen = 0
        for row in rows:
            veri = dict(row["data"])
            ticket_id = veri.get("expo_ticket_id")
            receipt = receipts.get(ticket_id)
            if not isinstance(receipt, dict):
                continue

            durum = receipt.get("status", "error")
            detay = receipt.get("details") if isinstance(receipt.get("details"), dict) else {}
            hata = detay.get("error")
            eski_token = veri.pop("expo_token", None)
            veri["expo_receipt_status"] = durum
            if hata:
                veri["expo_receipt_error"] = hata
            await db.execute("UPDATE push_log SET data=$2 WHERE id=$1", row["id"], veri)

            # Expo bunu kalıcı hata olarak tanımlar. Yalnızca receipt'in ait
            # olduğu ESKİ token hâlâ kullanıcıda kayıtlıysa opt-out yap; bu
            # arada yenilenmiş yeni tokenı yanlışlıkla silme.
            if hata == "DeviceNotRegistered" and eski_token:
                await db.execute(
                    """UPDATE users SET push_token=NULL, push_optin=false
                       WHERE id=$1 AND push_token=$2""",
                    row["user_id"], eski_token)
            islenen += 1
        return islenen
    finally:
        await db.close()
