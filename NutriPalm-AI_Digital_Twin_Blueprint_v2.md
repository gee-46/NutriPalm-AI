# NutriPalm AI — Temporal Digital Twin Blueprint (v2, revised)

**Assigned task**: Improve Digital Twin capabilities using temporal satellite, weather, and field data.
**Target repo**: `gee-46/NutriPalm-AI`
**Supersedes**: Reframes the earlier 5-item geospatial blueprint — GPS boundary, basemaps, cadastral, Sentinel-2, and weather are now *inputs* to this single outcome rather than parallel standalone integrations.
**Status**: Revised draft — v1 reviewed against current repo state, conflicts and execution risks resolved below before handing to agents.

> **What changed from v1**: Section 1.5 (new) documents a direct conflict between this blueprint and already-shipped work, with a resolution. Sections 2.1–2.4 gained explicit contracts (timezone, completeness schema, concurrency) so three parallel agents can't independently improvise inconsistent behavior. Section 6 gained mechanical (not just documented) enforcement for the dosage-logic guardrail. Test tables gained concurrency and edge-case coverage. Nothing in v1's scope changed — this only closes gaps that would otherwise surface as bugs or merge conflicts during agent execution.

---

## Operating principle — read the code before you write any

This applies to every phase and every agent, and it's the reason §1.5 exists at all: v1 nearly shipped a duplicate table because the blueprint was written and would have been executed without first checking what already exists in the repo. The rule going forward:

- **Before any phase starts, the agent reads the actual current state of what it's about to touch** — the real schema (not the schema this doc assumes), the real hook/service code, the real RLS policies, the real test suite — and reports back a short diff against what this blueprint expects. Phase 0 below is this check formalized for the `digital_twins` conflict specifically; the same check applies at the start of every subsequent phase for whatever that phase touches, not just once at the very beginning.
- **This is a gate, not a suggestion**: a phase doesn't start writing migrations or service code until the "what actually exists" check is done and any mismatch is reconciled (either the doc is wrong and gets corrected, or the assumption was right and the agent proceeds). Building against an assumed schema instead of the real one is exactly how §1.5's conflict would have happened silently.
- **When an error surfaces mid-phase — a failing test, a migration conflict, an API returning an unexpected shape — the agent fixes it and continues, rather than stalling on it or working around it silently.** "Tackle and move forward" means: diagnose the actual cause, make the smallest correct fix, re-run the relevant tests, and proceed to the next step — not skip the failing case, not comment out the assertion, not silently swallow the error to make the build green. If a fix isn't obvious or touches something outside the current phase's scope (e.g., a real schema mismatch that changes what Phase 2 should do), that's flagged explicitly and reconciled before continuing — same as any other gate — rather than papered over to hit a milestone.
- Regression suites exist for exactly this: after any fix, the full existing suite (47 baseline, growing per phase per §5) re-runs, not just the test that failed. A fix that's "good enough to pass the one test" but breaks something else is not actually a fix.

---

## 0. What "improve Digital Twin capabilities" actually means here

`DigitalTwinScreen.tsx` already has the right *shape*: a biophysical palm model with hover hotspots (Temperature, Moisture, NDVI, Foliar health), a **Simulation Switcher** toggling **Past / Current / Prediction**, and an NDVI trend chart with 7d/30d/90d filters — all currently running on **mock telemetry**.

The task is to replace that mock layer with a real **temporal data backbone**: three time-series streams (satellite, weather, field) that get fused into per-plot "twin snapshots" over time, so:

- **Past** = actual historical readings pulled from stored time series
- **Current** = latest real readings (satellite pass + weather + most recent soil report)
- **Prediction** = a forward projection computed from the trend in those time series, feeding the existing `yield_predictor.py` / `roi_calculator.py` pipeline

GPS survey and cadastral overlay remain optional/deferred (boundary accuracy, not temporal behavior). Basemaps are cosmetic. **The critical path is: NDVI time series + weather time series + field/soil observation time series → twin snapshot model → prediction.**

