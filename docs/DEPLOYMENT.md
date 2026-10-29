# Deployment

**Status: nothing has been deployed or verified in a hosted environment by this work.** There is no deployment access in this repository's
tooling, no managed Supabase project was verified, and no production URL exists. Everything below is what the code requires and what was checked
locally; the last section lists what is still unverified.

## 1. What runs where

| Piece | Runtime | Notes |
|---|---|---|
| Frontend | static files from `npm run build` (`dist/`) on any static host / CDN | needs `VITE_*` values at **build** time |
| Backend | FastAPI under Uvicorn (container recipe: `backend/Dockerfile`) | needs Tesseract + Poppler binaries |
| Database / auth | a Supabase project | migrations `supabase/migrations/001…013` |

Only these external services are contacted: your Supabase project; Open-Meteo (no key); Sentinel Hub (optional); map tiles and geocoding from the browser.
No report text or image is sent to any third party (OCR is local).

## 2. Environment variables

### Backend (`backend/.env` or the host's secret store — never in Git or the image)

| Variable | Required | Purpose |
|---|---|---|
| `ENVIRONMENT` | yes in deployments | `development` \| `staging` \| `production` |
| `SUPABASE_URL` | **required** in staging/production | project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **required** in staging/production | server-side only; bypasses RLS |
| `SUPABASE_JWT_SECRET` and/or `SUPABASE_JWKS_URL` | one is **required** | token verification (HS256 secret for legacy projects; JWKS, derived from `SUPABASE_URL` if blank, for asymmetric keys) |
| `CORS_ALLOW_ORIGINS` | yes | comma-separated explicit origins; `*` is rejected outside development |
| `STRICT_NO_MOCK_DATA` | – | must stay `true` in staging/production (enforced) |
| `SENTINEL_HUB_CLIENT_ID`, `SENTINEL_HUB_CLIENT_SECRET` | optional | live NDVI; without valid ones NDVI is reported unavailable |
| `RULE_PACK_PATH` | optional | your verified-rule pack (see the pipeline doc §3.1); default pack is empty |
| `MAX_UPLOAD_MB`, `OCR_MAX_PAGES`, `OCR_PAGE_TIMEOUT_SECONDS`, `OCR_TOTAL_TIMEOUT_SECONDS`, `OCR_MAX_CONCURRENT`, `OCR_QUEUE_WAIT_SECONDS` | optional | resource limits (defaults 20 / 15 / 60 / 180 / 2 / 30) |
| `TESSERACT_CMD`, `POPPLER_PATH` | optional | only if the binaries are not on `PATH` |

The backend **fails at startup** in staging/production if the required Supabase values are missing (clear message naming them). Optional integrations
never block startup. Heavy initialisation is lazy: nothing OCR-related is loaded at boot.

### Frontend (build time; public values only)

`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL` (empty = same origin `/api` behind your proxy), `VITE_GOOGLE_MAPS_API_KEY` (optional).
Never put the service-role key or JWT secret in a `VITE_*` variable — it would be shipped to every browser.

## 3. Database migrations (controlled, not automatic)

1. Take a backup / point-in-time-recovery marker of the target project.
2. Apply on a **staging** project first: `supabase db push` or the SQL editor, files in numeric order. `013` is additive and idempotent.
3. What `013` changes in existing objects: it **replaces four row-level-security policies** (INSERT and UPDATE on `soil_reports` and `recommendations`) with
   the same policies plus a condition that browser writes cannot set verification/engine columns. Existing rows are not modified.
4. **Order matters:** apply `013` *before* deploying the new backend (it needs `soil_report_extractions`). If the table is missing the API answers
   `503 … apply migration 013` rather than crashing.
5. After applying, existing `soil_reports` have `verification_status = NULL`: they stay visible in the database but are not used by the app (history, twin
   and recommendations show only verified reports). Owners re-upload their reports to obtain verified ones. Decide deliberately whether to backfill
   `verification_status` for legacy rows you have independently checked; the migration does not guess.
6. Verify with `supabase/tests`: `npm install && npm run verify` (clean-database apply + two-user attack matrix, on PGlite/PostgreSQL 17) and, against a
   **disposable** managed project, `npm run verify:remote` (see `docs/SCRATCH_SUPABASE_VERIFICATION.md`; refuses to run on a project that already has data).
7. Rolling back the application does not require rolling back `013`.

Never run migrations automatically at container start.

## 4. Backend container

```bash
docker build -t nutripalm-backend backend/
docker run --rm -p 8000:8000 --env-file backend/.env nutripalm-backend
curl http://localhost:8000/health/ready     # 200 only if config + tesseract + poppler are present
```

`backend/Dockerfile` installs `tesseract-ocr` and `poppler-utils`, runs as an unprivileged user (uid 10001), has a `HEALTHCHECK` on `/health`, and starts two Uvicorn workers.
`backend/docker-compose.example.yml` shows the runtime limits used below. Each worker bounds its own concurrent OCR jobs (`OCR_MAX_CONCURRENT`).

