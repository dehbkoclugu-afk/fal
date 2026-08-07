"""
Dil ve kültür kaydı.

Bu dosya "çeviri katmanı" değil. Plan açıkça şunu söylüyor: çeviri yapma, her
dilde NATIVE üret. Türkçe metni Arapçaya çevirmek, o pazarda ürünü hep
"yabancı" hissettirir ve dönüşümü yarıya düşürür. Burada tutulan şey, bir
dilin çalışabilmesi için ZORUNLU olan parçaların listesi.

EN ÖNEMLİ KURAL: kriz kaynakları olmayan bir dil kaydedilemez.

Guardrail'in tek işi, kırılgan andaki kullanıcıyı gerçek desteğe yönlendirmek.
Türkiye'nin 112/183 numaralarını Suudi Arabistan'daki bir kullanıcıya
göstermek, hiçbir şey göstermemekten daha kötü: kullanıcı arar, açılmaz,
güvenini kaybeder. Aynı şekilde kriz desenleri Türkçe olduğu için Arapça
yazılmış bir kriz mesajı filtreden geçer.

Bu yüzden Locale dataclass'ı crisis_patterns ve crisis_reply'ı ZORUNLU alan
olarak taşıyor — bir dili yarım kaydetmek teknik olarak mümkün değil.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Locale:
    code: str
    name: str
    name_native: str
    rtl: bool

    # --- Guardrail: dile özgü, ZORUNLU ---
    crisis_patterns: tuple[str, ...]
    crisis_reply: str
    minor_patterns: tuple[str, ...]
    medical_patterns: tuple[str, ...]
    legal_financial_patterns: tuple[str, ...]
    violence_patterns: tuple[str, ...]
    forbidden_output: tuple[tuple[str, str], ...]
    soft_limit_notes: dict[str, str]
    minor_reply: str

    # --- Ay/burç adları gibi görüntü metinleri ---
    signs: tuple[str, ...]

    # --- Varsayılan saat dilimi ve para birimi (fiyat gösterimi için) ---
    default_tz: str = "Europe/Istanbul"

    # Dil ürün içinde SEÇİLEBİLİR mi. False = altyapı hazır ama içerik
    # (blok kütüphanesi, tarot korpusu, sembol sözlüğü) tamamlanmadı.
    # Yarım bir dili açmak, kullanıcıya boş yorum göstermek demek.
    enabled: bool = False

    aliases: tuple[str, ...] = field(default_factory=tuple)


_REGISTRY: dict[str, Locale] = {}


def register(loc: Locale) -> Locale:
    _REGISTRY[loc.code] = loc
    for a in loc.aliases:
        _REGISTRY[a] = loc
    return loc


def get(code: str | None) -> Locale | None:
    if not code:
        return None
    c = code.strip().lower().replace("_", "-")
    if c in _REGISTRY:
        return _REGISTRY[c]
    return _REGISTRY.get(c.split("-")[0])


def resolve(code: str | None) -> Locale:
    """Her zaman çalışan bir dil döner — asla None, asla istisna.

    Guardrail bu fonksiyona bağlı; bilinmeyen bir dil kodu yüzünden kriz
    kontrolünün atlanması kabul edilemez, o yüzden varsayılana düşüyor.
    """
    return get(code) or DEFAULT


def enabled_locales() -> list[Locale]:
    """Kullanıcıya sunulabilecek diller."""
    seen: dict[str, Locale] = {}
    for loc in _REGISTRY.values():
        if loc.enabled:
            seen[loc.code] = loc
    return sorted(seen.values(), key=lambda x: x.code)


def all_locales() -> list[Locale]:
    return sorted({l.code: l for l in _REGISTRY.values()}.values(),
                  key=lambda x: x.code)


# ============================================================== Türkçe

TR = register(Locale(
    code="tr",
    name="Turkish",
    name_native="Türkçe",
    rtl=False,
    enabled=True,
    default_tz="Europe/Istanbul",
    aliases=("tr-tr",),

    signs=("Koç", "Boğa", "İkizler", "Yengeç", "Aslan", "Başak",
           "Terazi", "Akrep", "Yay", "Oğlak", "Kova", "Balık"),

    # Desenler fold() sonrası hâlle yazılı (aksansız, küçük harf).
    # Liste kasıtlı geniş: yanlış pozitif ucuz (kullanıcı destek mesajı
    # görür), yanlış negatif çok pahalı.
    crisis_patterns=(
        r"intihar", r"kendimi oldur", r"olmek istiyorum", r"yasamak istemiyorum",
        r"canima kiy", r"kendime zarar", r"bitirmek istiyorum hayat",
        r"hayatima son", r"artik dayanamiyorum", r"yok olmak istiyorum",
        r"kimse beni sevmiyor.*(olmek|bitmek)", r"her sey bitsin",
        r"ilaclari icsem", r"asiri doz",
    ),
    crisis_reply=(
        "Yazdıklarını okudum ve bunu geçiştirmek istemiyorum. Şu an taşıdığın şey "
        "bir fal yorumuyla hafifleyecek bir şey değil, gerçek bir destekle hafifler.\n\n"
        "Türkiye'de 7/24 ulaşabileceğin yerler var: **112** acil yardım hattı ve "
        "**183** Sosyal Destek Hattı. Yanında güvendiğin biri varsa, şu an ona haber "
        "vermek de iyi bir adım olur.\n\n"
        "Burada seninle kalmaya devam edebilirim ama bu konuda sana kader okumak "
        "doğru olmaz. Hazır olduğunda buradayım."
    ),
    minor_patterns=(
        r"\b1[0-7] yasindayim\b",
        r"\b(on ?(bir|iki|uc|dort|bes|alti|yedi)) yasindayim\b",
        r"ortaokul", r"\b(9|10|11|12)\. ?sinif", r"lise ?(1|2|3|birinci|ikinci)",
    ),
    minor_reply=("Yaşın nedeniyle ilişki ve kader yorumu üretmiyorum. "
                 "Günlük burç ve genel içerikler açık."),
    medical_patterns=(
        r"kanser", r"tumor", r"biyopsi", r"kemoterapi", r"hamile miyim",
        r"hastaligim.*(gecer mi|iyilesir mi)", r"ameliyat", r"kalp krizi",
        r"olecek mi", r"tesh?is", r"depresyon ilac", r"antidepresan",
    ),
    legal_financial_patterns=(
        r"davayi kazanir miyim", r"hapse girer miyim", r"icra", r"kredi ceker",
        r"borsada.*(alsam|satsam)", r"kripto.*(alsam|yukselir mi)",
        r"hangi hisseyi", r"velayeti alir miyim",
    ),
    violence_patterns=(
        r"onu oldur", r"zarar verecegim", r"intikam alacagim.*(kan|oldur)",
        r"bicakla", r"dovecegim",
    ),
    forbidden_output=(
        (r"\boleceks?in\b|\bolumun\b|\bolum tarihi\b", "ölüm kehaneti"),
        (r"\bkanser\b|\btumor\b|\bhastalanacaks?in\b", "hastalık kehaneti"),
        (r"\bhamilesin\b|\bhamile kalacaks?in\b", "hamilelik iddiası"),
        (r"\bkesin olarak\b|\b%\s?\d{2,3}\s?(dogru|kesin)\b", "kesinlik iddiası"),
        (r"\baldatiyor\b|\bseni aldatan\b", "üçüncü kişi suçlaması"),
        (r"\b\d+\s?(bin|milyon)\s?(tl|lira|dolar)\b", "somut finansal tutar"),
    ),
    soft_limit_notes={
        "medical": ("Sağlık konusunda hiçbir teşhis, tahmin veya zamanlama verme. "
                    "Kullanıcıyı nazikçe doktora yönlendir. Yorumu duygusal destek "
                    "ve genel eğilimlerle sınırla."),
        "legal_financial": ("Hukuki sonuç veya yatırım tavsiyesi verme. Somut tutar, "
                            "tarih veya 'kazanırsın/kaybedersin' ifadesi kullanma. "
                            "Uzmana yönlendir."),
        "violence": ("Şiddet niyeti içeren isteği besleme, intikam dili kullanma. "
                     "Yorumu sakinleştirici ve sorumluluk vurgulu tut."),
    },
))

DEFAULT = TR