---

## 1. Data Architecture — the temporal backbone

Three independent ingestion streams, one fusion layer, one output layer.

```
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  Satellite       │   │  Weather         │   │  Field Data      │
│  (Sentinel-2     │   │  (daily/hourly   │   │  (soil reports,  │
│  NDVI, ~5-day    │   │  observations)   │   │  farmer-logged   │
│  revisit)        │   │                  │   │  events)         │
└────────┬─────────┘   └────────┬─────────┘   └────────┬─────────┘
         │                      │                       │
         ▼                      ▼                       ▼
┌────────────────────────────────────────────────────────────────┐
│              twin_snapshot_service.py (NEW)                    │
│  Aggregates all 3 streams per plot per time-bucket (daily)     │
│  into a fused snapshot — writes to EXISTING `digital_twins`    │
│  table (see §1.5), not a new one.                              │
└────────────────────────┬─────────────────────────────────────--┘
                          │
             ┌────────────┴────────────┐
             ▼                         ▼
   ┌──────────────────┐      ┌──────────────────────┐
   │ Past/Current view │      │ Prediction engine     │
   │ (read snapshots)  │      │ (trend extrapolation, │
   │                    │      │  feeds yield_predictor)│
   └──────────────────┘      └──────────────────────┘
```

**Design principle carried over from the existing backend philosophy**: the current AI/ML layer is a deterministic, rule-based, fully-tested engine — not a black-box model. The prediction engine follows the same pattern: **transparent trend extrapolation** (e.g., linear/seasonal regression on NDVI + weather trend vs. historical yield outcomes), not an opaque ML model, so it stays testable with fixed assertions like the rest of the codebase. An ML upgrade can come later once there's enough real logged data to validate against.

---

## 1.5 Known conflict with shipped work — read this before Phase 2

**The conflict**: `digital_twins` (migration `003_create_digital_twins.sql`) is **already live in the repo** — row-per-snapshot, keyed by `plot_id + analysis_date`, RLS read-only for clients (write access gated via `plots.owner_id` EXISTS subquery), and already wired to `DigitalTwinScreen.tsx` through the `useDigitalTwinSnapshots` hook, with null-safe averaging and empty states verified.

This is, in shape and purpose, the same table v1 of this blueprint proposed creating from scratch as `digital_twin_snapshots`. If an agent executes §2.4 literally, it will create a second, competing table instead of extending the one already wired into the frontend — resulting in two sources of truth, a hook that reads the wrong one, or a silent fork of "current data" logic.

**Resolution — extend, don't recreate:**

- **Phase 2 target is `ALTER TABLE public.digital_twins`, not `CREATE TABLE digital_twin_snapshots`.** Add only the columns that don't already exist: `soil_health_index`, `foliar_health_score`, `data_completeness`. Confirm the exact current column list against migration `003` before writing the migration — don't assume the v1 column list above is accurate for what's already there.
- **Any agent picking up Phase 2 must first run `\d public.digital_twins` (or equivalent) against the actual schema**, not work from this document's assumed shape, and report back the diff before writing the migration.
- The RLS policy already on `digital_twins` (read-only for clients, owner-gated) carries forward unchanged — `ALTER TABLE ... ADD COLUMN` doesn't require new RLS policies, but the migration should include an explicit test asserting RLS still holds post-alter (a column addition shouldn't change access, but this stays cheap insurance against the migration file accidentally including a `DROP POLICY`).
- Rename `twin_snapshot_service.py`'s target references from `digital_twin_snapshots` to `digital_twins` everywhere in this document and in any agent task description.
- **Gate**: before Phase 2 starts, get an explicit yes/no from the lead confirming "extend `digital_twins`" is correct, since this affects the already-shipped hook's return shape (new nullable fields, not new query).

---

## 2. Module-by-Module Changes

