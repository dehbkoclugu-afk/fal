"""
Jeton fiyatları ve harcama tavanı.

Ayrı dosyada tutulmasının sebebi: worker'ın iade (refund) yapmak için bu tabloya
ihtiyacı var, ama `app.main`'i import etmesi gerekmemeli — bu import worker
sürecinde tüm FastAPI uygulamasını ayağa kaldırır.
"""

from __future__ import annotations

COIN_PRICES = {"coffee": 3, "tarot": 1, "natal": 5, "daily": 0}

# Kumar döngüsü önlemi ve aynı zamanda iade/chargeback önlemi.
# Kaldırma: günde sınırsız harcama, bu kategoride iade dalgası demek.
DAILY_SPEND_CAP = 25

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
