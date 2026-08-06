"""Blok kütüphanesini bir kez doldurur.

    python -m scripts.seed_blocks --locale tr --limit 50

Toplam ~300 anahtar × 4 varyant. Parça parça çalıştır, maliyeti izle.
Tamamı için tahmini bütçe: 15-40 $. Bir daha ödemezsin.
"""
import argparse, asyncio, os, asyncpg
from app.core.blocks import all_condition_keys, seed_library

async def main(locale: str, limit: int):
    db = await asyncpg.connect(os.getenv("DATABASE_URL", "postgresql://localhost/fal"))
    keys = all_condition_keys()
    done = await db.fetch("SELECT DISTINCT key FROM content_blocks WHERE locale=$1", locale)
    have = {r["key"] for r in done}
    todo = [k for k in keys if k not in have][:limit]
    print(f"toplam {len(keys)} | mevcut {len(have)} | bu turda {len(todo)}")
    res = await seed_library(db, todo, locale)
    print(res)
    await db.close()

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--locale", default="tr")
    p.add_argument("--limit", type=int, default=50)
    a = p.parse_args()
    asyncio.run(main(a.locale, a.limit))
