# NutriPalm AI - Integration Contract

This document defines the **data contract** the AI/ML Recommendation Engine
needs from two other modules in this project.

It does **not** create or assume any specific database schema on their side.
Each team member may expose the required data through a table, view, or other
supported data source, provided the required fields and semantics are preserved.

Status of both contracts below: **PENDING TEAMMATE SCHEMA CONFIRMATION**.

The AI repositories currently target the expected `plots` and `soil_reports`
sources described below. Once the real schema is confirmed, only the repository
integration boundary should need adjustment:

- source table/view name may require changing `.table(...)`
- selected source columns may require changing `.select(...)`
- returned row field mapping may require changing
  `_row_to_plot_input(...)` or `_row_to_soil_input(...)`

The AI/ML calculation pipeline does not depend directly on the teammates'
database schemas.

---

## 1. Contract with Team Member 2 (Plot / Digital Twin)

**What I need:** given a `plot_id`, resolve one plot's data.

Minimum required fields:

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key, referenced as `plot_id` elsewhere. |
| `owner_id` | uuid | Must match `auth.users.id` (Supabase Auth user). |
| `crop` | text | Must be one of the crops in `crop_rules.py`: `oil_palm`, `rice`, `maize`, `sugarcane`, `banana`, `coconut` (or confirm additional crops). |
| `area` | numeric, > 0 | Plot size, in the unit given by `area_unit`. |
| `area_unit` | text: `hectare` \| `acre` \| `square_meter` | Defaults to `hectare` if omitted. |

### Current expected source

Table/view:

```text
plots
```

Expected source columns:

```text
id
owner_id
crop
area
area_unit
```

If the real table/view name differs, update the repository `.table(...)`
source.

If the source column names differ, update the repository `.select(...)`
projection and `_row_to_plot_input(...)` mapping as required.

No other AI calculation service should need to know about the database
implementation.

### What I will NOT do

I will not create, own, or migrate the `plots` table.

I only consume plot data exposed through the agreed integration contract.

### Ownership check

The API verifies:

```text
plot.owner_id == authenticated_user.id
```

before the plot is used.

This application-level check is in addition to any Supabase RLS policies
implemented by the owning module.

---

## 2. Contract with Team Member 3 (Soil Report Upload / OCR)

**What I need:** given a `soil_report_id`, resolve the **structured,
numeric** soil-test result produced after OCR/parsing.

The AI backend consumes final structured values.

It does not consume:

- raw OCR text
- PDF/image references
- unparsed OCR output

Minimum required fields:

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key, referenced as `soil_report_id`. |
| `plot_id` | uuid | Plot to which this soil report belongs. |
| `owner_id` | uuid | Must match `auth.users.id`. |
| `nitrogen_kg_ha` | numeric, >= 0 | Available soil nitrogen, kg/ha. |
| `phosphorus_kg_ha` | numeric, >= 0 | Available soil phosphorus, kg/ha. |
| `potassium_kg_ha` | numeric, >= 0 | Available soil potassium, kg/ha. |
| `organic_carbon_percent` | numeric, 0-100 | Soil organic carbon, %. |
| `ph` | numeric, 0-14 | Soil pH. |

### Current expected source

Table/view:

```text
soil_reports
```

Expected source columns:

```text
id
plot_id
owner_id
nitrogen_kg_ha
phosphorus_kg_ha
potassium_kg_ha
organic_carbon_percent
ph
```

If the real table/view name differs, update the repository `.table(...)`
source.

If the source column names differ, update the repository `.select(...)`
projection and `_row_to_soil_input(...)` mapping as required.

If the OCR pipeline stores nutrients in different units or forms, such as:

- ppm
- N/P2O5/K2O oxide form

the owning team must document the actual representation before integration.
The AI repository layer can then perform the required conversion at the
integration boundary.

### What I will NOT do

I will not implement the OCR pipeline.

I will not create, own, or migrate the `soil_reports` table.

I consume only the final structured soil values exposed by the agreed contract.

### Ownership and plot relationship checks

The API verifies:

```text
soil.owner_id == authenticated_user.id
```

and:

```text
soil.plot_id == requested_plot_id
```

before the soil data is passed into the recommendation engine.

---

## 3. What the AI backend owns and exposes to the frontend

### Create recommendation

```http
POST /api/recommendations
```

Request:

```json
{
  "plot_id": "...",
  "soil_report_id": "...",
  "crop_price_per_ton_inr": 13500.0,
  "fertilizer_price_overrides": {
    "urea": 6.5,
    "dap": 27.0,
    "mop": 17.5
  }
}
```

`crop_price_per_ton_inr` is required for ROI calculation.

Authentication:

```http
Authorization: Bearer <supabase_access_token>
```

### List recommendation history

```http
GET /api/recommendations
```

Returns recommendations belonging to the authenticated caller.

### Get one recommendation

```http
GET /api/recommendations/{recommendation_id}
```

Returns the requested recommendation when it belongs to the authenticated
caller.

Unauthorized or nonexistent recommendations return the same 404-style
response.

### Persistence

The AI backend owns:

```text
public.recommendations
```

with its associated migration and RLS policy.

Full response models are defined in:

```text
backend/app/schemas/api.py
```

Swagger/OpenAPI documentation is available under:

```text
/docs
```

when the backend is running.

---

## 4. Integration procedure once teammate schemas are confirmed

### Step 1 - Confirm the real source

Team Member 2 confirms:

```text
actual plots table/view name
actual plot column names
```

Team Member 3 confirms:

```text
actual soil_reports table/view name
actual soil column names
actual nutrient units/forms
```

### Step 2 - Update repository integration boundary

For the plot repository, update as required:

```text
.table(...)
.select(...)
_row_to_plot_input(...)
```

For the soil repository, update as required:

```text
.table(...)
.select(...)
_row_to_soil_input(...)
```

### Step 3 - Validate ownership and relationship semantics

Confirm that:

```text
owner_id
plot_id
soil_report_id
```

match the contract.

### Step 4 - Run the full test suite

```bash
python -m pytest -v
```

### Step 5 - Run live Supabase integration tests

Validate the complete flow:

```text
Authenticated user
        ↓
Real plot
        ↓
Real soil report
        ↓
Recommendation engine
        ↓
Recommendation persistence
        ↓
Recommendation retrieval
```

---

## 5. Contract boundary

The following services intentionally do **not** depend on teammate-specific
database schemas:

```text
crop_rules
nutrient_analyzer
severity_calculator
dosage_calculator
yield_predictor
roi_calculator
explanation_engine
recommendation_service
```

They consume the stable Pydantic interfaces:

```text
PlotInput
SoilTestInput
```

This keeps the AI pipeline isolated from the implementation details of the
Plot/Digital Twin and Soil/OCR modules.
