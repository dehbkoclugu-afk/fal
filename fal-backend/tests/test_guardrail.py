"""
Guardrail testleri.

Bu dosyadaki testler "nice to have" değil. Kriz sinyali taşıyan bir mesaja
kader yorumu üretmek hem gerçek zarar hem de mağazadan kalkma sebebi. Yanlış
pozitif ucuz (kullanıcı destek mesajı görür), yanlış negatif pahalı — testler
bu asimetriyi koruyacak şekilde yazıldı.
"""

from __future__ import annotations

import pytest

from app.core.guardrail import Action, check, scan_output

# Kriz ifadeleri, Türkçe diakritikli ve diakritiksiz yazımlarıyla. Kullanıcılar
# telefonda çoğunlukla diakritiksiz yazar; _norm() bunu karşılamak zorunda.
KRIZ = [
    "artık dayanamıyorum yaşamak istemiyorum",
    "artik dayanamiyorum yasamak istemiyorum",
    "intihar etmeyi düşünüyorum",
    "kendime zarar vermek istiyorum",
    "hayatıma son vermek istiyorum",
    "ÖLMEK İSTİYORUM ARTIK",
    "her şey bitsin istiyorum",
    "ilaçları içsem ne olur",
]


@pytest.mark.parametrize("metin", KRIZ)
def test_kriz_sinyali_fal_uretimini_durduruyor(metin):
    r = check(metin)
    assert r["action"] == Action.BLOCK_CRISIS
    assert r["category"] == "crisis"
    assert r["reply"], "kriz vakasında kullanıcıya mesaj dönmek zorunda"


def test_kriz_mesaji_gercek_destek_yonlendirmesi_iceriyor():
    """Sadece 'fal üretemem' demek yeterli değil; ulaşılabilir bir yer gösterilmeli."""
    r = check("yaşamak istemiyorum")
    assert "112" in r["reply"] and "183" in r["reply"]


NORMAL = [
    "yarın ne olacak, işim düzelir mi",
    "sevgilimle aramız nasıl olacak",
    "bu ay para durumum nasıl",
    "yeni bir işe girecek miyim",
    "fincanımda ne görüyorsun",
]


@pytest.mark.parametrize("metin", NORMAL)
def test_normal_sorular_engellenmiyor(metin):
    """Yanlış pozitif ürünü kullanılamaz hale getirir — bu da regresyon altında."""
    assert check(metin)["action"] == Action.ALLOW


def test_saglik_sorusu_yumusak_sinir():
    r = check("kanser miyim acaba, biyopsi sonucum ne çıkar")
    assert r["action"] == Action.SOFT_LIMIT
    assert r["category"] == "medical"
    assert "doktora" in r["note"]


def test_finans_sorusu_yumusak_sinir():
    r = check("hangi hisseyi alsam")
    assert r["action"] == Action.SOFT_LIMIT
    assert r["category"] == "legal_financial"


def test_yas_kapisi_beyandan():
    assert check("16 yaşındayım aşk falı bak")["action"] == Action.BLOCK_MINOR


def test_yas_kapisi_profilden():
    assert check("aşk falı bak", user_age=15)["action"] == Action.BLOCK_MINOR
    assert check("aşk falı bak", user_age=22)["action"] == Action.ALLOW


def test_kriz_yas_kapisindan_once_gelir():
    """17 yaşındaki bir kullanıcının kriz mesajı 'yaş' diye geçiştirilemez —
    ona da destek yönlendirmesi gösterilmeli."""
    r = check("16 yaşındayım yaşamak istemiyorum", user_age=16)
    assert r["action"] == Action.BLOCK_CRISIS


def test_bos_girdi_izinli():
    """Fincan falı sorusuz da yapılabilir; boş metin akışı kırmamalı."""
    assert check("")["action"] == Action.ALLOW
    assert check(None)["action"] == Action.ALLOW


# ------------------------------------------------------------ çıktı taraması

YASAKLI_CIKTI = [
    ("Bu yıl kesin olarak öleceksin.", {"ölüm kehaneti", "kesinlik iddiası"}),
    ("Kanser olacaksın gibi görünüyor.", {"hastalık kehaneti"}),
    ("Yakında hamile kalacaksın.", {"hamilelik iddiası"}),
    ("Eşin seni aldatıyor.", {"üçüncü kişi suçlaması"}),
    ("Önümüzdeki ay 50 bin TL kazanacaksın.", {"somut finansal tutar"}),
]


