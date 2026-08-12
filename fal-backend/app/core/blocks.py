"""
Blok kütüphanesi — bootstrap bütçesinin asıl kurtarıcısı.

Problem: ücretsiz kullanıcıların %97'si hiç ödemez, ama her biri LLM maliyeti üretir.
10.000 günlük aktif kullanıcı × günde 1 fal × 0,02 $ = ayda 6.000 $. Bu bütçeyle biter.

Çözüm: içeriği İKİ kaynaktan üret.
  - %75-85'i ÖNCEDEN üretilmiş metin bloklarından gelir (bir kez üretilir, sonsuz kullanılır)
  - %15-25'i canlı, kısa bir LLM çağrısıyla kişiselleştirilir ve birleştirilir

astro.condition_keys() → blok anahtarları → DB'den blok metinleri → kısa stitch çağrısı.

Maliyet karşılaştırması (tek ücretsiz günlük yorum):
  Saf LLM  : ~1.800 giriş + 700 çıkış token  ≈ 0,006 $
  Hibrit   : ~500 giriş + 180 çıkış token    ≈ 0,0012 $   → 5x tasarruf
Ölçekte fark aylık yüzlerce dolar. Blok kütüphanesini bir kez üretmenin
toplam maliyeti ise ~15-40 $ (aşağıdaki seed_library ile batch olarak).
"""

from __future__ import annotations

import hashlib
import json
import random
from dataclasses import dataclass

# Her koşul anahtarı için kaç varyant üretilecek. 4 varyant × rotasyon =
# kullanıcı aynı bloğu 4 günde bir görür, tekrar hissi oluşmaz.
VARIANTS_PER_KEY = 4

# Blok tipleri: hangi anahtar hangi bölüme yazar.
# SIRA ÖNEMLİ — ilk eşleşen prefix kazanır, o yüzden özelden genele dizili.
# "moon_full_moon" önce ay fazı olarak eşleşmeli; "moon_" üstte olsaydı ay
# fazı blokları "duygu" bölümüne düşer ve fetch_blocks'un bölüm tekilleştirmesi
# onları Ay-burç bloğuyla aynı kovaya koyup birini eler.
BLOCK_SECTIONS = {
    "moon_new_moon": "donem", "moon_full_moon": "donem",
    "moon_first_quarter": "donem", "moon_last_quarter": "donem",
    "moon_waxing_": "donem", "moon_waning_": "donem",
    "asc_": "karakter",
    "sun_": "karakter",
    "moon_": "duygu",
    "mercury_": "iletisim",
    "venus_": "ask",
    "mars_": "enerji",
    "saturn_": "sinav",
    "asp_": "dinamik",
    "element_dom_": "genel",
}


@dataclass
class Block:
    key: str
    variant: int
    locale: str
    section: str
    text: str


def section_of(key: str) -> str:
    for prefix, sec in BLOCK_SECTIONS.items():
        if key.startswith(prefix):
            return sec
    return "genel"


def pick_variant(user_id: str, key: str, day_bucket: int) -> int:
    """Kullanıcı + anahtar + gün → deterministik varyant seçimi.

    Deterministik olması önemli: aynı gün iki kez açan kullanıcı aynı metni görür
    (tutarlılık), ama farklı günlerde farklı varyant alır (tazelik).
    """
    h = hashlib.sha256(f"{user_id}:{key}:{day_bucket}".encode()).hexdigest()
    return int(h[:8], 16) % VARIANTS_PER_KEY


async def fetch_blocks(db, keys: list[str], user_id: str, locale: str,
                       day_bucket: int, limit: int = 6) -> list[Block]:
    """DB'den ilgili blokları çeker. Bölüm çeşitliliği için section bazında tekilleştirir."""
    wanted = []
    seen_sections: set[str] = set()
    for k in keys:
        sec = section_of(k)
        if sec in seen_sections and len(wanted) >= 3:
            continue
        seen_sections.add(sec)
        wanted.append((k, pick_variant(user_id, k, day_bucket)))
        if len(wanted) >= limit:
            break

    if not wanted:
        return []
    rows = await db.fetch(
        """
        SELECT key, variant, locale, section, text
        FROM content_blocks
        WHERE locale = $1 AND (key, variant) = ANY($2::block_ref[])
        """,
        locale, wanted,
    )
    return [Block(**dict(r)) for r in rows]