### 2.1 Satellite stream (Sentinel-2 NDVI, temporal)

**Backend**
- `backend/app/services/ndvi_service.py` (new): fetch NDVI per plot polygon via Copernicus Data Space Ecosystem / Sentinel Hub / GEE (pick one — see Open Questions).
- Runs as an **async/scheduled job** (Celery beat or a cron-triggered FastAPI background task), not a live request — Sentinel-2 revisit is ~5 days, no reason to poll faster.
- `ndvi_repository.py` (new) stores each reading as a time-series row (not a cache-and-overwrite — the whole point is keeping history for "Past" mode).
- **Missing-geometry contract**: if a plot has neither `boundary_geom` nor a centroid, the service must not silently skip it. It writes/logs an explicit "ingestion skipped: no geometry" event (e.g., to a `field_observations` row of type `other`, or a structured log line an agent can assert against) rather than a no-op with no trace.
- **Timezone**: `captured_date` is the satellite pass date in **IST (Asia/Kolkata)**, not UTC-derived `date(now())`. State this explicitly in code, not just inferred — Sentinel-2 pass timestamps are UTC and naive truncation can shift the date by one day for passes near midnight IST.

**Database**
```sql
CREATE TABLE public.ndvi_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id uuid REFERENCES public.plots(id) NOT NULL,
  captured_date date NOT NULL, -- IST calendar date of the satellite pass, not UTC
  ndvi_mean numeric,
  ndvi_min numeric,
  ndvi_max numeric,
  cloud_cover_pct numeric,
  source text DEFAULT 'sentinel-2',
  is_synthetic boolean DEFAULT false, -- true only for Phase 3 backfilled test data (see §6)
  created_at timestamptz DEFAULT now(),
  UNIQUE(plot_id, captured_date)
);
CREATE INDEX idx_ndvi_plot_date ON public.ndvi_readings(plot_id, captured_date DESC);
```

### 2.2 Weather stream (temporal, not just a cache)

**Backend**
- `backend/app/services/weather_service.py` (new): pulls current conditions **and** backfills/accumulates daily observations (temp, humidity, rainfall, wind, solar radiation — matches the existing "Environmental Snapshot" UI fields) via Open-Meteo / OpenWeatherMap / IMD.
- **History table, not a short-TTL cache** — "Past" mode needs real historical weather, not just "latest known."
- Daily scheduled job appends one row per plot per day (or per weather-grid-cell shared across nearby plots, to cut API calls — see cost note below).
- **Timezone**: same IST-date rule as §2.1 — `observed_date` is the IST calendar day the reading represents.
- **Concurrency**: the daily job and any manual backfill/retry must both go through the same `upsert` path (`INSERT ... ON CONFLICT (plot_id, observed_date) DO UPDATE`), not "insert, catch unique-violation, ignore" — the latter silently drops legitimate corrections on retry.

**Database**
```sql
CREATE TABLE public.weather_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id uuid REFERENCES public.plots(id) NOT NULL,
  observed_date date NOT NULL, -- IST calendar date
  temperature_c numeric,
  humidity_pct numeric,
  rainfall_mm numeric,
  wind_kph numeric,
  solar_radiation numeric,
  source text,
  is_synthetic boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(plot_id, observed_date)
);
CREATE INDEX idx_weather_plot_date ON public.weather_observations(plot_id, observed_date DESC);
```
- **Cost/perf note**: don't call the weather API per-plot if farms are geographically clustered — bucket plots into a coarse grid (e.g., ~1km cells) and share one weather pull per cell per day. Worth a quick design check with backend lead before implementing — flag as a decision point, not something an agent should default silently either way.

### 2.3 Field data stream (soil reports + farmer-logged events)

