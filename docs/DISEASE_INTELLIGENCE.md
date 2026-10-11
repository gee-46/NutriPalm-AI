# Disease Intelligence (arecanut and coconut)

Status of this module on branch `phase2/farmer-first-frontend`:

| Capability | State |
|---|---|
| Source-attributed, versioned knowledge base (schema, validation, loader) | **Implemented, locally tested** |
| Evidence quotes machine-checked against the real ICAR-CPCRI documents | **Verified** on 2026-10-11 (42 quotes, 2 documents) |
| Deterministic risk engine, `POST /api/disease/assess` | **Implemented, locally tested** (backend + browser E2E on an emulated Supabase) |
| Management / treatment engine with chemical-safety rules | **Implemented, locally tested** |
| Saved assessments (migration `012`, RLS, history endpoints) | **Implemented**; RLS checked on PostgreSQL 17 (PGlite). **Not** run on managed Supabase |
| Expert (plant pathologist) review of any record | **Pending** — no record is `expert_reviewed` |
| Label / registration check of any pesticide | **Not done** — no product is `label_verified`, so no chemical dose is ever shown |
| Machine-learning model | **None.** The engine is rule-based and says so |

> A result from this module is a **screening**, not a diagnosis. "High" means the observations strongly match what the cited
> sources describe. It does not prove a disease is present.

## 1. Architecture

```text
 DiseaseScreen (React) ── fetches ──▶ GET  /api/disease/vocabulary   symptom / stage / condition lists (data-driven form)
        │                  posts  ──▶ POST /api/disease/assess       run + save an assessment
        │                  reads  ──▶ GET  /api/disease/assessments[/{id}]   the caller's history
        ▼
 app/routers/disease.py            auth (Supabase JWT) · HTTP error mapping · same 404 for "missing" and "not yours"
        ▼
 app/disease/service.py            validate → ownership → normalise → engine → treatment → persist
   ├─ vocabulary.py               literal normalisation of crop / stage / symptoms / parts (no fuzzy matching)
   ├─ assessment.py               deterministic rule engine (RULE_VERSION)
   ├─ treatment.py                management by decision hierarchy + chemical-safety rules
   ├─ knowledge_base.py           loads and validates data/*.json; decides which records are usable
   ├─ provenance.py               quote normalisation + PDF/HTML text extraction used to verify evidence
   ├─ repository.py               PlotContextRepository, AssessmentRepository (Supabase, ownership-scoped)
   └─ schemas.py                  Pydantic models (knowledge base, API, rows)
 app/disease/data/                vocabulary.json · sources.json · diseases.json · chemicals.json   (reviewed in pull requests)
 scripts/verify_disease_sources.py            re-downloads every source and re-checks every quote
 scripts/export_disease_contract_samples.py   writes real backend output for the frontend contract tests
 supabase/migrations/012_disease_assessments.sql
```

The knowledge base is read-only catalogue data shipped with the backend, versioned by `kb_version` and each record's
`record_version`. It is **not** stored in per-user tables. Only the user's own assessments live in the database. Adding a crop
means adding records and vocabulary entries; no frontend code changes (the form is built from `/api/disease/vocabulary`).

Distinctions kept explicit in every response: **observed** (what the farmer reported, `observed`), **derived** (risk level,
candidate ranking), **recommendation** (`treatment.steps`, `chemical_management`), **authoritative evidence** (`evidence[]` with
document, page, URL and verbatim quote), and **catalogue data** (`kb_version`, `rule_version`).

## 2. API

All routes need a verified Supabase bearer token. A plot or assessment that does not exist and one that belongs to someone
else return the **same** `404`, so ownership cannot be probed.

### `POST /api/disease/assess` → `201`

Request (illustrative example; field limits are enforced):

