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

import os

import asyncpg
from pgvector.asyncpg import register_vector

DB_URL = os.getenv("DATABASE_URL", "postgresql://localhost/fal")


async def init_connection(conn: asyncpg.Connection) -> None:
    await register_vector(conn)


async def create_pool(min_size: int = 2, max_size: int = 10) -> asyncpg.Pool:
    return await asyncpg.create_pool(
        DB_URL, min_size=min_size, max_size=max_size, init=init_connection
    )


async def connect() -> asyncpg.Connection:
    conn = await asyncpg.connect(DB_URL)
    await init_connection(conn)
    return conn