**Backend**
- Existing `soil_report_repository.py` needs to be **temporal-aware**: "the timeline of soil reports for a plot," not "the current one."
- `field_observations` covers non-soil-report events (fertilizer applied, irrigation, pest sighting) — farmer-logged, optional for v1, schema leaves room for it.
- `observed_at` is a `timestamptz`, not a bare date — field events genuinely have a time-of-day (e.g., irrigation at 6am vs. 6pm matters for correlation with weather), unlike satellite/weather which are daily-granularity by nature. Don't collapse this to a `date` for consistency with the other two tables — it would lose real information.

**Database**
```sql
CREATE TABLE public.field_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id uuid REFERENCES public.plots(id) NOT NULL,
  observed_at timestamptz NOT NULL,
  observation_type text CHECK (observation_type IN ('fertilizer_applied','irrigation','pest_sighting','soil_report','ingestion_gap','other')),
  payload jsonb, -- e.g. {"npk_applied": {...}} or links to soil_reports.id
  logged_by uuid REFERENCES public.profiles(id), -- nullable: system-logged events (e.g. ingestion_gap) have no human logger
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_field_obs_plot_date ON public.field_observations(plot_id, observed_at DESC);
```
- `ingestion_gap` added to the type enum to support the missing-geometry logging contract from §2.1 without inventing a side-channel logging mechanism.

### 2.4 Fusion layer — extending the existing `digital_twins` table

**Backend**
- New `backend/app/services/twin_snapshot_service.py`: a scheduled job (daily) that reads the latest available NDVI, weather, and field data per plot and **upserts into the existing `digital_twins` table** (see §1.5 — not a new table). This is what "Past" and "Current" modes already read from via `useDigitalTwinSnapshots`.
- New `backend/app/services/twin_prediction_service.py`: reads the last N snapshots, computes a simple trend (e.g., NDVI slope over the last 30–90 days, correlated with weather patterns), and produces a `PredictionOutput` schema consumed by the frontend's "Prediction" mode and by `yield_predictor.py` as an additional, optional, advisory-only signal.
- **`data_completeness` schema is pinned, not freeform**: all three ingestion services and the fusion service must agree on the exact same JSON contract, since three agents will build these independently. Fixed shape:
  ```json
  { "ndvi": true, "weather": true, "soil": false }
  ```
  Exactly these three boolean keys, always present, never additional keys, never omitted keys. Define this as a shared TypedDict/Pydantic model (backend) and TS type (frontend) in one place both sides import — not re-declared per service — so an agent can't drift the shape while building one stream in isolation.
- **Concurrency**: same upsert-not-insert-catch rule as §2.2 applies here — the fusion job and any manual "recompute snapshot for plot X" trigger must share one upsert path.

**Database (migration — additive `ALTER`, not `CREATE`)**
```sql
ALTER TABLE public.digital_twins
  ADD COLUMN IF NOT EXISTS soil_health_index numeric,       -- derived from latest soil report at that date
  ADD COLUMN IF NOT EXISTS foliar_health_score numeric,     -- derived score, existing hover-hotspot metric
  ADD COLUMN IF NOT EXISTS data_completeness jsonb,         -- {"ndvi": bool, "weather": bool, "soil": bool} — fixed 3-key shape
  ADD COLUMN IF NOT EXISTS is_synthetic boolean DEFAULT false;

-- Confirm actual current column list against migration 003 first — this assumes
-- plot_id, analysis_date, ndvi_mean, temperature_c, humidity_pct, rainfall_mm
-- already exist. If any are missing or named differently, adjust before running.
```
- The `data_completeness` field matters: if a plot has no NDVI reading yet (new plot, no satellite pass) the UI should say so honestly rather than silently showing a stale/mock value.

### 2.5 Frontend (`DigitalTwinScreen.tsx`)

