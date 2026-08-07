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
from enum import Enum

from . import locales
from .textutil import fold


class Action(str, Enum):
    ALLOW = "allow"
    SOFT_LIMIT = "soft_limit"    # fal üretilir ama o konuda kesin ifade yasak
    BLOCK_CRISIS = "block_crisis"
    BLOCK_MINOR = "block_minor"


def _norm(t: str) -> str:
    """TR harflerini sadeleştir + küçült — 'öldürmek/oldurmek' varyantlarını yakalamak için.

    Neden textutil.fold: Python'da "İ".lower() tek harf değil, "i" + U+0307
    (COMBINING DOT ABOVE) ikilisi üretir. Küçültmeden önce sadeleştirilmezse
    "İNTİHAR" → "i̇nti̇har" olur ve r"intihar" deseni EŞLEŞMEZ; büyük harfle
    yazılmış kriz mesajları guardrail'den sessizce geçer. Sıkıntıdaki
    kullanıcılar sıklıkla büyük harfle yazar — kaçırılmaması gereken vaka.
    """
    return fold(t)


# Desenler artık app/core/locales.py içinde, dile göre tutuluyor.
#
# Sebebi güvenlik: desenler Türkçe olduğu sürece Arapça yazılmış bir kriz
# mesajı filtreden geçiyordu ve kullanıcıya Türkiye'nin 112/183 numaraları
# gösteriliyordu. Bir dilin kaydedilebilmesi için kriz kaynaklarını taşıması
# ZORUNLU (bkz. locales.Locale).


def _hit(patterns, text: str) -> str | None:
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


def check(text: str, user_age: int | None = None,
          locale: str | None = None) -> dict:
    """Her fal isteğinde, üretimden ÖNCE çağrılır.

    locale: kullanıcının dili. Verilmezse varsayılana düşer — bilinmeyen bir
    dil kodu yüzünden kriz kontrolünün ATLANMASI kabul edilemez.
    """
    loc = locales.resolve(locale)
    t = _norm(text or "")

    if hit := _hit(loc.crisis_patterns, t):
        return {"action": Action.BLOCK_CRISIS, "category": "crisis",
                "matched": hit, "reply": loc.crisis_reply, "note": None,
                "locale": loc.code}

    if user_age is not None and user_age < 18:
        return {"action": Action.BLOCK_MINOR, "category": "minor", "matched": "age",
                "reply": loc.minor_reply, "note": None, "locale": loc.code}
    if hit := _hit(loc.minor_patterns, t):
        return {"action": Action.BLOCK_MINOR, "category": "minor", "matched": hit,
                "reply": loc.minor_reply, "note": None, "locale": loc.code}

    for cat, pats in (("violence", loc.violence_patterns),
                      ("medical", loc.medical_patterns),
                      ("legal_financial", loc.legal_financial_patterns)):
        if hit := _hit(pats, t):
            return {"action": Action.SOFT_LIMIT, "category": cat, "matched": hit,
                    "reply": None, "note": loc.soft_limit_notes[cat],
                    "locale": loc.code}

    return {"action": Action.ALLOW, "category": None, "matched": None,
            "reply": None, "note": None, "locale": loc.code}


# Üretilen METİN üzerinde son kontrol. LLM kuralları çiğnerse burada yakalanır.


def scan_output(text: str, locale: str | None = None) -> list[str]:
    """Boş liste dönmüyorsa yorum yeniden üretilir (regenerate, kullanıcıya gösterilmez)."""
    loc = locales.resolve(locale)
    t = _norm(text or "")
    return [label for pat, label in loc.forbidden_output if re.search(pat, t)]


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
