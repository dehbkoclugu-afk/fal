"""
Deterministik astroloji motoru.

TEMEL KURAL: LLM burada hiçbir şey hesaplamaz. Gezegen pozisyonu, ev, açı —
hepsi Swiss Ephemeris'ten gelir. LLM sadece bu JSON'u yorumlar.
Bu ayrım, "halüsinasyon üretmeyen astroloji" farklılaşmasının tamamıdır.

Kurulum:
    pip install pyswisseph timezonefinder
    # Ephemeris dosyaları (~30 MB, sepl_18.se1 / semo_18.se1) SWE_EPHE_PATH'e konur.
    # Dosya koymazsan Moshier yaklaşımı kullanılır (±1 yay saniyesi, ürün için yeterli).
"""

from __future__ import annotations

import math
import os
from dataclasses import dataclass, asdict, field
from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

import swisseph as swe

EPHE_PATH = os.getenv("SWE_EPHE_PATH", "")
if EPHE_PATH:
    swe.set_ephe_path(EPHE_PATH)

# Hesap bayrağı: geosentrik, hız dahil (retro tespiti için hız şart)
FLAGS = swe.FLG_SWIEPH | swe.FLG_SPEED

SIGNS_TR = [
    "Koç", "Boğa", "İkizler", "Yengeç", "Aslan", "Başak",
    "Terazi", "Akrep", "Yay", "Oğlak", "Kova", "Balık",
]
SIGN_KEYS = [
    "aries", "taurus", "gemini", "cancer", "leo", "virgo",
    "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
]
ELEMENTS = ["fire", "earth", "air", "water"] * 3  # burç indeksine göre döner
MODALITIES = ["cardinal", "fixed", "mutable"] * 4

# (anahtar, swe sabiti, TR ad)
BODIES: list[tuple[str, int, str]] = [
    ("sun", swe.SUN, "Güneş"),
    ("moon", swe.MOON, "Ay"),
    ("mercury", swe.MERCURY, "Merkür"),
    ("venus", swe.VENUS, "Venüs"),
    ("mars", swe.MARS, "Mars"),
    ("jupiter", swe.JUPITER, "Jüpiter"),
    ("saturn", swe.SATURN, "Satürn"),
    ("uranus", swe.URANUS, "Uranüs"),
    ("neptune", swe.NEPTUNE, "Neptün"),
    ("pluto", swe.PLUTO, "Plüton"),
    ("node", swe.MEAN_NODE, "Kuzey Ay Düğümü"),
    ("chiron", swe.CHIRON, "Chiron"),
]

LUMINARIES = {"sun", "moon"}

# Açı tanımları: (anahtar, tam derece, temel orb, TR ad)
ASPECTS: list[tuple[str, float, float, str]] = [
    ("conjunction", 0.0, 8.0, "kavuşum"),
    ("sextile", 60.0, 5.0, "altmışlık"),
    ("square", 90.0, 7.0, "kare"),
    ("trine", 120.0, 7.0, "üçgen"),
    ("quincunx", 150.0, 3.0, "yüz elliklik"),
    ("opposition", 180.0, 8.0, "karşıtlık"),
]
HARD_ASPECTS = {"conjunction", "square", "opposition"}

# Burç yöneticileri (geleneksel + modern karışık, ürün tonuna göre değiştir)
RULERS = {
    "aries": "mars", "taurus": "venus", "gemini": "mercury", "cancer": "moon",
    "leo": "sun", "virgo": "mercury", "libra": "venus", "scorpio": "pluto",
    "sagittarius": "jupiter", "capricorn": "saturn", "aquarius": "uranus",
    "pisces": "neptune",
}


# ---------------------------------------------------------------- veri sınıfları

@dataclass
class BirthInput:
    """Doğum verisi. lat/lon dışarıda geocode edilir, tz_name IANA formatındadır."""
    year: int
    month: int
    day: int
    hour: int = 12
    minute: int = 0
    lat: float = 41.0082          # varsayılan: İstanbul
    lon: float = 28.9784
    tz_name: str = "Europe/Istanbul"
    time_known: bool = True       # False ise ev sistemi güvenilmez, uyarı üretilir


@dataclass
class BodyPos:
    key: str
    name_tr: str
    lon: float                    # ekliptik boylam, 0-360
    sign: str                     # sign key
    sign_tr: str
    degree_in_sign: float
    house: int | None
    retrograde: bool
    speed: float


@dataclass
class Aspect:
    a: str
    b: str
    kind: str
    kind_tr: str
    orb: float                    # tam açıdan sapma (derece)
    applying: bool                # yaklaşıyor mu (aktifleşiyor)
    strength: float               # 0-1, orb'a göre normalize


