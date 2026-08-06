"""
LLM katmanı.

Bootstrap bütçesinin hayatta kalması bu dosyadaki 5 karara bağlı:
  1. KADEMELİ MODEL     — ücretsiz kullanıcı küçük modele, ödeyen büyük modele gider
  2. PROMPT CACHE       — sabit sistem promptu ikinci istekten sonra ~%10 fiyata düşer
  3. BATCH              — günlük burçlar gece toplu üretilir (yarı fiyat, aciliyet yok)
  4. JSON ZORLAMA       — tek denemede doğru çıktı = yeniden üretme maliyeti yok
  5. MALİYET MUHASEBESİ — her istek DB'ye yazılır; kullanıcı başı maliyeti bilmiyorsan
                          fiyatlandırmayı da bilemezsin

Sağlayıcıdan bağımsız tutuldu: BASE_URL ve model adlarını .env'den değiştirerek
başka sağlayıcıya geçebilirsin.
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

BASE_URL = os.getenv("LLM_BASE_URL", "https://api.anthropic.com/v1/messages")
API_KEY = os.getenv("LLM_API_KEY", "")
API_VERSION = os.getenv("LLM_API_VERSION", "2023-06-01")

# Model kademeleri. Adları .env'den ver — modeller değişir, kod değişmesin.
MODEL_TIERS = {
    "nano":  os.getenv("MODEL_NANO",  "claude-haiku-4-5"),   # guardrail, etiketleme, özetleme
    "small": os.getenv("MODEL_SMALL", "claude-haiku-4-5"),   # ücretsiz fal, blok birleştirme
    "large": os.getenv("MODEL_LARGE", "claude-sonnet-5"),    # ödeyen kullanıcı falı
}

# 1M token başına USD — kendi sağlayıcı fiyatınla güncelle, muhasebe buna bakıyor
PRICING = {
    "nano":  {"in": 1.00, "out": 5.00, "cache_write": 1.25, "cache_read": 0.10},
    "small": {"in": 1.00, "out": 5.00, "cache_write": 1.25, "cache_read": 0.10},
    "large": {"in": 3.00, "out": 15.00, "cache_write": 3.75, "cache_read": 0.30},
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
    """Tek LLM çağrısı.

    prefill: modelin cevabını '{' ile başlatmak JSON tutarlılığını çok artırır —
    ücretsiz bir kalite kazanımı, kullan.
    """
    model = MODEL_TIERS[tier]
    content: list[dict] = []
    for img in images or []:
        content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": img.get("media_type", "image/jpeg"),
                       "data": img["data"]},
        })
    content.append({"type": "text", "text": user})

    messages: list[dict] = [{"role": "user", "content": content}]
    if expect_json and prefill is None:
        prefill = "{"
    if prefill:
        messages.append({"role": "assistant", "content": prefill})

    payload = {
        "model": model,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "system": system if isinstance(system, list) else [{"type": "text", "text": system}],
        "messages": messages,
    }
    headers = {
        "x-api-key": API_KEY,
        "anthropic-version": API_VERSION,
        "content-type": "application/json",
    }

    t0 = time.perf_counter()
    last_err: Exception | None = None
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                r = await client.post(BASE_URL, headers=headers, json=payload)
                if r.status_code in (429, 500, 502, 503, 529):
                    await asyncio.sleep(min(2 ** attempt, 12))
                    continue
                r.raise_for_status()
                body = r.json()
                text = "".join(b.get("text", "") for b in body.get("content", [])
                               if b.get("type") == "text")
                if prefill:
                    text = prefill + text
                usage = body.get("usage", {})
                data = parse_json_loose(text) if expect_json else None
                if expect_json and data is None and attempt < MAX_RETRIES:
                    # Sıcaklığı düşürüp tekrar dene — JSON hatası genelde yaratıcılıktan gelir
                    payload["temperature"] = 0.3
                    continue
                return LLMResult(
                    text=text, data=data, tier=tier, model=model,
                    in_tokens=usage.get("input_tokens", 0),
                    out_tokens=usage.get("output_tokens", 0),
                    cache_read=usage.get("cache_read_input_tokens", 0),
                    cache_write=usage.get("cache_creation_input_tokens", 0),
                    cost_usd=_estimate_cost(tier, usage),
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

    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(url, json={"input": text[:2000]},
                         headers={"authorization": f"Bearer {os.getenv('EMBED_KEY','')}"})
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
