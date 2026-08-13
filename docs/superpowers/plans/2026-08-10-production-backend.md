# Telve Production Backend Implementation Plan

> **For agentic workers:** Execute this plan task-by-task. Steps use checkbox syntax.

**Goal:** Deploy the existing Telve backend as a restart-safe, HTTPS-only single-server production service with backups and verified asynchronous reading generation.

**Architecture:** Nginx terminates TLS and proxies to a loopback-only Uvicorn service. PostgreSQL/pgvector, Redis, one RQ worker, and one scheduler run as operating-system services on the same Ubuntu server. Secrets live in `/etc/telve/backend.env`; repository files contain only templates.

**Tech Stack:** Ubuntu 24.04, systemd, Nginx, Let's Encrypt, Python 3.12, FastAPI, PostgreSQL 16 + pgvector, Redis 7, RQ

## Global Constraints

- Never commit `.env`, database dumps, API keys, webhook secrets, or TLS private keys.
- Bind Uvicorn, PostgreSQL, and Redis to localhost; expose only ports 80/443.
- Use the existing `sql/001_init.sql`; introduce no migration framework for v1.
- Keep one worker and one scheduler until observed load requires more.

---

### Task 1: Add production service templates

**Files:**
- Create: `deploy/telve-api.service`
- Create: `deploy/telve-worker.service`
- Create: `deploy/telve-scheduler.service`
- Create: `deploy/nginx-api.telve.app.conf`
- Create: `deploy/backend.env.example`

**Interfaces:**
- Consumes: checkout at `/srv/telve`, virtualenv at `/srv/telve/.venv`, secrets at `/etc/telve/backend.env`
- Produces: loopback API on `127.0.0.1:8000` and public `https://api.telve.app`

- [ ] **Step 1: Create environment template**

  Copy every required variable name from `fal-backend/.env.example` into `deploy/backend.env.example`, use production-shaped non-secret defaults for URLs, and leave `LLM_API_KEY` and `RC_WEBHOOK_SECRET` empty.

- [ ] **Step 2: Add API unit**

  Define `WorkingDirectory=/srv/telve/fal-backend`, `EnvironmentFile=/etc/telve/backend.env`, `ExecStart=/srv/telve/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000`, `Restart=always`, and dependencies on network, PostgreSQL, and Redis.

- [ ] **Step 3: Add worker and scheduler units**

  Use `/srv/telve/.venv/bin/rq worker readings` for the worker and `/srv/telve/.venv/bin/python -m app.workers.scheduler` for the scheduler. Give both the same environment file and restart policy.

- [ ] **Step 4: Add Nginx template**

  Configure `server_name api.telve.app`, proxy `/` to `http://127.0.0.1:8000`, forward `Host`, `X-Forwarded-For`, and `X-Forwarded-Proto`, and set a request body limit large enough for the current compressed cup photo boundary documented by the app.

- [ ] **Step 5: Validate systemd templates**

  Run `systemd-analyze verify deploy/telve-*.service` on Linux and expect no syntax errors. Validate the Nginx server block with the installed `/etc/nginx/nginx.conf` during Task 3 before enabling it.

- [ ] **Step 6: Commit**

  Commit with `ops: add single-server production services`.

### Task 2: Add backup and health scripts

**Files:**
- Create: `deploy/backup-postgres.sh`
- Create: `deploy/health-check.sh`
- Create: `deploy/telve-backup.service`
- Create: `deploy/telve-backup.timer`

**Interfaces:**
- Consumes: `DATABASE_URL`, `https://api.telve.app/health`
- Produces: timestamped compressed dumps under `/var/backups/telve` and non-zero unhealthy exit

- [ ] **Step 1: Write backup script with safe failure behavior**

  Use `set -euo pipefail`, `umask 077`, an explicit `/var/backups/telve` directory, `pg_dump --format=custom`, and delete only files in that exact directory older than seven days. Do not interpolate an unvalidated deletion path.

- [ ] **Step 2: Write health script**

  Use `curl --fail --silent --show-error --max-time 10 https://api.telve.app/health` and verify the response contains `"ok":true`; exit non-zero otherwise.

