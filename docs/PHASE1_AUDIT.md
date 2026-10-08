# NutriPalm AI -- Phase 1 audit (final state of branch `audit/phase1-hardening`)

## Readiness: NOT READY FOR PRODUCTION-LIKE TESTING

Everything that can be verified without external infrastructure has been verified (below). Three things have
not: **(1)** a real, managed Supabase scratch project, **(2)** real OCR on this machine's CI (verified manually by
the project owner), **(3)** live Sentinel / Google Maps / Google OAuth. Item (1) is a genuine requirement and
is the single remaining blocker.

Status terms: **PASS** = executed and observed (test, script or browser run); **BLOCKED** = needs infrastructure or
credentials that were not available (steps given); **NOT VERIFIED** = not executed in any form; **NOT APPLICABLE**.
Nothing is called PASS on the strength of code reading alone.

---

## 1. Git and PR integration

| Item | Decision | Reason |
|------|----------|--------|
| PRs #1 - #12 | already merged into `main`; nothing to merge | `main` contains all of them |
| Branches `enhance/analytics-dashboard(-v3)`, `feature/ai-recommendation-backend`, `feature/auth-profile-setup`, `feature/deficiency`, `susheep` | no unmerged commits | fully contained in `main` |
| `suhan-google-map-fix` `.env.example` changes | **rejected** | commits a real-looking Supabase project URL + publishable key, and a `jsonjson` typo in the JWKS URL |
| `suhan-google-map-fix` `googleMapsLoader.ts` | **integrated, rewritten** | its real fix: the loader must resolve to the `google` namespace (surveyor calls `google.maps.Map`; `main` resolved to `google.maps`, so the surveyor always fell back to Leaflet). Key logging removed; timeout + retry-safe promise added; unit-tested |
| `suhan-google-map-fix` `GoogleMapBoundarySurveyor.tsx` | **rejected** | debug `console.log`s and it deletes Places Autocomplete. Its symptom (map resets) is fixed at the root by a stable `showToast` |
| `suhan-google-map-fix` `SoilReportScreen.tsx` | **rejected** | whitespace/indentation only |
| `suhan-google-map-fix` `schemas/inputs.py` | **rejected** | optional fields nothing reads; micronutrients persist via `soil_reports.micronutrients` |

Nothing was pushed or merged. All work is local commits on `audit/phase1-hardening`.

## 2. Credentials exposed in public Git history -- rotate / review

* Branch `suhan-google-map-fix`, commit `3abd769`: a Supabase project URL and a *publishable* (anon-class) key in
  `.env.example`. Publishable keys are meant to be public **only if RLS is correct**; apply migration 011, and
  consider rotating that key.
* `docs/GOOGLE_MAPS_SETUP.md` contains only a placeholder (`AIzaSyYourActual...`), not a real key.
* No service-role key, JWT secret, or Sentinel secret exists in any branch, PR ref or the working tree.
* Delete the `suhan-google-map-fix` branch on GitHub if you want the values out of the branch list (not done here).

---

## 3. Verified (PASS) -- with the evidence

| Area | Result | Evidence (re-runnable) |
|------|--------|------------------------|
| PostgreSQL migrations 001-011, clean database | **PASS** | `cd supabase/tests && npm run verify` -> every file applies in order; 011 idempotent (re-run keeps the policy count) |
| Schema vs application | **PASS** | same script: every column the app reads/writes exists; all 9 public tables have RLS and at least one policy; no duplicate policy names; all UPDATE policies carry `WITH CHECK` |
| Two-user RLS / ownership attack matrix | **PASS 210/210** | same script, as `authenticated` role with PostgREST-style JWT GUCs (never a superuser): A<->B read/update/delete, inserts claiming the other's `owner_id`/plot/farmer/report, re-pointing own rows at the other's plot/report/farmer, owner reassignment, backend-only tables, anon access |
| Recommendation cross-references | **PASS** | A cannot create a recommendation on B's plot or with B's soil report, cannot re-point an existing one, and a recommendation's report must belong to its plot (found and fixed in this audit) |
| Security tests are meaningful | **PASS** | `WEAKEN=1 npm run verify` re-creates the pre-011 policies -> 17 expected failures (cross-reference holes) |
| FastAPI auth with real signed JWTs | **PASS** | `backend/tests/test_api_jwt_ownership.py` (16): all 8 `/api` routes return 401 for missing/empty/garbage/expired/forged/wrong-audience/no-subject/non-bearer; A's token against B's resources -> 404 identical to "not found"; client `owner_id` ignored; a guard test fails if an `/api` route is added without being covered |
| Backend suite | **PASS 173 / 179** | the 6 failures are the real-OCR tests that need Tesseract/Poppler binaries, absent on this machine (OCR itself: see below) |
| Frontend build, lint, unit tests | **PASS** | `npm run build` (type-check + bundle), `npm run lint` (0 errors), `npm test` -> 30 tests incl. crop-table parity with the backend |
| Emulator fidelity | **PASS 14/14** | `npm run e2e:stack-selftest` runs the real `supabase-js` client against the emulated stack |
| Browser end-to-end, two users | **PASS 87/87** (Edge via Playwright, emulated Supabase stack — not managed Supabase) | `npm run e2e` (details in section 4) |
| OCR (Tesseract) | **PASS -- manual** | verified by the project owner on their machine; not re-run here. Frontend integration (upload -> API -> structured result -> persisted -> shown, missing values stay missing) **is** covered by the browser E2E using the text-layer PDF path |

