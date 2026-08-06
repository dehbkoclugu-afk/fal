"""
API uç testleri — gerçek Postgres, taklit kuyruk ve Redis.

Kuyruk taklit ediliyor çünkü test edilen şey HTTP sözleşmesi: jeton düşümü,
yetkilendirme, doğrulama ve 202 davranışı. Üretimin kendisi test_pipeline'da.
"""

from __future__ import annotations

import uuid

import httpx
import pytest

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
async def client(db, queue, monkeypatch):
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
    uid = await db.fetchval("SELECT id FROM users WHERE anon_id=$1", anon)
    await db.execute(
        """INSERT INTO coin_ledger (user_id, delta, reason, balance_after)
           VALUES ($1,$2,'purchase',$2)""", uid, adet)
    return uid


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

async def test_jeton_yetmezse_402(client, anon):
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
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
    assert await db.fetchval("SELECT count(*) FROM coin_ledger") == 0


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


async def test_kahve_fali_fotografi_redise_yaziyor(client, db, anon, queue):
    from app import main
    await client.put("/v1/profile", json=PROFIL, headers=H(anon))
    await coin_ver(db, anon, 10)
    r = await client.post("/v1/readings/coffee",
                          files={"photo": ("cup.jpg", b"sahte-jpeg", "image/jpeg")},
                          data={"question": "ne görüyorsun", "handle_angle": "0"},
                          headers=H(anon))
    assert r.status_code == 202
    rid = r.json()["reading_id"]
    assert f"cupimg:{rid}" in main.state["redis"].store
    assert len(queue.jobs) == 1


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
    assert "gorunur" in d["output_json"]


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

async def test_revenuecat_webhook_imzasiz_reddediliyor(client):
    r = await client.post("/v1/webhooks/revenuecat", json={"event": {}})
    assert r.status_code == 401


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
