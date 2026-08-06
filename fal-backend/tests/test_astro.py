"""
Astroloji motorunun doğrulaması.

YÖNTEM: Swiss Ephemeris'in çıktısını yayınlanmış harita tablolarına karşı değil,
BAĞIMSIZ OLARAK BURADA UYGULANMIŞ astronomik formüllere karşı doğruluyoruz.

Sebep: bir referans haritanın değerlerini elle koda yazmak, o değerleri yanlış
hatırlarsam hatayı teste gömer. Aşağıdaki formüller (USNO düşük hassasiyetli
güneş boylamı, GMST, yükselen/MC kapalı formu) astro.py'den tamamen bağımsız
ve sadece math modülüne dayanıyor — ikisi aynı anda aynı şekilde yanlış olamaz.

Asıl yakalanmak istenen hata sınıfı: timezone zincirinin bozulması. Yerel saat
UTC'ye yanlış çevrilirse yükselen saatte 15° kayar; kullanıcı yanlış yükselen
görür ve bunu hiçbir yerde fark etmezsin. `test_turkiye_dst_*` testleri bunun
regresyonudur.
"""

from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import pytest
import swisseph as swe

from app.core import astro
from app.core.astro import BirthInput, compute_chart

D2R = math.pi / 180.0
R2D = 180.0 / math.pi

# Bağımsız formüller ile swisseph arasında kabul edilen sapma.
# Ölçülen gerçek fark tüm test vakalarında < 0.007°; 0.05° rahat bir tavan.
TOL_DEG = 0.05


# ------------------------------------------------------- bağımsız referans formüller

def ref_gmst_deg(jd_ut: float) -> float:
    """Greenwich ortalama yıldız zamanı (derece). USNO yaklaşık formülü."""
    d = jd_ut - 2451545.0
    hours = (18.697374558 + 24.06570982441908 * d) % 24.0
    return hours * 15.0


def ref_obliquity_deg(jd_ut: float) -> float:
    """Ekliptik eğikliği (derece). IAU 1980 serisinin ilk terimleri."""
    t = (jd_ut - 2451545.0) / 36525.0
    return (23.439291111
            - 0.0130041667 * t
            - 1.638889e-7 * t * t
            + 5.036111e-7 * t ** 3)


def ref_sun_lon_deg(jd_ut: float) -> float:
    """Güneşin ekliptik boylamı. USNO düşük hassasiyetli formülü (±0.01°)."""
    n = jd_ut - 2451545.0
    mean_lon = (280.460 + 0.9856474 * n) % 360.0
    mean_anom = ((357.528 + 0.9856003 * n) % 360.0) * D2R
    return (mean_lon + 1.915 * math.sin(mean_anom)
            + 0.020 * math.sin(2 * mean_anom)) % 360.0


def ref_asc_mc_deg(jd_ut: float, lat: float, lon_east: float) -> tuple[float, float]:
    """Yükselen ve MC'nin ekliptik boylamı — küresel astronomi kapalı formu."""
    ramc = (ref_gmst_deg(jd_ut) + lon_east) % 360.0
    eps = ref_obliquity_deg(jd_ut) * D2R
    r = ramc * D2R
    phi = lat * D2R
    asc = math.atan2(
        math.cos(r),
        -(math.sin(r) * math.cos(eps) + math.tan(phi) * math.sin(eps)),
    ) * R2D % 360.0
    mc = math.atan2(math.sin(r), math.cos(r) * math.cos(eps)) * R2D % 360.0
    return asc, mc


def angular_diff(a: float, b: float) -> float:
    d = abs(a - b) % 360.0
    return min(d, 360.0 - d)


# Coğrafi çeşitlilik kasıtlı: kuzey/güney yarımküre, yüksek enlem, negatif boylam.
# Yükselen formülü tan(enlem) içerir; sadece İstanbul'la test etmek işaret
# hatalarını gizler.
CASES = [
    # (yıl, ay, gün, UT saat, enlem, doğu boylam, açıklama)
    (2000, 1, 1, 12.00, 41.0082, 28.9784, "J2000, İstanbul"),
    (1993, 6, 14, 1.50, 41.0082, 28.9784, "yaz, İstanbul"),
    (1975, 11, 3, 22.25, 39.9334, 32.8597, "gece, Ankara"),
    (2024, 3, 20, 3.00, -33.4489, -70.6693, "güney yarımküre, Santiago"),
    (1960, 7, 4, 6.75, 60.1699, 24.9384, "yüksek enlem, Helsinki"),
    (2010, 12, 21, 18.00, 25.2048, 55.2708, "Dubai"),
    (1987, 9, 9, 9.00, -6.2088, 106.8456, "Cakarta"),
]


