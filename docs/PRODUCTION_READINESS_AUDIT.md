# Production-readiness audit — scope reduction, OCR/recommendation hardening, Digital Twin

Audit date: 2026-10-30 (three rounds: scope/OCR/twin work, blocker resolution, then fertilizer-engine completion — §13) · branch `main` (changes are **uncommitted** in the working tree) · supersedes `PHASE1_AUDIT.md` / `PHASE2_FRONTEND_STATUS.md` for current status.

## 0. Release decision: **NO-GO**

Not production-ready, and not "production-ready pending paperwork": three of the four hard blockers are verification gaps that no amount of local testing can close.
Everything that *can* be verified on one developer machine has been, including a real Docker image. The remaining gates:

| # | Gate | State | Evidence | Owner to unblock |
|---|---|---|---|---|
| G1 | **Agronomist-approved, cited fertilizer rules** | **BLOCKED.** No rule is approved; every recommendation answers `insufficient_data`. Round 3 found and verified real sources and built the engine path for them: **candidate records for oil palm and coconut are complete and engine-ready but pending approval**; arecanut is source-verified but not an engine crop; rice, maize, sugarcane and banana have no source. The unit-basis bug (2.29×/1.20× dose error) is fixed; the model shape, region, age convention, soil-test adjustment and product grades need an agronomist (17 decisions, D1–D17) | [AGRONOMIST_REVIEW_CHECKLIST.md](AGRONOMIST_REVIEW_CHECKLIST.md), [FERTILIZER_SOURCES.md](FERTILIZER_SOURCES.md); `test_rule_validation.py`, `test_schedule_engine.py`, `test_candidate_rules.py`, `test_fertilizer_units.py` | **Agronomist** |
| G2 | **Managed Supabase verification** (migrations 001–013, RLS with real GoTrue/PostgREST, email confirmation, Google sign-in) | **BLOCKED.** No disposable project or `SCRATCH_*` credentials exist. Local proof is only PGlite/emulator. `verify:remote` is extended to 012/013 but **never executed** | `verify.mjs` 304/304 and `verify-upgrade.mjs` 21/21 are **PGlite**, not Supabase | **Project owner** (create a scratch project) |
| G3 | **OCR accuracy on realistic data** | **BLOCKED.** 1 real document (authorization to use it for evaluation not confirmed), 0 scans, 0 photos. The harness is ready and will print `INSUFFICIENT SAMPLE` until ≥ 30 per report type | `eval/README.md` lists the exact samples needed | **Project owner** (authorized, human-verified reports) |
| G4 | **Live NDVI (Sentinel Hub)** | **FAILED.** The configured OAuth client is rejected (`401 unauthorized_client`) on both the documented and the legacy token endpoint; format checks are clean, so the pair itself is invalid/revoked/from another account | `scripts/check_sentinel.py` (safe output), `test_sentinel_auth.py` | **Project owner** (new OAuth client) |
| G5 | **Hosted deployment checks** (TLS, proxy limits/timeouts, edge rate limiting, load, the staging workflow on real infrastructure) | **NOT DONE.** `staging-smoke.mjs` is ready and self-tested on the emulator (20/20) but has never run against a deployment | `DEPLOYMENT.md` §4–§7 | **Project owner / ops** |

A release decision of GO requires G1–G5 to be closed with evidence in this table. Closing G1 alone does not make the product releasable.

## 1. Baseline (before any change)

Commands run on the unmodified `main` working tree (Windows 11, Node 24, Python 3.13):

| Check | Result |
|---|---|
| `git status` | clean, branch `main` |
| `tsc -b` | passes |
| `oxlint` | 0 errors, warnings only |
| `vitest run` | 10 files, **74/74** passed |
| `pytest` (fresh venv from `backend/requirements.txt`) | 340 passed / 1 failed — the failure was a missing test dependency (`pypdf`) that `requirements.txt` did not list |
| Real OCR | worked **only** because `engine.py` contained a hard-coded developer path (`C:\Users\Dell\Desktop\Resumes\tesseract.exe`); no Tesseract on `PATH` |
| Migrations / RLS | previously reported 236/236 (not re-run before changes) |

## 2. What was traced from code (not assumed)

