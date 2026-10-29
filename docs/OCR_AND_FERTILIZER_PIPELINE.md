# OCR and fertilizer-recommendation pipeline

This is the contract between the soil-report reader and the recommendation engine, and the rules each stage enforces.
It describes what the code does today; where something is not verified, it says so.

```text
Upload → file checks → text layer / OCR → parse → validate → [review] → verified soil report → rule gate → recommendation
 (HTTP)   (router)      (ocr/pipeline)   (extractor) (validator)  (owner)   (soil_reports)     (rule_provenance) (engine)
```

Code map: `backend/app/routers/soil_reports.py` (HTTP), `app/services/soil_extraction_service.py` (review/confirm rules, persistence),
`app/ocr/*` (reading), `app/services/rule_provenance.py` (rule gate), `app/routers/recommendations.py` + `app/services/*` (engine).

## 1. Processing states

| State | Meaning | Stored? | Soil report exists? |
|---|---|---|---|
| `failed` | Nothing usable was read (corrupt file, too many pages, OCR engine missing, timeout, no text) | **no** | no |
| `needs_review` | Text was read, but at least one required value is missing, uncertain, repaired, or impossible | yes, in `soil_report_extractions` | **no** |
| `completed` | Every required value was read clearly **and** validated, or the owner confirmed/corrected the rest | yes | yes (`soil_reports.verification_status` set) |

Required parameters: nitrogen, phosphorus, potassium (kg/ha), pH, organic carbon (%). Optional: electrical conductivity (dS/m) and the
micronutrients Zn, Fe, Mn, Cu, B, S (mg/kg). Oxide forms (P₂O₅, K₂O) are kept as extras and never converted.

Processing is synchronous inside the request (the work runs in a worker thread so the event loop is not blocked). A queue was **not**
added: the file limit is 20 MB / 15 pages and the measured workload does not justify extra infrastructure. Bounded concurrency
(`OCR_MAX_CONCURRENT`, waiting up to `OCR_QUEUE_WAIT_SECONDS`, then `503` + `Retry-After`) and a per-account rate limit protect the CPU.
If real traffic shows long OCR times, move `ingest_upload` behind a job queue; the `needs_review`/`completed` states already fit that.

## 2. Stage by stage

### 2.1 File checks (router)
Declared type ∈ {PDF, JPEG, PNG}; the first bytes must match the declared type (a text file renamed `.pdf` is refused, `415`); empty → `422`;
over `MAX_UPLOAD_MB` (default 20) → `413`, aborting while streaming. The file is processed **in memory and never written to disk**, so the
client file name cannot cause path traversal; it is reduced to its last path segment, stripped of control characters, truncated to 255 chars
and stored as metadata only. The original document is **not retained** (privacy-minimising choice); it is identified by its SHA-256.

### 2.2 Reading (`app/ocr`)
Per page: if the PDF has a text layer (≥ 40 non-space characters) it is used directly; otherwise the page is rasterised (Poppler, 300 dpi),
cleaned (grayscale, upscale, contrast, threshold) and read with Tesseract in **one** pass (`image_to_data`; text and mean word confidence come
from the same run — earlier code ran Tesseract twice). Limits: pages ≤ `OCR_MAX_PAGES` (15), each page ≤ `OCR_PAGE_TIMEOUT_SECONDS` (60), whole
document ≤ `OCR_TOTAL_TIMEOUT_SECONDS` (180), image pixels ≤ 50 M (decompression-bomb guard). A timeout fails the **whole** document: a
partial read could silently drop the page that holds a value. A missing Tesseract/Poppler binary is reported as an error, never as an empty
success. A page that could not be read prevents `completed`.

### 2.3 Parsing (`extractor.py`)
A number is accepted only when it directly follows a recognised label (possibly on one of the next three lines). Bare "N/P/K/S/B" labels are
accepted at low confidence. Every extracted field carries:

