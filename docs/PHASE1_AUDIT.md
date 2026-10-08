# NutriPalm AI -- Phase 1 audit (branch `audit/phase1-hardening`)

Status terms: **PASS** = verified by a test or by reading the code path end to end;
**FIXED** = was broken or fabricated, now corrected and covered by a test or build check;
**IMPLEMENTED** = added in this audit; **BLOCKED** = needs an external service/binary that was
not available when the audit ran (exact steps below); **NOT VERIFIED** = no browser / live
Supabase was available, so the behaviour is covered by code reading and unit tests only.

## 1. Git and PR integration

| Item | Decision | Reason |
|------|----------|--------|
| PRs #1 - #12 | already merged into `main`; nothing to merge | `main` contains all of them |
| Branches `enhance/analytics-dashboard(-v3)`, `feature/ai-recommendation-backend`, `feature/auth-profile-setup`, `feature/deficiency`, `susheep` | no unmerged commits | fully contained in `main` |
| `suhan-google-map-fix` `.env.example` changes | **rejected** | commits a real-looking Supabase project URL + publishable key, and a `jsonjson` typo in the JWKS URL |
| `suhan-google-map-fix` `googleMapsLoader.ts` | **integrated, rewritten** | its real fix: the loader must resolve to the `google` namespace (surveyor calls `google.maps.Map`; `main` resolved to `google.maps`, so the surveyor always fell back to Leaflet). Console logging of key info removed; timeout + retry-safe promise added; covered by tests |
| `suhan-google-map-fix` `GoogleMapBoundarySurveyor.tsx` | **rejected** | debug `console.log`s and it deletes Places Autocomplete. Its underlying symptom (map resets) is fixed at the root by making `showToast` stable (see below) |
| `suhan-google-map-fix` `SoilReportScreen.tsx` | **rejected** | whitespace/indentation only |
| `suhan-google-map-fix` `schemas/inputs.py` | **rejected** | adds optional EC / micronutrient / crop-profile fields that nothing reads; micronutrients are persisted through `soil_reports.micronutrients` instead |

Nothing was pushed. All work is local commits on `audit/phase1-hardening`.

## 2. Credentials exposed in public Git history -- rotate / review

* Branch `suhan-google-map-fix`, commit `3abd769`: a Supabase project URL and a *publishable* (anon-class)
  key in `.env.example`. Publishable keys are meant to be public **only if RLS is correct**; apply migration 011
  and consider rotating that key and treating the project ref as known.
* `docs/GOOGLE_MAPS_SETUP.md` contains only a placeholder (`AIzaSyYourActual...`), not a real key.
* No service-role key, JWT secret, or Sentinel secret was found in any branch, PR ref or the working tree.
* Delete or force-clean the `suhan-google-map-fix` branch on GitHub if you want the values out of the branch list
  (history rewriting was not done by this audit).

## 3. Requirement matrix

