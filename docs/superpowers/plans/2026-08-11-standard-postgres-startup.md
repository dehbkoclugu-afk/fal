# Standard PostgreSQL Startup Implementation Plan

> **For agentic workers:** Execute this plan task-by-task. Steps use checkbox syntax.

**Goal:** Make the Fal API boot on an empty standard Railway PostgreSQL database.

**Architecture:** `app.core.db.ensure_schema()` applies the checked-in SQL once in
one transaction, then the existing pool is created. Embeddings use PostgreSQL's
built-in `real[]` type and continue to be compared in Python.

**Tech Stack:** Python 3, FastAPI lifespan, asyncpg, PostgreSQL, pytest

## Global Constraints

- Preserve the existing API and embedding behavior.
- Add no dependency or Railway-side manual step.

---

### Task 1: Cover schema initialization

**Files:**
- Create: `fal-backend/tests/test_db_startup.py`
- Modify: `fal-backend/app/core/db.py`

**Interfaces:**
- Consumes: `DATABASE_URL`, `fal-backend/sql/001_init.sql`
- Produces: `async ensure_schema() -> None`

- [ ] **Step 1: Write the failing test** for first-run and already-applied migrations.
- [ ] **Step 2: Run it and verify failure** with `pytest -q fal-backend/tests/test_db_startup.py`.
- [ ] **Step 3: Implement the minimum correct change** using one asyncpg transaction.
- [ ] **Step 4: Run verification** and expect both migration tests to pass.
- [ ] **Step 5: Commit** the complete fix atomically after Task 2.

### Task 2: Remove pgvector from startup

**Files:**
- Modify: `fal-backend/sql/001_init.sql`
- Modify: `fal-backend/app/core/db.py`
- Modify: `fal-backend/app/main.py`
- Modify: `fal-backend/requirements.txt`

**Interfaces:**
- Consumes: Python `list[float]` embeddings
- Produces: PostgreSQL `real[]` values returned as Python lists

- [ ] **Step 1: Assert the schema contains no vector extension or vector column.**
- [ ] **Step 2: Run the assertion and verify it fails before the edit.**
- [ ] **Step 3: Change the embedding column to `real[]`, remove codec/dependency, and call `ensure_schema()` before pool creation.**
- [ ] **Step 4: Run targeted tests, backend tests, and `compileall`; expect success.**
- [ ] **Step 5: Publish all files in one commit** with message `fix: boot backend on standard Railway Postgres`.
