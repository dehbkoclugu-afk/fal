# Standard PostgreSQL Startup Design

## Goal

Start the FastAPI service on Railway's standard PostgreSQL service without
requiring pgvector, and initialize an empty database automatically.

## Design

- Store the 384-value embedding as PostgreSQL `real[]`. The application already
  loads recent embeddings and performs similarity checks in Python, so no SQL
  vector operator or index is lost.
- Remove the pgvector connection codec. Keep the existing JSON/JSONB codecs.
- Before creating the application pool, run `sql/001_init.sql` exactly once.
  Record migration version `001` in `schema_migrations` and execute schema setup
  plus the version insert in one transaction so a failed setup rolls back fully.
- Keep `/health` unchanged. It becomes reachable only after the database is
  connected and the schema is ready.

## Error Handling

Database connection or migration errors abort startup and remain visible in
Railway deploy logs. A partial schema is never accepted as migrated.

## Verification

Unit-test the migration's first-run, already-applied, and rollback-safe call
paths with a fake asyncpg connection; run backend tests and Python compilation.
