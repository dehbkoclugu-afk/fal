"""
Türkçe metin normalizasyonu.

Tek bir sebeple ayrı dosya: Python'un varsayılan büyük/küçük harf dönüşümü
Türkçe'de yanlış ve bu hata iki ayrı yerde ürünü bozdu.

    "İ".lower()        → "i" + U+0307 (COMBINING DOT ABOVE), tek harf DEĞİL
    "İNTİHAR".lower()  → "i̇nti̇har" — r"intihar" deseni eşleşmez

Guardrail'de bu, büyük harfle yazılmış kriz mesajlarının filtreden geçmesine
yol açıyordu. Aynı düzeltmeyi ikinci bir yere kopyalamak yerine buraya alındı;
bir sonraki kullanan da doğrusunu almış olsun.
"""

from __future__ import annotations

import re
import unicodedata

# Küçültmeden ÖNCE uygulanır — sıra kritik (yukarıdaki nota bak).
TR_FOLD = str.maketrans({
    "İ": "i", "I": "i", "ı": "i",
    "Ş": "s", "ş": "s",
    "Ğ": "g", "ğ": "g",
    "Ü": "u", "ü": "u",
    "Ö": "o", "ö": "o",
    "Ç": "c", "ç": "c",
    "Â": "a", "â": "a", "Î": "i", "î": "i", "Û": "u", "û": "u",
})


def fold(t: str | None) -> str:
    """Aksansız, küçük harfli, boşlukları sadeleşmiş hâl — karşılaştırma için.

    Görüntülemek için KULLANMA: 'İstanbul' → 'istanbul' döner.
    """
    t = (t or "").translate(TR_FOLD).lower()
    t = unicodedata.normalize("NFKD", t)
    t = "".join(c for c in t if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", t).strip()
