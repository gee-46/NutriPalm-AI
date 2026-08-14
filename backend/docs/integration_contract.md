# NutriPalm AI - Integration Contract

This document defines the **data contract** the AI/ML Recommendation Engine
needs from two other modules in this project. It does **not** create or
assume any specific database schema on their side - it specifies the
minimum data shape my backend requires, so each team member can expose it
however fits their own implementation (a view, a table, a computed field,
whatever).

Status of both contracts below: **BLOCKED BY TEAMMATE CONTRACT** - the
`plots` and `soil_reports` tables referenced by
`backend/app/repositories/plot_repository.py` and
`backend/app/repositories/soil_report_repository.py` do not exist in this
repository as of this writing. My repositories are implemented and tested
against this contract; only the two `_row_to_*` mapping functions need to
change if the real column names differ.

---

## 1. Contract with Team Member 2 (Plot / Digital Twin)

**What I need:** given a `plot_id`, resolve one plot's data.

Minimum required fields:

| Field       | Type                                  | Notes                                            |
|-------------|----------------------------------------|---------------------------------------------------|
| `id`        | uuid                                   | Primary key, referenced as `plot_id` elsewhere.   |
| `owner_id`  | uuid                                   | Must match `auth.users.id` (Supabase Auth user).  |
| `crop`      | text                                   | Must be one of the crops in `crop_rules.py`'s catalog: `oil_palm`, `rice`, `maize`, `sugarcane`, `banana`, `coconut` (or tell me to add more). |
| `area`      | numeric, > 0                           | Plot size, in the unit given by `area_unit`.       |
| `area_unit` | text: `hectare` \| `acre` \| `square_meter` | Defaults to `hectare` if omitted.             |

Currently expected table name: **`plots`**, columns as above. If your
actual table/view has different names, tell me and I'll update
`app/repositories/plot_repository.py::_row_to_plot_input` - nothing else in
the AI pipeline needs to change.

**What I will NOT do:** create, own, or migrate the `plots` table. I only
`select` from it.

**Ownership check:** my API additionally verifies `plot.owner_id ==` the
authenticated caller before using the plot - this happens in
`backend/app/routers/recommendations.py`, on top of whatever RLS you apply.

---

## 2. Contract with Team Member 3 (Soil Report Upload / OCR)

**What I need:** given a `soil_report_id`, resolve the **structured,
numeric** soil-test result produced after OCR/parsing (not raw OCR text,
not a PDF/image reference).

Minimum required fields:

| Field                     | Type          | Notes                                             |
|---------------------------|---------------|----------------------------------------------------|
| `id`                      | uuid          | Primary key, referenced as `soil_report_id`.       |
| `plot_id`                 | uuid          | Which plot this report belongs to.                 |
| `owner_id`                | uuid          | Must match `auth.users.id`.                        |
| `nitrogen_kg_ha`          | numeric, >= 0 | Available soil nitrogen, kg/ha.                    |
| `phosphorus_kg_ha`        | numeric, >= 0 | Available soil phosphorus, kg/ha.                  |
| `potassium_kg_ha`         | numeric, >= 0 | Available soil potassium, kg/ha.                   |
| `organic_carbon_percent`  | numeric, 0-100| Soil organic carbon, %.                            |
| `ph`                      | numeric, 0-14 | Soil pH.                                           |

Currently expected table name: **`soil_reports`**, columns as above. If
your OCR pipeline reports nutrients in different units (e.g. ppm, or
N/P2O5/K2O oxide form instead of elemental), tell me the unit/form and I'll
add the conversion in `app/repositories/soil_report_repository.py` rather
than asking you to change your extraction logic.

**What I will NOT do:** implement OCR, create the `soil_reports` table, or
validate the *upload/parsing* step. I only consume the final structured
values.

**Ownership check:** same pattern as plots - `soil.owner_id` is verified
against the authenticated caller in the router before use.

---

## 3. What I own and expose back to the frontend

- `POST /api/recommendations` - body: `{ "plot_id": "...", "soil_report_id": "..." }`
  (+ optional `crop_price_per_ton_inr`, `fertilizer_price_overrides`).
  Requires `Authorization: Bearer <supabase_access_token>`.
- `GET /api/recommendations` - the caller's own recommendation history.
- `GET /api/recommendations/{recommendation_id}` - one recommendation, 404
  if it doesn't belong to the caller.
- Table `public.recommendations` (migration
  `supabase/migrations/003_create_recommendations.sql`), RLS-protected.

Full response shape: see `backend/app/schemas/api.py::RecommendationResponse`,
or run the backend and check `/docs` (Swagger).

---

## 4. Once your schema is ready

1. Tell me your real table/column names (or update this doc directly and
   open a PR against it).
2. I update `_row_to_plot_input` / `_row_to_soil_input` in the two
   repository files - a small, isolated change.
3. No change is needed anywhere else (services, orchestration, API,
   database migration for `recommendations`) because they only depend on
   the `PlotInput` / `SoilTestInput` Pydantic models, not on your tables
   directly.
