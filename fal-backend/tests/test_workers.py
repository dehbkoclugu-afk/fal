"""
Worker görevleri — bildirim zinciri.

Bu dosyanın varlık sebebi: nightly_transits her gece transits_queue'ya satır
yazıyordu ama onu okuyan taraf (send_daily_push) hiç yazılmamıştı. Yani
"Satürn senin Venüs'üne kare yapıyor" vaadi — jenerik burç bildiriminden
ayrıştığın tek nokta — hiç gönderilmiyordu. Zincirin uçtan uca bağlı kaldığını
buradaki testler garanti ediyor.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, time, timedelta, timezone

import pytest

from app.workers import tasks
from tests.conftest import requires_db

pytestmark = [pytest.mark.asyncio, requires_db]


async def _kullanici(db, *, optin=True, saat=None, tz="Europe/Istanbul",
                     ad="Deniz"):
    """Aktif saati şimdiye ayarlı, bildirime açık kullanıcı."""
    if saat is None:
        from zoneinfo import ZoneInfo
        saat = datetime.now(timezone.utc).astimezone(ZoneInfo(tz)).hour
    return await db.fetchval(
        """INSERT INTO users (anon_id, first_name, push_optin, push_token,
                              active_hour, tz_name)
           VALUES ($1,$2,$3,'tok-1',$4,$5) RETURNING id""",
        str(uuid.uuid4()), ad, optin, saat, tz)


async def _transit(db, uid, code="saturn_square_venus", gun=1, severity=0.9):
    await db.execute(
        """INSERT INTO transits_queue (user_id, code, exact_at, severity)
           VALUES ($1,$2,$3,$4)""",
        uid, code, datetime.now(timezone.utc) + timedelta(days=gun), severity)


@pytest.fixture
def push_yakala(monkeypatch):
    """Gerçek gönderim yerine kayıt tut — Expo Push çağrısı yapılmasın."""
    gonderilen: list[dict] = []

    async def sahte(token, title, body, data):
        gonderilen.append({"title": title, "body": body, "data": data})
        return True

    monkeypatch.setattr(tasks, "_send_push", sahte)
    return gonderilen


# ------------------------------------------------------ transit bildirimleri

async def test_transit_bildirimi_gonderiliyor(db, push_yakala, monkeypatch):
    uid = await _kullanici(db)
    await _transit(db, uid)
    monkeypatch.setattr(tasks, "connect", lambda: _ayni(db))

    await tasks._send_daily_push(100)

    assert len(push_yakala) == 1
    p = push_yakala[0]
    assert "Satürn" in p["title"], p["title"]
    assert "kalbine" in p["title"], "natal gezegen Türkçeye çevrilmemiş"
    assert p["data"]["transit"] == "saturn_square_venus"
    # İşaretlenmiş olmalı ki ikinci turda tekrar gitmesin
    assert await db.fetchval(
        "SELECT count(*) FROM transits_queue WHERE notified_at IS NOT NULL") == 1


async def test_ayni_transit_iki_kez_gonderilmiyor(db, push_yakala, monkeypatch):
    uid = await _kullanici(db)
    await _transit(db, uid)
    monkeypatch.setattr(tasks, "connect", lambda: _ayni(db))

    await tasks._send_daily_push(100)
    await tasks._send_daily_push(100)
    assert len(push_yakala) == 1


async def test_bildirim_kapaliysa_gonderilmiyor(db, push_yakala, monkeypatch):
    uid = await _kullanici(db, optin=False)
    await _transit(db, uid)
    monkeypatch.setattr(tasks, "connect", lambda: _ayni(db))
    await tasks._send_daily_push(100)
    assert push_yakala == []


async def test_aktif_saat_disinda_gonderilmiyor(db, push_yakala, monkeypatch):
    """Gece bildirimi opt-out üretir; kullanıcının saatini beklemek zorunlu."""
    from zoneinfo import ZoneInfo
    simdi = datetime.now(timezone.utc).astimezone(ZoneInfo("Europe/Istanbul")).hour
    uid = await _kullanici(db, saat=(simdi + 5) % 24)
    await _transit(db, uid)
    monkeypatch.setattr(tasks, "connect", lambda: _ayni(db))
    await tasks._send_daily_push(100)
    assert push_yakala == []


async def test_uzak_transit_henuz_gonderilmiyor(db, push_yakala, monkeypatch):
    uid = await _kullanici(db)
    await _transit(db, uid, gun=30)
    monkeypatch.setattr(tasks, "connect", lambda: _ayni(db))
    await tasks._send_daily_push(100)
    assert push_yakala == []


async def test_gunde_iki_bildirim_tavani(db, push_yakala, monkeypatch):
    """push() tavanı uyguluyor; aşılırsa opt-out patlar."""
    uid = await _kullanici(db)
    for i, code in enumerate(("saturn_square_venus", "jupiter_trine_sun",
                              "pluto_opposition_moon")):
        await _transit(db, uid, code=code, gun=1, severity=0.9 - i * 0.1)
    monkeypatch.setattr(tasks, "connect", lambda: _ayni(db))
    await tasks._send_daily_push(100)
    assert len(push_yakala) == 2


async def test_bilinmeyen_gezegen_kodu_atlaniyor(db, push_yakala, monkeypatch):
    uid = await _kullanici(db)
    await _transit(db, uid, code="chiron_square_venus")
    monkeypatch.setattr(tasks, "connect", lambda: _ayni(db))
    await tasks._send_daily_push(100)
    assert push_yakala == []


async def test_transit_kodu_cozuluyor():
    assert tasks._code_coz("saturn_square_venus") == ("saturn", "venus")
    assert tasks._code_coz("jupiter_conjunction_sun") == ("jupiter", "sun")
    assert tasks._code_coz("bozuk") == ("bozuk", "")


async def test_expo_push_ticket_payload(monkeypatch):
    async def sahte_post(url, payload):
        assert url == tasks.EXPO_PUSH_URL
        assert payload["to"] == "ExponentPushToken[test]"
        assert payload["data"]["deeplink"] == "daily"
        return {"data": {"status": "ok", "id": "ticket-1"}}

    monkeypatch.setattr(tasks, "_expo_post", sahte_post)
    ticket = await tasks._send_push(
        "ExponentPushToken[test]", "Başlık", "Gövde", {"deeplink": "daily"})
    assert ticket == "ticket-1"


async def test_device_not_registered_tokeni_kapatiyor(db, monkeypatch):
    uid = await _kullanici(db)
    await db.execute(
        """INSERT INTO push_log (user_id, title, body, data, created_at)
           VALUES ($1,'x','y',$2, now() - interval '20 minutes')""",
        uid, {"expo_ticket_id": "ticket-dead", "expo_token": "tok-1",
              "gonderildi": True})

    async def sahte_post(url, payload):
        assert url == tasks.EXPO_RECEIPTS_URL
        assert payload == {"ids": ["ticket-dead"]}
        return {"data": {"ticket-dead": {
            "status": "error", "details": {"error": "DeviceNotRegistered"}}}}

    monkeypatch.setattr(tasks, "_expo_post", sahte_post)
    monkeypatch.setattr(tasks, "connect", lambda: _ayni(db))
    assert await tasks._check_push_receipts() == 1
    user = await db.fetchrow("SELECT push_token, push_optin FROM users WHERE id=$1", uid)
    assert user["push_token"] is None
    assert user["push_optin"] is False
    kayit = await db.fetchval("SELECT data FROM push_log WHERE user_id=$1", uid)
    assert kayit["expo_receipt_error"] == "DeviceNotRegistered"
    assert "expo_token" not in kayit


async def test_receipt_penceresi_gecen_token_logdan_siliniyor(db, monkeypatch):
    uid = await _kullanici(db)
    await db.execute(
        """INSERT INTO push_log (user_id, title, body, data, created_at)
           VALUES ($1,'x','y',$2, now() - interval '24 hours')""",
        uid, {"expo_ticket_id": "ticket-old", "expo_token": "tok-1",
              "gonderildi": True})
    monkeypatch.setattr(tasks, "connect", lambda: _ayni(db))
    assert await tasks._check_push_receipts() == 0
    kayit = await db.fetchval("SELECT data FROM push_log WHERE user_id=$1", uid)
    assert kayit["expo_receipt_status"] == "expired"
    assert "expo_token" not in kayit


# ------------------------------------------------------------------ winback

async def test_winback_uc_gun_sonra_gidiyor(db, push_yakala, monkeypatch):
    uid = await _kullanici(db)
    await db.execute(
        """INSERT INTO entitlements (user_id, tier, source, expires_at)
           VALUES ($1,'fate','android', now() - interval '3 days')""", uid)
    monkeypatch.setattr(tasks, "connect", lambda: _ayni(db))

    await tasks._winback(100)
    assert len(push_yakala) == 1
    assert push_yakala[0]["data"]["kampanya"] == "winback"


async def test_winback_ayni_gun_tekrar_gonderilmiyor(db, push_yakala, monkeypatch):
    uid = await _kullanici(db)
    await db.execute(
        """INSERT INTO entitlements (user_id, tier, source, expires_at)
           VALUES ($1,'fate','android', now() - interval '3 days')""", uid)
    monkeypatch.setattr(tasks, "connect", lambda: _ayni(db))
    await tasks._winback(100)
    await tasks._winback(100)
    assert len(push_yakala) == 1


async def test_winback_aktif_aboneye_gitmiyor(db, push_yakala, monkeypatch):
    uid = await _kullanici(db)
    await db.execute(
        """INSERT INTO entitlements (user_id, tier, source, expires_at)
           VALUES ($1,'fate','android', now() + interval '30 days')""", uid)
    monkeypatch.setattr(tasks, "connect", lambda: _ayni(db))
    await tasks._winback(100)
    assert push_yakala == []


# ------------------------------------------------------------ gece taraması

async def test_nightly_transits_kuyruga_yaziyor(db, monkeypatch):
    uid = await _kullanici(db)
    await db.execute(
        """INSERT INTO birth_profiles (user_id, is_primary, birth_date, birth_time,
                                       time_known, lat, lon, tz_name)
           VALUES ($1,true,$2,$3,true,41.0082,28.9784,'Europe/Istanbul')""",
        uid, date(1993, 6, 14), time(4, 30))
    monkeypatch.setattr(tasks, "connect", lambda: _ayni(db))

    await tasks._nightly_transits(days_ahead=30)
    n = await db.fetchval("SELECT count(*) FROM transits_queue WHERE user_id=$1", uid)
    assert n > 0, "gece taraması hiç transit bulamadı"
    # Ciddiyet eşiği uygulanmalı — her açı bildirim değil
    assert await db.fetchval("SELECT min(severity) FROM transits_queue") >= 0.5


async def test_bildirimi_kapali_kullanici_taranmiyor(db, monkeypatch):
    """Boşuna hesap: opt-in yoksa transit üretmenin anlamı yok."""
    uid = await _kullanici(db, optin=False)
    await db.execute(
        """INSERT INTO birth_profiles (user_id, is_primary, birth_date, birth_time,
                                       time_known, lat, lon, tz_name)
           VALUES ($1,true,$2,$3,true,41.0082,28.9784,'Europe/Istanbul')""",
        uid, date(1993, 6, 14), time(4, 30))
    monkeypatch.setattr(tasks, "connect", lambda: _ayni(db))
    await tasks._nightly_transits(days_ahead=10)
    assert await db.fetchval("SELECT count(*) FROM transits_queue") == 0


# ---------------------------------------------------------- doğrulama soruları

async def test_ask_verdicts_penceresi_kapanani_soruyor(db, push_yakala, monkeypatch):
    uid = await _kullanici(db)
    rid = str(uuid.uuid4())
    await db.execute("INSERT INTO readings (id,user_id,kind,status) "
                     "VALUES ($1,$2,'daily','done')", rid, uid)
    await db.execute(
        """INSERT INTO predictions (reading_id,user_id,topic,claim,
                                    window_start,window_end,confidence)
           VALUES ($1,$2,'ask','Beklemediğin bir mesaj alacaksın',
                   now() - interval '20 days', now() - interval '1 days','orta')""",
        rid, uid)
    monkeypatch.setattr(tasks, "connect", lambda: _ayni(db))

    await tasks._ask_verdicts(100)
    assert len(push_yakala) == 1
    assert "tuttu mu" in push_yakala[0]["body"]
    assert push_yakala[0]["data"]["deeplink"] == "verdict"
    assert await db.fetchval(
        "SELECT count(*) FROM predictions WHERE asked_at IS NOT NULL") == 1


async def test_penceresi_dolmamis_tahmin_sorulmuyor(db, push_yakala, monkeypatch):
    uid = await _kullanici(db)
    rid = str(uuid.uuid4())
    await db.execute("INSERT INTO readings (id,user_id,kind,status) "
                     "VALUES ($1,$2,'daily','done')", rid, uid)
    await db.execute(
        """INSERT INTO predictions (reading_id,user_id,topic,claim,
                                    window_start,window_end,confidence)
           VALUES ($1,$2,'ask','henüz erken', now(),
                   now() + interval '9 days','orta')""", rid, uid)
    monkeypatch.setattr(tasks, "connect", lambda: _ayni(db))
    await tasks._ask_verdicts(100)
    assert push_yakala == []


# --------------------------------------------------------------------- yardımcı

class _ayni:
    """Testteki tek bağlantıyı worker'a ver; close() çağrısını yut.

    Worker üretimde kendi bağlantısını açıp kapatıyor. Testte fixture'ın
    bağlantısı kapanırsa sonraki assert'ler düşer.
    """

    def __init__(self, conn):
        self._c = conn

    def __await__(self):
        async def _():
            return _Sarmal(self._c)
        return _().__await__()


class _Sarmal:
    def __init__(self, c):
        self._c = c

    def __getattr__(self, ad):
        return getattr(self._c, ad)

    async def close(self):
        return None


# ------------------------------------------------------------- KVKK kalıcı silme

async def test_silinen_kullanici_kalici_siliniyor(db, monkeypatch):
    """DELETE /v1/me yalnızca işaretliyordu; bu iş yazılmadan kullanıcının
    doğum verisi, fal geçmişi ve tahminleri veritabanında süresiz kalıyordu.
    "Sildim" deyip saklamak silme talebini karşılamamak demek."""
    uid = await _kullanici(db)
    await db.execute(
        """INSERT INTO birth_profiles (user_id, is_primary, birth_date, lat, lon)
           VALUES ($1,true,$2,41.0,29.0)""", uid, date(1993, 6, 14))
    rid = str(uuid.uuid4())
    await db.execute("INSERT INTO readings (id,user_id,kind,status) "
                     "VALUES ($1,$2,'daily','done')", rid, uid)
    await db.execute(
        """INSERT INTO predictions (reading_id,user_id,topic,claim,
                                    window_start,window_end)
           VALUES ($1,$2,'ask','x', now(), now())""", rid, uid)
    await db.execute(
        "UPDATE users SET deleted_at = now() - interval '2 days' WHERE id=$1", uid)
    monkeypatch.setattr(tasks, "connect", lambda: _ayni(db))

    n = await tasks._purge_deleted_users(24)
    assert n == 1
    # Cascade her şeyi götürmeli — arkada kişisel veri kalmamalı
    for tablo in ("users", "birth_profiles", "readings", "predictions"):
        assert await db.fetchval(f"SELECT count(*) FROM {tablo}") == 0, tablo


async def test_bekleme_suresi_dolmadan_silinmiyor(db, monkeypatch):
    uid = await _kullanici(db)
    await db.execute("UPDATE users SET deleted_at = now() WHERE id=$1", uid)
    monkeypatch.setattr(tasks, "connect", lambda: _ayni(db))
    assert await tasks._purge_deleted_users(24) == 0
    assert await db.fetchval("SELECT count(*) FROM users") == 1


async def test_aktif_kullanici_silinmiyor(db, monkeypatch):
    await _kullanici(db)
    monkeypatch.setattr(tasks, "connect", lambda: _ayni(db))
    assert await tasks._purge_deleted_users(0) == 0
    assert await db.fetchval("SELECT count(*) FROM users") == 1
