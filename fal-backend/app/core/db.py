"""Veritabanı bağlantısı ve tek seferlik başlangıç şeması."""

from __future__ import annotations

import json
import os
from pathlib import Path

import asyncpg

DB_URL = os.getenv("DATABASE_URL", "postgresql://localhost/fal")
SCHEMA_PATH = Path(__file__).resolve().parents[2] / "sql" / "001_init.sql"
SCHEMA_VERSION = "001"


def _dumps(v) -> str:
    # default=str: tarih/UUID gibi tipler sessizce patlamasın. Sayısal
    # değerlerin string'e dönmemesi için kaynakta temizlik yapılıyor
    # (bkz. cup_vision — numpy tipleri int()/float() ile sarılıyor).
    return json.dumps(v, ensure_ascii=False, default=str)


async def init_connection(conn: asyncpg.Connection) -> None:
    # jsonb/json codec'i. Kaydedilmezse asyncpg bu sütunları düz METİN olarak
    # döndürür: /v1/readings/{id} yanıtında output_json bir JSON string'i olur,
    # istemcideki `reading.output_json.ozet` undefined döner ve fal ekranı boş
    # görünür — sunucu doğru içeriği üretmiş olsa bile. Yazarken de dict
    # geçilebilsin diye encoder aynı yerde tanımlı.
    for tip in ("jsonb", "json"):
        await conn.set_type_codec(
            tip, encoder=_dumps, decoder=json.loads, schema="pg_catalog")


async def ensure_schema() -> None:
    """Boş Railway veritabanına şemayı atomik olarak bir kez uygula."""
    conn = await asyncpg.connect(DB_URL)
    try:
        async with conn.transaction():
            await conn.execute(
                """CREATE TABLE IF NOT EXISTS schema_migrations (
                     version text PRIMARY KEY,
                     applied_at timestamptz NOT NULL DEFAULT now()
                   )""")
            applied = await conn.fetchval(
                "SELECT 1 FROM schema_migrations WHERE version=$1",
                SCHEMA_VERSION,
            )
            if not applied:
                await conn.execute(SCHEMA_PATH.read_text(encoding="utf-8"))
                await conn.execute(
                    "INSERT INTO schema_migrations (version) VALUES ($1)",
                    SCHEMA_VERSION,
                )
    finally:
        await conn.close()


async def create_pool(min_size: int = 2, max_size: int = 10) -> asyncpg.Pool:
    return await asyncpg.create_pool(
        DB_URL, min_size=min_size, max_size=max_size, init=init_connection
    )


async def connect() -> asyncpg.Connection:
    conn = await asyncpg.connect(DB_URL)
    await init_connection(conn)
    return conn