@dataclass
class Chart:
    bodies: dict[str, BodyPos]
    houses: list[float]                      # 12 ev başlangıcı
    ascendant: float
    mc: float
    aspects: list[Aspect]
    element_balance: dict[str, int]
    modality_balance: dict[str, int]
    chart_ruler: str
    moon_phase: dict[str, Any]
    meta: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        d = asdict(self)
        d["bodies"] = {k: asdict(v) for k, v in self.bodies.items()}
        d["aspects"] = [asdict(a) for a in self.aspects]
        return d

    def llm_context(self) -> dict:
        """LLM'e giden sıkıştırılmış hâl. Token tasarrufu için gereksiz alanlar atılır."""
        return {
            "yukselen": f"{SIGNS_TR[int(self.ascendant // 30)]} {self.ascendant % 30:.1f}°",
            "gezegenler": [
                f"{b.name_tr} {b.sign_tr} {b.degree_in_sign:.1f}°"
                f"{f' / {b.house}. ev' if b.house else ''}"
                f"{' (retro)' if b.retrograde else ''}"
                for b in self.bodies.values()
            ],
            "onemli_acilar": [
                f"{self.bodies[a.a].name_tr} {a.kind_tr} {self.bodies[a.b].name_tr} (orb {a.orb:.1f}°)"
                for a in self.aspects if a.strength > 0.55
            ][:14],
            "element_dagilimi": self.element_balance,
            "modalite_dagilimi": self.modality_balance,
            "harita_yoneticisi": self.bodies[self.chart_ruler].name_tr,
            "ay_fazi": self.moon_phase["name_tr"],
            "saat_bilinmiyor": self.meta.get("time_unknown", False),
        }


# ------------------------------------------------------------------- yardımcılar

def _julian_day(b: BirthInput) -> float:
    """Yerel doğum saatini UTC'ye çevirip Julian Day üretir.

    zoneinfo tarihsel DST kurallarını uygular — Türkiye'nin 2016'da kalıcı
    UTC+3'e geçişi ve öncesindeki yaz saati uygulamaları dahil. Bu detay
    atlanırsa 1990'larda doğmuş kullanıcıların yükseleni 30 derece kayar.
    """
    tz = ZoneInfo(b.tz_name)
    local = datetime(b.year, b.month, b.day, b.hour, b.minute, tzinfo=tz)
    utc = local.astimezone(timezone.utc)
    hour_frac = utc.hour + utc.minute / 60 + utc.second / 3600
    return swe.julday(utc.year, utc.month, utc.day, hour_frac)


def _norm360(x: float) -> float:
    return x % 360.0


def _house_of(lon: float, cusps: list[float]) -> int:
    """Boylamın hangi eve düştüğünü bulur (eşit olmayan ev sistemleri dahil)."""
    for i in range(12):
        start = cusps[i]
        end = cusps[(i + 1) % 12]
        if start <= end:
            if start <= lon < end:
                return i + 1
        else:  # 0 derece sınırını geçen ev
            if lon >= start or lon < end:
                return i + 1
    return 1


def _moon_phase(sun_lon: float, moon_lon: float) -> dict[str, Any]:
    elong = _norm360(moon_lon - sun_lon)
    illum = (1 - math.cos(math.radians(elong))) / 2
    if elong < 15 or elong >= 345:
        key, tr = "new_moon", "Yeni Ay"
    elif elong < 75:
        key, tr = "waxing_crescent", "Hilal (büyüyen)"
    elif elong < 105:
        key, tr = "first_quarter", "İlk Dördün"
    elif elong < 165:
        key, tr = "waxing_gibbous", "Şişkin Ay (büyüyen)"
    elif elong < 195:
        key, tr = "full_moon", "Dolunay"
    elif elong < 255:
        key, tr = "waning_gibbous", "Şişkin Ay (küçülen)"
    elif elong < 285:
        key, tr = "last_quarter", "Son Dördün"
    else:
        key, tr = "waning_crescent", "Hilal (küçülen)"
    return {"key": key, "name_tr": tr, "elongation": round(elong, 2),
            "illumination": round(illum, 3)}


def _orb_limit(kind: str, base: float, a: str, b: str) -> float:
    """Işıklar (Güneş/Ay) daha geniş orb tolere eder."""
    bonus = 2.0 if (a in LUMINARIES or b in LUMINARIES) else 0.0
    return base + bonus


# ------------------------------------------------------------------ ana fonksiyon