| ID | Requirement | Final | Evidence / location |
|----|-------------|-------|---------------------|
| A1 | Supabase email login/signup/logout, session persistence | PASS (code) / NOT VERIFIED live | `PrototypeAuth.tsx`, `App.tsx` session listener |
| A2 | Frontend and backend agree on user; JWT verified (HS256 + JWKS RS256/ES256), audience checked | PASS | `dependencies.py`; `test_auth_dependency.py`, `test_security_isolation.py` (expired, wrong audience, `alg:none`, tampered, no-secret) |
| A3 | No hard-coded identity / auth bypass | **FIXED** | mock-login Supabase fallback removed (fails closed); hard-coded demo login (`DemoUser123!`) removed; `src/__tests__/security.test.ts` |
| A4 | Google OAuth | NOT VERIFIED (needs Supabase Google provider) | `signInWithOAuth` wired in `PrototypeAuth.tsx` |
| B1 | Dashboard/profile identity from session | **FIXED** | fallback name "Dr. L. Ramana", Settings defaults, dashboard sample personas removed |
| C1 | Farm(er) management persisted | **IMPLEMENTED** | `farmers` table (migration 011), `src/data/farmers.ts`, RLS; farmers were localStorage-only before |
| C2 | Plots linked to a farmer | **IMPLEMENTED** | `plots.farmer_id`, farmer select in plot wizard |
| D1 | Plot create/view/select/edit/reload with ownership | **FIXED** | store starts empty, never falls back to sample plots; failed save raises instead of creating a fake local `plot-N`; hard-coded farmer "Swaminathan Gowda" and default coordinates removed |
| D2 | Plot location = real centroid | **FIXED** | previously the first polygon vertex was saved as lat/lng; now `polygonCentroid()` (tested) on create and boundary update |
| E1 | Real GPS, high accuracy, permission/timeout/poor-accuracy handling, watcher cleanup | PASS (code) | `GoogleMapBoundarySurveyor.tsx` `handleUseCurrentLocation`; no synthetic coordinates. NOT VERIFIED on a device |
| F1 | Boundary survey: find, GPS, draw, edit, undo/clear, area, perimeter, confirm, save, reload | PASS (code) / NOT VERIFIED in browser | surveyor + `geo.ts` (`geoMath.test.ts` for distance/perimeter/acres) |
| F2 | Surveyor map was reset by parent re-renders | **FIXED** | `showToast` is now stable (`useCallback`) so the lifecycle effect no longer tears the map down |
| G1 | Satellite map; Google optional; fallback works | **FIXED** | loader returns `google` namespace (previously always dropped to fallback); tests cover missing key, success, retry, no key logging. Live Google imagery BLOCKED (needs key) |
| H1 | Weather from plot centroid, units, loading/error states | **FIXED** | dashboard weather was hard-coded (32 C, 11 km/h, fake forecast) -> `DashboardWeatherCard` (Open-Meteo at centroid); `useEnvironmentalData` uses the true centroid |
| H2 | Live twin never substitutes weather | **FIXED** | `or 30.0 / 70.0 / 10.0` defaults removed -> 503 "unavailable"; `test_live_twin.py` |
| I1 | NDVI: ownership, real geometry, env credentials, graceful unconfigured, validation | **FIXED** (geometry validation added) / live data BLOCKED | `sentinel_service.validate_polygon`, `test_geometry_validation.py`, `test_api_geospatial.py` |
| J1 | Soil OCR pipeline: upload validation, extraction, validation, persistence | **FIXED** | streamed 20 MB limit, magic-byte check, malformed-UUID -> 404, micronutrient + validation summary persisted; tests in `test_api_soil_reports.py` |
| J2 | Missing values stay missing | **FIXED** | the soil screen invented N=280 / P=35 / K=175 / pH 6.5 / EC 0.6 and Zn 0.85 / S 14.2 / B 0.75 ... and hard-coded treatment doses; all removed |
| J3 | Real OCR on scanned/multi-page | BLOCKED | needs Tesseract + Poppler; 6 backend tests fail only for this reason |
| K1 | Digital Twin bound to the real plot id, no cross-plot leakage | PASS (code) | `digitalTwins.ts` hooks key off plot id; sample ids rejected |
| K2 | Twin screen fabricated values | **FIXED** | hard-coded soil-chemistry table (pH 6.2, N 72 ppm ...), default foliar health 98, default "Low" risk, 0-valued gauges shown as data -> "N/A"/empty states; soil chemistry now from the plot's latest report |
| K3 | Prediction excludes synthetic data | **FIXED** | filter was documented but missing; snapshot service also hard-coded `is_synthetic: True` on real snapshots (would have excluded all real data) -> flag now derived from inputs; `test_twin_snapshot_service.py` |
| L1 | Analytics use real account/plot data | **FIXED** | rewritten; removed mock fallback plots, default 75/18.2/40/NPK values, fixed 12-month "forecast", fake sub-zones, unconditional "Live Active Sync" |
| M1 | Recommendations generated by the backend engine, persisted, retrievable per user | **FIXED** | the UI never called the backend: it computed invented doses/costs in the browser and saved nothing. Rebuilt on `/api/recommendations` (crop price required, history listed) |
| M2 | Recommendation cross-account isolation | PASS | `test_security_isolation.py`: other user's plot/report/recommendation, report/plot mismatch, owner_id in body ignored |
| N1 | RLS correct | **FIXED** (unexecuted) | migration 011: WITH CHECK on UPDATE (owner swap), plot ownership on soil_report/recommendation INSERT, farmer ownership on plot, explicit DELETE policies |
| N2 | Migrations coherent on a fresh DB | NOT VERIFIED -- no Postgres available | statically reviewed; apply 001-011 on a scratch Supabase project |
| O1 | Config / secrets / CORS | **FIXED** | `.env.example` files rewritten with placeholders; SETUP.md corrected (port, variable names, nonexistent module paths, wrong schema); wildcard CORS rejected outside development; API base URL no longer silently `localhost` in production builds |
| P1 | Logout clears per-browser caches | **FIXED** | `nutripalm*` localStorage keys removed on logout; soil/recommendation views no longer cache across plots/accounts |

