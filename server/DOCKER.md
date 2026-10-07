# SVRN Publisher — Docker & Deployment

## One-command dev stack

```bash
docker compose up --build
```

This boots Postgres 16 + the API server. The server runs all knex
migrations on boot, so a fresh `up` is a working install.

| Service | Address |
|---|---|
| API | http://localhost:3000 (`/api/health`) |
| Postgres | localhost:5432 — user `svrn`, password `svrn`, db `svrn` |

Data persists in two named volumes:
- `pgdata` — Postgres
- `svrn-data` — disk asset store (`/app/server/data/assets`), `.svrn` packages,
  and the sqlite fallback (unused when `DATABASE_URL` is set)

Tear down (keep data): `docker compose down`
Nuke everything: `docker compose down -v`

## Production notes

1. **Secrets.** Set a real `JWT_SECRET` (compose defaults to a dev value
   that `config.cjs` rejects in production — the container will refuse to
   boot, which is the intended behavior). Generate one:
   `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
2. **Database.** `DATABASE_URL` selects Postgres; without it the server falls
   back to sqlite at `DB_PATH`. Migrations are plain knex — no SQLite-isms —
   so the same migration set runs on both.
3. **Asset storage.** `ASSET_STORE=disk` (default, volume-backed) or `s3`
   (set `S3_BUCKET`, `S3_REGION`, credentials). Assets are content-addressed
   by SHA-256; identical bytes are stored once.
4. **Payments.** Without `STRIPE_SECRET_KEY` the server runs in simulated
   payment mode and logs a warning in production. Set the three
   `STRIPE_*` vars for the real rail.
5. **Demo account.** `ALLOW_DEMO_ACCOUNT=false` in compose; keep it off in
   any public deployment.
6. **Frontend.** The API serves a packaged frontend from `APP_DIST` when set
   (see `server.cjs`). Build the editor/reader separately and mount or bake
   the `dist/` output.

## Without Docker (bare metal)

```bash
cd server
cp .env.example .env   # then edit: JWT_SECRET at minimum
npm install
npm run migrate        # or rely on boot-time migrate.latest()
npm start
```

Config reference: `server/.env.example`. Every setting is env-driven;
see `server/config.cjs` for validation rules.

## What the server does on boot

1. Validates config (refuses to boot in production with the dev JWT secret).
2. Runs `db.migrate.latest()` — schema is versioned, up/down, in
   `server/migrations/`.
3. Seeds the demo account (unless disabled).
4. Listens on `PORT`. `/api/health` reports DB connectivity.

## API surface (new in the production-readiness pass)

Auth / identity:
- `POST /api/auth/register`, `POST /api/auth/login` (existing, JWT)
- `POST /api/auth/password-reset/request` — always 200; token logged for dev
- `POST /api/auth/password-reset/confirm` — single-use, 1h expiry
- `GET  /api/auth/me` — the single-identity "who am I"

Storage (all authenticated):
- `PUT    /api/assets/:hash` — upload bytes (SHA-256 verified)
- `GET    /api/assets/:hash` — download, owner only, ETag
- `DELETE /api/assets/:hash` — owner only

Sync (all authenticated; local is source of truth, server is backup):
- `POST /api/sync/push` — upsert project; 409 + server copy on version conflict
- `GET  /api/sync/pull?since=` — changed projects incl. tombstones
- `POST /api/sync/delete` — soft delete (tombstone)
- `POST /api/sync/assets/have` — which hashes the server is missing

Client half: `src/utils/serverSync.js` (mirrors `toStorableProject` /
`resolveProjectAssets`; syncs only with a real JWT, never the offline token).

Encrypted pages stay opaque end to end: the server stores envelopes and
asset bytes as-is and never decrypts anything.