- **Past mode**: existing `useDigitalTwinSnapshots` hook now receives real historical rows once §2.4 lands — no new endpoint needed if the hook already queries `digital_twins`; confirm this before an agent builds a redundant new API route.
- **Current mode**: latest row from the same table/hook.
- **Prediction mode**: `GET /api/plots/{id}/twin/prediction` → forward-looking values from `twin_prediction_service`, clearly labeled as a projection (not measured data) in the UI — important for trust with agronomists reviewing this.
- Hover hotspots (Temperature, Moisture, NDVI, Foliar health) bind to the real snapshot fields instead of mock values.
- Add a subtle "data gap" indicator per hotspot when `data_completeness` shows a missing source, instead of pretending full coverage.
- **Synthetic data must never reach production UI**: any query the frontend uses must filter `is_synthetic = false` (or the API layer does it once, centrally) — don't leave this to each frontend call site to remember.

---

## 3. Phased Execution Plan

| Phase | Scope | Depends on |
|---|---|---|
| **0. Schema reconciliation (NEW)** | Confirm actual current `digital_twins` columns against migration 003; get lead sign-off on "extend, don't recreate" (§1.5). This is the first instance of the "read before you build" check that repeats at the start of every phase below | Nothing — do this before any code is written |
| **1. Ingestion foundation** | `ndvi_readings`, `weather_observations`, `field_observations` tables + the 3 ingestion services, scheduled jobs, shared `data_completeness` type definition | Plot boundary geometry or centroid must exist per plot; plots lacking either are logged via `ingestion_gap`, not silently skipped. Phase 0 |
| **2. Fusion layer** | `ALTER TABLE digital_twins` (not a new table) + `twin_snapshot_service.py` daily job, using the shared upsert path | Phase 1, Phase 0 |
| **3. Prediction engine** | `twin_prediction_service.py`, trend extrapolation, `PredictionOutput` schema, wired (advisory-only) into `yield_predictor.py`, enforced via import-boundary check (§6) | Phase 2, needs several weeks of accumulated snapshots — synthetic backfilled dataset (flagged `is_synthetic = true`) unblocks this without waiting on real data |
| **4. Frontend wiring** | Replace all mock values in `DigitalTwinScreen.tsx` with real API calls for Past/Current/Prediction; confirm no redundant endpoints were built where the existing hook already suffices | Phase 2 (Past/Current), Phase 3 (Prediction) |
| **5. Data-gap UX polish** | Honest "no data yet" / "projection, not measured" states | Phase 4 |

Phase 1's three ingestion streams can be split across 3 people/agent-runs in parallel (satellite, weather, field) since they don't depend on each other — **but all three must consume the same shared `data_completeness` type definition and the same migration-numbering convention (see §6) before starting**, so their outputs merge cleanly into Phase 2.

---

## 4. Test Cases per Phase

### Phase 0 — Schema reconciliation (NEW)

| # | Test | Pass criteria |
|---|---|---|
| 0.1 | Actual `digital_twins` schema matches (or documented diff from) the columns this blueprint assumes | Diff reported and reconciled before Phase 1 starts |
| 0.2 | Existing `useDigitalTwinSnapshots` hook confirmed to already query `digital_twins`, not a stale/mock source | Hook source inspected, documented |

### Phase 1 — Ingestion

| # | Test | Pass criteria |
|---|---|---|
| 1.1 | NDVI job stores one row per plot per captured date, no duplicates on re-run | Unique constraint respected, idempotent |
| 1.2 | Weather job backfills a daily row per plot; re-running same day doesn't duplicate | Same as above |
| 1.3 | High cloud-cover NDVI reading is flagged/excluded, not treated as valid signal | `cloud_cover_pct` threshold tested |
| 1.4 | Field observation of type `soil_report` correctly links back to `soil_reports` table | FK/reference integrity check |
| 1.5 | Each ingestion service degrades gracefully if its external API is down (no crash, no partial-write corruption) | Mocked API failure → clean error state, other streams unaffected |
| 1.6 | Plot with no `boundary_geom` and no centroid produces an explicit `ingestion_gap` field observation, not a silent skip | `field_observations` row asserted present |
| 1.7 | Concurrent job + manual backfill for the same plot/date resolve via upsert, not a dropped write or a crash | Simulated concurrent write test |
| 1.8 | `captured_date`/`observed_date` reflect IST calendar day for a reading taken near UTC midnight | Fixed-timestamp test asserting correct date bucket |
| 1.9 | Full regression: existing 47 backend tests pass | 47/47 green |