Verified against PostgreSQL 17/PGlite with Supabase-auth-compatible test roles. Managed Supabase verification remains blocked.

**Test scope that must not be overstated:** the database checks ran on PostgreSQL 17 (PGlite, real Postgres compiled
to WASM) with a Supabase-auth-compatible shim (`supabase/tests/supabase_shim.sql`); the browser E2E ran against an
**emulated** Supabase (GoTrue/PostgREST-compatible HTTP layer over that Postgres) with the real FastAPI backend and
the real Vite app. This is **not** equivalent to a managed Supabase project.

## 4. Browser E2E (emulated Supabase + real backend + real app, Microsoft Edge via Playwright)

Run: `cd supabase/tests && npm install && E2E_PYTHON=<python with backend deps> npm run e2e`.

| Step | Result |
|------|--------|
| Sign up (email), session persists across reload, sign out clears token + `nutripalm*` caches, no restore after logout | PASS |
| Dashboard: real profile name/role, honest empty state, no fabricated persona/telemetry, header API status from `/health` | PASS |
| Create farmer (persisted for the right owner) | PASS |
| Create plot: wizard -> location search (live geocoding) -> current location (browser geolocation, emulated device at +/-12 m) -> satellite map -> draw 4 vertices -> undo -> edit (drag a vertex, area/perimeter update) -> confirm -> save | PASS |
| Saved boundary: closed WGS84 GeoJSON, stored location = polygon **centroid** (not first vertex), real reverse-geocode + elevation, status "Not Assessed" | PASS |
| Reload: same plot and area; weather requested for the plot's own centroid; NDVI shows "Config required" (no fabricated NDVI); backend NDVI call is authenticated and carries the plot id | PASS |
| Soil report: incomplete report not saved and missing values shown as missing; complete report persisted with the exact extracted N/P/K/pH/EC/OC, micronutrients stay empty ("Not reported") | PASS |
| Recommendations: refuses to run without a crop price; browser calls `POST /api/recommendations` with plot id, report id and price only (no owner/user id, bearer token); persisted for the right user/plot/report; shown again after reload; nothing computed or cached in the browser | PASS |
| Second plot; Digital Twin follows the selected plot (live + prediction requests use that plot's UUID); persisted non-synthetic snapshot shown, synthetic one never shown; no leakage between plots | PASS |
| Analytics: KPIs equal the account's data; no invented forecast/telemetry | PASS |
| Profile / Settings: real identity, no hard-coded organisation/licence | PASS |
| User B: sees none of A's data on any screen; direct calls with B's token against A's ids (twin live/prediction, NDVI, cadastral, recommendation get/create, soil upload) -> 404; REST read/update/delete/insert against A's rows denied; A's data unchanged; forged token -> 401 | PASS |
| Console/network audit: no page errors, no unexpected console errors or HTTP errors, no request storm, no backend traceback | PASS (known accepted noise below) |

Accepted console noise (framework-level, not application logic): framer-motion logs
`<path> attribute d: Expected moveto path command` for the boot-splash SVG animation; the missing Google key logs a
warning because the keyless engine is intentional.

## 5. BLOCKED / NOT VERIFIED

| Item | Status | Why / how to finish |
|------|--------|---------------------|
| Managed Supabase scratch project: migrations + two-user RLS | **BLOCKED -- no scratch Supabase project/credentials** | follow `docs/SCRATCH_SUPABASE_VERIFICATION.md`; `npm run verify:remote` (written, syntax-checked, guarded, **never run**) |
| Supabase email confirmation, password reset, GoTrue behaviours | **BLOCKED** (same) | emulator auto-confirms and does not implement recovery |
| Google OAuth sign-in | **BLOCKED** | needs the Google provider configured in a real Supabase project |
| Google Maps imagery / Places search | **BLOCKED -- no API key** | keyless fallback is PASS (above); set `VITE_GOOGLE_MAPS_API_KEY` to test the Google engine |
| Sentinel-2 NDVI with real data | **BLOCKED -- no credentials** | unconfigured state, authentication, ownership and geometry validation are PASS |
| Real GPS hardware | **NOT VERIFIED** | browser geolocation was emulated (permission + coordinates + accuracy); permission-denied / timeout paths are code-only |
| Scanned/multi-page OCR in CI | **NOT VERIFIED here** (PASS manually by owner) | install Tesseract + Poppler and run `pytest` |
| Mobile viewport / accessibility | **NOT VERIFIED** | desktop viewport only |
| `GET /api/plots/{id}` and `/api/soil-reports/{id}` | **NOT APPLICABLE** | these backend routes do not exist; plots and reports are read directly from Supabase under RLS (covered by the DB matrix and browser attacks) |

## 6. Bugs found and fixed (cumulative)

**Critical**: mock-login Supabase fallback; hard-coded demo credentials; recommendations computed in the browser
(invented doses/costs/yields); soil screen inventing lab values; dashboard / twin / analytics / farmer / plot screens showing hard-coded
telemetry as live (fake sensors, "99.8%", "+12% MoM", fake activity logs, fake AI observations, fake plot health).

**High**: confirm-boundary dialog rendered *behind* the Leaflet map (users could not save a boundary with the keyless engine);
plot location stored as first vertex not centroid; Maps loader contract mismatch; surveyor reset by parent re-renders;
cross-reference RLS holes (found by the attack matrix, including one in this audit's own first draft of migration 011);
farmers only in localStorage; snapshot service marking real data synthetic; live-twin default weather; sample plots shown to signed-in
users; failed save creating a fake local plot; Soil/Analytics benchmark ranges contradicting the recommendation engine
(frontend table now mirrors `crop_rules.py`, guarded by a parity test).

**Medium**: unvalidated polygons sent to Sentinel; unbounded uploads / trusted content type; wildcard CORS allowed in
production; unknown crops judged against oil palm and loose crop-name matching ("Cocoa" matched coconut); oil-palm
yield shown for every crop (now only for oil palm, others get an explicit note); analytics inverted water-stress logic;
Esri imagery blank at zoom 19 (now upscales from native zoom 18); farmer wizard fake coordinates/district defaults; dead
duplicate `AddFarmerScreen`; soil reference ranges hard-coded to oil palm.

**Low**: stale SETUP/README; static status chips; fake refresh toasts; duplicate success toast; "Soil Reports Scanned"
counting farmers; unformatted acreage (1.4675289...).

## 7. Known limitations (not claimed as solved)

* Crop reference values and the live-twin disease/water models are **V1 defaults, not agronomist-validated**. The yield
  model is oil-palm only. Unsupported crops (e.g. Cocoa, Coconut *Palm* as free text) are recorded but get no recommendation
  (the UI says which crops are supported).
* Sentinel NDVI is an aggregate over the last 30 days, not a single satellite pass.
* Cadastral (Bhu-Naksha) lookup intentionally reports unavailable.
* A boot-splash animation shows a fixed-duration progress bar; it carries no data.
* The plot wizard's irrigation / soil-type selects still default to "Precision Drip" / "Loamy" and are saved as chosen.
* Imagery providers may lack tiles for some locations (grey placeholders); that is provider coverage, not an app fault.

## 8. Reproduce everything

```bash
npm install && npm run build && npm run lint && npm test            # frontend
cd backend && pip install -r requirements.txt && python -m pytest -q  # backend (6 OCR tests need Tesseract/Poppler)
cd supabase/tests && npm install
npm run verify                  # migrations + 210-attack RLS matrix on PostgreSQL 17 (PGlite)
WEAKEN=1 npm run verify         # mutation check: expected failures
npm run e2e:stack-selftest      # emulator vs the real supabase-js client
E2E_PYTHON=/path/to/python npm run e2e   # browser E2E (needs internet for tiles/geocoding/weather, and Edge or Chrome)
npm run verify:remote           # BLOCKED: real scratch Supabase project, see docs/SCRATCH_SUPABASE_VERIFICATION.md
```