- [ ] **Step 3: Schedule daily backup**

  Add a oneshot service reading `/etc/telve/backend.env` and a timer with `OnCalendar=*-*-* 04:15:00`, `Persistent=true`, and randomized delay under ten minutes.

- [ ] **Step 4: Shell-validate**

  Run `bash -n deploy/backup-postgres.sh deploy/health-check.sh` and `systemd-analyze verify deploy/telve-backup.service deploy/telve-backup.timer`; expect success.

- [ ] **Step 5: Test restoration on a disposable database**

  Create `fal_restore_test`, restore the newest dump with `pg_restore`, and query counts for `users`, `readings`, and `entitlements`. Drop only the explicitly named disposable database after verification.

- [ ] **Step 6: Commit**

  Commit with `ops: add backend backup and health checks`.

### Task 3: Provision the server

**Files:**
- Deploy: repository checkout to `/srv/telve`
- Deploy: environment file to `/etc/telve/backend.env`
- Deploy: service templates to `/etc/systemd/system/`

**Interfaces:**
- Consumes: server SSH access, DNS control, production secrets
- Produces: running production stack

- [ ] **Step 1: Resolve DNS**

  Point `api.telve.app` A/AAAA records to the server and verify with `dig +short api.telve.app` before requesting TLS.

- [ ] **Step 2: Install packaged dependencies**

  Install Python 3.12 venv tooling, PostgreSQL 16 with pgvector, Redis, Nginx, Certbot, build tools, and lib dependencies required by `requirements.txt`.

- [ ] **Step 3: Create least-privilege service account and directories**

  Create a non-login `telve` user, `/srv/telve`, `/etc/telve`, and `/var/backups/telve`; give only the service account the access each directory needs.

- [ ] **Step 4: Install application dependencies**

  Check out the approved release commit to `/srv/telve`, create `/srv/telve/.venv`, and run `pip install -r fal-backend/requirements.txt`.

- [ ] **Step 5: Initialize database**

  Create a dedicated database role and database, enable pgvector through `sql/001_init.sql`, and verify all expected tables exist. Do not use the PostgreSQL superuser in `DATABASE_URL`.

- [ ] **Step 6: Install secrets**

  Populate `/etc/telve/backend.env` with `DATABASE_URL`, loopback `REDIS_URL`, `LLM_API_KEY`, models, and a randomly generated `RC_WEBHOOK_SECRET`; set mode 600.

- [ ] **Step 7: Enable services and TLS**

  Install units, run `systemctl daemon-reload`, enable API/worker/scheduler/backup timer, enable Nginx config, run `nginx -t`, and obtain the certificate with Certbot.

- [ ] **Step 8: Verify restart safety**

  Reboot the server once. Verify all four Telve services, PostgreSQL, Redis, Nginx, and the backup timer are active without manual intervention.

### Task 4: Seed and verify the production data path

**Files:**
- Execute: `fal-backend/scripts/seed_blocks.py`
- Test: `fal-backend/tests/**`

**Interfaces:**
- Consumes: production database, Redis, LLM provider
- Produces: populated block library and completed reading

- [ ] **Step 1: Run cost preview**

  From `fal-backend`, run `/srv/telve/.venv/bin/python -m scripts.seed_blocks --dry-run`; save the key count and estimated spend without exposing the API key.

- [ ] **Step 2: Seed a small batch**

  Run `python -m scripts.seed_blocks --limit 5`, verify inserted rows and generated Turkish content, and stop if formatting or provider errors appear.

- [ ] **Step 3: Seed the remaining library**

  Run `python -m scripts.seed_blocks`; rerun it once to confirm the process is resumable and does not duplicate completed keys.

- [ ] **Step 4: Exercise the asynchronous path**

  Create a production test user through the public API, submit one non-coffee ritual, poll `/v1/readings/{id}` until `done`, and verify the RQ worker and database record agree.

- [ ] **Step 5: Exercise deletion and cleanup**

  Request deletion for that test user, run/observe the scheduled deletion path in a controlled test window, and verify personal records are removed according to the existing policy.

- [ ] **Step 6: Record operational evidence**

  Save command names, timestamps, service status, and redacted outcomes in the release checklist; do not commit live user IDs, tokens, payloads, or secrets.