STITCH_SYSTEM = """Sana hazır yorum parçaları verilecek. Görevin bunları tek, akıcı bir
Türkçe metne dönüştürmek.

KURALLAR
- Parçaların ANLAMINI koru, içeriğine yeni kehanet ekleme.
- Tekrar eden fikirleri birleştir, geçiş cümleleri kur.
- Kullanıcının adını en fazla bir kez kullan.
- Sonuna 1 kısa tavsiye ve 1 doğrulanabilir tahmin ekle. Tahmin tek başına
  evet/hayır/kısmen diye değerlendirilebilen gözlenebilir bir olay olsun;
  "bir plan", "bir adım", "bir haber" gibi her şeye uyan belirsiz ifade kullanma.
- Çıktı SADECE şu JSON: {"ozet": "...", "metin": "...", "tavsiye": "...",
  "tahmin": {"konu": "...", "iddia": "...", "pencere_gun": 7, "guven": "orta"}}"""


async def compose_free(db, user_id: str, user_ctx: dict, keys: list[str],
                       locale: str, day_bucket: int,
                       transits: list[dict] | None = None,
                       extra_note: str | None = None) -> dict:
    """Ücretsiz kullanıcı için hibrit üretim.

    extra_note: guardrail'in yumuşak kısıtı (sağlık/hukuk/şiddet). Ücretsiz
    kullanıcılar tüm tabanın ~%97'si; bu kısıt buraya taşınmazsa çoğunluk
    için hiç uygulanmamış olur.
    """
    from .llm import complete

    blocks = await fetch_blocks(db, keys, user_id, locale, day_bucket)
    if not blocks:
        return {"ozet": "", "metin": "", "tavsiye": "", "tahmin": None,
                "source": "empty"}

    parts = "\n\n".join(f"[{b.section}] {b.text}" for b in blocks)
    tr_line = ""
    if transits:
        tr_line = "\nBUGÜNÜN TRANSİTİ: " + ", ".join(
            f"{t['transit']} {t['aspect_tr']} {t['natal']}" for t in transits[:2])

    user_msg = (
        f"KULLANICI: {json.dumps(user_ctx, ensure_ascii=False)}{tr_line}\n\n"
        f"PARÇALAR:\n{parts}"
    )
    system = STITCH_SYSTEM
    if extra_note:
        system += f"\n\nEK KISIT: {extra_note}"
    res = await complete(system=system, user=user_msg, tier="small",
                         max_tokens=600, temperature=0.75, expect_json=True)
    out = res.data or {}
    out["source"] = "hybrid"
    out["_cost"] = res.cost_usd
    out["_blocks"] = [b.key for b in blocks]
    return out


# ------------------------------------------------- kütüphaneyi bir kez doldurmak

SEED_SYSTEM = """Sen bir astroloji metni yazarısın. Türkçe yazarsın.

Sana bir astrolojik koşul verilecek (örn. "venus_scorpio" = Venüs Akrep'te,
"asp_saturn_venus_square" = Satürn Venüs'e kare).

Bu koşul için {n} FARKLI paragraf yaz. Her paragraf:
- 3-4 cümle
- "sen" diliyle, sıcak ve kendinden emin
- SADECE bu koşulun anlamını anlatır, başka gösterge uydurmaz
- kesin tarih, para tutarı, hastalık, ölüm, hamilelik içermez
- diğer varyantlarla aynı kelimeleri tekrarlamaz (farklı imge, farklı açı)

Çıktı SADECE: {{"variants": ["...", "...", ...]}}"""