**OCR → recommendation flow as found:** upload → type/size/magic checks → pdfplumber text layer or Tesseract (run **twice** per scanned page: text and confidence)
→ regex label/value extraction → range/unit/confidence validation → save a `soil_reports` row only if all five required values were `valid` → `POST /api/recommendations`
→ target-deficit arithmetic → DAP/urea/MOP plan + yield + ROI + explanation → save.

**Digital Twin data flow as found:** see [ARCHITECTURE.md §4](ARCHITECTURE.md). The Phase 2 clean-up of fabricated values was confirmed (no sample plots for signed-in users;
unavailable states show "N/A" / "Config required" / "Not connected").

**Defects and risks found** (S = severity):

| S | Finding | Resolution |
|---|---|---|
| High | **Recommendations were produced from unsourced targets** and presented as advice; yield/revenue/ROI from illustrative baselines and placeholder catalog prices; an unsourced "split into 2–3 doses" instruction | Gated on a cited, reviewed rule pack (empty by default → `insufficient_data`); economics only if the rule covers them; costs only for products the caller priced; the timing sentence removed |
| High | **Browsers could write any numbers into `soil_reports` and any "advice" into `recommendations`** directly (RLS only checked ownership), so "verified" could not be guaranteed | Migration 013: browser writes cannot set verification/engine columns; only the backend can; recommendations refuse unverified soil reports |
| High | **Silent value rewriting:** `0.7/1`→`0.71`, `./5`→`.75`, O→0 etc. were applied without telling anyone; **a minus sign was swallowed** (`Nitrogen: -245` became `245`); units were silently assumed from defaults; values could be taken from a neighbouring line | All repairs are recorded (`normalizations`) and force review; the sign is kept and rejected as impossible; assumed units force review; neighbouring-line and conflicting values force review |
| High | **`public/sample-soil-report.pdf` + a "Load sample report" button** created a real saved soil report with invented values on the user's own plot | Button and file deleted; a test guards against reintroduction |
| Medium | **Incomplete reads were dropped**: the user saw numbers but could not correct them or keep the original | Review/correct/confirm workflow with an audit trail (§3) |
| Medium | OCR ran Tesseract twice per page; no per-page/total timeout, page limit or pixel limit; unbounded concurrency | One pass; limits and bounded concurrency; timeout fails the whole document |
| Medium | Missing-table errors: repositories only recognised `42P01`, but PostgREST reports `PGRST205` → an unhandled 500 (**found by the browser E2E**) | one helper recognises both → clear `503 … apply migration 013` |
| Medium | Wide-open CORS methods/headers with credentials; no readiness probe; staging/production could start without core config; no rate limiting | tightened to GET/POST/OPTIONS + Authorization/Content-Type; `/health/ready`; startup refuses; per-account limiter |
| Medium | Fake progress bar reached 100% on a timer, independent of the real result | capped at 90% until the real response arrives |
| Low | Developer's absolute path and a personal-resumes folder in source; `requirements.txt` missing test deps; root `requirements.txt` was a non-installable note; stale walkthrough with invented KPIs ("142 farmers") | path removed; deps split into `requirements.txt` / `requirements-dev.txt` (+ `pypdf`); note replaced; walkthrough deleted |
| Info | Digital Twin live scores (water stress, disease-risk model, crop-health fusion) are **heuristics over live weather, not validated** | left in place (twin is preserved), documented as modelled estimates in ARCHITECTURE §4 |
| Info | Engine defects needing agronomic judgement: P₂O₅/K₂O vs elemental basis; 1:1 deficit model; no crop age/irrigation/timing | documented in the pipeline doc §3.3, **not changed** |

## 3. What was built

* **Pipeline contract** (`ocr/schemas.py`, `ocr/pipeline.py`): statuses `failed | needs_review | completed`; per-field provenance (source line, page, unit source, repairs); pipeline version; SHA-256.
* **Review workflow** (`soil_extraction_service.py`, 3 routes, `ExtractionReview.tsx`): confirm-as-read only for exact, in-unit, in-range values; corrections never converted; original kept in `corrections`; single-flight de-duplication; idempotent re-upload; compensation if the closing write fails.
* **Rule gate** (`rule_provenance.py`) and **provenance** on every recommendation (`engine_version`, `generated_at`, inputs, rule citation, assumptions, not-considered list).
* **Digital Twin integration** (`TwinManagementPanel.tsx`): measured soil tests, advice, and farmer-recorded applications in three separate, labelled lists; applications are a separate table so advice can never appear as something that happened. History lists applications too.
* **Migration 013** (additive): `soil_report_extractions`, provenance columns, `fertilizer_applications`, four tightened policies.
* **Hardening:** startup validation, `/health/ready`, rate limiting, CORS, OCR limits, filename sanitisation, Dockerfile (built and verified in round 2, §4.5), dev/runtime requirement split.
* **Evaluation harness:** `backend/eval/ocr_eval.py`.

