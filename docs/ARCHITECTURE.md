# Architecture

NutriPalm AI has two product areas and nothing else:

1. **Soil-report OCR → verified soil report → evidence-gated fertilizer recommendation**
2. **Digital Twin** of each plot (real plot data, live weather, satellite NDVI when configured, soil/advice/application history)

Plus the supporting pieces they need: sign-in, farmer and plot management (including the GPS boundary survey), profile/settings, history.
Removed from the product: Disease Intelligence, Crop Suitability, the standalone Weather advisory page, the Analytics dashboard (and there is no RAG/chat
module in this repository). See [PRODUCTION_READINESS_AUDIT.md](PRODUCTION_READINESS_AUDIT.md) §6.

## 1. Components and trust boundaries

```text
 Browser (React 19 + TypeScript + Vite)             public anon key only; no secrets
   │
   ├─ Supabase JS ───────────────► Supabase Auth + PostgreSQL (row-level security on every table)
   │    reads own rows, writes farmers / plots / fertilizer_applications
   │
   ├─ Bearer token ──► FastAPI ───► Supabase (service-role key, server only)
   │                     │   verifies the JWT, then checks plot / report / extraction ownership in code
   │                     ├─ Tesseract + Poppler (local binaries, no cloud OCR)
   │                     ├─ Open-Meteo (live weather, no key)
   │                     └─ Sentinel Hub (NDVI, optional credentials)
   └─ Open-Meteo / map tiles / geocoding (direct from the browser)
```

* **The backend uses the service-role key, which bypasses row-level security.** So every backend route authenticates the JWT
  (HS256 secret or RS256/ES256 via JWKS; algorithms are restricted explicitly) and then checks ownership itself; another user's id is `404`, identical to a missing id.
* **The browser only holds the anon key, so row-level security is the only barrier on the direct path.** Migration 013 stops the browser from
  creating anything that claims to be verified or engine-generated (§3).
* Secrets live in `backend/.env` / the host's secret store. `VITE_*` variables are public by design. A scan of the production bundle and all tracked files
  found only the public anon key.

## 2. Backend (`backend/app`)

| Module | Responsibility |
|---|---|
| `main.py` | app, CORS (explicit origins; GET/POST/OPTIONS; Authorization + Content-Type), `/health`, `/health/ready` |
| `config.py` | settings from the environment; **refuses to start** in staging/production without Supabase URL, service-role key and a token-verification source; no wildcard CORS outside development |
| `dependencies.py` | JWT verification (PyJWT; `exp`, `aud`, `sub` required; algorithm pinned per path; key type must match; every failure is a 401) → `AuthenticatedUser` |
| `rate_limit.py` | per-account sliding window on upload / confirm / recommendation generation (20 per minute per worker) |
| `routers/soil_reports.py` | upload, list/get extractions, confirm |
| `routers/recommendations.py` | generate (gated), list, get |
| `routers/digital_twins.py`, `routers/geospatial.py` | live twin scores, NDVI trend prediction, NDVI, cadastral (reports unavailable) |
| `ocr/` | document loading, Tesseract engine wrapper, extractor, validator, pipeline |
| `services/soil_extraction_service.py` | review/confirm rules, persistence orchestration, single-flight de-duplication |
| `services/rule_provenance.py` | the verified-rule gate (strict record validation, see the checklist) |
| `services/fertilizer_catalog.py` | labelled product grades (urea/DAP/MOP/SSP evidence from FCO Schedule I) + explicit elemental/oxide conversion |
| `services/schedule_engine.py` | published per-palm dose schedules: palm age + palm count -> kg/ha -> products (rule kind `published_schedule`) |
| `services/{crop_rules,nutrient_analyzer,dosage_calculator,…}` | deterministic engine (see the pipeline doc §3) |
| `services/{live_twin_service,twin_prediction_service,twin_snapshot_service,sentinel_service,…}` | Digital Twin data |
| `repositories/` | all Supabase access; Protocols with in-memory fakes in tests |

Deterministic agronomic calculation lives **only** here. The frontend does not compute doses; `src/constants/cropBaselines.ts` is a display mirror of the same
(unsourced) targets, kept in sync by a test, used only for reference bands on the soil-report screen.

## 3. Data model (PostgreSQL / Supabase)

```text
auth.users ─ profiles
   └─ farmers ─┐
   └─ plots ◄──┘ (farmer_id, boundary GeoJSON, crop, planting data …)
        ├─ soil_report_extractions   one per (plot, document SHA-256): fields as read + correction audit trail   [013, backend-written]
        │      └─► soil_reports      the verified numbers; extraction_id + verification_status + verified_at      [004, 011, 013]
        │              └─► recommendations   engine output; engine_version + generated_at + provenance           [005, 013]
        │                       └─► fertilizer_applications   what the farmer actually applied (optional link)   [013, farmer-written]
        ├─ digital_twins / ndvi_readings / weather_observations / field_observations     (backend-written snapshots, 003/006–009)
        └─ disease_assessments   [012] — historical table, retained, no longer read or written by the application
```