@pytest.mark.parametrize("y,m,d,h,lat,lon,label", CASES)
def test_gunes_boylami_bagimsiz_formulle_uyusuyor(y, m, d, h, lat, lon, label):
    jd = swe.julday(y, m, d, h)
    res, _ = swe.calc_ut(jd, swe.SUN, astro.FLAGS)
    assert angular_diff(res[0], ref_sun_lon_deg(jd)) < TOL_DEG, label


@pytest.mark.parametrize("y,m,d,h,lat,lon,label", CASES)
def test_yukselen_ve_mc_bagimsiz_formulle_uyusuyor(y, m, d, h, lat, lon, label):
    jd = swe.julday(y, m, d, h)
    cusps, ascmc = swe.houses(jd, lat, lon, b"P")
    ref_asc, ref_mc = ref_asc_mc_deg(jd, lat, lon)
    assert angular_diff(ascmc[0], ref_asc) < TOL_DEG, f"ASC {label}"
    assert angular_diff(ascmc[1], ref_mc) < TOL_DEG, f"MC {label}"


def test_compute_chart_yukseleni_bagimsiz_formulle_uyusuyor():
    """Uçtan uca: BirthInput → tz çevrimi → JD → yükselen."""
    b = BirthInput(1993, 6, 14, 4, 30, 41.0082, 28.9784, "Europe/Istanbul")
    chart = compute_chart(b)

    utc = datetime(1993, 6, 14, 4, 30,
                   tzinfo=ZoneInfo("Europe/Istanbul")).astimezone(timezone.utc)
    jd = swe.julday(utc.year, utc.month, utc.day, utc.hour + utc.minute / 60)
    ref_asc, _ = ref_asc_mc_deg(jd, 41.0082, 28.9784)
    assert angular_diff(chart.ascendant, ref_asc) < TOL_DEG


# ------------------------------------------------------------- timezone regresyonu

def test_turkiye_dst_1993_yaz_utc3():
    """1993 Haziran'da Türkiye yaz saatinde (EEST, UTC+3) idi."""
    off = datetime(1993, 6, 14, 4, 30,
                   tzinfo=ZoneInfo("Europe/Istanbul")).utcoffset()
    assert off.total_seconds() / 3600 == 3.0


def test_turkiye_dst_1993_kis_utc2():
    """Aynı yıl kışın UTC+2. Sabit +3 varsayan kod burada 1 saat kayar."""
    off = datetime(1993, 1, 14, 4, 30,
                   tzinfo=ZoneInfo("Europe/Istanbul")).utcoffset()
    assert off.total_seconds() / 3600 == 2.0


def test_turkiye_2016_sonrasi_kalici_utc3():
    """2016'dan sonra yaz saati kaldırıldı, kış da UTC+3."""
    for month in (1, 6):
        off = datetime(2020, month, 15, 4, 30,
                       tzinfo=ZoneInfo("Europe/Istanbul")).utcoffset()
        assert off.total_seconds() / 3600 == 3.0


def test_yanlis_timezone_yukseleni_kaydiriyor():
    """Timezone zinciri bozulursa ne olduğunu sabitler.

    Bu test 'geçmesi' gereken bir davranışı değil, hatanın BÜYÜKLÜĞÜNÜ ölçüyor:
    1 saatlik kayma yükseleni ~15° kaydırır, yani çoğu durumda burç değiştirir.
    Kullanıcıya yanlış yükselen göstermek onboarding'in en kritik ekranını
    (reveal) sessizce bozar — bu yüzden sapma büyüklüğü kayıt altında.
    """
    ist = compute_chart(BirthInput(1993, 6, 14, 4, 30, 41.0082, 28.9784,
                                   "Europe/Istanbul"))
    utc_yanlis = compute_chart(BirthInput(1993, 6, 14, 4, 30, 41.0082, 28.9784,
                                          "UTC"))
    kayma = angular_diff(ist.ascendant, utc_yanlis.ascendant)
    # 3 saatlik fark → ~45° (yükselen saatte ortalama 15° ilerler, enleme göre
    # hızı değişir; 30-60 aralığı bu enlem için makul)
    assert 30.0 < kayma < 60.0, f"beklenmeyen kayma: {kayma}"