## 4. Test evidence

All commands were run on 2026-10-30 on one Windows machine. Results are grouped by what kind of environment they prove; **no row in the first four groups is evidence about a managed Supabase project or a hosted deployment.**

### 4.1 Local tests (mocks / in-memory fakes / real Tesseract and Poppler binaries)

| Command | Result |
|---|---|
| `npx tsc -b` · `npm run build` · `npx oxlint` | pass · pass · 0 errors (warnings only) |
| `npx vitest run` | **11 files, 68/68** (jsdom; Supabase and API mocked) |
| `npm run i18n:scan` | 0 untranslated literals |
| `cd backend && python -m pytest` | **513 passed** (239 after round 1, 418 after round 2, +95 in round 3: schedule-rule validation, per-palm→product arithmetic, refusals, API/persistence/ownership, candidate-record pins). Real Tesseract; Supabase replaced by fakes. Run with the Anaconda interpreter (the only one with every dependency) |
| `python -m eval.ocr_eval --validate-only` | manifest valid (1 document); warns that authorization is **not** confirmed |
| `python -m eval.ocr_eval --include-synthetic` | see pipeline doc §4: real 12/12 fields (INSUFFICIENT SAMPLE); synthetic 6/6 + 6/6 |
| `npm audit --omit=dev` · `pip-audit -r requirements.txt` | 0 vulnerabilities · **No known vulnerabilities** (python-jose and ecdsa removed, §7) |
| Secret scan (bundle + tracked + new files vs the actual local `.env` values) | only the public Supabase anon key is in the bundle; nothing else anywhere |

### 4.2 Emulator / PGlite tests (PostgreSQL 17 in WASM with a Supabase auth shim; HTTP emulator of GoTrue/PostgREST)

| Command | Result |
|---|---|
| `cd supabase/tests && npm run verify` | **304/304** — 13 migrations apply to a clean database, 013 idempotent, schema vs app, two-user attack matrix both directions, anon |
| `WEAKEN=1 npm run verify` | 45 expected failures (259/304) (24 in the 013 group): the checks fail when the policies are weakened |
| `npm run verify:upgrade` | **21/21** — migration order/dependency table; 013 applied to a database already populated by 001–012: no row, column, index, table or policy lost; exactly the four documented policies change and only gain `… IS NULL` provenance conditions; legacy users keep working; re-apply changes nothing |
| `npm run smoke:selftest` | **25/25** — the staging workflow script against the emulator + local backend. Round 3 switched it to the labelled **schedule** test pack and added: schedule provenance on the response and the stored row, product quantities equal to independently hand-worked values, and a refusal naming the missing planting date / palm count for a second plot |
| `E2E_PYTHON=… npm run e2e` | **131/131** — real Edge, real FastAPI, real Vite, emulated Supabase. One map-wizard step ("Draw Boundary"/"Add Plot") timed out in two of the runs made while the machine was busy and passed on every rerun; it is existing survey code that depends on live map tiles |

### 4.3 Managed Supabase tests
**None run. Blocked (G2).** `verify:remote` refused to start: no `SCRATCH_*` credentials in the environment. It is *not* read-only (creates and deletes two auth users and writes rows); it must not be pointed at the project named in `backend/.env`.

### 4.4 Live external-service tests
| Service | Result |
|---|---|
| Sentinel Hub OAuth | **failed** — `HTTP 401 unauthorized_client` on `/auth/realms/main/protocol/openid-connect/token` (documented) and `/oauth/token` (legacy); client id UUID-shaped, no whitespace/quotes/non-ASCII, secret 26 characters. No NDVI request was possible |
| Open-Meteo (live weather) | exercised by the browser E2E (weather requested for the plot centroid and rendered) — a public service, no credentials |
| Map tiles / geocoding | exercised by the browser E2E |