**Verified on 2026-10-30** (Docker Desktop 29.8 on Windows, Docker started for this check; image built from the repository's Dockerfile, ~87 s cold):

| Check | Result |
|---|---|
| `docker build` | succeeded (python:3.12-slim + Tesseract 5.5.0 + Poppler 25.03.0) |
| `/health` · `/health/ready` | `ok` · `ready` (HTTP 200: database + token verification configured, **tesseract and poppler available**) |
| unauthenticated `GET /api/recommendations` | `401` |
| process user | `uid=10001(nutripalm)`, not root |
| container `HEALTHCHECK` | `healthy` |
| runtime `--read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges --memory 1g --cpus 2` | starts, ready, `touch /srv/x` → "Read-only file system" (so the service really needs no disk writes) |
| real OCR in the container through `run_pipeline` | PNG **and** an image-only PDF (Poppler rasterisation → Tesseract): N 245, P 18, K 142, pH 6.8, OC 0.62, status `completed` |
| memory | idle ≈ 125 MiB; peak RSS 115 MiB for a 1700×1300 page and **155 MiB for one A4 / 300 dpi page** (single job, synthetic) |

Not covered: the HTTP upload path inside the container (needs a Supabase project), load/concurrency behaviour, real-scan OCR time (the A4 synthetic page took ~0.5 s and, with a bitmap font, was read at only
52 % confidence and correctly routed to `needs_review` — a reminder that quality depends on the scan). The `--memory 1g` figure is a starting point sized from one measurement, **not** a tested capacity plan:
two workers × `OCR_MAX_CONCURRENT=2` could in principle run four OCR jobs at once.

### Reverse proxy requirements (not provided by this repository)
* TLS termination; HSTS.
* Request body limit ≥ `MAX_UPLOAD_MB` + overhead (e.g. 25 MB) on `/api/soil-reports/upload`.
* Upstream read timeout **> `OCR_TOTAL_TIMEOUT_SECONDS`** (use ≥ 200 s) or long scans will be cut off by the proxy while still processing.
* **Edge / IP rate limiting.** The built-in limiter is per account and per worker only (20 expensive calls per minute) and does not stop unauthenticated floods.
* Route `/api/*` and `/health*` to the backend, everything else to the static site (or set `VITE_API_BASE_URL` to the API's origin and add that origin's frontend to `CORS_ALLOW_ORIGINS`).

## 5. Frontend

```bash
npm ci
VITE_SUPABASE_URL=… VITE_SUPABASE_ANON_KEY=… VITE_API_BASE_URL=… npm run build
```
Serve `dist/` with SPA fallback to `index.html`. A production build with `VITE_API_BASE_URL` unset uses same-origin `/api` (it never silently points at localhost).
Without the Supabase values the app fails closed: sign-in is refused.

## 6. Operations

* Liveness `GET /health`; readiness `GET /health/ready` returns which required dependency is missing (no secret values). Wire readiness to your orchestrator.
* Logs are structured key/values with ids (`owner_id`, `plot_id`, `extraction_id`, short document hash). Report contents, bearer tokens and secrets are not logged.
* Graceful shutdown is Uvicorn's default (in-flight requests finish before the worker exits).
* Sentinel Hub: create an OAuth client under Sentinel Hub dashboard → User settings → OAuth clients; set both variables; then run `cd backend && python scripts/check_sentinel.py --lon <lon> --lat <lat>` (prints only safe metadata; exit 0 only if a token was issued **and** an NDVI request succeeded).

## 7. What is verified and what is not

| Item | Status | Environment |
|---|---|---|
| Backend tests, frontend tests/build/lint, token-attack suite, migrations on a clean PostgreSQL 17, upgrade-safety of 013 on populated data, two-user RLS matrix, browser E2E | run locally — results in [PRODUCTION_READINESS_AUDIT.md](PRODUCTION_READINESS_AUDIT.md) | local / PGlite / emulator |
| Docker image build, `/health/ready` with OCR binaries, non-root, read-only runtime, real OCR | **verified** (table in §4) | local Docker |
| Staging workflow script (`supabase/tests/staging-smoke.mjs`) | written; **self-tested against the local emulator only** (20/20) — never run against a deployment | local emulator |
| Managed Supabase project (migrations, RLS, email confirmation, Google sign-in) | **not verified** — blocked: no disposable project or `SCRATCH_*` credentials; see `docs/SCRATCH_SUPABASE_VERIFICATION.md` | – |
| Sentinel Hub live | **failed**: the OAuth client credentials in the local `backend/.env` are rejected (`401 unauthorized_client` on both the documented and the legacy token endpoint; format checks clean) — regenerate the OAuth client | live third party |
| Hosted deployment, TLS, proxy limits, edge rate limiting, load/soak behaviour, real-scan OCR accuracy | **not done** | – |
