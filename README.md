<div align="center">

# 🌱 NutriPalm AI

### Precision-agriculture platform for farm plots, soil reports and evidence-backed advice

**Built by Samruddhi Organics**

![Status](https://img.shields.io/badge/status-prototype%20%E2%80%94%20not%20production--ready-orange?style=for-the-badge)
![License](https://img.shields.io/badge/license-All%20Rights%20Reserved-lightgrey?style=for-the-badge)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-API-009688?style=for-the-badge&logo=fastapi&logoColor=white)

</div>

> **Status: working prototype, not production-ready.** The code, database policies and browser flows have been tested
> (see [Running tests](#15-running-tests)), but the browser end-to-end tests ran against an **emulated** Supabase stack and
> verification against a real managed Supabase project is **still outstanding**. Several features depend on credentials or
> system programs you must configure yourself ([Current limitations](#16-current-limitations)).

## Contents

1. [Project overview](#1-project-overview) · 2. [Problem statement](#2-problem-statement) · 3. [Key features](#3-key-features) ·
4. [Phase 1 architecture](#4-phase-1-architecture) · 5. [Phase 2 progress](#5-phase-2-progress) · 6. [Technology stack](#6-technology-stack) ·
7. [System architecture](#7-system-architecture) · 8. [Repository structure](#8-repository-structure) · 9. [Prerequisites](#9-prerequisites) ·
10. [Local installation](#10-local-installation) · 11. [Environment configuration](#11-environment-configuration) · 12. [Frontend setup](#12-frontend-setup) ·
13. [Backend setup](#13-backend-setup) · 14. [Database and Supabase setup](#14-database-and-supabase-setup) · 15. [Running tests](#15-running-tests) ·
16. [Current limitations](#16-current-limitations) · 17. [Security and data integrity](#17-security-and-data-integrity) ·
18. [Development roadmap](#18-development-roadmap) · 19. [Contributors](#19-contributors--team-roles) · 20. [License](#20-license)

---

## 1. Project overview

NutriPalm AI helps a farmer keep farm plots, soil-test reports, weather and satellite information in one place and,
over time, turn that data into advice that can be traced back to evidence. Each signed-in user gets an isolated workspace:
farmers, plots, soil reports and recommendations belong to the account that created them.

```text
Account → Farmer → Plot (GPS boundary) → Soil report (PDF/image → OCR) → Recommendation (backend engine) → History / Analytics
                         └→ Weather · Sentinel-2 NDVI (if configured) · Digital Twin
```

## 2. Problem statement

Farmers and agronomy teams hold fragmented information: lab reports on paper or PDF, plot boundaries that were never
mapped, fertilizer decisions made without the soil numbers in front of them, and no record of what was advised before.
When these pieces are disconnected it is hard to get from "what does my soil report say" to "what should I do next, and why".
NutriPalm AI connects those pieces and is built to **show missing data as missing** instead of filling it in.

## 3. Key features

What exists in the code today. "Configuration-dependent" means it needs a credential or a system program that is not
part of the repository.

| Capability | State |
|---|---|
| Email/password sign-up and sign-in (Supabase Auth); Google sign-in button | Implemented. Google sign-in needs the Google provider enabled in your Supabase project (not verified here). No offline/mock login exists. |
| Farmers and farm plots, ownership per account | Implemented (migration `011` adds `farmers`) |
| GPS boundary survey, GeoJSON polygon, area, centroid | Implemented; satellite basemap uses Google Maps if a key is set, otherwise an Esri/Leaflet fallback |
| Weather at the plot centroid | Implemented via Open-Meteo (no key) |
| Sentinel-2 NDVI | Implemented in the backend; **configuration-dependent** (Sentinel Hub client id/secret). Reported as unavailable otherwise |
| Soil-report upload and OCR | Implemented; **system-dependent** (Tesseract and Poppler for scanned PDFs/images). Extracted values are validated; incomplete reads are **not saved** |
| Nutrient and fertilizer recommendation engine | Implemented in the backend for six crops (oil palm, rice, maize, sugarcane, banana, coconut). Reference values are engineering defaults |
| Digital Twin | Implemented; shows stored/live values and "not available" where data is missing |
| Analytics | Built only from the account's stored rows |
| Disease Intelligence, Crop Suitability | **Interfaces only** — see [Phase 2](#5-phase-2-progress) |
| English / Kannada interface | Implemented (Phase 2) |

## 4. Phase 1 architecture

Phase 1 is the working core: React + TypeScript frontend, FastAPI backend, Supabase (Auth + PostgreSQL).

* The browser talks to **Supabase** directly for auth and for row-level-secured reads/writes of the user's own rows
  (profiles, farmers, plots, soil reports, recommendation history).
* The browser talks to the **FastAPI backend** with the user's Supabase bearer token for soil-report OCR,
  recommendation generation, Digital Twin prediction/live data and geospatial (NDVI, cadastral) calls.
* The backend verifies the JWT (HS256 shared secret, or JWKS for RS256/ES256), then **checks that the plot belongs to the
  caller** before reading or writing. It uses a service-role database key, which bypasses row-level security, so those
  application checks are the barrier on the backend path.
* Row-level security policies (migrations `001`–`011`) protect the direct browser path, including cross-reference checks
  (a recommendation may only point at a plot *and* soil report the caller owns).

Phase 1 hardening work and its evidence are in [`docs/PHASE1_AUDIT.md`](docs/PHASE1_AUDIT.md).

## 5. Phase 2 progress

Phase 2 (branch `phase2/farmer-first-frontend`) is a **frontend** upgrade. Full detail, coverage numbers and API contracts:
[`docs/PHASE2_FRONTEND_STATUS.md`](docs/PHASE2_FRONTEND_STATUS.md).

Implemented:

* **Farmer-first dashboard** — real counts, latest soil report, weather, saved advice and quick actions; "Not available"
  or an empty state when data is missing.
* **Navigation** — seven groups and thirteen destinations (Home, My Farms, Farm Health, Crop Suitability, Recommendations,
  History, Profile), mobile drawer, keyboard-reachable.
* **Disease Intelligence** (arecanut, coconut) — input form, risk states and result layout. **Interface only.**
* **What Should I Grow? (Crop Suitability)** — shows the plot's real inputs and what is missing, plus a ranked-result layout.
  **Interface only.**
* **Nutrient & Fertilizer** — backend results displayed as observed / derived / recommendation / predicted values;
  anything the API does not return is listed as not provided.
* **Weather Advisory** — current weather and forecast for the plot. **No spray/fertilizer timing advice.**
* **History** — saved soil reports, saved advice and plots.
* **Shared recommendation card** — one layout (what / what to do / how / how much / when / why / evidence / limitations /
  missing information) used by disease, suitability and fertilizer results.
* **English and Kannada** — selector in the header and Settings; stored on the device; persists across refresh and logout.
  Translation infrastructure: `src/translation/` (`t(key, vars)`, `renderRich`, parity and coverage tests, `npm run i18n:scan`).
* **Responsive layouts** — checked in a browser at desktop, 820 px and 390 px widths.
* Removed from the Digital Twin and app shell: hard-coded figures and sample notifications found during the Phase 2 review.

**Still required from the backend (not implemented):**

```text
POST /api/disease/assess
POST /api/crop-suitability/assess
```

The frontend reads the backend's `/openapi.json` and enables these forms **only if the path is advertised**; until then
the pages say the service is not available and send nothing. Response contracts (proposed) are in the Phase 2 status doc.
The frontend never calculates a suitability score, a ranking or a fertilizer dose itself.

## 6. Technology stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4, Framer Motion, Lucide icons, Leaflet / Google Maps JS API, jsPDF |
| Backend | Python, FastAPI, Uvicorn; OCR with Tesseract + Poppler |
| Data and auth | Supabase (PostgreSQL, Auth, Row Level Security) |
| External data | Open-Meteo (weather), Sentinel Hub (NDVI, optional), Esri/OpenStreetMap tiles, Google Maps (optional) |
| Tests | Vitest + jsdom, pytest, PGlite (PostgreSQL 17 in WASM) for migration/RLS checks, Playwright-core for browser E2E |

## 7. System architecture

```text
 Browser (React + TS)
   │  Supabase JS: auth + RLS-protected rows          ┌───────────────────────────┐
   ├───────────────────────────────────────────────▶ │ Supabase Auth + Postgres  │
   │                                                  └───────────────────────────┘
   │  Bearer token: OCR, recommendations, twin, NDVI        ▲ service-role key (server only)
   ├────────────▶ FastAPI ── JWT check ── plot-ownership check ──┘
   │                  └── Tesseract/Poppler, Sentinel Hub (optional)
   └── Open-Meteo (weather, direct from the browser)
```

## 8. Repository structure

```text
src/
  components/            landing page, PrototypeApp (app shell + navigation), PrototypeAuth
    prototype/           screens: Dashboard, Farmers, FarmPlots, Soil, Disease, Weather, DigitalTwin, CropSuitability,
                         Recommendation (Nutrient & Fertilizer), History, Analytics, Settings, map components
    phase2/              shared Phase 2 UI: RecommendationCard, status badges, empty/unavailable states
  data/                  Supabase-backed stores (plots, farmers, digital twins)
  hooks/                 data hooks (plot weather, latest soil report, backend capabilities, analytics)
  lib/                   apiClient, supabaseClient, weather client, Google Maps loader, lib/phase2 (contracts, validators, capability probe)
  translation/           i18n: context, hook, rich text, translations/en.json + kn.json
  constants/cropBaselines.ts   mirror of the backend crop table (a test keeps them in sync)
  __tests__/             Vitest suites
backend/
  app/                   FastAPI app: routers, services (nutrient, dosage, ROI, yield, explanation), repositories, ocr/, schemas
  tests/                 pytest suites (including JWT/ownership and isolation tests)
supabase/
  migrations/            001–011 SQL migrations (apply in order)
  tests/                 migration + two-user RLS verification (PGlite), emulated Supabase stack, browser E2E, remote verifier
docs/                    PHASE1_AUDIT.md, PHASE2_FRONTEND_STATUS.md, SCRATCH_SUPABASE_VERIFICATION.md, GOOGLE_MAPS_SETUP.md, GIS_AND_TELEMETRY.md, walkthrough.md
scripts/                 find-hardcoded-strings.mjs (i18n scanner) and an older i18n codemod
SETUP.md                 detailed setup guide
```

## 9. Prerequisites

* Node.js 20+ and npm
* Python 3.11+
* A Supabase project (use a **separate scratch project** for testing, never one that holds real data)
* Optional: Tesseract OCR and Poppler (scanned-PDF OCR), a Sentinel Hub OAuth client (NDVI), a Google Maps JavaScript API key (Google imagery)

Details and Windows notes: [`SETUP.md`](SETUP.md).

## 10. Local installation

```bash
git clone https://github.com/gee-46/NutriPalm-AI.git
cd NutriPalm-AI
npm install
cd backend
python -m venv .venv          # Windows: .venv\Scripts\activate after creating
pip install -r requirements.txt
```

## 11. Environment configuration

Copy the examples and fill in your own values (never commit the filled-in files):

| File | Copy to | Contains |
|---|---|---|
| `.env.example` | `.env.local` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`, `VITE_GOOGLE_MAPS_API_KEY` (optional) — public values only |
| `backend/.env.example` | `backend/.env` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` and/or `SUPABASE_JWKS_URL`, `ENVIRONMENT`, `CORS_ALLOW_ORIGINS`, `STRICT_NO_MOCK_DATA`, `SENTINEL_HUB_CLIENT_ID` / `SENTINEL_HUB_CLIENT_SECRET` (optional) |

The frontend fails closed: without the Supabase URL and anon key, sign-in is refused. In production the backend refuses a
wildcard CORS origin. The service-role key and JWT secret belong **only** in the backend environment.

## 12. Frontend setup

```bash
npm run dev        # Vite dev server, normally http://localhost:5173
npm run build      # type-check (tsc -b) + production bundle
npm run lint       # oxlint
npm test           # Vitest
npm run i18n:scan  # reports untranslated JSX text / attributes / toasts
```

## 13. Backend setup

```bash
cd backend
python -m uvicorn app.main:app --reload     # http://127.0.0.1:8000, interactive docs at /docs, health at /health
```

Set `VITE_API_BASE_URL` (for example `http://127.0.0.1:8000`) in the frontend environment. For OCR on scanned documents,
install Tesseract and Poppler and, on Windows, set `TESSERACT_CMD` / `POPPLER_PATH` in `backend/.env` (see `SETUP.md`).

## 14. Database and Supabase setup

Apply every file in `supabase/migrations/` **in numeric order** (`001` … `011`) with the Supabase SQL editor or CLI, then enable
the auth providers you need. `011_farmers_and_rls_hardening.sql` adds the `farmers` table and the cross-reference RLS checks.
To verify a **disposable** Supabase project against the two-user attack matrix, follow
[`docs/SCRATCH_SUPABASE_VERIFICATION.md`](docs/SCRATCH_SUPABASE_VERIFICATION.md) (`npm run verify:remote` from `supabase/tests`; it
refuses to run on a project that already contains data).

## 15. Running tests

Previously reported results (from the Phase 1 hardening and Phase 2 work). While preparing this README the frontend build, lint, unit tests and the backend
`pytest` suite were re-run and gave the same results as below (build passes, 0 lint errors, 48/48, 173 passed + the same 6 OCR failures).
The **browser E2E, migration/RLS and scratch-Supabase checks were not re-run** for this README update:

| Suite | Last reported result |
|---|---|
| Frontend build (`npm run build`) | passed |
| Frontend lint (`npm run lint`) | 0 errors (warnings remain) |
| Frontend unit tests (`npm test`) | 48 / 48 passed |
| Hardcoded-string scan (`npm run i18n:scan`) | 0 untranslated literals detected |
| Browser E2E, two users (`supabase/tests`: `npm run e2e`) | 137 / 137 passed — **against an emulated Supabase stack, not managed Supabase** |
| Backend (`cd backend && python -m pytest`) | 173 passed, 6 failed: the 6 real-OCR tests need Tesseract/Poppler, which were not installed on the audit machine (OCR itself was checked manually by the project owner) |
| Migrations + RLS (`supabase/tests`: `npm run verify`) | 210 / 210 on PostgreSQL 17 (PGlite) with Supabase-compatible test roles; **managed Supabase verification is still outstanding** |

The E2E suite starts its own emulated Supabase (GoTrue/PostgREST subset over PGlite), the FastAPI backend and Vite, and drives
Microsoft Edge with Playwright. Set `E2E_PYTHON` (interpreter with the backend dependencies), optionally `E2E_BROWSER`, then
`cd supabase/tests && npm install && npm run e2e`. The emulator is not a substitute for Supabase itself.

## 16. Current limitations

* **Not production-ready.** No managed-Supabase verification has been completed; the E2E suite uses an emulator.
* **Disease Intelligence and Crop Suitability are interfaces only.** They need `POST /api/disease/assess` and
  `POST /api/crop-suitability/assess`; no disease or suitability result has ever been produced by this project.
* **Nutrient advice:** arecanut is not in the backend crop table; crop reference values are engineering defaults, **not
  agronomist-validated**; the API does not return fertilizer quantity per palm, application method or timing (the UI lists these
  as not provided). No prices, dosages or treatments are invented by the frontend.
* **Weather:** current conditions and forecast only. Spray/fertilizer timing rules are not implemented.
* **Configuration-dependent:** Google imagery (API key), Sentinel-2 NDVI (Sentinel Hub credentials), scanned-document OCR
  (Tesseract/Poppler), Google sign-in (provider setup). Without them the app says the data is unavailable.
* **Kannada** text has not been reviewed by a native speaker; backend-generated advice sentences and the PDF export are English only.
* IoT sensor telemetry is not connected.
* Some older screens still use small text and mixed styling.

## 17. Security and data integrity

* Supabase Auth sessions; backend JWT verification (HS256 or JWKS RS256/ES256); no hard-coded users or demo login.
* Row-level security on every user-owned table, with insert/update checks that cross-reference ownership of related rows.
* Backend ownership checks on every plot-scoped route; a request for another user's plot returns 404, not 403.
* Uploads are size-limited (20 MB) and content-sniffed; malformed IDs resolve to "not found".
* **Data integrity rule:** missing data is shown as missing (never `0`, never a default); nothing is estimated unless it comes from a
  documented backend calculation; incomplete OCR results are not saved. Synthetic Digital Twin rows are excluded from displays.
* Secrets: only publishable Supabase values go in the frontend; service-role key and JWT secret stay server-side and out of Git.
  If a service-role key is ever exposed, rotate it.

## 18. Development roadmap

| Item | State |
|---|---|
| Phase 1: auth, farms/plots, GPS survey, OCR, recommendations, twin, analytics, hardening | built; managed-Supabase verification pending |
| Phase 2 frontend: Kannada, farmer-first UI, new screens | built (this branch) |
| Backend disease assessment (arecanut, coconut) with evidence and sources | planned |
| Backend crop suitability with ranked, evidence-backed results | planned |
| Arecanut nutrient rules; per-plant dose, method and timing; agronomist-validated reference values | planned |
| Weather-based advisory rules | planned |
| Translatable backend advice (message codes); native-speaker Kannada review | planned |
| IoT / sensor integration | future |

## 19. Contributors / team roles

Developed by **Gautam N Chipkar & Team** under **Samruddhi Organics** ([github.com/gee-46](https://github.com/gee-46)).
Individual roles are not recorded in this repository; add them here.

## 20. License

No `LICENSE` file is present in the repository. The badge at the top reflects the project's stated position,
**All Rights Reserved**. Add a license file before any redistribution.

---

<div align="center">

**From soil data → evidence → actionable decisions.**

</div>