def test_dst_gecisi_haritayi_degistiriyor():
    """DST'nin uygulandığını doğrudan kanıtlar: yaz ve kış aynı yerel saatte
    aynı UTC ofsetini kullanmıyor."""
    yaz = BirthInput(1993, 7, 1, 12, 0, 41.0082, 28.9784, "Europe/Istanbul")
    kis = BirthInput(1993, 1, 1, 12, 0, 41.0082, 28.9784, "Europe/Istanbul")
    jd_yaz = astro._julian_day(yaz)
    jd_kis = astro._julian_day(kis)
    # Aynı yerel saat, farklı ofset → JD'nin kesirli kısmı 1 saat farklı olmalı
    frac_yaz = (jd_yaz % 1.0) * 24
    frac_kis = (jd_kis % 1.0) * 24
    assert abs((frac_kis - frac_yaz) % 24 - 1.0) < 1e-6


# ----------------------------------------------------------------- ev sistemi

def test_yukselen_birinci_evin_baslangici():
    b = BirthInput(1988, 4, 22, 15, 45, 39.9334, 32.8597, "Europe/Istanbul")
    chart = compute_chart(b)
    assert angular_diff(chart.houses[0], chart.ascendant) < 1e-3


def test_yukselenin_hemen_ustundeki_nokta_birinci_evde():
    b = BirthInput(1988, 4, 22, 15, 45, 39.9334, 32.8597, "Europe/Istanbul")
    chart = compute_chart(b)
    assert astro._house_of((chart.ascendant + 1.0) % 360, chart.houses) == 1
    assert astro._house_of((chart.ascendant - 1.0) % 360, chart.houses) == 12


def test_evler_360_dereceyi_kapsiyor():
    """Her ev bir sonrakine bitişik ve toplam tam bir tur olmalı."""
    chart = compute_chart(BirthInput(1995, 2, 2, 8, 15, 41.0082, 28.9784))
    total = 0.0
    for i in range(12):
        span = (chart.houses[(i + 1) % 12] - chart.houses[i]) % 360.0
        assert 0 < span < 180, f"{i+1}. ev anlamsız genişlikte: {span}"
        total += span
    assert abs(total - 360.0) < 1e-6


def test_saat_bilinmiyorsa_ev_atanmiyor():
    """time_known=False iken ev bilgisi güvenilmez; None dönmeli ki LLM
    'yükselen evin' gibi uydurma yorum yapmasın."""
    chart = compute_chart(BirthInput(1990, 5, 5, 12, 0, time_known=False))
    assert all(b.house is None for b in chart.bodies.values())
    assert chart.llm_context()["saat_bilinmiyor"] is True


# --------------------------------------------------------------------- açılar

def test_aci_tespiti_ve_orb_hesabi():
    chart = compute_chart(BirthInput(2001, 8, 17, 3, 20, 41.0082, 28.9784))
    for a in chart.aspects:
        exact = dict((k, deg) for k, deg, _, _ in astro.ASPECTS)[a.kind]
        diff = angular_diff(chart.bodies[a.a].lon, chart.bodies[a.b].lon)
        assert abs(abs(diff - exact) - a.orb) < 0.02, f"{a.kind} orb tutarsız"
        assert 0.0 <= a.strength <= 1.0


def test_ayni_cift_icin_tek_aci():
    """Bir gezegen çifti aynı anda hem kare hem üçgen olamaz."""
    chart = compute_chart(BirthInput(2001, 8, 17, 3, 20, 41.0082, 28.9784))
    pairs = [tuple(sorted((a.a, a.b))) for a in chart.aspects]
    assert len(pairs) == len(set(pairs))


def test_isiklara_genis_orb_taniniyor():
    assert astro._orb_limit("square", 7.0, "sun", "mars") == 9.0
    assert astro._orb_limit("square", 7.0, "saturn", "mars") == 7.0


# ------------------------------------------------------------------- ay fazı

