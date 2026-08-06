-- Fal uygulaması — başlangıç şeması (Postgres 15+)
-- pgvector: anti-tekrar kontrolü ve semantic cache için
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS vector;

-- blocks.py'nin ANY($2::block_ref[]) sorgusu için bileşik tip
DO $$ BEGIN
  CREATE TYPE block_ref AS (key text, variant int);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================ kullanıcı
CREATE TABLE users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anon_id             text UNIQUE NOT NULL,          -- cihaz kimliği; kayıt zorunlu değil
  apple_sub           text UNIQUE,
  google_sub          text UNIQUE,
  first_name          text,
  locale              text NOT NULL DEFAULT 'tr',
  tz_name             text NOT NULL DEFAULT 'Europe/Istanbul',
  tone                text DEFAULT 'mistik',         -- nazik | dobra | mistik | bilimsel
  relationship_status text,
  focus_topic         text,
  birth_year          int,                           -- yaş kapısı için
  acq_source          text,                          -- utm / attribution
  push_token          text,
  push_optin          boolean DEFAULT false,
  active_hour         int DEFAULT 9,                 -- bildirim saati öğrenilir
  streak_count        int DEFAULT 0,
  streak_last_day     date,
  created_at          timestamptz DEFAULT now(),
  deleted_at          timestamptz                    -- KVKK silme talebi (soft delete + purge job)
);
CREATE INDEX ON users (locale);
CREATE INDEX ON users (push_optin) WHERE push_optin;

-- ============================================================ doğum verisi
CREATE TABLE birth_profiles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label        text NOT NULL DEFAULT 'ben',          -- ben | partner | anne | patron...
  is_primary   boolean DEFAULT false,
  birth_date   date NOT NULL,
  birth_time   time,
  time_known   boolean DEFAULT true,
  place_name   text,
  lat          double precision,
  lon          double precision,
  tz_name      text DEFAULT 'Europe/Istanbul',
  created_at   timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX ON birth_profiles (user_id) WHERE is_primary;

-- Harita cache: ephemeris hesabı ucuz ama boşuna tekrar etmesin
CREATE TABLE natal_charts (
  birth_profile_id uuid PRIMARY KEY REFERENCES birth_profiles(id) ON DELETE CASCADE,
  chart_json       jsonb NOT NULL,
  engine_version   text NOT NULL,
  calculated_at    timestamptz DEFAULT now()
);

-- ============================================================ fallar
CREATE TABLE readings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind          text NOT NULL,                      -- coffee | tarot | natal | daily
  status        text NOT NULL DEFAULT 'queued',     -- queued|running|done|failed|blocked
  block_reason  text,
  tier          text,                               -- free | paid (üretim anındaki)
  input_json    jsonb DEFAULT '{}',
  output_json   jsonb,
  extra_json    jsonb,                              -- cup analizi, kart çekimi, transitler
  model         text,
  cost_usd      numeric(10,6) DEFAULT 0,
  embedding     vector(384),                        -- MiniLM boyutu; modeli değiştirirsen güncelle
  eta_seconds   int DEFAULT 120,
  created_at    timestamptz DEFAULT now(),
  delivered_at  timestamptz
);
CREATE INDEX ON readings (user_id, created_at DESC);
CREATE INDEX ON readings (status) WHERE status IN ('queued','running');

-- Fotoğraflar: ham görüntüyü SAKLAMA. R2'ye kısa TTL ile koy, işledikten sonra sil.
-- purge_at geçen kayıtlar için nightly job dosyayı siler.
CREATE TABLE reading_assets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reading_id  uuid NOT NULL REFERENCES readings(id) ON DELETE CASCADE,
  kind        text NOT NULL,                        -- cup_photo
  storage_key text NOT NULL,
  overlay     jsonb,
  purge_at    timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  purged      boolean DEFAULT false
);
CREATE INDEX ON reading_assets (purge_at) WHERE NOT purged;

