"""
Test altyapısı.

İki şeyi sağlar:
  1. Gerçek bir Postgres şeması üzerinde çalışan izole test veritabanı.
     Şema testi ediyoruz çünkü bulunan hataların çoğu (dizi codec'i,
     date/time argüman tipleri, ON CONFLICT çıkarımı) sadece gerçek sürücü
     ve gerçek Postgres karşısında ortaya çıkıyor — mock'la görünmezler.
  2. LLM taklidi. Gerçek API çağrısı yapmadan boru hattını uçtan uca
     çalıştırmak için; testler ne para harcar ne ağ ister.

Test DB'si TEST_DATABASE_URL ile verilir, yoksa testler atlanır.
"""

from __future__ import annotations

import json
import os
import pathlib
import uuid

import pytest
import pytest_asyncio

SCHEMA = pathlib.Path(__file__).resolve().parents[1] / "sql" / "001_init.sql"
TEST_DB_URL = os.getenv("TEST_DATABASE_URL", "")

requires_db = pytest.mark.skipif(
    not TEST_DB_URL, reason="TEST_DATABASE_URL tanımlı değil")


@pytest_asyncio.fixture
async def db():
    """Her test için temiz şema. Testler birbirinin verisini görmez."""
    import asyncpg

    from app.core.db import init_connection

    conn = await asyncpg.connect(TEST_DB_URL)
    await conn.execute("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;")
    await conn.execute(SCHEMA.read_text())
    # Üretimdeki bağlantı kurulumunun aynısı (json/jsonb codec'leri).
    # Testler bunu atlarsa gerçek sürücü davranışını doğrulamamış olur —
    # zaten bulunan hataların çoğu tam olarak burada ortaya çıktı.
    await init_connection(conn)
    try:
        yield conn
    finally:
        await conn.close()


@pytest_asyncio.fixture
async def user_id(db):
    return await db.fetchval(
        "INSERT INTO users (anon_id, first_name) VALUES ($1,'Deniz') RETURNING id",
        str(uuid.uuid4()))


@pytest_asyncio.fixture
async def user_with_chart(db, user_id):
    from datetime import date, time
    await db.execute(
        """INSERT INTO birth_profiles
             (user_id, label, is_primary, birth_date, birth_time, time_known,
              place_name, lat, lon, tz_name)
           VALUES ($1,'ben',true,$2,$3,true,'İstanbul',41.0082,28.9784,'Europe/Istanbul')""",
        user_id, date(1993, 6, 14), time(4, 30))
    return user_id


# ------------------------------------------------------------------ LLM taklidi

class FakeLLM:
    """llm.complete yerine geçer. Ne döneceğini test belirler."""

    def __init__(self):
        self.calls: list[dict] = []
        self.responses: list[dict] = []
        self.default = {
            "ozet": "Bu hafta iletişim kanalların açılıyor.",
            "bolumler": [{"baslik": "Genel", "metin": "Uzun süredir beklettiğin "
                          "bir konuşma yakında kendiliğinden başlayacak."}],
            "tahminler": [
                {"konu": "ask", "iddia": "Beklemediğin bir mesaj alacaksın",
                 "pencere_gun": 10, "guven": "orta"},
                {"konu": "is", "iddia": "Bir işbirliği teklifi gelecek",
                 "pencere_gun": 14, "guven": "dusuk"},
            ],
            "tavsiye": "Acele karar verme.",
            "sembol": "kuş",
            "paylasim_cumlesi": "İletişim kanalların açılıyor.",
        }

    def queue(self, data: dict) -> None:
        self.responses.append(data)

    async def __call__(self, system, user, tier="large", max_tokens=2000,
                       temperature=0.9, expect_json=True, images=None,
                       prefill=None):
        from app.core.llm import LLMResult
        self.calls.append({"system": system, "user": user, "tier": tier,
                           "temperature": temperature, "images": images})
        data = self.responses.pop(0) if self.responses else dict(self.default)
        return LLMResult(
            text=json.dumps(data, ensure_ascii=False), data=data, tier=tier,
            model="fake", in_tokens=500, out_tokens=200, cache_read=0,
            cache_write=0, cost_usd=0.0012, latency_ms=5, attempts=1,
        )


@pytest.fixture
def fake_llm(monkeypatch):
    fake = FakeLLM()
    # pipeline modül seviyesinde import ediyor; blocks ve llm.label_symbols ise
    # fonksiyon içinde `from .llm import complete` yapıyor — ikisi de kapansın.
    monkeypatch.setattr("app.core.pipeline.complete", fake)
    monkeypatch.setattr("app.core.llm.complete", fake)
    return fake


@pytest.fixture
def fake_embed(monkeypatch):
    """Deterministik sahte embedding — sentence-transformers indirmeden
    anti-tekrar yolunu test edebilmek için."""
    import hashlib

    async def _embed(text: str) -> list[float]:
        h = hashlib.sha256(text.encode()).digest()
        return [((h[i % len(h)] / 255.0) - 0.5) for i in range(384)]

    monkeypatch.setattr("app.core.pipeline.embed", _embed)
    return _embed
