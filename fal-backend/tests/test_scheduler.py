"""
Zamanlayıcı testleri.

Bu dosyanın varlık sebebi tek cümleyle: `ask_verdicts` çalışmazsa Kader
Günlüğü hiç dolmaz ve ürünün ana farkı olan "söylediğinin hesabını tutuyor"
iddiası sessizce ölür — uygulama çalışıyor görünmeye devam ederek. Elle
yazılan bir crontab satırında bunu hiçbir şey uyarmıyordu.

Testler Redis kullanıyor ama görevlerin kendisini ÇALIŞTIRMIYOR (onlar
test_workers'ta); burada test edilen şey zamanlamanın kendisi.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta

import pytest
from zoneinfo import ZoneInfo

from app.workers import scheduler

TZ = ZoneInfo("Europe/Istanbul")


@pytest.fixture
def r():
    """Temiz bir Redis veritabanı. Yoksa test atlanıyor."""
    from redis import Redis

    url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    try:
        conn = Redis.from_url(url)
        conn.ping()
    except Exception:
        pytest.skip("Redis yok")
    for k in conn.scan_iter("sched:*", count=1000):
        conn.delete(k)
    yield conn
    for k in conn.scan_iter("sched:*", count=1000):
        conn.delete(k)


@pytest.fixture
def sahte_isler(monkeypatch):
    """Gerçek görevlerin yerine sayaç koyar."""
    cagrilar: dict[str, int] = {}

    def yap(ad):
        def _f():
            cagrilar[ad] = cagrilar.get(ad, 0) + 1
        return _f

    isler = [
        scheduler.Is("gunluk_is", yap("gunluk_is"), 12, 0),
        scheduler.Is("saatlik_is", yap("saatlik_is"), None, 0),
        scheduler.Is("gec_is", yap("gec_is"), 23, 30),
    ]
    monkeypatch.setattr(scheduler, "ISLER", isler)
    return cagrilar


def _an(saat, dakika=0, gun=6):
    return datetime(2026, 8, gun, saat, dakika, tzinfo=TZ)


# ------------------------------------------------------------ temel zamanlama

def test_saati_gelmemis_is_calismiyor(r, sahte_isler):
    scheduler.calistir_bekleyenleri(r, _an(9))
    assert "gunluk_is" not in sahte_isler


def test_saati_gelen_is_calisiyor(r, sahte_isler):
    scheduler.calistir_bekleyenleri(r, _an(12))
    assert sahte_isler["gunluk_is"] == 1


def test_ayni_gun_ikinci_kez_calismiyor(r, sahte_isler):
    scheduler.calistir_bekleyenleri(r, _an(12))
    scheduler.calistir_bekleyenleri(r, _an(12, 1))
    scheduler.calistir_bekleyenleri(r, _an(18))
    assert sahte_isler["gunluk_is"] == 1


def test_ertesi_gun_tekrar_calisiyor(r, sahte_isler):
    scheduler.calistir_bekleyenleri(r, _an(12, gun=6))
    scheduler.calistir_bekleyenleri(r, _an(12, gun=7))
    assert sahte_isler["gunluk_is"] == 2


# --------------------------------------------- yeniden başlatma ve kesinti

def test_gecikmis_is_yine_de_calisiyor(r, sahte_isler):
    """Asıl mesele bu.

    Sunucu 12:00'de kapalıysa klasik zamanlayıcı o günü atlar ve doğrulama
    sorusu HİÇ gitmez. Burada kural 'saati yakala' değil, 'bugün çalıştı mı':
    12:40'ta açılan sunucu işi yine çalıştırıyor.
    """
    scheduler.calistir_bekleyenleri(r, _an(12, 40))
    assert sahte_isler["gunluk_is"] == 1


def test_yeniden_baslatma_isi_tekrarlatmiyor(r, sahte_isler):
    """Süreç gün içinde birkaç kez yeniden başlasa da iş bir kez çalışmalı."""
    for saat in (12, 13, 14, 20):
        scheduler.calistir_bekleyenleri(r, _an(saat))
    assert sahte_isler["gunluk_is"] == 1


def test_iki_zamanlayici_ayni_anda_kalkarsa_is_bir_kez_calisiyor(r, sahte_isler):
    """Dağıtım sırasında eski ve yeni süreç bir an birlikte yaşayabiliyor."""
    scheduler.calistir_bekleyenleri(r, _an(12))
    scheduler.calistir_bekleyenleri(r, _an(12))
    assert sahte_isler["gunluk_is"] == 1


# ------------------------------------------------------------- saatlik işler

def test_saatlik_is_her_saat_calisiyor(r, sahte_isler):
    for saat in (9, 10, 11):
        scheduler.calistir_bekleyenleri(r, _an(saat))
    assert sahte_isler["saatlik_is"] == 3


def test_saatlik_is_ayni_saatte_tekrarlanmiyor(r, sahte_isler):
    for dakika in (0, 15, 30, 59):
        scheduler.calistir_bekleyenleri(r, _an(9, dakika))
    assert sahte_isler["saatlik_is"] == 1


# ----------------------------------------------------------- hata dayanıklılığı

def test_patlayan_is_digerlerini_durdurmuyor(r, monkeypatch):
    """Tek bir hatalı sorgu yüzünden o gün hiçbir bakım işinin çalışmaması,
    hatanın kendisinden pahalı."""
    calisti = []

    def patla():
        raise RuntimeError("veritabanı düştü")

    isler = [
        scheduler.Is("patlayan", patla, 12, 0),
        scheduler.Is("saglam", lambda: calisti.append(1), 12, 0),
    ]
    monkeypatch.setattr(scheduler, "ISLER", isler)

    scheduler.calistir_bekleyenleri(r, _an(12))
    assert calisti == [1]


def test_patlayan_is_ayni_gun_yeniden_denenmiyor(r, monkeypatch):
    """Hata döngüsü, sağlayıcıya dakikada bir istek atmak demek olurdu."""
    sayac = []

    def patla():
        sayac.append(1)
        raise RuntimeError("kalıcı hata")

    monkeypatch.setattr(scheduler, "ISLER", [scheduler.Is("patlayan", patla, 12, 0)])
    for dakika in range(0, 30, 5):
        scheduler.calistir_bekleyenleri(r, _an(12, dakika))
    assert len(sayac) == 1


# ------------------------------------------------------------------ uyanma

def test_dakika_basina_kadar_uyuyor():
    sn = scheduler.sonraki_uyanis(datetime(2026, 8, 6, 12, 0, 10, tzinfo=TZ))
    assert 45 < sn <= 50


def test_uyku_hep_pozitif():
    """Sıfır veya negatif uyku, tam dakika başında meşgul döngü demek."""
    for saniye in (0, 1, 59, 59.999):
        an = datetime(2026, 8, 6, 12, 0, tzinfo=TZ) + timedelta(seconds=saniye)
        assert scheduler.sonraki_uyanis(an) >= 1.0


# ------------------------------------------------- gerçek iş listesi tutarlılığı

def test_gercek_isler_cagrilabilir():
    for is_ in scheduler.ISLER:
        assert callable(is_.fn), f"{is_.ad} çağrılabilir değil"
        assert is_.aciklama, f"{is_.ad} açıklamasız"


def test_dogrulama_sorusu_zamanlanmis():
    """Kader Günlüğü'nün dolması buna bağlı; listeden düşerse ürünün ana
    farkı sessizce kaybolur."""
    adlar = {i.ad for i in scheduler.ISLER}
    assert "ask_verdicts" in adlar


def test_kvkk_isleri_zamanlanmis():
    """Silme talebini kalıcılaştıran ve fotoğrafları temizleyen işler
    çalışmazsa 'sildik' demek yanlış beyan olur."""
    adlar = {i.ad for i in scheduler.ISLER}
    assert "purge_deleted_users" in adlar
    assert "purge_assets" in adlar


def test_is_saatleri_gecerli():
    for is_ in scheduler.ISLER:
        if is_.saat is not None:
            assert 0 <= is_.saat <= 23, is_.ad
        assert 0 <= is_.dakika <= 59, is_.ad
