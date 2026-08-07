"""
Blok kütüphanesini doldurur. Bir kez çalıştırılır (veya yeni anahtar eklendikçe).

    python -m scripts.seed_blocks --dry-run       # ne yapılacağını göster, para harcama
    python -m scripts.seed_blocks --limit 50      # 50 anahtar üret
    python -m scripts.seed_blocks                 # kalan her şeyi üret

~302 anahtar × 4 varyant = ~1.200 paragraf. Tahmini toplam 15-40 $.
Bir daha ödemezsin: ücretsiz kullanıcıların günlük yorumu bundan besleniyor
ve blok başına maliyet sıfıra yakınsıyor (bkz. app/core/blocks.py).

TASARIM NOTLARI
- Eşzamanlı çalışır. Sıralı hâlde 302 anahtar × ~8 sn ≈ 40 dakika sürüyordu;
  8 kanalla ~5 dakikaya iniyor.
- Kaldığı yerden devam eder: kütüphanede karşılığı olan anahtarı atlar.
  Yarıda kesersen tekrar çalıştır, ödediğin yerden başlar.
- Maliyeti canlı raporlar. Bütçe aşımını sonradan faturada değil, burada gör.
- Bir anahtar patlarsa tur durmaz; sonunda başarısızlar listelenir.
"""

from __future__ import annotations

import argparse
import asyncio
import sys

from app.core.blocks import (VARIANTS_PER_KEY, all_condition_keys, section_of,
                             seed_key)
from app.core.db import create_pool


async def main(locale: str, limit: int | None, concurrency: int,
               dry_run: bool, butce: float) -> int:
    # Havuz, tek bağlantı DEĞİL: asyncpg'de tek bağlantı eşzamanlı sorgu
    # kaldırmıyor ("another operation is in progress"). Eşzamanlılık bu
    # betiğin tek varlık sebebi, o yüzden havuz şart.
    pool = await create_pool(min_size=2, max_size=max(4, concurrency + 2))
    try:
      async with pool.acquire() as db:
          keys = all_condition_keys()
          mevcut = {r["key"] for r in await db.fetch(
              "SELECT DISTINCT key FROM content_blocks WHERE locale=$1", locale)}
          todo = [k for k in keys if k not in mevcut]
          if limit:
              todo = todo[:limit]

          print(f"dağarcık {len(keys)} | kütüphanede {len(mevcut)} | "
                f"bu turda {len(todo)} anahtar × {VARIANTS_PER_KEY} varyant")
          if not todo:
              print("yapılacak bir şey yok.")
              return 0

          if dry_run:
              from collections import Counter
              print("\nbölümlere göre:", dict(Counter(section_of(k) for k in todo)))
              print("örnek:", todo[:8])
              print(f"\ntahmini maliyet: {len(todo) * 0.05:.2f}-{len(todo) * 0.13:.2f} $")
              print("(--dry-run kaldırıldığında üretilecek)")
              return 0

          toplam_maliyet = 0.0
          uretilen = 0
          basarisiz: list[tuple[str, str]] = []
          sem = asyncio.Semaphore(concurrency)
          durdu = asyncio.Event()

          async def bir(i: int, key: str) -> None:
              nonlocal toplam_maliyet, uretilen
              if durdu.is_set():
                  return
              async with sem:
                  if durdu.is_set():
                      return
                  try:
                      async with pool.acquire() as c:
                          n, cost = await seed_key(c, key, locale)
                  except Exception as e:                      # noqa: BLE001
                      basarisiz.append((key, str(e)[:90]))
                      print(f"  [{i:>3}/{len(todo)}] ✗ {key}  ({type(e).__name__})")
                      return
                  toplam_maliyet += cost
                  uretilen += n
                  print(f"  [{i:>3}/{len(todo)}] {key:<34} "
                        f"{n} varyant  ${cost:.4f}  toplam ${toplam_maliyet:.2f}")
                  # Bütçe freni: yanlış model veya kaçak prompt faturayı patlatmasın.
                  if butce and toplam_maliyet >= butce:
                      if not durdu.is_set():
                          print(f"\n!! bütçe sınırına ulaşıldı (${butce:.2f}) — duruluyor")
                          durdu.set()

          await asyncio.gather(*(bir(i, k) for i, k in enumerate(todo, 1)))

          print(f"\nüretilen paragraf: {uretilen}")
          print(f"harcanan: ${toplam_maliyet:.2f}")
          kalan = len(keys) - len(mevcut) - (len(todo) - len(basarisiz))
          if kalan > 0:
              print(f"kalan anahtar: {kalan} — tekrar çalıştırarak devam edebilirsin")
          if basarisiz:
              print(f"\nbaşarısız {len(basarisiz)}:")
              for k, e in basarisiz[:10]:
                  print(f"  {k}: {e}")
          return 1 if basarisiz and not uretilen else 0
    finally:
        await pool.close()


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Blok kütüphanesini doldurur.")
    p.add_argument("--locale", default="tr")
    p.add_argument("--limit", type=int, default=None,
                   help="bu turda en fazla kaç anahtar (varsayılan: hepsi)")
    p.add_argument("--concurrency", type=int, default=8,
                   help="eşzamanlı istek (sağlayıcı hız sınırına göre düşür)")
    p.add_argument("--budget", type=float, default=50.0,
                   help="bu tur için üst sınır, USD (0 = sınırsız)")
    p.add_argument("--dry-run", action="store_true",
                   help="hiçbir şey üretme, ne yapılacağını göster")
    a = p.parse_args()
    sys.exit(asyncio.run(main(a.locale, a.limit, a.concurrency,
                              a.dry_run, a.budget)))