@pytest.mark.parametrize("metin,beklenen", YASAKLI_CIKTI)
def test_yasakli_ciktilar_yakalaniyor(metin, beklenen):
    assert beklenen.issubset(set(scan_output(metin)))


def test_temiz_cikti_geciyor():
    temiz = ("Bu hafta iletişimin güçleniyor. Uzun süredir ertelediğin bir "
             "konuşma kendiliğinden başlayabilir. Acele karar verme.")
    assert scan_output(temiz) == []


def test_cikti_taramasi_diakritiksiz_yazimda_da_calisiyor():
    assert scan_output("Bu yil kesin olarak oleceksin.") != []


# ------------------------------------------------------------ konu dağarcığı

def test_konu_normalizasyonu():
    """Konu bazlı isabet paneli ürünün ana farkının görünür kısmı. Model
    serbest metin üretirse aynı konu birden fazla kovaya bölünür ve panel
    birkaç ay içinde okunamaz hale gelir."""
    from app.core.pricing import TOPICS, normalize_topic

    esitler = [
        (["ask", "Aşk", " AŞK ", "love", "ilişki", "sevgili"], "ask"),
        (["kariyer", "is", "iş", "İŞ", "İş", "work", "okul"], "kariyer"),
        (["para", "money", "finans", "bütçe", "BÜTÇE"], "para"),
        (["saglik", "sağlık", "SAĞLIK", "health"], "saglik"),
    ]
    for girdiler, beklenen in esitler:
        for g in girdiler:
            assert normalize_topic(g) == beklenen, f"{g!r} → {normalize_topic(g)}"

    # Tanınmayan her şey tek kovaya
    for g in ("uydurma", "", None, "xyz", "🙂"):
        assert normalize_topic(g) == "genel"

    # Çıktı her zaman dağarcık içinde
    for g in ("ask", "İŞ", "bilinmeyen", None):
        assert normalize_topic(g) in TOPICS


def test_turkce_buyuk_harf_katlamasi():
    """textutil.fold, "İ".lower()'ın ürettiği birleşen noktayı temizlemeli."""
    from app.core.textutil import fold

    assert fold("İNTİHAR") == "intihar"
    assert fold("YAŞAMAK İSTEMİYORUM") == "yasamak istemiyorum"
    assert fold("İstanbul") == "istanbul"
    assert fold("  ÇOK   ÖNEMLİ  ") == "cok onemli"
    assert "̇" not in fold("İİİ"), "birleşen nokta temizlenmemiş"


def test_bos_embed_anahtari_gecersiz_baslik_uretmiyor():
    """Regresyon: EMBED_KEY boşken "Bearer " başlığı üretiliyordu ve httpx
    bunu LocalProtocolError ile reddediyordu — scripts/dev.sh tam olarak bu
    durumu yaratıyor, yani ilk kurulumda her fal düşüyordu."""
    import asyncio
    import os
    from unittest.mock import patch

    import httpx

    from app.core import llm

    yakalanan = {}

    class SahteYanit:
        status_code = 200
        def raise_for_status(self): pass
        def json(self): return {"data": [{"embedding": [0.0] * 384}]}

    class SahteIstemci:
        def __init__(self, **kw): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def post(self, url, json=None, headers=None):
            yakalanan["headers"] = headers
            # Gerçek httpx doğrulamasını uygula: geçersiz başlık burada patlar
            httpx.Headers(headers or {})
            return SahteYanit()

    with patch.dict(os.environ, {"EMBED_URL": "http://yerel/embed", "EMBED_KEY": ""}):
        with patch.object(httpx, "AsyncClient", SahteIstemci):
            asyncio.run(llm.embed("deneme"))
    assert "authorization" not in (yakalanan["headers"] or {})

    with patch.dict(os.environ, {"EMBED_URL": "http://yerel/embed", "EMBED_KEY": "gizli"}):
        with patch.object(httpx, "AsyncClient", SahteIstemci):
            asyncio.run(llm.embed("deneme"))
    assert yakalanan["headers"]["authorization"] == "Bearer gizli"