Key integrity rules (all enforced by row-level security / constraints, tested in `supabase/tests/verify.mjs`):

| Rule | Where |
|---|---|
| A user reads and changes only rows they own | policies on every table |
| A plot/report/recommendation/application may only reference rows owned by the same user, and a report/recommendation only a plot it belongs to | cross-reference `WITH CHECK` clauses (011, 013) |
| Browser writes cannot set `verification_status`, `extraction_id`, `verified_at`, `engine_version`, `provenance`, `generated_at` | 013 policies; the backend (service role) is the only writer of those columns |
| A verified soil report cannot be edited in place from the browser | same policies (an edit would have to clear the verification) |
| Extractions: no browser INSERT/UPDATE; one row per (owner, plot, hash); status ∈ needs_review/completed only (a failed read is never stored) | table definition |
| Applications: quantity > 0, fixed unit list, notes ≤ 1000 chars | table checks |
| Deleting a plot removes its reports, extractions, recommendations and applications | `ON DELETE CASCADE` |

Migrations are additive and numbered `001`–`013`; none was edited or deleted by this work except that 013 is new. Apply them in order through your
controlled process (see [DEPLOYMENT.md](DEPLOYMENT.md)). The disease table from `012` and all its rows are untouched.

## 4. Digital Twin: where every displayed value comes from

| Shown | Origin | When unavailable |
|---|---|---|
| Plot name, crop, area, boundary, location, planting date, age, stage, irrigation, soil type | `plots` row owned by the user (survey/forms) | "Not available" |
| Soil values and soil-test history | `soil_reports` where `verification_status IS NOT NULL` | "No verified soil test yet" |
| Recommendations | `recommendations` where `engine_version IS NOT NULL` (never shown as applied) | empty state |
| Fertilizer applied | `fertilizer_applications` (typed in by the farmer) | "No application recorded yet" |
| Current weather | Open-Meteo at the plot centroid (timestamp shown) | "N/A", feed offline |
| Live scores: water stress, disease-risk model, crop-health fusion, soil state, oil-palm yield estimate | `GET /api/plots/{id}/twin/live`: documented formulas over the live Open-Meteo data. **These are modelled estimates, not measurements, and the formulas have not been agronomically validated.** | "N/A" |
| NDVI, stored crop-health snapshots | `digital_twins`/`ndvi_readings` rows with `is_synthetic = false`; Sentinel Hub when credentials work | "Config required" / "N/A" |
| Soil moisture | no sensor is connected | "Not connected" |
| Cadastral parcel | service reports unavailable | unavailable |

Synthetic snapshot rows are filtered out everywhere. Nothing in the twin is seeded with sample plots for a signed-in user.

## 5. Frontend (`src`)

`components/PrototypeApp.tsx` is the shell and navigation (Dashboard · Farmers · Farm Plots · Soil Reports · Digital Twin · Recommendations · History ·
Profile · Settings). New in this work: `prototype/ExtractionReview.tsx` (review/correct step), `prototype/TwinManagementPanel.tsx` (measured / advice /
applied, embedded in the Digital Twin), insufficient-data and provenance blocks in `RecommendationScreen.tsx`. `lib/apiClient.ts` carries typed contracts and a
structured `ApiError`. English and Kannada strings are flat JSON (`translation/translations`); a test enforces key and placeholder parity. The new Kannada
text is a first draft and needs native-speaker review.

## 6. Backend API contract

All `/api/*` routes require `Authorization: Bearer <Supabase access token>`; owner ids come only from the verified token.

| Method | Path | Success | Notable failures |
|---|---|---|---|
| POST | `/api/soil-reports/upload` | `200` `{status: failed\|needs_review\|completed, extraction_id, soil_report_id, fields…, review_required}` | 401, 404 (plot), 413, 415, 422, 429, 503 |
| GET | `/api/soil-reports/extractions?plot_id=&limit=` | list | 401, 404 |
| GET | `/api/soil-reports/extractions/{id}` | one | 401, 404 |
| POST | `/api/soil-reports/extractions/{id}/confirm` | `200` completed | 401, 404, 409, 422 `{code, problems}`, 429 |
| POST | `/api/recommendations` | `201` generated · `200` `{state: "insufficient_data", reasons, required}` | 401, 404, 422 `soil_report_not_verified`, 429 |
| GET | `/api/recommendations`, `/api/recommendations/{id}` | rows with `engine_version`, `generated_at`, `provenance` | 401, 404 |
| GET | `/api/plots/{id}/twin/live`, `/twin/prediction` | scores / NDVI trend | 401, 404 |
| GET | `/api/geospatial/ndvi/{id}`, `/bhunaksha/{id}` | `available: true/false` + reason | 401, 404 |
| GET | `/health` · `/health/ready` | liveness · readiness (`503` if a required dependency is missing; no secret values) | – |

Removed: all `/api/disease/*` routes. Impact: any external client of those routes now gets `404`; the in-repo frontend never calls them any more.

Interactive OpenAPI: `/docs`. The request/response models are in `backend/app/schemas/api.py` and `backend/app/ocr/schemas.py`.
