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

| Field       | Type                                  | Notes |
|-------------|----------------------------------------|-------|
| `id`        | uuid                                   | Primary key, referenced as `plot_id` elsewhere. |
| `owner_id`  | uuid                                   | Must match `auth.users.id` (Supabase Auth user). |
| `crop`      | text                                   | Must be one of the crops in `crop_rules.py`: `oil_palm`, `rice`, `maize`, `sugarcane`, `banana`, `coconut` (or confirm additional crops). |
| `area`      | numeric, > 0                           | Plot size, in the unit given by `area_unit`. |
| `area_unit` | text: `hectare` \| `acre` \| `square_meter` | Defaults to `hectare` if omitted. |

### Current expected source

Table/view:

```text
plots
