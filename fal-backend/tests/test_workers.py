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
    """Gerçek gönderim yerine kayıt tut — OneSignal çağrısı yapılmasın."""
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
