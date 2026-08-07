#!/usr/bin/env bash
#
# Yerel geliştirme ortamını ayağa kaldırır: Postgres + Redis + API + worker.
#
# Amaç, projeyi ilk kez açan birinin "çalışıyor mu" sorusunu 2 dakikada
# cevaplayabilmesi. LLM anahtarı yoksa da her şey çalışır — sahte bir LLM
# sunucusu devreye giriyor (scripts/fake_llm.py), böylece fal üretimini
# para harcamadan uçtan uca deneyebilirsin.
#
# Kullanım:
#   scripts/dev.sh            # sahte LLM ile
#   LLM_API_KEY=... scripts/dev.sh   # gerçek LLM ile
#
set -euo pipefail

KOK="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="$KOK/fal-backend"
LOG="${TMPDIR:-/tmp}/fal-dev"
mkdir -p "$LOG"

: "${DATABASE_URL:=postgresql://postgres:fal@127.0.0.1/fal}"
: "${REDIS_URL:=redis://localhost:6379/0}"
export DATABASE_URL REDIS_URL
export PYTHONPATH="$BACKEND"

bilgi() { printf '\033[36m›\033[0m %s\n' "$*"; }
hata()  { printf '\033[31m✗\033[0m %s\n' "$*" >&2; }

# --- Redis
if ! redis-cli -u "$REDIS_URL" ping >/dev/null 2>&1; then
  bilgi "Redis başlatılıyor"
  redis-server --daemonize yes --save '' --appendonly no
  sleep 1
fi
redis-cli -u "$REDIS_URL" ping >/dev/null || { hata "Redis'e bağlanılamadı"; exit 1; }

# --- Postgres
if ! pg_isready -q 2>/dev/null; then
  hata "Postgres çalışmıyor. Başlat ve tekrar dene."
  hata "  (Debian/Ubuntu) sudo pg_ctlcluster 16 main start"
  exit 1
fi

if ! psql "$DATABASE_URL" -c 'SELECT 1' >/dev/null 2>&1; then
  bilgi "Veritabanı yok, oluşturuluyor"
  createdb fal 2>/dev/null || true
fi

if ! psql "$DATABASE_URL" -tAc \
     "SELECT to_regclass('public.readings')" | grep -q readings; then
  bilgi "Şema uygulanıyor"
  psql "$DATABASE_URL" -q -f "$BACKEND/sql/001_init.sql"
fi

# --- LLM: anahtar yoksa sahte sunucu
if [ -z "${LLM_API_KEY:-}" ]; then
  bilgi "LLM_API_KEY yok — sahte LLM sunucusu kullanılıyor (port 8899)"
  if ! curl -sf -o /dev/null -X POST http://127.0.0.1:8899/v1/embeddings \
        -H 'content-type: application/json' -d '{"input":"x"}' 2>/dev/null; then
    python3 "$KOK/scripts/fake_llm.py" >"$LOG/llm.log" 2>&1 &
    sleep 2
  fi
  export LLM_BASE_URL="http://127.0.0.1:8899/v1/messages"
  export EMBED_URL="http://127.0.0.1:8899/v1/embeddings"
  export LLM_API_KEY="sahte"
fi

# --- API + worker + zamanlayıcı
bilgi "Worker başlatılıyor"
( cd "$BACKEND" && rq worker readings --url "$REDIS_URL" >"$LOG/worker.log" 2>&1 & )

# Zamanlayıcı yerelde de çalışıyor: bakım işleri üretimde çalışıp yerelde
# çalışmazsa, aradaki fark ancak canlıda fark ediliyor. Yerelde çalışması
# ayrıca "tahmin penceresi kapandı, soru gitti mi" akışını denemeyi de
# mümkün kılıyor.
if [ "${FAL_SCHEDULER:-1}" = "1" ]; then
  bilgi "Zamanlayıcı başlatılıyor"
  ( cd "$BACKEND" && python3 -m app.workers.scheduler >"$LOG/scheduler.log" 2>&1 & )
fi

bilgi "API başlatılıyor → http://127.0.0.1:8000"
bilgi "Loglar: $LOG"
echo
cd "$BACKEND" && exec uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
