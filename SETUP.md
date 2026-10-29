# NutriPalm AI -- Setup

## 1. Prerequisites

| Tool | Needed for |
|------|-----------|
| Node.js 20+ and npm | frontend |
| Python 3.11+ | backend |
| A Supabase project | auth + database |
| Tesseract OCR and Poppler | soil-report OCR on scanned PDFs / images |
| Sentinel Hub OAuth client (optional) | live Sentinel-2 NDVI |
| Google Maps JS API key (optional) | Google satellite imagery in the boundary surveyor |

Tesseract and Poppler are **external programs** (not Python packages). Install them with your
OS package manager (`apt-get install tesseract-ocr poppler-utils`, `brew install tesseract poppler`)
or on Windows install the binaries and set `TESSERACT_CMD` / `POPPLER_PATH` in `backend/.env`.
Without them, text-layer PDFs still work but scanned/image reports cannot be read (the API says so; it never returns an empty
"success"), and the real-OCR backend tests fail. `GET /health/ready` reports whether both binaries were found.

## 2. Install

```bash
npm install
cd backend && python -m venv .venv && . .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt        # production: requirements.txt
```

## 3. Environment variables

Copy the two example files and fill them in:

* `.env.example` -> `.env.local` (frontend; `VITE_*` only, public values)
* `backend/.env.example` -> `backend/.env` (server-side secrets)

The frontend fails closed: if `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are missing, sign-in is
refused with a configuration error (there is no offline/mock login).

## 4. Database

Apply every file in `supabase/migrations/` **in numeric order** (`001` ... `013`) with the Supabase
CLI (`supabase db push`) or the SQL editor. Migration `011` adds the `farmers` table, plot->farmer
link, soil-report micronutrient storage, and tightens row-level security (ownership checks on
INSERT/UPDATE, explicit DELETE policies). Migration `013` adds the verified-extraction workflow (`soil_report_extractions`),
recommendation provenance columns and `fertilizer_applications`, and stops browser writes from claiming verification.
All statements are idempotent. Apply `013` **before** deploying the matching backend (see `docs/DEPLOYMENT.md`).

Every user-data table has row-level security; the backend additionally checks ownership in code
because it uses the service-role key (which bypasses RLS).

## 5. Run

```bash
# backend (from backend/)
python -m uvicorn app.main:app --reload --port 8000
# frontend (from repo root)
npm run dev
```

API docs: http://localhost:8000/docs . Health check: `GET /health`.

## 6. Tests and checks

```bash
npm run build          # type-check + production build
npm run lint
npm test
cd backend && python -m pytest -q
cd supabase/tests && npm install && npm run verify      # migrations + row-level-security attack matrix
```

## 7. Protected endpoints

All `/api/*` routes require `Authorization: Bearer <Supabase access token>`; the user id is taken
from the verified token, never from the request body. The full contract is in `docs/ARCHITECTURE.md` section 6.

| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/soil-reports/upload | read a soil report for one of your plots -> `failed` / `needs_review` / `completed` |
| GET | /api/soil-reports/extractions[/{id}] | stored extractions (as read, with provenance) |
| POST | /api/soil-reports/extractions/{id}/confirm | confirm / correct values -> verified soil report |
| POST | /api/recommendations | generate + save a recommendation, or `insufficient_data` |
| GET | /api/recommendations, /api/recommendations/{id} | your saved recommendations |
| GET | /api/geospatial/ndvi/{plot_id} | Sentinel-2 NDVI for your plot (`available:false` if not configured) |
| GET | /api/geospatial/bhunaksha/{plot_id} | cadastral lookup (currently reports unavailable) |
| GET | /api/plots/{plot_id}/twin/live | live Digital Twin scores (Open-Meteo at the plot's centroid) |
| GET | /api/plots/{plot_id}/twin/prediction | NDVI trend from stored non-synthetic snapshots |
| GET | /health, /health/ready | public liveness / readiness |

Requests for another user's plot, report, extraction or recommendation return **404**, identical to a missing id.