def test_ay_fazi_swisseph_aydinlanmasiyla_uyusuyor():
    """Ay fazı sınıflandırmasını bağımsız kaynağa karşı doğrula:
    swe.pheno_ut aydınlanma oranını kendi hesaplar."""
    for y, m, d in [(2024, 1, 11), (2024, 1, 25), (2024, 2, 2), (2023, 6, 18)]:
        jd = swe.julday(y, m, d, 12.0)
        sun, _ = swe.calc_ut(jd, swe.SUN, astro.FLAGS)
        moon, _ = swe.calc_ut(jd, swe.MOON, astro.FLAGS)
        phase = astro._moon_phase(sun[0], moon[0])
        ref_illum = swe.pheno_ut(jd, swe.MOON, astro.FLAGS)[1]
        assert abs(phase["illumination"] - ref_illum) < 0.02, f"{y}-{m}-{d}"


def test_ay_fazi_isimleri_elongasyonla_tutarli():
    assert astro._moon_phase(0, 0)["key"] == "new_moon"
    assert astro._moon_phase(0, 180)["key"] == "full_moon"
    assert astro._moon_phase(10, 100)["key"] == "first_quarter"
    assert astro._moon_phase(0, 270)["key"] == "last_quarter"
    assert astro._moon_phase(200, 20)["key"] == "full_moon"   # elongasyon 180


# ---------------------------------------------------------------- transitler

def test_transit_taramasi_sikilastikca_azaliyor():
    chart = compute_chart(BirthInput(1993, 6, 14, 4, 30))
    now = datetime(2026, 3, 1, tzinfo=timezone.utc)
    genis = astro.transits_for(chart, now, tight_orb=2.0)
    dar = astro.transits_for(chart, now, tight_orb=0.3)
    assert len(dar) <= len(genis)
    assert all(h["orb"] <= 0.3 for h in dar)


def test_transit_siddeti_yavas_gezegenlerde_yuksek():
    """Bildirim kotası (günde 2) severity'ye göre sıralanıyor; Satürn'ün
    Ay'a karesi Mars'ın Neptün'e altmışlığından önce gelmeli."""
    agir = astro._severity("saturn", "moon", "square", 0.1)
    hafif = astro._severity("mars", "neptune", "sextile", 0.1)
    assert agir > hafif


def test_transitler_severity_sirali():
    chart = compute_chart(BirthInput(1993, 6, 14, 4, 30))
    hits = astro.transits_for(chart, datetime(2026, 6, 1, tzinfo=timezone.utc),
                              tight_orb=3.0)
    assert hits == sorted(hits, key=lambda h: -h["severity"])


# ------------------------------------------------- blok anahtarları ve çıktı şekli

def test_kosul_anahtarlari_blok_kutuphanesiyle_ortusuyor():
    """astro.condition_keys() üreten taraf, blocks.all_condition_keys() ise
    kütüphaneyi dolduran taraf. İkisi ayrışırsa ücretsiz kullanıcı boş yorum
    alır — maliyet mimarisi sessizce çöker."""
    from app.core.blocks import all_condition_keys

    havuz = set(all_condition_keys())
    for b in [BirthInput(1993, 6, 14, 4, 30), BirthInput(1975, 11, 3, 22, 15),
              BirthInput(2001, 8, 17, 3, 20), BirthInput(1960, 7, 4, 6, 45)]:
        for k in astro.condition_keys(compute_chart(b)):
            assert k in havuz, f"kütüphanede karşılığı olmayan anahtar: {k}"


def test_chart_json_serilestirilebilir():
    """chart_json Postgres'e jsonb olarak yazılıyor; numpy/float32 sızarsa
    kayıt anında patlar."""
    chart = compute_chart(BirthInput(1993, 6, 14, 4, 30))
    s = json.dumps(chart.to_dict(), ensure_ascii=False)
    assert json.loads(s)["ascendant"] == chart.ascendant


def test_llm_context_hesaplanmis_veriden_olusuyor():
    """LLM'e giden bağlamda yükselen, gezegenler ve açılar bulunmalı —
    'halüsinasyon üretmeyen astroloji' tezinin somut karşılığı."""
    ctx = compute_chart(BirthInput(1993, 6, 14, 4, 30)).llm_context()
    assert "yukselen" in ctx and "°" in ctx["yukselen"]
    assert len(ctx["gezegenler"]) >= 10
    assert ctx["harita_yoneticisi"]


def test_element_dagilimi_on_gezegeni_sayiyor():
    chart = compute_chart(BirthInput(1993, 6, 14, 4, 30))
    assert sum(chart.element_balance.values()) == 10
    assert sum(chart.modality_balance.values()) == 10
