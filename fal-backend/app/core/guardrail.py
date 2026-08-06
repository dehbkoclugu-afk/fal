"""
Guardrail — boru hattının 1. adımı, atlanabilir bir özellik DEĞİL.

Bu ürüne insanlar en kırılgan anlarında geliyor: ayrılık, borç, hastalık, ölüm
korkusu. Bir fal uygulaması bu anlarda "kader" dili kullanırsa gerçek zarar verir.
İş tarafı da aynı yerde: bu vakalarda kötü çıkan tek bir ekran görüntüsü
uygulamanın mağazadan kalkmasına ve markanın bitmesine yeter.

Kural: kriz sinyali varsa FAL ÜRETİLMEZ. Şefkatli mesaj + gerçek destek yönlendirmesi.
Bu bir "disclaimer ekle" işi değil, akışı durdurma işidir.
"""

from __future__ import annotations

import re
import unicodedata
from enum import Enum


class Action(str, Enum):
    ALLOW = "allow"
    SOFT_LIMIT = "soft_limit"    # fal üretilir ama o konuda kesin ifade yasak
    BLOCK_CRISIS = "block_crisis"
    BLOCK_MINOR = "block_minor"


def _norm(t: str) -> str:
    """TR harflerini sadeleştir + küçült — 'öldürmek/oldurmek' varyantlarını yakalamak için."""
    t = t.lower()
    t = (t.replace("ı", "i").replace("İ", "i").replace("ş", "s").replace("ğ", "g")
          .replace("ü", "u").replace("ö", "o").replace("ç", "c"))
    t = unicodedata.normalize("NFKD", t)
    return re.sub(r"\s+", " ", t)


# Kriz sinyalleri. Liste kasıtlı olarak geniş; yanlış pozitif maliyeti düşük
# (kullanıcı yine destek mesajı görür), yanlış negatif maliyeti çok yüksek.
CRISIS_PATTERNS = [
    r"intihar", r"kendimi oldur", r"olmek istiyorum", r"yasamak istemiyorum",
    r"canima kiy", r"kendime zarar", r"bitirmek istiyorum hayat",
    r"hayatima son", r"artik dayanamiyorum", r"yok olmak istiyorum",
    r"kimse beni sevmiyor.*(olmek|bitmek)", r"her sey bitsin",
    r"ilaclari icsem", r"asiri doz",
]

VIOLENCE_PATTERNS = [
    r"onu oldur", r"zarar verecegim", r"intikam alacagim.*(kan|oldur)",
    r"bicakla", r"dovecegim",
]

MEDICAL_PATTERNS = [
    r"kanser", r"tumor", r"biyopsi", r"kemoterapi", r"hamile miyim",
    r"hastaligim.*(gecer mi|iyilesir mi)", r"ameliyat", r"kalp krizi",
    r"olecek mi", r"tesh?is", r"depresyon ilac", r"antidepresan",
]

LEGAL_FINANCIAL_PATTERNS = [
    r"davayi kazanir miyim", r"hapse girer miyim", r"icra", r"kredi ceker",
    r"borsada.*(alsam|satsam)", r"kripto.*(alsam|yukselir mi)",
    r"hangi hisseyi", r"velayeti alir miyim",
]

MINOR_SELF_PATTERNS = [
    r"\b1[0-7] yasindayim\b", r"\b(on ?(bir|iki|uc|dort|bes|alti|yedi)) yasindayim\b",
    r"ortaokul", r"\b(9|10|11|12)\. ?sinif", r"lise ?(1|2|3|birinci|ikinci)",
]


def _hit(patterns: list[str], text: str) -> str | None:
    for p in patterns:
        if re.search(p, text):
            return p
    return None


CRISIS_REPLY_TR = (
    "Yazdıklarını okudum ve bunu geçiştirmek istemiyorum. Şu an taşıdığın şey "
    "bir fal yorumuyla hafifleyecek bir şey değil, gerçek bir destekle hafifler.\n\n"
    "Türkiye'de 7/24 ulaşabileceğin yerler var: **112** acil yardım hattı ve "
    "**183** Sosyal Destek Hattı. Yanında güvendiğin biri varsa, şu an ona haber "
    "vermek de iyi bir adım olur.\n\n"
    "Burada seninle kalmaya devam edebilirim ama bu konuda sana kader okumak "
    "doğru olmaz. Hazır olduğunda buradayım."
)