```json
{
  "plot_id": "<uuid of one of your plots>",
  "crop": "coconut",
  "crop_stage": "adult",
  "symptom_codes": ["spear_leaf_withering", "spindle_pulls_out"],
  "symptoms": ["free text is matched literally against the vocabulary"],
  "affected_parts": ["crown"],
  "context": { "high_rainfall_area": "yes", "rhinoceros_beetle_damage": "unknown" },
  "severity": "mild | moderate | severe",
  "duration_days": 12,
  "observation_date": "2026-10-01",
  "observations": "free text, stored but not used by the rules",
  "weather": { "source": "Open-Meteo", "temperature_c": 24, "humidity_pct": 90 }
}
```

Response (shape; real output is committed in `src/__tests__/fixtures/disease-assessment.*.sample.json`):

```json
{
  "assessment_id": "uuid | null",
  "plot_id": "…", "crop": "coconut",
  "risk_level": "low | moderate | high | insufficient_evidence",
  "risk_explanation": "…",
  "candidates": [{
    "rank": 1, "disease_id": "coconut_bud_rot", "disease_name": "Bud rot of coconut", "scientific_names": ["Phytophthora palmivora"],
    "risk_level": "high", "matched_symptoms": ["…"], "first_or_characteristic_matches": 2,
    "supportive_conditions": ["…"], "contradicting_observations": [], "contributing_factors": ["…"],
    "evidence": [{ "description": "…", "source": "institution — title (date), p. 1", "url": "https://…", "page": 1, "quote": "verbatim text" }],
    "management": ["…"], "precautions": ["…"],
    "treatment": {
      "steps": [{ "category": "monitoring_and_confirmation", "text": "…", "evidence": ["…"] }],
      "chemical_status": "not_applicable | verification_required | institutional_recommendation_only | verified_available",
      "chemical_management": [{ "product_name": "…", "status": "…", "actionable": false, "reported_recommendation": "…", "message": "…" }],
      "referral": "…"
    },
    "is_confirmed_diagnosis": false
  }],
  "observed": { "kind": "farmer_reported", "symptoms": [{ "code": "…", "label": "…" }], "plot_state": "read from the plot row" },
  "inputs_used": ["…"], "inputs_not_used": ["…"], "limitations": ["…"], "missing_inputs": ["…"],
  "follow_up_questions": ["…"], "next_steps": ["…"],
  "kb_version": "0.1.0", "rule_version": "1.0.0", "expert_review_status": "pending", "assessed_at": "ISO-8601", "disclaimer": "…"
}
```

Errors: `401` missing/invalid token · `404` unknown or foreign plot/assessment · `422` invalid request (unsupported crop, unknown symptom
code, unknown field-condition key, a plot recorded with a different crop, future date, out-of-range values) · `503` database or knowledge
base unavailable (no internals in the body). If saving fails the result is still returned with `assessment_id: null` and a limitation.

Other routes: `GET /api/disease/vocabulary`, `GET /api/disease/assessments?plot_id=`, `GET /api/disease/assessments/{id}`.

The response is a superset of the contract the frontend was already built against (`risk_level`, `candidates[]` with `disease_name`,
`contributing_factors`, `evidence[{description, source}]`, `management`, `precautions`, `limitations`, `missing_inputs`, `assessed_at`).
The frontend validators (`src/lib/phase2/validate.ts`) accept both and **refuse** a response that claims a confirmed diagnosis or an
actionable chemical without a verified label.

## 3. Knowledge-base schema (`app/disease/schemas.py`)

* **SourceDocument** — id, institution, title, authors, publication, publication date, `https` URL, document type, `tier` (1 = ICAR-CPCRI … 7 =
  label/regulatory), geographic scope, target crops, `retrieved_on`, and `verification` (status, `checked_at`, `sha256` of the retrieved file, page count).
* **EvidenceItem** — source id, page, locator, a verbatim `quote` (25–600 chars), the author's `paraphrase`, and `verified` (set only by the script).
* **DiseaseRecord** — stable id, name, local names, scientific names (each with evidence), crops, category, affected parts, symptom links
  (`specificity`: `first_or_characteristic` only when the source says first / initial / characteristic, otherwise `reported`), excluded symptoms,
  risk conditions, crop stages / any-stage evidence, geographic applicability, severity notes, management items (category, crops, evidence),
  chemical product ids, evidence list, `record_version`, `status` (`draft` → `source_verified` → `expert_reviewed`), expert review, `last_verified`.
