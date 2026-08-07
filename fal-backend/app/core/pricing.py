"""
Jeton fiyatları ve harcama tavanı.

Ayrı dosyada tutulmasının sebebi: worker'ın iade (refund) yapmak için bu tabloya
ihtiyacı var, ama `app.main`'i import etmesi gerekmemeli — bu import worker
sürecinde tüm FastAPI uygulamasını ayağa kaldırır.
"""

from __future__ import annotations

COIN_PRICES = {"coffee": 3, "tarot": 1, "natal": 5, "dream": 2, "daily": 0}

# Kumar döngüsü önlemi ve aynı zamanda iade/chargeback önlemi.
# Kaldırma: günde sınırsız harcama, bu kategoride iade dalgası demek.
DAILY_SPEND_CAP = 25


# ------------------------------------------------------------ abonelik katmanları
#
# Katmanların NE VAAT ETTİĞİ tek yerde. Dağınık olduğunda ortaya çıkan hata
# şuydu: jeton düşümü yalnızca fate/yearly'yi muaf tutuyordu ama model seçimi
# star'ı da "ödeyen" sayıyordu. Sonuç: Yıldız abonesi pahalı modele gidiyor
# AMA yine tam jeton ödüyordu — hem gelir kaybı hem maliyet artışı.
#
# monthly_readings: None = sınırsız. Sayı ise aylık kota; kota bitince
# kullanıcı duvara toslamıyor, normal jeton ekonomisine düşüyor (ödeyen
# kullanıcıyı kilitlemek iptal sebebidir).
TIER_LIMITS: dict[str, dict] = {
    "star":   {"monthly_readings": 10,   "ads_free": True, "tr": "Yıldız"},
    "fate":   {"monthly_readings": None, "ads_free": True, "tr": "Kader"},
    "yearly": {"monthly_readings": None, "ads_free": True, "tr": "Yıllık"},
}

PAID_TIERS = frozenset(TIER_LIMITS)

# Tanınmayan bir entitlement id gelirse düşülecek katman.
# RevenueCat'te ürün adı değişir, yeni bir entitlement eklenir ve backend
# haberi olmaz. O anda kullanıcı PARA ÖDEMİŞ durumda; hiçbir hak vermemek
# en kötü sonuç. En düşük ücretli katmana düşüp uyarı logluyoruz.
FALLBACK_TIER = "star"


def normalize_tier(raw: str | None) -> str | None:
    """RevenueCat entitlement id'sini bilinen bir katmana eşler.

    None döner = ücretsiz kullanıcı. Tanınmayan ama dolu bir değer
    FALLBACK_TIER'a düşer (yukarıdaki nota bak).
    """
    t = (raw or "").strip().lower()
    if not t:
        return None
    return t if t in TIER_LIMITS else FALLBACK_TIER


def monthly_quota(tier: str | None) -> int | None:
    """Katmanın aylık fal kotası. None = sınırsız veya abonelik yok."""
    if not tier or tier not in TIER_LIMITS:
        return None
    return TIER_LIMITS[tier]["monthly_readings"]

# --------------------------------------------------------------- tahmin konuları
#
# Konu bazlı isabet paneli ("aşkta %72, parada %31") ürünün ana farkının
# görünür kısmı. Konu serbest metin bırakılırsa model bir gün "is", ertesi gün
# "iş", sonra "kariyer" yazar; panel aynı şeyi üç ayrı kovaya böler ve birkaç
# ay sonra okunamaz hale gelir. Bu yüzden sabit dağarcığa indirgeniyor.
TOPICS = ("ask", "para", "kariyer", "aile", "saglik", "kendim", "genel")

# Modelin üretebileceği yakın karşılıklar → dağarcık.
# Anahtarlar fold() sonrası hâlle yazılı: "İŞ", "iş" ve "is" hepsi "is" olur.
_TOPIC_ALIASES = {
    "iliski": "ask", "love": "ask", "romantik": "ask", "sevgili": "ask",
    "is": "kariyer", "work": "kariyer", "meslek": "kariyer",
    "okul": "kariyer", "egitim": "kariyer",
    "money": "para", "finans": "para", "maddi": "para", "butce": "para",
    "family": "aile", "ev": "aile", "anne": "aile", "cocuk": "aile",
    "health": "saglik", "beden": "saglik",
    "self": "kendim", "ruh": "kendim", "icsel": "kendim",
    "general": "genel", "diger": "genel",
}


def normalize_topic(raw: str | None) -> str:
    """Modelden gelen konuyu sabit dağarcığa indirger. Tanınmayan → 'genel'.

    Karşılaştırma textutil.fold() ile yapılıyor: "İŞ".lower() Python'da
    "i̇ş" (birleşen noktalı) üretir ve düz eşleşme kaçar.
    """
    from .textutil import fold

    t = fold(raw)
    if t in TOPICS:
        return t
    return _TOPIC_ALIASES.get(t, "genel")