### Phase 2 — Fusion

| # | Test | Pass criteria |
|---|---|---|
| 2.1 | Snapshot correctly aggregates same-day NDVI + weather + latest-known soil health | Values match source rows |
| 2.2 | `data_completeness` matches the fixed 3-key `{ndvi, weather, soil}` contract exactly — no extra/missing keys | Schema-level check against shared type |
| 2.3 | Snapshot job is idempotent (re-running doesn't duplicate or corrupt existing snapshot) | Unique constraint + upsert logic tested |
| 2.4 | Snapshot uses last-known-good soil health when no new soil report exists for that date (doesn't null it out) | Correct carry-forward logic |
| 2.5 | Post-`ALTER TABLE`, existing RLS policy on `digital_twins` still blocks client writes and still scopes reads to `plots.owner_id` | RLS test re-run unchanged after migration |
| 2.6 | Regression: Phase 1 + original 47 tests pass | All green |

### Phase 3 — Prediction

| # | Test | Pass criteria |
|---|---|---|
| 3.1 | Trend extrapolation on a known synthetic 90-day NDVI series produces expected direction (up/down/flat) | Matches hand-calculated expectation |
| 3.2 | Prediction gracefully returns "insufficient data" state for a plot with <N snapshots, rather than a garbage extrapolation | Explicit insufficient-data response, not a wild guess |
| 3.3 | Prediction output is clearly typed/flagged as `is_projection: true` and never silently merges into deterministic `severity_calculator` output | Schema-level check + existing 47 tests still pass unmodified |
| 3.4 | Import-boundary check confirms `severity_calculator.py` / dosage logic modules have no import path from `twin_prediction_service.py` | Static check passes (not just a code-review note) |
| 3.5 | Synthetic backfilled rows (`is_synthetic = true`) used for this phase's testing are excluded from any real prediction query by default | Query-level filter test |
| 3.6 | `yield_predictor.py` accepts prediction signal as optional input with a default of `None`, doesn't break when absent | Regression on `yield_predictor` test suite |
| 3.7 | Regression: all prior tests pass | All green |

### Phase 4 — Frontend wiring

| # | Test | Pass criteria |
|---|---|---|
| 4.1 | Past mode renders real historical snapshot data for a plot with full history | Chart/hotspots reflect API data, not mock |
| 4.2 | Current mode renders the latest snapshot | Matches latest DB row |
| 4.3 | Prediction mode visually distinguishes projected values from measured ones | Distinct styling/label present |
| 4.4 | Data-gap indicator appears correctly when `data_completeness` shows a missing source | UI element renders as expected |
| 4.5 | 7d/30d/90d filters correctly scope the query range for all three modes, not just NDVI | Correct date range sent to API |
| 4.6 | No synthetic (`is_synthetic = true`) rows ever reach the rendered UI in a normal (non-test) session | Filter verified at API or query layer |
| 4.7 | No redundant new API route was built where the existing `useDigitalTwinSnapshots` hook already covered Past/Current | Code review checklist item |
| 4.8 | Full regression across backend + frontend | All green |

---

## 5. Master Test Matrix

| Phase | New tests (min) | Cumulative regression baseline |
|---|---|---|
| 0. Schema reconciliation | 2 | 47 (no code change, verification only) |
| 1. Ingestion | 9 | 56 |
| 2. Fusion | 6 | 62 |
| 3. Prediction | 7 | 69 |
| 4. Frontend wiring | 8 | 77 (+ frontend suite once it exists) |
| **Total** | **32 new** | **77 backend + frontend** |

---

## 6. Agent/Team Workflow Notes

- **Migration naming convention (fixes v1's parallel-branch numbering collision)**: each of the three Phase 1 branches uses a timestamp-prefixed migration filename (e.g., `20260901_1400_create_ndvi_readings.sql`) instead of the next sequential number. Whoever merges first "wins" the next sequential slot when migrations are finally applied in order; timestamp prefixes avoid three agents all claiming `007_`. Optionally, one person owns applying/renumbering migrations at merge time rather than each agent guessing the next number.
- Branch structure: `feature/twin-ndvi-ingestion`, `feature/twin-weather-ingestion`, `feature/twin-field-observations` run in parallel (Phase 1); `feature/twin-fusion-layer` branches off once all three merge; `feature/twin-prediction` and `feature/twin-frontend-wiring` branch off fusion.
- Per-PR gate: full pytest suite green, migration is additive only (for Phase 2 specifically: `ALTER ... ADD COLUMN IF NOT EXISTS`, never a `CREATE TABLE` that duplicates `digital_twins` — see §1.5), and **no PR may make prediction output silently feed into `severity_calculator.py`/dosage logic**. This guardrail is now backed by an automated import-boundary check (test 3.4), not just a documented convention — an agent working autonomously can't accidentally violate it without a test failing.
- Since prediction needs weeks of real accumulated data to validate meaningfully, generate a **synthetic backfilled snapshot dataset** (90 days of plausible NDVI/weather/soil values with a known trend, all rows flagged `is_synthetic = true`) for Phase 3 testing. This flag is enforced at the query layer (test 3.5, 4.6), not just a naming convention, so synthetic rows can never leak into a real prediction or the production UI even if someone forgets to delete them later.
- **Before Phase 1 starts**: circulate the shared `data_completeness` type (§2.4) and this document's §1.5 resolution to whoever/whatever is building each of the three ingestion streams, so no agent discovers the `digital_twins` conflict mid-implementation.
- **Every phase, not just Phase 0, opens with a real-state check** (see "Operating principle" above): before Phase 2 writes migration SQL, it re-confirms `digital_twins`' actual columns post-Phase-1; before Phase 3 builds the prediction service, it confirms the actual shape of what Phase 2 landed rather than what this doc assumed it would land. Skipping this because "the doc already says what the schema looks like" is exactly the failure mode that produced the v1 conflict.
- **On error mid-phase**: fix the root cause, re-run the full regression suite (not just the failing test), and continue — don't skip, don't comment out assertions, don't silently narrow scope to avoid the failure. If the fix requires a decision outside the current phase's authority (e.g., it implies a real schema change, or contradicts an earlier phase's output), stop and flag it for reconciliation rather than working around it quietly.

---

## 7. Open Questions for the Team

1. Which Sentinel-2 access path — Copernicus Data Space (free, official), Sentinel Hub (paid, easier DX), or Google Earth Engine (needs licensing check for commercial use)? Affects `ndvi_service.py` implementation.
2. Weather source — Open-Meteo (free, no key) vs. IMD (more locally accurate for Karnataka) vs. OpenWeatherMap? Also affects whether grid-bucketing plots for shared weather pulls is worth the complexity now or later.
3. Is a "foliar health score" a genuinely new derived metric, or does it already exist somewhere in the mock UI that we should reverse-engineer the intended formula from?
4. Does the team want prediction as simple trend extrapolation (recommended for v1, matches the existing deterministic-engine philosophy) or is there appetite/data for an actual ML model down the line?
5. GPS boundary accuracy and cadastral overlay (from the earlier blueprint) — are those now deprioritized/deferred given this reassignment, or still running in parallel on a separate track?
6. **(NEW)** Confirm with lead: is "extend `digital_twins`" (§1.5) the correct call, or is there a reason (not visible from the frontend/migration history alone) to keep a separate `digital_twin_snapshots` table? This blocks Phase 2 and should be resolved first.