### 4.5 Container tests (local Docker 29.8, started for this check)
Image built; `/health/ready` 200 with Tesseract 5.5.0 and Poppler 25.03.0; unauthenticated API call → 401; non-root; healthy; read-only root filesystem with all capabilities dropped, 1 GiB / 2 CPU; real OCR through the pipeline for a PNG and an image-only PDF (value-for-value correct); peak RSS 155 MiB for one A4/300-dpi page. Details and caveats: `DEPLOYMENT.md` §4.

### 4.6 Hosted deployment tests
**None. Blocked (G5).**

Bugs the browser E2E found in this work's own changes (all fixed before the final runs): an effect that re-ran `applyVerified` in a loop and froze the soil screen on the clear-read path;
the `PGRST205` missing-table handling; unlabeled plot selector and file input on the soil screen (accessibility).

## 5. Digital Twin acceptance

| Criterion | Evidence |
|---|---|
| Real authenticated user sees own plots; cannot see/modify another's | RLS matrix (A↔B both directions, all tables); API tests with signed JWTs; browser E2E (user B's session attacks) |
| Data persists across refresh / new session | browser E2E: plot, soil reports, recommendation, application reload checks |
| Soil reports and recommendations belong to the right plot | FK + cross-reference policies; E2E checks plot ids on every row |
| No fake weather/NDVI/chart values | E2E "no fabricated persona/telemetry" checks; unavailable states; synthetic rows filtered |
| Unconfigured integrations are reported honestly | NDVI "Config required"; moisture "Not connected"; cadastral unavailable; `/health/ready` optional section |
| Recommendation ≠ application | separate tables, headings, and an E2E check that a recommendation creates no application row |
| Existing behaviour covered | live-twin, snapshot, prediction and geometry backend tests unchanged and passing |

## 6. Scope: retained and removed

**Retained:** sign-in/profile/settings; farmers; plots + GPS survey; soil-report OCR with review; recommendations (gated); Digital Twin (+ management panel); history; dashboard (counts, latest verified soil report, weather, advice).
**Removed** (nav, routes, components, backend router + rule engine + knowledge base + tests, scripts, docs, hooks, translations kept only as unused strings): Disease Intelligence; Crop Suitability (UI only — it never had a backend); standalone Weather advisory; Analytics dashboard;
the "load sample report" demo. **Not removed on purpose:** migration `012` and the `disease_assessments` table and rows (historical data; the matrix still tests its RLS); the shared weather client, map components, cropBaselines (used by the soil screen).
There was **no RAG / chat / LLM code** in the repository.
**API impact:** `/api/disease/*` now returns 404; no in-repo client calls it.

## 7. Dependency and token-security review

* `npm audit --omit=dev`: 4 findings at the start (dompurify via jsPDF, nanoid, source-map-js, vite) → **0** after `npm audit fix` (lock-file only). Two moderate dev-only findings (vitest tooling) remain.
* **python-jose 3.5.0 / ecdsa 0.19.2 — resolved by removal.** Dependency path: `python-jose` → `ecdsa` (`pip show`); nothing else required either. The advisories: PYSEC-2026-4298 (python-jose accepts a DER-encoded public key as an HMAC secret → forged HS256 tokens when algorithms are unrestricted) and PYSEC-2026-1325 (ecdsa Minerva signing side-channel; no upstream fix planned).
  The first analysis ("not exploitable here") was right for those two advisories — HS256 used a shared secret and `algorithms` was pinned — but **writing a token-attack suite first exposed three real defects in the old code**:
  tokens with **no `exp`** (never expire) and tokens with **no `aud`** were accepted, and a JWKS key whose type did not match the token header's algorithm raised an unhandled error (**HTTP 500 for an unauthenticated request**).
  Verification now uses **PyJWT 2.x** (`PyJWT[crypto]`; maintained, already a transitive dependency): algorithms are pinned per path, `exp`/`aud`/`sub` are required, the JWK key type (`RSA` / `EC P-256`) must match the header algorithm, and every failure is a 401.
  `tests/test_jwt_attacks.py` (28 tests: alg `none`, HS384/512, expired, never-expiring, not-yet-valid, wrong/missing audience, wrong secret, missing subject, garbage, RS256→HS256 confusion with PEM **and DER** public keys, wrong signer with a known `kid`, unknown/missing `kid`, algorithm/key-type mismatch, unsupported RS512/PS256) was run against python-jose first (3 failures = the defects above) and then against PyJWT (all pass). The older auth, ownership and isolation suites pass unchanged apart from the import and an added `exp` in one helper.
  `pip-audit`: **No known vulnerabilities.** The sign-in contract with Supabase is unchanged (same tokens); a managed-Supabase check of real GoTrue tokens (G2) is still outstanding.
