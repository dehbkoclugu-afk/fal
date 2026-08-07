"""
Veritabanı bağlantı kurulumu.

Tek sorumluluğu: her bağlantıda pgvector codec'ini kaydetmek. Bu yapılmazsa
`readings.embedding` (vector(384)) sütununa Python listesi yazılamaz — asyncpg
bilinmeyen tipi `str` sanar ve her fal kaydı DataError ile düşer. Okurken de
sütun `"[0.1,0.2,...]"` string'i olarak gelir; `list(...)` bunu karakterlere
böler ve anti-tekrar kontrolü sessizce çöker.

Bu yüzden DB'ye giden her yol (API pool'u ve worker bağlantısı) buradan geçer.
"""

from __future__ import annotations

import json
import os

import asyncpg
from pgvector.asyncpg import register_vector

DB_URL = os.getenv("DATABASE_URL", "postgresql://localhost/fal")


def _dumps(v) -> str:
    # default=str: tarih/UUID gibi tipler sessizce patlamasın. Sayısal
    # değerlerin string'e dönmemesi için kaynakta temizlik yapılıyor
    # (bkz. cup_vision — numpy tipleri int()/float() ile sarılıyor).
    return json.dumps(v, ensure_ascii=False, default=str)


async def init_connection(conn: asyncpg.Connection) -> None:
    await register_vector(conn)

    # jsonb/json codec'i. Kaydedilmezse asyncpg bu sütunları düz METİN olarak
    # döndürür: /v1/readings/{id} yanıtında output_json bir JSON string'i olur,
    # istemcideki `reading.output_json.ozet` undefined döner ve fal ekranı boş
    # görünür — sunucu doğru içeriği üretmiş olsa bile. Yazarken de dict
    # geçilebilsin diye encoder aynı yerde tanımlı.
    for tip in ("jsonb", "json"):
        await conn.set_type_codec(
            tip, encoder=_dumps, decoder=json.loads, schema="pg_catalog")


async def create_pool(min_size: int = 2, max_size: int = 10) -> asyncpg.Pool:
    return await asyncpg.create_pool(
        DB_URL, min_size=min_size, max_size=max_size, init=init_connection
    )


async def connect() -> asyncpg.Connection:
    conn = await asyncpg.connect(DB_URL)
    await init_connection(conn)
    return conn