async def seed_key(db, key: str, locale: str = "tr") -> tuple[int, float]:
    """Tek bir koşul anahtarı için varyantları üretip yazar.

    (yazılan_paragraf, maliyet_usd) döner. Eşzamanlı çalıştırılabilsin diye
    tek anahtarlık: scripts/seed_blocks.py bunu N kanalla sürüyor.
    """
    from .llm import complete

    mevcut = await db.fetchval(
        "SELECT count(*) FROM content_blocks WHERE key=$1 AND locale=$2", key, locale)
    if mevcut:
        return 0, 0.0

    res = await complete(
        system=SEED_SYSTEM.format(n=VARIANTS_PER_KEY),
        user=f"Koşul: {key}\nBölüm: {section_of(key)}",
        tier="small", max_tokens=1200, temperature=1.0, expect_json=True,
    )
    variants = [v for v in (res.data or {}).get("variants", [])
                if isinstance(v, str) and len(v.strip()) > 40]
    if not variants:
        # Boş/bozuk çıktıyı sessizce yazma: kütüphaneye giren boş blok,
        # ücretsiz kullanıcıya boş yorum olarak geri döner.
        raise ValueError(f"{key}: kullanılabilir varyant üretilmedi")

    yazilan = 0
    for i, text in enumerate(variants[:VARIANTS_PER_KEY]):
        await db.execute(
            """INSERT INTO content_blocks (key, variant, locale, section, text)
               VALUES ($1,$2,$3,$4,$5)
               ON CONFLICT (key, variant, locale) DO NOTHING""",
            key, i, locale, section_of(key), text.strip(),
        )
        yazilan += 1
    return yazilan, res.cost_usd


async def seed_library(db, keys: list[str], locale: str = "tr") -> dict:
    """Sıralı doldurma (küçük listeler ve testler için).

    Büyük tur için scripts/seed_blocks.py kullan — eşzamanlı çalışır,
    maliyeti canlı raporlar ve bütçe freni vardır.
    """
    created = 0
    for key in keys:
        try:
            n, _ = await seed_key(db, key, locale)
        except Exception:      # noqa: BLE001 — tek anahtar tüm turu durdurmasın
            continue
        created += n
    return {"created": created}


def all_condition_keys() -> list[str]:
    """seed_library'ye verilecek tam anahtar listesini üretir.

    astro.condition_keys()'in üretebileceği HER anahtarı kapsamak zorunda.
    Kapsamayan bir anahtar = o kullanıcı için boş içerik. İkisi de
    astro.BLOCK_* listelerinden türediği için ayrışamazlar.
    """
    from .astro import (BLOCK_ASPECT_KINDS, BLOCK_PLANETS, MOON_PHASE_KEYS,
                        RETRO_PLANETS, SIGN_KEYS)

    keys = [f"asc_{s}" for s in SIGN_KEYS]
    for p in BLOCK_PLANETS:
        keys += [f"{p}_{s}" for s in SIGN_KEYS]
        keys += [f"{p}_h{h}" for h in range(1, 13)]
        if p in RETRO_PLANETS:
            keys.append(f"{p}_retro")
    for i in range(len(BLOCK_PLANETS)):
        for j in range(i + 1, len(BLOCK_PLANETS)):
            pair = "_".join(sorted([BLOCK_PLANETS[i], BLOCK_PLANETS[j]]))
            keys += [f"asp_{pair}_{k}" for k in BLOCK_ASPECT_KINDS]
    keys += [f"element_dom_{e}" for e in ("fire", "earth", "air", "water")]
    keys += [f"moon_{p}" for p in MOON_PHASE_KEYS]
    return sorted(set(keys))


if __name__ == "__main__":
    ks = all_condition_keys()
    print("anahtar sayısı:", len(ks), "→ paragraf:", len(ks) * VARIANTS_PER_KEY)
    print("örnek:", random.sample(ks, 8))