* **ChemicalProduct** — kept separate from disease text: product, active ingredient, formulation, concentration, target diseases and crops
  **named by the evidence**, `status` (`label_verified` | `institutional_recommendation` | `verification_required`), `reported_use`, `label`
  (registration reference, label reference, method, rate + unit, timing, safety instructions, restrictions, market, verified-on, valid-until, verifier),
  evidence, version, review status.

Loader rules (all tested): unique ids; every reference resolves; symptom / condition / stage codes exist in the vocabulary; evidence page ≤ document
pages; a source that is about arecanut cannot back a coconut record; `source_verified` requires every quote verified; `expert_reviewed` requires an approved
named review; `label_verified` requires complete label details, a positive rate with units, approval and named registered crops; an institutional
recommendation may not carry label details; a disease can list a product only if the product lists the disease. Unverified records load (so they can be
reviewed) but are never used.

## 4. Evidence: what was actually verified

Two documents were downloaded on **2026-10-11** and every quote below was checked mechanically against the extracted page text
(`python scripts/verify_disease_sources.py`; result: *all quotes verified*; `sha256` recorded in `sources.json`):

| Source | Tier | Quotes |
|---|---|---|
| Hegde V., Josephrajkumar A. (2022) *Crop protection: integrated management of pests and diseases for the successful cultivation of coconut, arecanut and cocoa*. **Indian Horticulture** (ICAR), pp. 59–65. ICAR-CPCRI, Kasaragod. https://epubs.icar.org.in/index.php/IndHort/article/download/129751/48484/472822 | 1 | 35 |
| CPCRI **Extension Folder No. 17**, *Koleroga (Mahali) of arecanut* (Aug 1989). https://cpcri.gov.in/filemgr/webfs/publication/ext17.pdf | 1 | 7 |

Records built from them (all `source_verified`, expert review **pending**): coconut bud rot; coconut Ganoderma wilt (basal stem rot / Thanjavur wilt);
coconut lethal wilt (reported from Tamil Nadu); arecanut fruit rot (Koleroga / Mahali); arecanut bud rot and crown rot; arecanut Ganoderma basal stem rot.

Deliberate gaps (the sources do not give what a rule needs, so nothing was invented): yellow leaf disease and root (wilt) of coconut/arecanut, leaf blights
and inflorescence die-back (no symptom descriptions in the verified sources); **no numeric weather thresholds** (the sources describe conditions only in
words, so weather values are stored but never change a result); no ICAR-IIHR, state department, KVK, peer-reviewed or product-label sources have been
ingested; no CIB&RC registration or product label has been checked.

## 5. Ingestion and verification process

1. Obtain the document from an authoritative source (see the priority list in the task: ICAR-CPCRI → other ICAR → state departments → KVK → peer-reviewed
   → official labels). Do not use a document you cannot download and read.
2. Add the `SourceDocument` to `sources.json` (leave `verification.status` as `unverified`).
3. Add or extend a `DiseaseRecord` / `ChemicalProduct`. Copy each `quote` **verbatim** from the page text; write the `paraphrase` yourself. Mark a symptom
   `first_or_characteristic` only if the source says so. For crops the source does not name, leave `target_crops` empty.
4. Run `python scripts/verify_disease_sources.py --write`. It downloads the sources, checks every quote on its cited page (layout noise such as hyphenation and
   column breaks is normalised; changed words fail), records the file hash, and sets `source_verified` only when everything passes. A changed file hash makes the
   source `failed` until the quotes are re-checked.
5. A domain expert may then set `expert_review` (named reviewer + date) and `status: expert_reviewed`. Only a named person may do this; the script never does.
6. Run the backend tests and regenerate the frontend fixtures (`python scripts/export_disease_contract_samples.py`); a test fails if they are stale.

