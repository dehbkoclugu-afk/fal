from __future__ import annotations

from pathlib import Path

import pytest

from app.core import db


class _Transaction:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


class _Connection:
    def __init__(self, migrated: bool):
        self.migrated = migrated
        self.executed: list[str] = []
        self.closed = False

    def transaction(self):
        return _Transaction()

    async def execute(self, sql: str, *args):
        self.executed.append(sql)

    async def fetchval(self, sql: str, *args):
        return 1 if self.migrated else None

    async def close(self):
        self.closed = True


@pytest.mark.asyncio
async def test_ensure_schema_applies_initial_migration(monkeypatch):
    conn = _Connection(migrated=False)

    async def connect(_url):
        return conn

    monkeypatch.setattr(db.asyncpg, "connect", connect)
    await db.ensure_schema()

    assert any("CREATE TABLE users" in sql for sql in conn.executed)
    assert any("schema_migrations" in sql for sql in conn.executed)
    assert conn.closed


@pytest.mark.asyncio
async def test_ensure_schema_skips_applied_migration(monkeypatch):
    conn = _Connection(migrated=True)

    async def connect(_url):
        return conn

    monkeypatch.setattr(db.asyncpg, "connect", connect)
    await db.ensure_schema()

    assert not any("CREATE TABLE users" in sql for sql in conn.executed)
    assert conn.closed


def test_initial_schema_uses_builtin_array_instead_of_pgvector():
    sql = (Path(__file__).parents[1] / "sql" / "001_init.sql").read_text()
    assert "CREATE EXTENSION IF NOT EXISTS vector" not in sql
    assert "embedding     real[]" in sql