def compute_chart(b: BirthInput, house_system: bytes = b"P") -> Chart:
    """Natal harita. house_system: P=Placidus, W=Whole sign, K=Koch, O=Porphyry."""
    jd = _julian_day(b)

    positions: dict[str, BodyPos] = {}
    raw: dict[str, tuple[float, float]] = {}
    for key, code, name_tr in BODIES:
        try:
            res, _flag = swe.calc_ut(jd, code, FLAGS)
        except Exception:
            continue  # Chiron eski ephemeris dosyalarında olmayabilir
        lon, _lat, _dist, lon_speed = res[0], res[1], res[2], res[3]
        raw[key] = (lon, lon_speed)

    # Evler. Saat bilinmiyorsa hesaplanır ama güvenilmez olarak işaretlenir.
    cusps, ascmc = swe.houses(jd, b.lat, b.lon, house_system)
    cusps = list(cusps)
    if len(cusps) == 13:      # bazı sürümler 1-indeksli döner
        cusps = cusps[1:]
    asc, mc = ascmc[0], ascmc[1]

    for key, code, name_tr in BODIES:
        if key not in raw:
            continue
        lon, speed = raw[key]
        sign_idx = int(lon // 30)
        positions[key] = BodyPos(
            key=key,
            name_tr=name_tr,
            lon=round(lon, 4),
            sign=SIGN_KEYS[sign_idx],
            sign_tr=SIGNS_TR[sign_idx],
            degree_in_sign=round(lon % 30, 2),
            house=_house_of(lon, cusps) if b.time_known else None,
            retrograde=speed < 0 and key != "node",
            speed=round(speed, 5),
        )

    aspects = _find_aspects(positions)

    elements = {e: 0 for e in ("fire", "earth", "air", "water")}
    modalities = {m: 0 for m in ("cardinal", "fixed", "mutable")}
    for key in ("sun", "moon", "mercury", "venus", "mars",
                "jupiter", "saturn", "uranus", "neptune", "pluto"):
        if key in positions:
            idx = SIGN_KEYS.index(positions[key].sign)
            elements[ELEMENTS[idx]] += 1
            modalities[MODALITIES[idx]] += 1

    asc_sign = SIGN_KEYS[int(asc // 30)]
    ruler = RULERS[asc_sign]
    if ruler not in positions:
        ruler = "sun"

    return Chart(
        bodies=positions,
        houses=[round(c, 4) for c in cusps],
        ascendant=round(asc, 4),
        mc=round(mc, 4),
        aspects=aspects,
        element_balance=elements,
        modality_balance=modalities,
        chart_ruler=ruler,
        moon_phase=_moon_phase(raw["sun"][0], raw["moon"][0]),
        meta={
            "jd": jd,
            "house_system": house_system.decode(),
            "time_unknown": not b.time_known,
            "ephe": "swieph" if EPHE_PATH else "moshier",
            "engine_version": "1.0.0",
        },
    )


def _find_aspects(pos: dict[str, BodyPos]) -> list[Aspect]:
    out: list[Aspect] = []
    keys = list(pos.keys())
    for i in range(len(keys)):
        for j in range(i + 1, len(keys)):
            a, b = keys[i], keys[j]
            if {a, b} == {"node", "chiron"}:
                continue
            diff = abs(pos[a].lon - pos[b].lon)
            if diff > 180:
                diff = 360 - diff
            for kind, exact, base_orb, kind_tr in ASPECTS:
                limit = _orb_limit(kind, base_orb, a, b)
                orb = abs(diff - exact)
                if orb <= limit:
                    # Yaklaşan mı: hızlı gezegen yavaşa doğru gidiyorsa açı aktifleşiyor
                    rel_speed = pos[a].speed - pos[b].speed
                    applying = (diff < exact and rel_speed > 0) or \
                               (diff > exact and rel_speed < 0)
                    out.append(Aspect(
                        a=a, b=b, kind=kind, kind_tr=kind_tr,
                        orb=round(orb, 2),
                        applying=applying,
                        strength=round(1 - (orb / limit), 3),
                    ))
                    break
    out.sort(key=lambda x: -x.strength)
    return out


# ------------------------------------------------------- transit motoru (bildirim yakıtı)

# Bildirim değeri olan gezegenler: hızlılar gürültü üretir, yavaşlar anlam taşır
TRANSIT_BODIES = ["mars", "jupiter", "saturn", "uranus", "neptune", "pluto"]
FAST_TRANSIT_BODIES = ["sun", "mercury", "venus"]


def transits_for(chart: Chart, when: datetime, tight_orb: float = 1.0,
                 include_fast: bool = True) -> list[dict]:
    """Verilen anda natal haritaya gelen sıkı açılar.

    Gece cron'u bunu tüm kullanıcılar için çalıştırıp transits_queue tablosuna yazar.
    "Yarın Satürn senin Venüs'üne kare yapıyor" bildirimlerinin kaynağı burasıdır —
    jenerik burç bildirimlerinden ayrıştığın nokta.
    """
    jd = swe.julday(when.year, when.month, when.day,
                    when.hour + when.minute / 60)
    bodies = TRANSIT_BODIES + (FAST_TRANSIT_BODIES if include_fast else [])
    code_map = {k: c for k, c, _ in BODIES}
    hits: list[dict] = []

    for t_key in bodies:
        try:
            res, _ = swe.calc_ut(jd, code_map[t_key], FLAGS)
        except Exception:
            continue
        t_lon, t_speed = res[0], res[3]
        for n_key, n in chart.bodies.items():
            if n_key in ("node", "chiron"):
                continue
            diff = abs(t_lon - n.lon)
            if diff > 180:
                diff = 360 - diff
            for kind, exact, _base, kind_tr in ASPECTS:
                orb = abs(diff - exact)
                if orb <= tight_orb:
                    severity = _severity(t_key, n_key, kind, orb)
                    hits.append({
                        "transit": t_key,
                        "natal": n_key,
                        "aspect": kind,
                        "aspect_tr": kind_tr,
                        "orb": round(orb, 3),
                        "retrograde": t_speed < 0,
                        "severity": severity,
                        "code": f"{t_key}_{kind}_{n_key}",
                        "house_touched": n.house,
                    })
                    break
    hits.sort(key=lambda h: -h["severity"])
    return hits


def _severity(t: str, n: str, kind: str, orb: float) -> float:
    """0-1 arası önem skoru. Bildirim kotasını (günde max 2) doldurmak için sıralama."""
    slow = {"saturn": 1.0, "pluto": 1.0, "uranus": 0.9, "neptune": 0.85, "jupiter": 0.7}
    base = slow.get(t, 0.4)
    if n in LUMINARIES:
        base += 0.2
    if n in ("venus", "mars"):
        base += 0.1
    if kind in HARD_ASPECTS:
        base += 0.15
    base *= (1 - orb / 2)
    return round(min(max(base, 0.0), 1.0), 3)


def next_notable_transits(chart: Chart, start: datetime, days: int = 90,
                          step_hours: int = 12, top: int = 12) -> list[dict]:
    """Önümüzdeki N gün için kayda değer transitler — 'yıllık kader haritası' ürününün motoru."""
    seen: dict[str, dict] = {}
    cur = start
    end = start + timedelta(days=days)
    while cur < end:
        for h in transits_for(chart, cur, tight_orb=0.6, include_fast=False):
            prev = seen.get(h["code"])
            if prev is None or h["orb"] < prev["orb"]:
                h = {**h, "exact_at": cur.isoformat()}
                seen[h["code"]] = h
        cur += timedelta(hours=step_hours)
    ranked = sorted(seen.values(), key=lambda x: -x["severity"])
    return ranked[:top]


# ------------------------------------- blok kütüphanesi için koşul anahtarları

def condition_keys(chart: Chart) -> list[str]:
    """Haritayı, önceden üretilmiş metin bloklarına eşlenecek anahtarlara indirger.

    blocks.py bu anahtarlarla hazır blok çeker → ücretsiz kullanıcıya
    büyük model çağrısı yapmadan kişisel görünen içerik üretilir.
    Maliyet kontrolünün kalbi burasıdır.
    """
    keys: list[str] = []
    asc_sign = SIGN_KEYS[int(chart.ascendant // 30)]
    keys.append(f"asc_{asc_sign}")
    for k in ("sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"):
        if k in chart.bodies:
            b = chart.bodies[k]
            keys.append(f"{k}_{b.sign}")
            if b.house:
                keys.append(f"{k}_h{b.house}")
            if b.retrograde:
                keys.append(f"{k}_retro")
    for a in chart.aspects[:8]:
        if a.strength > 0.6:
            pair = "_".join(sorted([a.a, a.b]))
            keys.append(f"asp_{pair}_{a.kind}")
    dom_el = max(chart.element_balance, key=chart.element_balance.get)
    keys.append(f"element_dom_{dom_el}")
    keys.append(f"moon_{chart.moon_phase['key']}")
    return keys


if __name__ == "__main__":
    b = BirthInput(1993, 6, 14, 4, 30, 41.0082, 28.9784, "Europe/Istanbul")
    c = compute_chart(b)
    import json
    print(json.dumps(c.llm_context(), ensure_ascii=False, indent=2))
    print("\nKoşul anahtarları:", condition_keys(c)[:15])
    print("\nBugünün transitleri:")
    for t in transits_for(c, datetime.now(timezone.utc))[:5]:
        print(" ", t["code"], t["severity"])