| Field | Meaning |
|---|---|
| `value`, `unit` | parsed value (a bound such as `>5` stays a string); unit |
| `extracted_text` | the numeric token exactly as read |
| `source_text`, `page` | the matched line(s) (≤ 200 chars) and 1-based page |
| `confidence` | label-match confidence × OCR page confidence |
| `unit_source` | `stated` (found next to the value), `assumed_default` (the parameter's usual unit, **not read**), `not_applicable` (pH) |
| `normalizations` | any automatic repair applied to the text this value came from |
| `validation`, `warnings` | see 2.4 |

Automatic repairs exist because real OCR needs them (the test suite reproduces Tesseract reading `0.71` as `0.7/1`), but a repaired value is a
guess, so it is **recorded and forced to review**: slash removed between digits, `./`→`.7`, look-alike letters→digits, a value taken from a
neighbouring line, or a second, different value found for the same parameter. A minus sign directly attached to a number
(`Nitrogen: -245`) is **kept** (earlier code silently dropped it, turning a negative reading into a plausible positive one); the validator then
rejects it. The Unicode minus (U+2212) is treated as `-`.

### 2.4 Validation (`validator.py`)
Order of checks; the first that fires decides the status:

1. no value → `missing` (never `0`)
2. not numeric → `unusable`
3. outside the **hard** range → `unusable`
4. any automatic repair / neighbouring-line value / conflicting second value → `review`
5. a bound (`>5`, `<0.1`) → `review` (not an exact measurement)
6. unit not stated next to the value → `review` ("do not assume units")
7. stated unit differs from the parameter's unit (equivalents only: mS/cm = dS/m, ppm = mg/kg) → `review`; **never auto-converted**
8. outside the **typical** range → `review`
9. confidence < 0.65 → `review`
10. otherwise `valid`

| Parameter | Unit | Hard range (unusable outside) | Typical range (review outside) |
|---|---|---|---|
| Nitrogen / Phosphorus / Potassium | kg/ha | 0–2000 / 0–500 / 0–1500 | 20–800 / 1–200 / 20–900 |
| pH | – | 0–14 | 3.5–10 |
| EC | dS/m | 0–50 | 0–8 |
| Organic carbon | % | 0–100 | 0–10 |
| Zn, Fe, Mn, Cu, B, S | mg/kg | wide physical backstops | heuristics |

**Provenance of these ranges:** the hard ranges are physical-plausibility bounds (pH is 0–14 by definition; a percentage cannot exceed 100).
The typical ranges are engineering heuristics chosen to flag unusual readings for a human glance; **they are not agronomic thresholds and carry
no citation.** They only ever route a value to review; they never decide a recommendation.

### 2.5 Review and correction
`POST /api/soil-reports/extractions/{id}/confirm` with `{corrections: {param: {value, unit, reason?}}, confirmed: [param, …]}`.

* `confirmed` accepts a `review` value **exactly as read**; it is allowed only if the value is an exact number, in the parameter's own unit
  (or the unit was merely assumed), and inside the hard range.
* A bound (`>5`), a stated foreign unit, an `unusable` value or a missing value **cannot be confirmed** — only corrected.
* A correction must be finite, in the parameter's unit (the unit must be given for non-pH parameters), and inside the hard range.
  No conversion is ever done.
* Optional parameters the owner does not confirm are left out of the soil report (`not_saved` lists them).
* Every correction appends `{parameter, original_value, original_text, original_unit, corrected_value, unit, reason, at}` to
  `soil_report_extractions.corrections` — the original reading is never overwritten. `verification_status` is `user_corrected` if any
  correction exists, else `user_confirmed` if any uncertain value was confirmed, else `auto_validated`.

### 2.6 Persistence, idempotency, atomicity
* One row per `(owner, plot, SHA-256)` (unique index). Uploading the same document again returns the stored extraction (`reused: true`) and
  **does not run OCR**. Simultaneous identical uploads are serialised in-process so OCR runs once; across workers the unique index decides.
* Supabase's REST API has no multi-statement transaction. The soil report is inserted first; the extraction is then closed by a single
  `UPDATE … WHERE status = 'needs_review'`. If that update fails or loses a race, the new soil report is deleted again, so no verified
  report outlives a failed close (tested). `soil_reports.extraction_id` links the report to its extraction.
* Only the backend (service role) can create rows that carry `verification_status`/`extraction_id`: migration 013 makes the row-level-security
  policies reject browser writes that set them, and recommendations refuse a soil report whose `verification_status` is NULL.

### 2.7 Soil-report API summary
| Method | Path | Notes |
|---|---|---|
| POST | `/api/soil-reports/upload` | multipart `plot_id` + `file`; `200` with `status` ∈ failed/needs_review/completed |
| GET | `/api/soil-reports/extractions?plot_id=` | the caller's extractions for one plot (newest first, `limit` ≤ 50) |
| GET | `/api/soil-reports/extractions/{id}` | one extraction; the document text is never re-served |
| POST | `/api/soil-reports/extractions/{id}/confirm` | `422 {code: extraction_not_confirmable, problems}` / `409` if already confirmed |

All require a verified bearer token; another user's plot or extraction is `404`, indistinguishable from a missing one.

## 3. Recommendation engine

`POST /api/recommendations {plot_id, soil_report_id}` (+ optional `fertilizer_price_overrides`).

Order of gates (each failure returns before any number is computed):

1. token valid; plot belongs to the caller; soil report belongs to the caller **and to that plot** (`404` otherwise)
2. soil report has a `verification_status` (else `422 soil_report_not_verified`)
3. the plot has a crop, the crop is in the engine's catalog (oil palm, rice, maize, sugarcane, banana, coconut), **and a verified rule exists
   for it** — otherwise **`200 {state: "insufficient_data", reasons, required}`** and nothing is saved
4. for a *published-schedule* rule (§3.5): the plot has the facts the schedule needs (planting date, palm count, state when the rule is region-bound) and its age is inside the schedule —
   otherwise `200 insufficient_data` naming each missing fact (`planting_date_missing`, `plant_count_missing`, `state_not_recorded`, `region_not_covered`, `planting_date_in_future`, `age_outside_schedule`)

Two rule kinds exist: **sufficiency target** (§3.1-3.4, the original deficit model) and **published schedule** (§3.5, doses exactly as a publication states them).

### 3.1 The rule gate — the honest state of the agronomy
`app/services/crop_rules.py` holds per-crop targets (N/P/K kg/ha, pH range, minimum organic carbon). Its own header calls them "V1 default,
configurable engineering assumptions, not a peer-reviewed agronomic model", and **no source for any of them exists in this repository**
(the only source-like material is a laboratory card that quotes unnamed "State Agricultural Universities"; see
[AGRONOMIST_REVIEW_CHECKLIST.md](AGRONOMIST_REVIEW_CHECKLIST.md) §6). A dose computed from them is arithmetic on assumptions, so the engine does not release one on its own.

`app/services/data/verified_rules.json` is the rule pack. **It ships empty.** A record is activated only if `rule_provenance.validate_record`
finds nothing wrong — complete, `status: approved` with a named reviewer and past date, a traceable source (id, title, publisher, edition, year,
locator, verbatim quote), the crop stage and region it applies to, stated assumptions, units exactly kg/ha and %, the P/K **basis**
(elemental or oxide) equal to the one the engine uses, finite positive plausible numbers **equal** to the catalog values (so the number cited is the number used),
the reviewer's confirmation of the urea/DAP/MOP label grades, exactly one record per crop, and — for records marked `test_fixture` — `ENVIRONMENT=development`.
Anything else is skipped and logged; the crop stays `insufficient_data`. Candidate material (pending review, never loaded) lives in `data/candidate_rules/`.
`covers_yield_and_economics` must be explicitly `true` for yield/revenue/ROI to be shown. `RULE_PACK_PATH` points a deployment at its own pack.
Validate a file without activating it: `python -m app.services.rule_provenance check <file>`.

**Consequence today: every recommendation request returns `insufficient_data`.** Unblocking it is an agronomy task, not a coding task; the
decisions and the procedure are in [AGRONOMIST_REVIEW_CHECKLIST.md](AGRONOMIST_REVIEW_CHECKLIST.md). Source-backed **candidate** records for oil palm and coconut now exist
(pending review, not loaded): see [FERTILIZER_SOURCES.md](FERTILIZER_SOURCES.md) and §3.5.

### 3.2 What a generated recommendation contains
`engine_version` (`rec-2.2`), `generated_at`, `provenance` (crop, area, soil report id and its verification status, the exact soil values used,
the rule citation including stage, region and P/K basis, assumptions, and what was **not** considered: crop age/growth stage, irrigation/rainfall, timing/splitting, previous crop),
nutrient findings, the product plan (kg/ha and kg for the plot, each with the basis its deficit was expressed in), and the explanation. The stored row equals the response (what is shown is
what was saved). Costs appear only for products the caller priced (catalog prices are placeholders, not market data). Yield, revenue and ROI
are omitted unless the rule says its source supports them. The unsourced "split into 2–3 doses" sentence was removed.

### 3.3 Units: elemental vs oxide (resolved in code; the *choice of basis* still needs an agronomist)
Fertilizer labels state N as elemental N but phosphate as P₂O₅ and potash as K₂O (DAP 18-46-0, MOP 60 % K₂O). Elemental P is **0.4364 × P₂O₅** and elemental K is
**0.8302 × K₂O** (stoichiometry from standard atomic weights; agrees with the published 0.436 / 0.830 in Eurofins Agro "Phosphorus (P) versus phosphate (P₂O₅)" and the
Cropaia conversion tables, checked 2026-10-30 — secondary references, but this is arithmetic, not agronomy).

The earlier catalog treated 0.46 and 0.60 as *elemental* fractions. For an elemental-P deficit that under-dosed DAP by **2.29×**, and MOP by **1.20×** for elemental K. This is fixed:

* `fertilizer_catalog.py` stores the **labelled** grade (N, P₂O₅, K₂O) and derives elemental fractions; every conversion takes an explicit `NutrientBasis` (no silent default at the dosing call sites).
* `CropRequirement.p_basis / k_basis` record which basis each crop's targets and soil-test values are on (currently `elemental`, an **unverified working assumption**); `dosage_calculator` converts accordingly and records the basis on each dose.
* A rule record must state `soil_test_basis` and it must equal the engine's; a mismatch blocks activation.
* The invented `organic_compost` product (made-up nutrient percentages) was removed. Tests: `tests/test_fertilizer_units.py`.

**Still open (decision D3):** whether each laboratory's *soil-test* P and K are on the elemental or oxide basis. Reports labelled "(P)" / "(K)" are read as elemental; reports that
print P₂O₅ / K₂O are kept as separate extras and never converted. If a lab's "P" is really P₂O₅, doses are 2.29× too high until the basis for that lab/crop is set.

### 3.4 Known limitations of the engine itself (not fixed — need agronomic judgement)
* The deficit model (target − soil test = nutrient to add, 1:1) ignores soil buffering, fixation, losses and crop removal (D2, D6).
* Crop age/stage and irrigation are not inputs. Application timing, frequency and method are not provided (D7, D8).
* Targets are single numbers per crop, not soil-test-category (low/medium/high) rules as most published recommendations are (D2).
* Product label grades are nominal and were not checked against the Fertiliser (Control) Order schedule (D5).
* Frontend `src/constants/cropBaselines.ts` mirrors the same unsourced targets for display bands; a parity test keeps them in sync.
  They are shown as reference ranges on the soil-report screen only.

### 3.5 Published-schedule rules (`rule_kind: "published_schedule"`)
The sources that could be read and verified (FERTILIZER_SOURCES.md) do not state soil-test sufficiency targets. They state **doses per palm per year by palm age** (oil palm: ICAR Indian Farming 2019; coconut and arecanut: ICAR-CPCRI authors, Indian Horticulture 2022). The schedule engine (`app/services/schedule_engine.py`) uses such a table exactly as printed:

```
age_year        = whole years since the plot's planting date + 1                     (the record's age_basis states this)
per palm        = the schedule band containing age_year    g N, g P2O5-or-P, g K2O-or-K per palm per year  (basis stated by the record)
plot total (kg) = per palm (g) x palm count / 1000                                    (palm count = the plot's recorded plant_count)
per hectare     = plot total / plot area in hectares                                  (acres converted at 0.4046856422)
products        = dosage_calculator.plan_from_requirements(...)
                  DAP = P2O5 / 0.46 (P2O5 basis) ; the DAP's nitrogen (x 0.18) is credited ; urea = remaining N / 0.46 ; MOP = K2O / 0.60
```

Worked example (test fixture numbers, `tests/test_schedule_engine.py`): 2 ha, 500 palms, band 400 / 200 / 400 g -> 200 / 100 / 200 kg for the plot, 100 / 50 / 100 kg per ha -> DAP 108.7 kg/ha (carrying 19.6 kg N), urea 174.9 kg/ha, MOP 166.7 kg/ha.

What it will not do: change the dose from the soil-test numbers (the record must say `soil_test_adjustment: "none"`; the soil values are stored with the recommendation and the response says they did not change the dose), estimate a missing palm count from the area, extrapolate beyond the table's ages, apply losses, or show yield/revenue. The recommendation carries `provenance.schedule` (age year, palm count, per-palm g, basis, per-palm product grams, quoted timing text) and the rule citation including the rule kind. It is stored in the same `recommendations` row (no migration), and the Digital Twin shows it as advice, never as an application.

**State today:** candidate records for oil palm and coconut are complete in this shape and are *not active* (no agronomist approval). Arecanut cannot be served until it is an engine crop (D11). Rice, maize, sugarcane and banana have no source.

## 4. Measured extraction quality
`cd backend && python -m eval.ocr_eval --include-synthetic` (needs the OCR binaries). Dataset and format: `eval/manifest.json` (schema v2, validated, documents pinned by SHA-256), `eval/README.md`.

**Sample size: 1 real document (12 ground-truth fields), 0 scanned, 0 photographed.** The harness reports, per report type and never pooling real with synthetic:
numeric accuracy (a miss counts as wrong), value accuracy among found fields, unit accuracy (only where the report prints a unit beside the value), completeness, and
**review routing** — whether a wrong read was caught by a human or auto-accepted (`AUTO_WRONG`, the dangerous case), with 95 % Wilson intervals, and `INSUFFICIENT SAMPLE` for any report type below 30 documents.

Result recorded on 2026-10-30:

| Set | Documents | Fields | Numeric accuracy (95 % CI) | Unit accuracy, stated units | Completeness | AUTO_WRONG / auto-accepted | Needed a human |
|---|---|---|---|---|---|---|---|
| **Real**, digital_pdf (1 card; `authorization_confirmed: false`) | 1 | 12 | 12/12 (76–100 %) | 6/6 | 12/12 | 0/3 (0–56 %) | 9/12 |
| Synthetic digital_pdf (generated) | 1 | 6 | 6/6 (61–100 %) | 5/5 | 6/6 | 0/6 | 0/6 |
| Synthetic scanned_pdf (generated, real Tesseract) | 1 | 6 | 6/6 (61–100 %) | 5/5 | 6/6 | 0/6 | 0/6 |

These numbers describe those documents. **They are not an accuracy score for the product.** The one real card's ground truth was asserted by the project owner and not
re-checked by a second person; permission to use it for evaluation is not recorded (and the card's disclaimer forbids reproduction without the laboratory's written approval).
The synthetic documents are rendered by the test helpers. The hard cases are exercised separately by `tests/test_eval_harness.py` on generated documents with known truth: a
negative sign (`-245`) and a lost decimal point (`68` for `6.8`) land in `review_wrong`, never in `AUTO_WRONG`; an ambiguous unit (`mg/kg` for N) is read right but sent to a human and counted as a unit miss;
a missing value lowers completeness and numeric accuracy; scanned and digital reports are summarised separately. **What is missing** (≥ 30 per cell: scans, phone photos, multiple laboratories, P₂O₅/K₂O-printing reports, other units, Kannada) is listed in `eval/README.md`.

## 5. Configuration

| Variable | Default | Purpose |
|---|---|---|
| `MAX_UPLOAD_MB` | 20 | upload size limit |
| `OCR_MAX_PAGES` | 15 | page limit |
| `OCR_PAGE_TIMEOUT_SECONDS` / `OCR_TOTAL_TIMEOUT_SECONDS` | 60 / 180 | per page / per document |
| `OCR_MAX_CONCURRENT` / `OCR_QUEUE_WAIT_SECONDS` | 2 / 30 | concurrent OCR jobs per worker / wait before `503` |
| `TESSERACT_CMD`, `POPPLER_PATH` | auto-detect | binary locations (Windows) |
| `RULE_PACK_PATH` | shipped (empty) pack | verified-rule pack (validated; see 3.1) |

No cloud OCR is used or configured; farmers' reports never leave the server. If a cloud OCR provider is added later it must be an opt-in,
documented engine behind `OcrEngine`, with its cost and data-handling stated.
