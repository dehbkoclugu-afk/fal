"""
LLM katmanı.

Bootstrap bütçesinin hayatta kalması bu dosyadaki 5 karara bağlı:
  1. KADEMELİ MODEL     — ücretsiz kullanıcı küçük modele, ödeyen büyük modele gider
  2. TEK REST İSTEMCİSİ — metin ve görsel aynı Gemini çağrı yolundan geçer
  3. BATCH              — günlük burçlar gece toplu üretilir (yarı fiyat, aciliyet yok)
  4. JSON ZORLAMA       — tek denemede doğru çıktı = yeniden üretme maliyeti yok
  5. MALİYET MUHASEBESİ — her istek DB'ye yazılır; kullanıcı başı maliyeti bilmiyorsan
                          fiyatlandırmayı da bilemezsin

Google Gemini REST API kullanılır. Harici SDK yok; mevcut httpx bağımlılığı yeterli.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
from dataclasses import dataclass
from typing import Any

import httpx

log = logging.getLogger(__name__)

BASE_URL = os.getenv(
    "GEMINI_API_BASE",
    "https://generativelanguage.googleapis.com/v1beta/models",
).rstrip("/")
API_KEY = os.getenv("GEMINI_API_KEY", "")

# Model kademeleri. Adları .env'den ver — modeller değişir, kod değişmesin.
MODEL_TIERS = {
    "nano":  os.getenv("MODEL_NANO",  "gemini-3.5-flash-lite"),
    "small": os.getenv("MODEL_SMALL", "gemini-3.5-flash-lite"),
    "large": os.getenv("MODEL_LARGE", "gemini-3.5-flash-lite"),
}

# 1M token başına USD — kendi sağlayıcı fiyatınla güncelle, muhasebe buna bakıyor
PRICING = {
    "nano":  {"in": 0.30, "out": 2.50, "cache_write": 0.0, "cache_read": 0.0},
    "small": {"in": 0.30, "out": 2.50, "cache_write": 0.0, "cache_read": 0.0},
    "large": {"in": 0.30, "out": 2.50, "cache_write": 0.0, "cache_read": 0.0},
}

MAX_RETRIES = 3
TIMEOUT = 90.0


@dataclass
class LLMResult:
    text: str
    data: dict | None
    tier: str
    model: str
    in_tokens: int
    out_tokens: int
    cache_read: int
    cache_write: int
    cost_usd: float
    latency_ms: int
    attempts: int


def _estimate_cost(tier: str, u: dict) -> float:
    p = PRICING[tier]
    return round(
        (u.get("input_tokens", 0) * p["in"]
         + u.get("output_tokens", 0) * p["out"]
         + u.get("cache_creation_input_tokens", 0) * p["cache_write"]
         + u.get("cache_read_input_tokens", 0) * p["cache_read"]) / 1_000_000,
        6,
    )


_JSON_FENCE = re.compile(r"^\s*```(?:json)?\s*|\s*```\s*$", re.MULTILINE)


def parse_json_loose(text: str) -> dict | None:
    """Model bazen kod bloğu veya önsöz ekler. Tamir et, yine olmazsa None dön."""
    t = _JSON_FENCE.sub("", text).strip()
    try:
        return json.loads(t)
    except json.JSONDecodeError:
        pass
    # İlk { ile son } arasını dene
    i, j = t.find("{"), t.rfind("}")
    if i != -1 and j > i:
        try:
            return json.loads(t[i:j + 1])
        except json.JSONDecodeError:
            return None
    return None


def _system_text(system: list[dict] | str) -> str:
    if isinstance(system, str):
        return system
    return "\n\n".join(
        str(block.get("text", ""))
        for block in system
        if isinstance(block, dict) and block.get("text")
    )


async def complete(
    system: list[dict] | str,
    user: str,
    tier: str = "large",
    max_tokens: int = 2000,
    temperature: float = 0.9,
    expect_json: bool = True,
    images: list[dict] | None = None,
    prefill: str | None = None,
) -> LLMResult:
    """Tek Gemini çağrısı. ``prefill`` eski sağlayıcıyla API uyumluluğu içindir."""
    model = MODEL_TIERS[tier]
    if not API_KEY:
        raise RuntimeError("GEMINI_API_KEY ortam değişkeni eksik.")

    content: list[dict] = []
    for img in images or []:
        content.append({
            "inline_data": {
                "mime_type": img.get("media_type", "image/jpeg"),
                "data": img["data"],
            },
        })
    content.append({"text": user})

    payload = {
        "system_instruction": {"parts": [{"text": _system_text(system)}]},
        "contents": [{"role": "user", "parts": content}],
        "generationConfig": {
            "maxOutputTokens": max_tokens,
            "temperature": temperature,
            **({"responseMimeType": "application/json"} if expect_json else {}),
        },
    }
    headers = {"x-goog-api-key": API_KEY, "content-type": "application/json"}
    url = f"{BASE_URL}/{model}:generateContent"

    t0 = time.perf_counter()
    last_err: Exception | None = None
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                r = await client.post(url, headers=headers, json=payload)
                if r.status_code in (429, 500, 502, 503, 529):
                    await asyncio.sleep(min(2 ** attempt, 12))
                    continue
                r.raise_for_status()
                body = r.json()
                candidates = body.get("candidates") or []
                parts = candidates[0].get("content", {}).get("parts", []) if candidates else []
                text = "".join(p.get("text", "") for p in parts)
                usage = body.get("usageMetadata", {})
                normalized_usage = {
                    "input_tokens": usage.get("promptTokenCount", 0),
                    "output_tokens": usage.get("candidatesTokenCount", 0),
                    "cache_read_input_tokens": usage.get("cachedContentTokenCount", 0),
                    "cache_creation_input_tokens": 0,
                }
                data = parse_json_loose(text) if expect_json else None
                if expect_json and data is None and attempt < MAX_RETRIES:
                    # Sıcaklığı düşürüp tekrar dene — JSON hatası genelde yaratıcılıktan gelir
                    payload["generationConfig"]["temperature"] = 0.3
                    continue
                return LLMResult(
                    text=text, data=data, tier=tier, model=model,
                    in_tokens=normalized_usage["input_tokens"],
                    out_tokens=normalized_usage["output_tokens"],
                    cache_read=normalized_usage["cache_read_input_tokens"],
                    cache_write=0,
                    cost_usd=_estimate_cost(tier, normalized_usage),
                    latency_ms=int((time.perf_counter() - t0) * 1000),
                    attempts=attempt,
                )
            except Exception as e:      # noqa: BLE001
                last_err = e
                await asyncio.sleep(min(2 ** attempt, 12))
    raise RuntimeError(f"LLM çağrısı {MAX_RETRIES} denemede başarısız: {last_err}")


# --------------------------------------------------- fincan sembolü etiketleme

async def label_symbols(blobs: list[Any], lexicon: list[str],
                        max_blobs: int = 6) -> None:
    """Her telve bölgesini küçük vision modeline sorar. blobs.symbols'ü doldurur.

    Maliyet notu: 6 kırpma × ~250 giriş token ≈ ihmal edilebilir. Ama fincanın
    TAMAMINI büyük modele göndermek yerine kırpma göndermek hem daha doğru
    hem ~5x daha ucuz. Bu yüzden bölgesel yaklaşım seçildi.
    """
    from .prompts import SYMBOL_LABEL_SYSTEM

    async def one(b):
        if not b.crop_b64:
            return
        sys_p = SYMBOL_LABEL_SYSTEM.format(lexicon=", ".join(lexicon), hint=b.hint)
        try:
            res = await complete(
                system=sys_p, user="Bu şekil neye benziyor?",
                tier="nano", max_tokens=150, temperature=0.2,
                images=[{"data": b.crop_b64}], expect_json=True,
            )
            if res.data and isinstance(res.data.get("labels"), list):
                b.symbols = [s for s in res.data["labels"]
                             if isinstance(s, dict) and s.get("confidence", 0) >= 0.35]
            else:
                # Sessizce boş bırakma: sembol etiketleme çökerse kahve falı
                # geometri ipuçlarına düşer ve hiçbir yerde iz kalmaz.
                # Kalibrasyon sırasında bu satır olmadan sorunu göremezsin.
                log.warning("sembol etiketleme boş döndü (blob=%s, hint=%s)",
                            b.id, b.hint)
        except Exception as e:      # noqa: BLE001
            log.warning("sembol etiketleme hatası (blob=%s): %s", b.id, e)
            b.symbols = []

    await asyncio.gather(*(one(b) for b in blobs[:max_blobs]))


# ------------------------------------------------------ anti-tekrar (embedding)

async def embed(text: str) -> list[float]:
    """Embedding sağlayıcısı ayrı olabilir. Yerelde sentence-transformers da yeter
    (bootstrap için önerilen: paraphrase-multilingual-MiniLM, CPU'da çalışır, bedava).
    """
    url = os.getenv("EMBED_URL")
    if not url:
        # Yerel model yolu — sunucuda 1 kez yüklenir
        from functools import lru_cache

        @lru_cache(maxsize=1)
        def _model():
            from sentence_transformers import SentenceTransformer
            return SentenceTransformer(
                os.getenv("EMBED_MODEL", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
            )
        return _model().encode(text[:2000]).tolist()

    # Anahtar yoksa Authorization başlığını HİÇ gönderme. Boş anahtarla
    # "Bearer " üretilir ve httpx bunu geçersiz başlık sayıp
    # LocalProtocolError atar — kimliksiz yerel bir embedding servisiyle
    # (veya scripts/fake_llm.py ile) çalışırken her fal bu yüzden düşer.
    headers = {}
    if key := os.getenv("EMBED_KEY"):
        headers["authorization"] = f"Bearer {key}"

    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(url, json={"input": text[:2000]}, headers=headers)
        r.raise_for_status()
        return r.json()["data"][0]["embedding"]


def cosine(a: list[float], b: list[float]) -> float:
    num = sum(x * y for x, y in zip(a, b))
    da = sum(x * x for x in a) ** 0.5
    db = sum(y * y for y in b) ** 0.5
    return num / (da * db + 1e-9)


REPEAT_THRESHOLD = 0.86


def too_similar(new_vec: list[float], recent_vecs: list[list[float]]) -> bool:
    """Kullanıcının son 10 falına çok benziyorsa yeniden üret.

    Bu kontrol olmadan LLM 3. faldan sonra kendini tekrar eder ve kullanıcı
    'hep aynı şeyi yazıyor' diyerek aboneliği iptal eder. Churn'ün 1 numaralı
    teknik sebebi budur.
    """
    return any(cosine(new_vec, v) > REPEAT_THRESHOLD for v in recent_vecs)
