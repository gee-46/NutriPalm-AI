# NutriPalm AI - Recommendation Engine Backend

AI/ML backend: soil nutrient analysis, severity scoring, fertilizer dosage,
yield prediction, ROI, and farmer-friendly explanations - exposed as a
FastAPI service and persisted to Supabase/PostgreSQL.

This backend owns **only** the AI/recommendation module. It does not own
authentication, plot creation, soil OCR, or analytics - see
`backend/docs/integration_contract.md` for what it expects from those
modules.

## 1. Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# edit .env with real Supabase project values
```

## 2. Run the API

```bash
uvicorn app.main:app --reload --port 8000
```

- Health check: http://localhost:8000/health
- Swagger UI (interactive API docs): **http://localhost:8000/docs**
- ReDoc: http://localhost:8000/redoc

## 3. Try it via Swagger

1. Open http://localhost:8000/docs
2. `POST /api/recommendations` requires `Authorization: Bearer <token>`.
   Get a real token by signing in through the frontend (Supabase Auth) and
   copying the session's `access_token`, or via
   `supabase.auth.sign_in_with_password(...)` in a Python/JS shell against
   your project.
3. Click "Authorize" in Swagger, paste `Bearer <token>`, then try the
   endpoint with a real `plot_id` / `soil_report_id` that belongs to that
   user.

Until `plots` / `soil_reports` tables exist (see integration contract), the
endpoint will correctly return `503` for those lookups rather than fake
data - this is expected, not a bug.

## 4. Run the tests

```bash
cd backend
python3 -m pytest -v
```

All 47 tests run with **no Supabase connection required** - pure business
logic is tested directly, and API tests use FastAPI `dependency_overrides`
with in-memory fake repositories (see `tests/conftest.py`). Nothing in
`app/` imports from `tests/fixtures/` - fixture/demo data never reaches
production code paths.

```
tests/test_crop_rules.py            - crop catalog lookups
tests/test_nutrient_analyzer.py     - soil vs. crop target comparison
tests/test_severity_calculator.py   - deficiency severity scoring
tests/test_dosage_calculator.py     - fertilizer quantity + cost calc
tests/test_yield_predictor.py       - current vs expected yield
tests/test_roi_calculator.py        - dynamic ROI (not fixed)
tests/test_explanation_engine.py    - farmer-friendly text generation
tests/test_recommendation_service.py- full pipeline orchestration
tests/test_auth_dependency.py       - JWT verification (valid/invalid/tampered)
tests/test_api_recommendations.py   - HTTP layer: success, 401, 404, 422, ownership
```

## 5. Apply the database migration

The `recommendations` table + RLS policies live in
`supabase/migrations/003_create_recommendations.sql`. Apply it with the
Supabase CLI (from the repo root, alongside the existing
`001_create_profiles.sql`):

```bash
supabase db push
# or, in the Supabase Dashboard SQL editor, run the file's contents directly
```

This migration does **not** touch `001_create_profiles.sql` and does not
create `plots` or `soil_reports` (those belong to teammates).

## 6. Architecture

```
Frontend (React, existing)
    |
    v
FastAPI  (backend/app/main.py)
    |
    v
Recommendation API  (backend/app/routers/recommendations.py)
    |
    v
Recommendation Service  (backend/app/services/recommendation_service.py)
    |
    v
+-------------------------------------------------+
| AI Services (backend/app/services/)              |
|                                                    |
|  crop_rules -> nutrient_analyzer -> severity_calc |
|      -> dosage_calculator (uses fertilizer_catalog)|
|      -> yield_predictor -> roi_calculator          |
|      -> explanation_engine                        |
+------------------------+--------------------------+
                          v
                  Recommendation Result
                          v
     Supabase/PostgreSQL (`recommendations` table, RLS)
                          v
                Recommendation History API
```

Plot data and soil-report data come in from two repository interfaces
(`app/repositories/plot_repository.py`,
`app/repositories/soil_report_repository.py`) that are the integration
boundary with Team Member 2 and Team Member 3's modules - see
`backend/docs/integration_contract.md`.

## 7. Environment variables

| Variable                     | Required | Purpose                                          |
|-------------------------------|----------|---------------------------------------------------|
| `SUPABASE_URL`                | Yes (for DB-backed endpoints) | Supabase project URL              |
| `SUPABASE_SERVICE_ROLE_KEY`   | Yes (for DB-backed endpoints) | Server-side only, never sent to frontend |
| `SUPABASE_JWT_SECRET`         | Yes | Verifies the caller's Supabase Auth token          |
| `ENVIRONMENT`                 | No  | `development` \| `staging` \| `production`         |
| `CORS_ALLOW_ORIGINS`          | No  | Comma-separated list, defaults to `http://localhost:5173` |
| `STRICT_NO_MOCK_DATA`         | No  | Reserved for future use; repositories never fall back to fake data regardless |

Pure-logic unit tests do not require any of these to be set. Only the
Supabase-backed repositories (and therefore the live HTTP endpoints against
a real database) require them.