## 4. Bugs by severity

* **Critical**: mock-login fallback in `supabaseClient.ts` (anyone "signs in" when env is missing); hard-coded demo credentials in the bundle; recommendations computed and shown without the backend (invented doses/costs/yields); soil screen inventing lab values; dashboard / twin / analytics presenting hard-coded telemetry as live.
* **High**: plot lat/lng stored as first vertex, not centroid; Maps loader contract mismatch (surveyor always on fallback); RLS UPDATE without WITH CHECK (owner reassignment) and INSERT not checking plot ownership; farmers stored only in localStorage; synthetic flag hard-coded on real twin snapshots; live twin default weather; sample plots shown to signed-in users on load/error; failed plot save created fake local plot.
* **Medium**: unvalidated polygon sent to Sentinel Hub; unbounded upload read + trust of client content type; wildcard CORS allowed in production; unknown crops judged against oil-palm ranges (and "Cocoa" matched coconut, "Coconut Palm" matched oil palm); inverted water-stress interpretation and `[0]`-of-unordered-rows "latest" in analytics.
* **Low**: stale SETUP/README claims; static "GIS sync 100% online" chip; fake refresh toasts.

## 5. Known limitations / not claimed

* The yield estimate in `/twin/live` uses an oil-palm baseline (20 t/ha) for every crop, and `crop_rules.py` / `cropBaselines.ts` are separate V1 reference tables with different numbers. Treat both as defaults, not agronomy-validated.
* Sentinel NDVI is an aggregate over the last 30 days (the `acquisition_date` is the end of that window, not a single satellite pass).
* `Bhu-Naksha` cadastral lookup is intentionally unavailable.
* Crops not in the backend catalog (e.g. "Cocoa", "Coconut Palm" as written) get a 422 "unsupported crop" from the recommendation API instead of advice.
* The i18n dictionaries still contain strings for removed mock content; they are unused.
* A guided-demo overlay (tour text only) remains; it contains no fabricated account data.
* Not verified: browser behaviour, Google OAuth, live Supabase RLS, live Sentinel, live Google Maps, real OCR.

## 6. How to finish the BLOCKED verifications

1. **Database**: create a scratch Supabase project, run `001`...`011`, then sign up two users and confirm with the anon key
   that user B cannot select/update/insert rows referencing user A's `plots`, `soil_reports`, `recommendations`, `farmers`.
2. **OCR**: install Tesseract and Poppler (see `SETUP.md`), run `cd backend && python -m pytest -q` -- expect 0 failures.
3. **Sentinel**: set `SENTINEL_HUB_CLIENT_ID/SECRET`, call `GET /api/geospatial/ndvi/{plot_id}` with a token for a mapped plot.
4. **Google Maps**: set `VITE_GOOGLE_MAPS_API_KEY`, open the surveyor, confirm Google satellite loads; unset it and confirm the Esri/Leaflet fallback.
5. **End to end**: two accounts, create farmer -> plot (draw boundary) -> upload report -> generate recommendation -> check Digital Twin and Analytics; then as user B request A's ids against the API (expect 404).
