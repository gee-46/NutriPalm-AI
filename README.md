<div align="center">

# 🌱 NutriPalm AI

### Soil-report OCR with evidence-gated fertilizer recommendations, and a Digital Twin for every plot

**Built by Samruddhi Organics**

![Status](https://img.shields.io/badge/status-not%20production--ready-orange?style=for-the-badge)
![License](https://img.shields.io/badge/license-All%20Rights%20Reserved-lightgrey?style=for-the-badge)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-API-009688?style=for-the-badge)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)

</div>

> **Status: not production-ready.** The code is tested locally (see [Tests](#tests)), but nothing has been verified on a managed Supabase project or a hosted
> deployment, and **no fertilizer quantity is produced until an agronomist installs a cited rule** (see [What it does not do yet](#what-it-does-not-do-yet)).
> The full, honest picture is in [`docs/PRODUCTION_READINESS_AUDIT.md`](docs/PRODUCTION_READINESS_AUDIT.md).

## What the product is

Two things, and only these:

1. **Soil-report OCR → verified soil report → fertilizer recommendation.** A farmer uploads a lab report (PDF/JPG/PNG) for one of their plots. The
   server reads it (text layer, or Tesseract for scans), validates every value, and either saves it (if every required value was read clearly) or
   asks the farmer to check/correct the doubtful ones. Corrections keep the original reading in an audit trail. A recommendation is generated only
   from a verified soil report **and** a cited, expert-reviewed rule for the crop; otherwise the server answers `insufficient_data` and says what is missing.
2. **Digital Twin.** For each plot: real plot data and boundary, live weather, satellite NDVI when configured, the history of verified soil tests,
   the engine's recommendations (shown as *advice*, never as something that happened) and the fertilizer the farmer *actually applied* (recorded by hand).

Supporting pieces: sign-in, farmer and plot management with a GPS boundary survey, profile/settings, history, English/Kannada interface.

**Removed from the product** (UI, routes, API, tests): Disease Intelligence, Crop Suitability, the standalone Weather advisory page, the Analytics dashboard.
The repository never contained a RAG/chat module. Database migrations and stored rows (including the `disease_assessments` table) are untouched.

## What it does not do yet

* **No fertilizer dose is given today.** The per-crop targets in `backend/app/services/crop_rules.py` are the project's own engineering defaults with no
  citation. The rule pack that unlocks recommendations (`backend/app/services/data/verified_rules.json`) ships **empty**. Until an agronomist adds a
  cited record for a crop, `POST /api/recommendations` returns `insufficient_data` for it. Details and the unresolved P₂O₅/K₂O unit basis:
  [`docs/OCR_AND_FERTILIZER_PIPELINE.md`](docs/OCR_AND_FERTILIZER_PIPELINE.md) §3.
* **OCR accuracy is not established.** The evaluation harness works, but the only real document in the repository is one soil-health card
  (12/12 values read correctly, 9 of them still routed to human review by design). That is an anecdote, not an accuracy figure.
* **Not verified on managed infrastructure:** Supabase project, email confirmation, Google sign-in, hosted deployment.
* **Sentinel Hub NDVI:** the code is wired, but the OAuth client credentials in the maintainer's local `backend/.env` are rejected by Sentinel Hub (HTTP 401 `unauthorized_client`, on both token endpoints; format checks clean)
  when tested on 2026-10-30. Create a new OAuth client; until then NDVI is shown as unavailable.
* Irrigation, crop age/stage, application timing and method are not inputs/outputs of the engine. IoT soil-moisture sensors are not connected.
* Kannada strings added in this work are a first draft awaiting native-speaker review.

## Quick start

Prerequisites: Node.js 20+, Python 3.11+, a Supabase project (use a **disposable** one for testing), Tesseract OCR and Poppler for scanned documents.

```bash
npm install
cd backend && python -m venv .venv && . .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt                              # runtime + test deps; use requirements.txt in production
cp .env.example .env                                             # then fill in backend/.env
cd .. && cp .env.example .env.local                              # then fill in the frontend values
```

Apply every file in `supabase/migrations/` in numeric order (`001` … `013`), then:

```bash
cd backend && python -m uvicorn app.main:app --reload --port 8000     # API docs /docs · liveness /health · readiness /health/ready
npm run dev                                                           # http://localhost:5173
```

Configuration reference: [`.env.example`](.env.example) (frontend, public values) and [`backend/.env.example`](backend/.env.example) (server secrets).
Setup details: [`SETUP.md`](SETUP.md). Deployment: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Tests

Results of the last full run are recorded, with their scope, in [`docs/PRODUCTION_READINESS_AUDIT.md`](docs/PRODUCTION_READINESS_AUDIT.md) §4.

| Command | What it covers | Environment |
|---|---|---|
| `npm run build` · `npm run lint` · `npm test` | type-check + bundle · oxlint · Vitest (components, API client, scope, i18n parity) | local |
| `cd backend && python -m pytest` | OCR parsing/validation, review workflow, rule gate, API auth/ownership, hardening | local; real Tesseract/Poppler needed for the scan tests |
| `cd backend && python -m eval.ocr_eval --include-synthetic` | per-field OCR metrics incl. review routing, with sample-size caveats (1 real document today) | local |
| `cd supabase/tests && npm run verify:upgrade` | migration 013 applied to a populated 001–012 database is additive | local, PGlite |
| `cd supabase/tests && npm run smoke:selftest` | the staging workflow script against the local emulator (`smoke:staging` for a real deployment) | local emulator |
| `python scripts/check_sentinel.py` (in `backend/`) | safe Sentinel Hub connectivity diagnosis | live third party |
| `cd supabase/tests && npm install && npm run verify` | migrations on a clean PostgreSQL 17 (PGlite) + two-user row-level-security attack matrix | local, **not** a managed Supabase project |
| `WEAKEN=1 npm run verify` | mutation check: re-creates weak policies, the new tests must fail | local |
| `E2E_PYTHON=… npm run e2e` (in `supabase/tests`) | real browser, real backend and app, **emulated** Supabase | local, needs Edge/Chrome and internet for tiles/geocoding |
| `npm run verify:remote` | the same RLS matrix against a disposable managed project | **never run** — see `docs/SCRATCH_SUPABASE_VERIFICATION.md` |

## Security model in one paragraph

Supabase Auth issues the session; the FastAPI backend verifies the JWT and then checks plot/report/extraction ownership in code (it holds the
service-role key, which bypasses row-level security). The browser holds only the public anon key, so row-level security protects the direct path, and
migration 013 stops the browser from writing anything that claims to be verified or engine-generated. Uploads are size/type/magic-byte checked, processed
in memory, never written to disk, and bounded by page, time, pixel and concurrency limits. Missing data is shown as missing. See
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Documentation

| Document | Purpose |
|---|---|
| [`docs/PRODUCTION_READINESS_AUDIT.md`](docs/PRODUCTION_READINESS_AUDIT.md) | baseline, findings, what changed, test evidence, blockers, owner actions |
| [`docs/AGRONOMIST_REVIEW_CHECKLIST.md`](docs/AGRONOMIST_REVIEW_CHECKLIST.md) | the decisions only an agronomist can make, per-crop review sheets, the rule-record template |
| [`docs/FERTILIZER_SOURCES.md`](docs/FERTILIZER_SOURCES.md) | every fertilizer source read (what, where, verified how) and what it supports; candidate rules for oil palm and coconut (not approved) |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | components, data model, Digital Twin data sources, API contract |
| [`docs/OCR_AND_FERTILIZER_PIPELINE.md`](docs/OCR_AND_FERTILIZER_PIPELINE.md) | the OCR → recommendation contract, validation rules, rule gate, measured accuracy |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | environment, migrations, container, proxy requirements, what is unverified |
| [`docs/SCRATCH_SUPABASE_VERIFICATION.md`](docs/SCRATCH_SUPABASE_VERIFICATION.md) · [`docs/MAPS_AND_LOCATION.md`](docs/MAPS_AND_LOCATION.md) · [`docs/GIS_AND_TELEMETRY.md`](docs/GIS_AND_TELEMETRY.md) | operational notes |
| [`docs/PHASE1_AUDIT.md`](docs/PHASE1_AUDIT.md) · [`docs/PHASE2_FRONTEND_STATUS.md`](docs/PHASE2_FRONTEND_STATUS.md) | **historical** reports from earlier phases (they describe features since removed) |

## Contributors and license

Developed by **Gautam N Chipkar & Team** under **Samruddhi Organics** ([github.com/gee-46](https://github.com/gee-46)). No `LICENSE` file is present; the project's stated
position is **All Rights Reserved** — add a license before any redistribution.