## 6. Risk-assessment methodology

Inputs come from the farmer (symptom codes, stage, parts, yes/no/not-sure field conditions, severity, duration) plus the **plot's state read from the database**
(never from the request). Missing inputs stay missing and are listed. For every `source_verified` record of the requested crop, the engine counts:

* **F** — reported symptoms the source calls first / initial / characteristic for that disease
* **R** — reported symptoms the source merely lists
* **C** — field conditions the farmer answered *yes* that the source links to the disease (*no* and *not sure* never count)
* **X** — contradictions: a reported symptom the source lists against the disease; a crop stage the source does not cover (unless any-age evidence exists);
  a plot state outside the regions the source reports the disease from

| Candidate level (before X) | Rule |
|---|---|
| `high` | F ≥ 1 and (F + R ≥ 2 or C ≥ 1) |
| `moderate` | F ≥ 1, or R ≥ 2, or (R = 1 and C ≥ 1) |
| `low` | R = 1 and C = 0 |
| `insufficient_evidence` | nothing matched |

Each contradiction lowers the level one step. Candidates are ranked by level, then F, then F + R, then C, then disease id (deterministic). The overall result is the
best candidate's level. Weather values, severity and duration are recorded but **do not** move the category.

**Category meaning** (also shown to the user): `low` — the information fits a disease only weakly; `moderate` — the information fits a disease, so watch
and confirm; `high` — the information strongly matches a disease the sources describe, so confirm soon; `insufficient_evidence` — the tool cannot assess (no
verified knowledge for the crop, no symptom, or no match). It is **not** "healthy". No number is presented as a probability or confidence.

## 7. Treatment and management rules

Guidance follows the hierarchy: monitoring and confirmation → preventive → cultural → field sanitation → irrigation / drainage / field → biological →
chemical. Each step carries its evidence. Chemicals are stored apart from disease text and governed by code (`treatment.py`) and tests:

* A dose appears only for a `label_verified`, approved, unexpired product whose registered crops include **this** crop and whose targets include **this**
  disease. Approval for another crop or disease is never carried over. **No shipped product is label-verified, so no dose is ever returned.**
* An `institutional_recommendation` (an authoritative institute recommends it; label not checked) is reproduced as "as reported by the source" text only
  (concentration, method, timing exactly as written), `actionable: false`, with a "not label-verified" message. NutriPalm never calculates a pesticide dose.
* Anything else is `verification_required`: the product may be named; no dose, rate, interval or mixture is shown.
* Every treatment block ends with a referral to a qualified agricultural officer / KVK.

Shipped chemical records: *Bordeaux mixture 1 %* and *mandipropamid 23.4 % SC 0.5 %* (arecanut fruit rot only) as institutional recommendations; *hexaconazole 5EC*
for Ganoderma as `verification_required` because the source passage does not say which crop each treatment is for.

## 8. Authentication and ownership

* Supabase JWT verification as for the other routes (HS256 or JWKS). The FastAPI backend uses the **service-role** key, which bypasses RLS, so ownership is
  enforced explicitly: the plot's `owner_id` must equal the token subject, saved rows are written with the token subject as `owner_id`, and every history query is
  filtered by it. Client-supplied `owner_id`, `user_id`, `state` or region fields are ignored.
* Migration `012_disease_assessments.sql`: RLS — select own; insert only with `owner_id = auth.uid()` **and** an own plot; delete own; **no update** policy
  (history is immutable); crop and risk level are constrained by `CHECK`; cascade on plot/profile delete. Checked in `supabase/tests/verify.mjs`
  (cross-user read/update/delete/insert, forged owner, unsupported crop, immutability).
* The knowledge base is public to authenticated users only (`/vocabulary` needs a token); there is no write path to it from the API.
* Free text is stored but not used by the rules, is length-limited, is returned only as JSON (never echoed into explanations) and is not written to logs.