* Secrets: the production bundle and every tracked or new file were scanned for the actual values in the local `.env` files and for key patterns — only the public anon key is in the bundle (protected by RLS by design). Fail-closed behaviour is preserved and tested (startup refuses without core config; unknown crops, unverified soil, missing rules, bad tokens, missing tables all refuse).
* **Rotate/confirm:** `.env.local` (frontend env file) contains a `SENTINEL_HUB_CLIENT_ID`. It is not exposed (Vite only ships `VITE_*`) but does not belong there.

## 8. Required decisions, credentials and setup — by owner

### 8.1 Agronomist (G1)
Complete [AGRONOMIST_REVIEW_CHECKLIST.md](AGRONOMIST_REVIEW_CHECKLIST.md) (round 3 added D12–D17: soil-test adjustment, palm-age convention, article-as-source, regional applicability, organic manure, reuse permission; start from the oil-palm and coconut candidate records): decisions **D1–D11** (source per crop; whether the 1:1 sufficiency-target model is acceptable; the **elemental-vs-oxide basis of each laboratory's soil-test P and K**; sign-off of the P₂O₅/K₂O conversion; product label grades against the Fertiliser (Control) Order; loss factors; stage/region/per-plant units; timing; pH/OC handling; whether yield/ROI are ever shown; which crops/regions to serve), fill and sign each crop's sheet, then a developer adds the record and a test pinning the real citation. Candidate material from the only lab card in the repository is in `data/candidate_rules/` — **pending review and not usable as a source** (unnamed publication, crop not in the engine, copyright disclaimer).

### 8.2 Project owner
1. **Disposable Supabase project (G2):** create it, apply 001–013, run `npm run verify:remote` and the manual checks in `SCRATCH_SUPABASE_VERIFICATION.md` (email confirmation, Google sign-in, real JWT/JWKS), then deploy the backend against it and run `npm run smoke:staging` with an authorized real report. Apply 013 before the backend.
2. **Authorized soil reports (G3):** ≥ 30 per report type (scans, phone photos, several laboratories, P₂O₅/K₂O-printing and other-unit reports), each with the farmer's/lab's permission recorded and a person-verified ground truth, into `backend/eval/manifest.json` (format and the exact list in `eval/README.md`). Also record the permission for the one card already there, or remove it.
3. **Sentinel Hub (G4):** create a new OAuth client (dashboard → User settings → OAuth clients; client-credentials), put the id and secret in `backend/.env` only, run `python scripts/check_sentinel.py --lon <lon> --lat <lat>`; NDVI is operational only when it exits 0.
4. **Deployment (G5):** reverse proxy (TLS, body ≥ 25 MB on upload, upstream timeout ≥ 200 s), edge rate limiting, secret store, `ENVIRONMENT=production`; sizing/load test; run the container with the limits in `backend/docker-compose.example.yml`.
5. Kannada review of the `p3.*` strings (first draft). Decide whether to backfill `verification_status` for legacy soil reports you have independently checked (the migration deliberately does not).
6. The repository has no commits from this work: review the working tree and commit/branch as you prefer. Docker Desktop was started for the container check and left running.

## 9. Phase checklist

| Phase | State |
|---|---|
| 1 Audit and baseline | done (this document) |
| 2 Protect the Digital Twin | twin code untouched except: verified-only soil card and the new panel; regression via the existing twin tests + E2E |
| 3 OCR + recommendation pipeline | done, with the rule-pack blocker |
| 4 Digital Twin integration | done (panel, applications, history) |
| 5 Remove unrelated features | done |
| 6 Security / migrations / deployment | done locally; hosted verification outstanding |
| 7 Full regression / real-data verification | local suites run; real-data and managed-infrastructure verification outstanding (§0) |

## 10. Round 2 — what was resolved, and how

| Item | Outcome |
|---|---|
| Fertilizer **unit basis** (task 1.2) | **Fixed in code.** P = 0.4364 × P₂O₅ and K = 0.8302 × K₂O derived from atomic weights and cross-checked against published tables; the catalog stores labelled grades; `NutrientBasis` is explicit end to end; the DAP-credit test that had encoded the old bug was rewritten; dose output records its basis. Old behaviour under-dosed elemental P by 2.29× and K by 1.20× |
| Invented product composition | `organic_compost` (made-up N/P/K %) removed |
| **Rule validation** (1.6) | `rule_provenance.validate_record` + CLI `check`; 70 tests cover missing citations, bad units, basis mismatches, number mismatches, implausible/NaN/negative numbers, contradictory pH, duplicate crops, pending status, test fixtures refused outside development, malformed packs |
| Candidate rules from repository documents (1.9) | Extracted with page references and exact short quotes into `data/candidate_rules/hegde_card_arecanut.json`, labelled `pending_review`, never loaded, and shown by a test to be unactivatable. **No approved record exists; `verified_rules.json` is still empty** |
| Agronomist checklist (1.8) | `AGRONOMIST_REVIEW_CHECKLIST.md`: 11 decisions, procedure, per-crop sheets generated from the catalog (a test fails if they drift), record template |
| **OCR evaluation** (task 2) | Manifest schema v2 with validation (authorization, verifier, SHA-256 of the document, units, known parameters); metrics: numeric/unit accuracy, completeness, review routing incl. `AUTO_WRONG`, Wilson intervals, `INSUFFICIENT SAMPLE`; tests for negative signs, lost decimals, ambiguous units, missing values, scanned vs digital. The manifest no longer invents a verification date (`recorded_on`) and says authorization is unconfirmed |
| **Database** (task 3) | Migration order/dependencies tabulated and checked; 013 proven additive on a populated 001–012 database; `verify:remote` extended to 012/013 and its mutations documented; managed check **blocked** |
| **Sentinel** (task 4) | Diagnosed with safe metadata only; app moved to the documented token endpoint; error messages distinguish rejected credentials from network failure without leaking anything; diagnostic script; live auth **still fails** |
| **Docker** (task 4) | Built and run; OCR binaries, health, non-root, read-only, resource caps and real OCR verified; a `useradd` warning fixed; compose example added |
| **Token security** (task 5) | python-jose/ecdsa replaced by PyJWT; 3 latent defects fixed; 28 attack tests |
| **Staging workflow** (task 6) | `staging-smoke.mjs` covers: failed OCR creates no verified report, review gate, verified report persistence, cited-or-insufficient recommendation, recommendation ≠ application, plot history, cross-farmer denial. Self-tested on the emulator; **not run on infrastructure** |

## 11. Evidence for each integration claimed

| Integration | Claimed state | Evidence | Not claimed |
|---|---|---|---|
| Tesseract/Poppler OCR | works (local and in the container) | pytest with real Tesseract; Docker OCR smoke; `/health/ready` | accuracy on real scans |
| Open-Meteo weather | works | browser E2E, live | – |
| Map tiles / geocoding | works | browser E2E, live | Google Maps (no key) |
| Supabase (emulated) | works | 304 + 21 + 131 + 20 checks on PGlite/emulator | **managed Supabase** |
| Sentinel Hub NDVI | **not operational** | live auth rejected | any NDVI value from this deployment |
| Recommendation engine | arithmetic, gating and persistence verified for both rule kinds; a real, cited recommendation is produced when a (test) rule is active | unit/rule/API tests, smoke self-test | any agronomically approved dose: **no active rule exists** |
| Fertilizer sources (S1–S7) | read from the publishers' PDFs and pages and verified visually | [FERTILIZER_SOURCES.md](FERTILIZER_SOURCES.md) | agronomist approval; reuse permission; current FCO Schedule I |
| Hosted deployment | none | – | everything |

## 12. Go/no-go checklist

| Criterion | Met? |
|---|---|
| Approved, cited rules for the crops to be served | **No** (G1) — source-backed candidates for oil palm and coconut await approval |
| A real recommendation can be generated end to end once a rule is approved | Yes (tested with labelled fixture rules; never with an approved real rule) |
| Migrations 001–013 and RLS verified on a managed Supabase project | **No** (G2) |
| OCR accuracy measured on ≥ 30 authorized, verified reports per report type | **No** (G3) |
| Live NDVI verified | **No** (G4) |
| Staging workflow run on real infrastructure; proxy/TLS/rate limits in place | **No** (G5) |
| Secrets absent from bundle/repo; fail-closed auth; token attack suite; dependency audits clean | Yes |
| Browser E2E, RLS matrix, upgrade safety, container smoke | Yes (local/emulator only) |
| Removed features unreachable; recommendation ≠ application; failed OCR cannot create a verified report | Yes (tested) |

**Decision: NO-GO.** Next action for the owner: commission the agronomist review (G1) and create the disposable Supabase project (G2) — they unblock the most and can run in parallel.

## 13. Round 3 — fertilizer engine completion

Goal: real, explainable, source-backed recommendations from verified soil reports, **without** marking anything approved. Result: the engine path is complete and tested; the only thing between two crops and a live recommendation is an agronomist's decision.

| Item | Outcome |
|---|---|
| **Sources** | Seven documents read and verified (text extracted, tables rendered and read visually): oil palm (Indian Farming 2019), coconut and arecanut (ICAR-CPCRI authors, Indian Horticulture Nov–Dec 2022), the ICAR-CPCRI North East coconut bulletin (2023), an undated arecanut KVK leaflet, soil-fertility ratings (Indian Farming 2020) and the Fertiliser (Control) Order 1985 (consolidated copies). Search snippets were never used as evidence — one snippet gave oil-palm doses in product weights, the document gives nutrients. Unreadable or unreachable sources are listed as unresolved. Register: [FERTILIZER_SOURCES.md](FERTILIZER_SOURCES.md) |
| **Finding that changes the design** | The published recommendations are **doses per palm per year by palm age**, not soil-test sufficiency targets in kg/ha. The original deficit model (target − soil test) has no source support. A second rule kind, `published_schedule`, was added (below); the deficit kind remains, gated, for crops that may one day get a source |
| **Engine** | `schedule_engine.py`: age year from the planting date → per-palm band → × palm count → per ha → products through the existing catalog (labelled P₂O₅/K₂O, DAP nitrogen credited once, MOP). It refuses with named reasons when planting date, palm count, state (region-bound rules) or an in-range age is missing. It never changes the dose from soil-test numbers and says so. `dosage_calculator.plan_from_requirements` was extracted so both models share one unit-safe product calculation |
| **Rule validation** | `published_schedule` records are validated for units (`g/palm/year`), stated basis, age convention, contiguous non-overlapping age bands, plausibility, `soil_test_adjustment: "none"`, optional region list, plus every approval/citation/grade check of the first kind; one record per crop across both kinds. Candidate records for oil palm and coconut validate with **exactly** the three approval problems (status, reviewer, date) |
| **Grades** | FCO 1985 Schedule I Part A minimums for urea (46.00 % N), DAP (18.0 % N, 46.0 % P₂O₅), MOP (60.0 % K₂O) and SSP (16.0 % P₂O₅) were read and are recorded in the catalog with the caveat that the copies are older consolidated texts. NPK 19:19:19 stays unconfirmed |
| **API / persistence** | Same `POST /api/recommendations`; no migration (`provenance` jsonb carries the schedule arithmetic); engine `rec-2.2`; rule kind, version and citation stored with each row. Plot reads now include `planting_date`, `plant_count`, `state`. Ownership, verification, rate-limit and refusal-saves-nothing behaviour unchanged and re-tested |
| **Frontend** | Recommendation screen shows palm age, palm count, per-palm grams (N / P₂O₅ / K₂O), per-palm product grams, quoted timing and the "soil values did not change the dose" note; no "adequate/deficient" badge for schedule advice. English + Kannada (Kannada is a first draft needing native review) |
| **Crops for which a real recommendation can be generated today** | **None.** No rule is approved. With an approved record oil palm and coconut would work immediately (tested end to end with labelled fixture rules) |
| **Not resolved (need an agronomist or the owner)** | D2 model choice; D12 soil-test adjustment (none applied); D13 age convention; D14 article-as-source; D15 region (the NE-India coconut bulletin disagrees with the general table, and disagrees with itself: 690 g vs 500 g N); D16 organic manure; D17 reuse permission; D11 arecanut as an engine crop; no source at all for rice, maize, sugarcane, banana |

**Decision after round 3: still NO-GO.** The sources and the engine path exist; the approval, the managed-database check, the real-data OCR measurement, live NDVI and the hosted checks do not. Next owner action: put the oil-palm and coconut candidate records in front of an agronomist (open questions are listed in each file) and, in parallel, create the disposable Supabase project.