-- ============================================================ tahmin doğrulama
-- Ürünün ana farkı. Bu tablo aynı zamanda en değerli veri varlığın olacak.
CREATE TABLE predictions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reading_id    uuid NOT NULL REFERENCES readings(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic         text,
  claim         text NOT NULL,
  window_start  timestamptz NOT NULL,
  window_end    timestamptz NOT NULL,
  confidence    text,                               -- dusuk | orta | yuksek
  user_verdict  text,                               -- hit | miss | partial | NULL
  verdict_at    timestamptz,
  asked_at      timestamptz,                        -- doğrulama push'u gönderildi mi
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX ON predictions (user_id, window_end);
CREATE INDEX ON predictions (window_end) WHERE user_verdict IS NULL AND asked_at IS NULL;

CREATE VIEW user_accuracy AS
SELECT user_id,
       count(*)                                                        AS total,
       count(*) FILTER (WHERE user_verdict = 'hit')                    AS hits,
       count(*) FILTER (WHERE user_verdict = 'partial')                AS partials,
       round(100.0 * (count(*) FILTER (WHERE user_verdict = 'hit')
             + 0.5 * count(*) FILTER (WHERE user_verdict = 'partial'))
             / NULLIF(count(*) FILTER (WHERE user_verdict IS NOT NULL), 0), 1) AS score
FROM predictions GROUP BY user_id;

-- ============================================================ hafıza
CREATE TABLE memories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       text NOT NULL,                         -- person | concern | goal | event
  key        text NOT NULL,
  summary    text,
  salience   real DEFAULT 0.5,
  last_seen  timestamptz DEFAULT now(),
  UNIQUE (user_id, kind, key)
);
CREATE INDEX ON memories (user_id, salience DESC);

-- ============================================================ blok kütüphanesi
CREATE TABLE content_blocks (
  key      text NOT NULL,
  variant  int  NOT NULL,
  locale   text NOT NULL,
  section  text NOT NULL,
  text     text NOT NULL,
  PRIMARY KEY (key, variant, locale)
);
CREATE INDEX ON content_blocks (locale, section);

-- ============================================================ transit kuyruğu
CREATE TABLE transits_queue (
  id           bigserial PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code         text NOT NULL,                       -- saturn_square_venus
  exact_at     timestamptz NOT NULL,
  severity     real NOT NULL,
  notified_at  timestamptz,
  UNIQUE (user_id, code, exact_at)
);
CREATE INDEX ON transits_queue (exact_at) WHERE notified_at IS NULL;

-- ============================================================ para
CREATE TABLE entitlements (
  user_id     uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  tier        text NOT NULL,                        -- star | fate | yearly
  source      text NOT NULL,                        -- ios | android | web
  rc_app_user text,
  started_at  timestamptz DEFAULT now(),
  expires_at  timestamptz,
  will_renew  boolean DEFAULT true,
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE coin_ledger (
  id            bigserial PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta         int NOT NULL,
  reason        text NOT NULL,                      -- purchase|daily|streak|rewarded_ad|
                                                    -- invite|verify|spend_coffee|spend_tarot
  ref_id        text,
  balance_after int NOT NULL,
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX ON coin_ledger (user_id, created_at DESC);

-- Günlük harcama tavanı kontrolü (kumar döngüsü önlemi + refund önlemi)
CREATE VIEW daily_spend AS
SELECT user_id, date_trunc('day', created_at) AS day, -sum(delta) AS spent
FROM coin_ledger WHERE delta < 0 GROUP BY 1, 2;

-- ============================================================ bildirim
-- Günde 2 bildirim tavanını uygulamak için log şart; tavan olmadan opt-out patlar
CREATE TABLE push_log (
  id         bigserial PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      text,
  body       text,
  data       jsonb,
  opened_at  timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX ON push_log (user_id, created_at DESC);

-- ============================================================ deney/analitik
CREATE TABLE paywall_events (
  id          bigserial PRIMARY KEY,
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  placement   text NOT NULL,                        -- onboarding|reading_gate|home_banner
  variant     text NOT NULL,
  action      text NOT NULL,                        -- view|dismiss|start_trial|purchase
  price_shown text,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX ON paywall_events (placement, variant, created_at);

-- Maliyet takibi: kullanıcı başı LLM maliyetini bilmiyorsan fiyat da koyamazsın
CREATE VIEW cost_per_user_30d AS
SELECT user_id, sum(cost_usd) AS llm_cost, count(*) AS readings
FROM readings WHERE created_at > now() - interval '30 days'
GROUP BY user_id ORDER BY llm_cost DESC;