SOFT_LIMIT_NOTES = {
    "medical": ("Sağlık konusunda hiçbir teşhis, tahmin veya zamanlama verme. "
                "Kullanıcıyı nazikçe doktora yönlendir. Yorumu duygusal destek "
                "ve genel eğilimlerle sınırla."),
    "legal_financial": ("Hukuki sonuç veya yatırım tavsiyesi verme. Somut tutar, "
                        "tarih veya 'kazanırsın/kaybedersin' ifadesi kullanma. "
                        "Uzmana yönlendir."),
    "violence": ("Şiddet niyeti içeren isteği besleme, intikam dili kullanma. "
                 "Yorumu sakinleştirici ve sorumluluk vurgulu tut."),
}


def check(text: str, user_age: int | None = None) -> dict:
    """Her fal isteğinde, üretimden ÖNCE çağrılır."""
    t = _norm(text or "")

    if hit := _hit(CRISIS_PATTERNS, t):
        return {"action": Action.BLOCK_CRISIS, "category": "crisis",
                "matched": hit, "reply": CRISIS_REPLY_TR, "note": None}

    if user_age is not None and user_age < 18:
        return {"action": Action.BLOCK_MINOR, "category": "minor", "matched": "age",
                "reply": ("Bu içerik 18 yaş ve üzeri kullanıcılar için. "
                          "Sana uygun günlük burç bölümüne göz atabilirsin."),
                "note": None}
    if hit := _hit(MINOR_SELF_PATTERNS, t):
        return {"action": Action.BLOCK_MINOR, "category": "minor", "matched": hit,
                "reply": ("Yaşın nedeniyle ilişki ve kader yorumu üretmiyorum. "
                          "Günlük burç ve genel içerikler açık."),
                "note": None}

    for cat, pats in (("violence", VIOLENCE_PATTERNS),
                      ("medical", MEDICAL_PATTERNS),
                      ("legal_financial", LEGAL_FINANCIAL_PATTERNS)):
        if hit := _hit(pats, t):
            return {"action": Action.SOFT_LIMIT, "category": cat, "matched": hit,
                    "reply": None, "note": SOFT_LIMIT_NOTES[cat]}

    return {"action": Action.ALLOW, "category": None, "matched": None,
            "reply": None, "note": None}


# Üretilen METİN üzerinde son kontrol. LLM kuralları çiğnerse burada yakalanır.
FORBIDDEN_OUTPUT = [
    (r"\boleceks?in\b|\bolumun\b|\bolum tarihi\b", "ölüm kehaneti"),
    (r"\bkanser\b|\btumor\b|\bhastalanacaks?in\b", "hastalık kehaneti"),
    (r"\bhamilesin\b|\bhamile kalacaks?in\b", "hamilelik iddiası"),
    (r"\bkesin olarak\b|\b%\s?\d{2,3}\s?(dogru|kesin)\b", "kesinlik iddiası"),
    (r"\baldatiyor\b|\bseni aldatan\b", "üçüncü kişi suçlaması"),
    (r"\b\d+\s?(bin|milyon)\s?(tl|lira|dolar)\b", "somut finansal tutar"),
]


def scan_output(text: str) -> list[str]:
    """Boş liste dönmüyorsa yorum yeniden üretilir (regenerate, kullanıcıya gösterilmez)."""
    t = _norm(text or "")
    return [label for pat, label in FORBIDDEN_OUTPUT if re.search(pat, t)]


if __name__ == "__main__":
    tests = [
        "yarın ne olacak, işim düzelir mi",
        "artık dayanamıyorum yaşamak istemiyorum",
        "kanser miyim acaba, biyopsi sonucum ne çıkar",
        "hangi hisseyi alsam",
        "16 yaşındayım aşk falı bak",
    ]
    for s in tests:
        r = check(s)
        print(f"{r['action'].value:14} | {r['category']} | {s[:40]}")
    print("çıktı taraması:", scan_output("Bu yıl kesin olarak öleceksin."))