## 9. Database migration

`supabase/migrations/012_disease_assessments.sql` — idempotent (`if not exists`, `drop policy if exists`). Apply it after `001`–`011`.
`cd supabase/tests && npm run verify` applies all migrations to a clean PostgreSQL 17 (PGlite), re-runs the latest to prove idempotency, and runs the attack
matrix. It does not prove behaviour on managed Supabase (see `docs/SCRATCH_SUPABASE_VERIFICATION.md`).

## 10. Configuration

No new environment variables and no new credentials. The module makes **no external calls at request time** (the knowledge base is local; the source documents
are fetched only when you run the verification script). No paid API or model is used.

## 11. Tests and results

Run on the audit machine on 2026-10-11 against the final code:

| Suite | Command | Result |
|---|---|---|
| Disease backend (knowledge base, engine, treatment, API/security, contract fixtures) | `cd backend && python -m pytest tests/disease` | **158 passed** |
| Whole backend | `cd backend && python -m pytest` | **335 passed, 6 failed** — the same 6 real-OCR tests that need Tesseract/Poppler (unchanged) |
| Frontend (validators, contract fixtures, component states, Kannada, translation stability) | `npm test` | **74 passed** |
| Build / lint / hardcoded-string scan | `npm run build`, `npm run lint`, `npm run i18n:scan` | passes / 0 errors / 0 literals |
| Migrations + RLS | `cd supabase/tests && npm run verify` | **236 / 236** (mutation run `WEAKEN=1`: 21 expected failures) |
| Browser E2E, two users (emulated Supabase stack) | `cd supabase/tests && npm run e2e` | **158 / 158** — includes the full disease flow: validation, real assessment, saved + reopened history, insufficient evidence, and user B's attacks on the disease endpoints and table |
| Source verification (network) | `cd backend && python scripts/verify_disease_sources.py` | all 42 quotes verified (2026-10-11) |

Mutation checks were run on the engine: removing the ownership check, relaxing the chemical crop check, or loosening the `high` rule each makes tests fail.

## 12. Known limitations

* Only six diseases from two documents; coverage is narrow and says so (`insufficient_evidence` is the honest answer for everything else).
* Symptom matching is literal; free-text typos are not guessed. Farmers must choose from the symptom list for reliable results.
* No numeric weather / soil / NDVI rules, because the verified sources give none. Those inputs are accepted but reported as "not used".
* Records are source-verified, **not expert-reviewed**. A wrong or outdated statement in an authoritative source would be reproduced faithfully.
* No pesticide label or registration (CIB&RC) was checked; all chemical information is institutional text or `verification_required`.
* Advice sentences come from English sources; the interface is bilingual but the server's sentences, quotes and source titles are English (the UI says so in Kannada).
* No image-based assessment. No machine-learning model.
* Verified on an emulated Supabase stack and PostgreSQL 17 (PGlite), not on a managed Supabase project.

## 13. Future work

Ingest ICAR-IIHR, state horticulture department, KVK and peer-reviewed sources; add symptom descriptions for yellow leaf disease, root (wilt) and leaf blights;
have a plant pathologist review each record; verify product labels / registrations for the target crops; add quantitative environmental rules where a source
gives thresholds; add locale-keyed advice text so Kannada users receive translated sentences; add new crops through the same data files; scheduled re-verification
of source hashes.

## 14. Run it locally

```bash
cd backend && python -m uvicorn app.main:app --reload          # API at http://127.0.0.1:8000  (docs at /docs)
npm run dev                                                      # frontend at http://localhost:5173 -> Disease Intelligence
cd backend && python -m pytest tests/disease                     # module tests
cd backend && python scripts/verify_disease_sources.py           # re-check every quote against the sources (needs network)
cd backend && python scripts/export_disease_contract_samples.py  # regenerate the frontend contract fixtures
cd supabase/tests && npm run verify && npm run e2e               # RLS matrix and browser E2E (see SETUP.md for E2E prerequisites)
```
