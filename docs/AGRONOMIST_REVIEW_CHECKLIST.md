# Agronomist review checklist — fertilizer rules

**Status today: no crop rule is approved. The engine answers `insufficient_data` for every crop.** This document is what an
agronomist needs to change that, and it is also the record of what is *not* decided. Nothing here may be filled in by a developer.

## 0. Where each crop stands

Source evidence is in [FERTILIZER_SOURCES.md](FERTILIZER_SOURCES.md) (what was read, where, and what it supports).

| Group | Crops | State |
|---|---|---|
| **Rule supported by a verified source, awaiting agronomist approval, engine ready** | **Oil palm** (S1, Indian Farming 2019, Table 1) · **Coconut** (S2, Indian Horticulture 2022, Table 1) | Candidate record in `backend/app/services/data/candidate_rules/`; its validator output lists *only* the three approval fields. Open questions are in each file's `_candidate.open_questions`. **Not active.** |
| Source verified, **not expressible by the engine** | **Arecanut** (S2 Table 2, S4 leaflet) | Arecanut is not an engine crop (D11); needs "schedule-only crops" support. North-East coconut (S3, tall / hybrid) needs a plot variety and a region decision. |
| **No usable source found** | Rice, maize, sugarcane, banana | The numbers in `crop_rules.py` for these are the project's unsourced defaults. They stay `insufficient_data`. |
| Active rules | none | `verified_rules.json` is empty and a test pins that. |

## 1. Decisions that only an agronomist can make

| # | Decision | Why it matters | Where it lands in code |
|---|---|---|---|
| D1 | **Primary source per crop** — a publication (state agricultural university package of practices, ICAR/CPCRI/MPOB/…), with edition, year and the page/table that states the numbers | Without it a dose is a guess. The engine rejects a rule with no locator or quote | `source.*` in the rule record |
| D2 | **Which model?** The engine has two. *Sufficiency target* compares one soil-test number with one target per nutrient (1 : 1); **no source we could read states crop targets in that form**, and the project's `crop_rules.py` targets are unsourced. *Published schedule* uses a publication's dose as printed (g N / P2O5 / K2O per palm per year by palm age) and ignores soil-test values. The sources found (S1, S2) are schedules. Decide whether schedules alone are acceptable for farmer-facing advice, or whether a soil-test adjustment (D12) is required first | Build-up vs maintenance, soil buffering, fixation and crop removal are all ignored by a 1 : 1 gap | `crop_rules.py`, `nutrient_analyzer.py`, `dosage_calculator.py` (code change, not just data) |
| D3 | **Basis of soil-test P and K** — does the laboratory report available P as P or as P₂O₅, and K as K or K₂O (Olsen/Bray/Mehlich P; ammonium-acetate K)? Indian labs differ and the label alone does not say | A wrong basis changes the product quantity by **2.29×** (P) or **1.20×** (K). This is the single biggest numeric risk | `soil_test_basis` in the record (must equal `p_basis`/`k_basis` in `crop_rules.py`) |
| D4 | **Confirm the oxide ↔ element conversion** used: P = 0.4364 × P₂O₅, K = 0.8302 × K₂O (stoichiometry from standard atomic weights; agrees with published tables) | Formal sign-off so the factor is not "a developer's number" | `fertilizer_catalog.py` (tested) |
| D5 | **Product grades** — confirm urea 46 % N, DAP 18-46-0, MOP 60 % K₂O against the current *Fertiliser (Control) Order* schedule, and whether those products are appropriate for the crop (e.g. chloride-sensitive crops and MOP) | The catalog grades come from secondary sources only | `product_grades_verified` in the record; `fertilizer_catalog.py` |
| D6 | **Application losses / efficiency factors** — none are applied today | Doses may under- or over-state what to apply | new code if required |
| D7 | **Crop stage / age and unit of the recommendation** (per hectare vs per plant, young vs bearing, irrigated vs rainfed) | Plots carry stage and age, but the engine does not use them; the rule record states what it applies to | `applicable_stage`, `region`; new inputs if required |
| D8 | **Timing, splitting and placement** — the engine gives none (an unsourced "split into 2–3 doses" sentence was removed) | Farmers will ask; unsourced timing would read as advice | out of scope until sourced |
| D9 | **pH and organic-carbon rules** — the engine only flags out-of-range values and says fertilizer will not fix pH | Lime / organic amendment advice needs its own sourced rule | out of scope until sourced |
| D10 | **Yield, revenue and ROI** — omitted by default. Set `covers_yield_and_economics` to true only if the *same* source supports the yield model | The yield baselines in `crop_rules.py` are invented placeholders | `covers_yield_and_economics` |
| D11 | **Which crops and regions to serve** — arecanut appears on the only real lab card in the repository but is not in the catalog; the six catalog crops may not all be wanted. Serving arecanut needs a *schedule-only crop* (no deficit-model targets): a small code change plus tests | Scope | `crop_rules.py`, `rule_provenance.py`, router, plot crop list |
| D12 | **Soil-test adjustment** — S2 says to test soil and S1 says rates may need modifying from soil and leaf analysis, but neither gives a rule. S6 states a general ICAR statement (low / high fertility class: raise / lower the dose by 25 %) without extractant, P/K basis or crop. A CPCRI page says P may be skipped above 20 ppm in acid soils. Today the engine applies **none** of these | Soil values are saved with the advice but do not change the dose; the recommendation says so | `soil_test_adjustment: "none"` (enforced); new code + source if wanted |
| D13 | **Palm-age convention** — "1st / 2nd / 3rd year" is not defined in the sources. The engine counts whole 12-month periods after the planting date; S2's first-year column also assumes planting in May-June | Wrong age = wrong band (a factor of 2-3 between bands) | `age_basis` in the record; `schedule_engine.age_year_on` |
| D14 | **Is a journal / extension article an acceptable primary source?** S1 and S2 are ICAR articles, not formal package-of-practices bulletins | Provenance strength | `source.*` |
| D15 | **Regional applicability** — S1 and S2 state no region; S3 gives a different adult coconut total for North East India (tall 500 : 400 : 1050, hybrid 500 : 500 : 2000, vs 500 : 320 : 1200). Decide `applicable_states` per rule | A dose outside the region it was derived for | `applicable_states` (enforced when set) |
| D16 | **Organic manure and other nutrient sources** — the sources say chemical doses should be reduced when organic manure is applied (S1) and give organic doses (S2). The engine does not know what the farmer applied | Over-application | not modelled |
| D17 | **Reuse permission** — none of the pages read carries a licence. Confirm what may be reproduced in product screens and exports | Legal | `source.*` text shown to farmers |

## 2. What the software enforces before it will use a rule

A record in `verified_rules.json` (or the file named by `RULE_PACK_PATH`) is activated only if **all** hold; otherwise it is skipped and logged and the crop stays `insufficient_data`.
Check a file without activating anything: `cd backend && python -m app.services.rule_provenance check path/to/records.json`.

* `status` is `approved`, `reviewed_by` has a **name and a role**, `reviewed_on` is a real past date
* `source` has `id`, `title`, `publisher`, `edition`, `locator`, a `quote` of ≥ 20 characters and an integer `year` (1900…this year); `url` if given is http(s)
* `applicable_stage` and `region` are stated; `assumptions` is a non-empty list
* `units` is exactly `{nutrient_targets: "kg/ha", organic_carbon: "%"}` — the engine never converts other units
* `soil_test_basis` states `elemental` or `oxide` for P and K and **equals** the basis the engine uses for that crop
* every number in `targets` is finite, > 0, physically plausible (N ≤ 2000, P ≤ 500, K ≤ 1500 kg/ha; 0 < pH min < pH max ≤ 14; organic carbon ≤ 10 %) and **equals** the value in `crop_rules.py` (so the number cited is the number used)
* `product_grades_verified` names where the label grade of urea, DAP and MOP was checked
* the crop is in the catalog, and there is **exactly one** record for it (two records disable the crop)
* records marked `test_fixture` are accepted only when `ENVIRONMENT=development`

For `rule_kind: "published_schedule"` records the numbers are the schedule itself, so `crop_rules.py` is not compared; instead the validator checks:

* `units` is exactly `{dose: "g/palm/year"}`; `nutrient_basis` states whether the *source's* P and K are `elemental` or `oxide`
* `age_basis` explains how "year N" is counted; `soil_test_adjustment` is exactly `"none"` (the engine does not adjust, so a record may not imply it does)
* `schedule` bands start at year 1, are contiguous and non-overlapping, only the last may be open-ended; each of `n_g`, `p_g`, `k_g` is a finite number >= 0 (zero only if the source states zero), not all zero, and under the plausibility ceilings (5000 / 3000 / 8000 g per palm per year)
* `applicable_states` is `null` (the source states no restriction) or a non-empty list; when set, the plot's recorded state must match or the engine answers `region_not_covered`
* the engine additionally refuses (`insufficient_data`, naming the missing fact) when the plot has no planting date, no palm count, a planting date in the future, an age beyond a closed schedule, or no state for a region-bound rule

If the source disagrees with a number, **change `crop_rules.py` first** (and its tests) so that code and citation say the same thing, then add the record.

## 3. Review procedure

1. Pick the crop and region. Obtain the primary source. Do **not** use a secondary summary.
2. Fill the crop's sheet in §4: for each row, record the exact source location and whether the engine's number matches. Mark mismatches.
3. Decide D2–D10 for that crop and write the consequences in "Notes".
4. If anything is wrong, a developer changes `crop_rules.py` / `fertilizer_catalog.py` / the model and adds tests with the **real citation** as the expected value.
5. Add the record (template §5). Run the `check` command until it prints `[OK ]`.
6. Add a test `tests/test_rule_<crop>.py` that pins the targets and the cited locator, and run the whole suite.
7. Sign the sheet (name, role, date). Keep the signed sheet with the project records; it is the evidence behind the `reviewed_by` field.
8. Re-verify end to end with `npm run smoke:staging` on a staging deployment using a real, authorized report (see `docs/DEPLOYMENT.md`).

## 4. Per-crop review sheets

<!-- BEGIN GENERATED: per-crop sheets -->

_Generated from `backend/app/services/crop_rules.py` and `fertilizer_catalog.py`. Do not edit by hand; run `python scripts/generate_rule_review_sheets.py --write`._

### Fertilizer products the engine uses (grades are NOMINAL and unverified)

| Product | N % | P₂O₅ % | K₂O % | elemental P % | elemental K % | Grade source recorded in code | Reviewer: grade confirmed against (document, clause)? |
|---|---|---|---|---|---|---|---|
| Urea (`urea`) | 46 | 0 | 0 | 0.0 | 0.0 | Fertiliser (Control) Order 1985, G.S.R. 758(E) of 25 Sep 1985, consolidated copy of unknown amendment date (read 2026-10-30; not confirmed against the current Schedule I): Schedule I Part A, 1(a) no. 2 'Urea (46% N)': total nitrogen (dry basis) 46.00 minimum | ☐ ______ |
| Di-Ammonium Phosphate (DAP) (`dap`) | 18 | 46 | 0 | 20.1 | 0.0 | Fertiliser (Control) Order 1985, G.S.R. 758(E) of 25 Sep 1985, consolidated copy of unknown amendment date (read 2026-10-30; not confirmed against the current Schedule I): Schedule I Part A, 1(d) no. 2 'Diammonium Phosphate (18-46-0)': total nitrogen 18.0 minimum; neutral ammonium citrate soluble phosphate (as P2O5) 46.0 minimum (water soluble 41.0 minimum) | ☐ ______ |
| Muriate of Potash (MOP) (`mop`) | 0 | 0 | 60 | 0.0 | 49.8 | Fertiliser (Control) Order 1985, G.S.R. 758(E) of 25 Sep 1985, consolidated copy of unknown amendment date (read 2026-10-30; not confirmed against the current Schedule I): Schedule I Part A, 1(c) no. 1 'Potassium Chloride (Muriate of Potash)': water soluble potash (as K2O) 60.0 minimum | ☐ ______ |

### Banana (`banana`) — status: **NOT APPROVED** (no source, no reviewer)

| Item | Value in the engine today | Source (publication, edition, year, page/table) | Applies to (stage, region) | Matches source? | Notes / change required |
|---|---|---|---|---|---|
| N target (kg/ha) | 200 | ______ | ______ | ☐ yes ☐ no | |
| P target (kg/ha, basis: **elemental**) | 40 | ______ | ______ | ☐ yes ☐ no | |
| K target (kg/ha, basis: **elemental**) | 300 | ______ | ______ | ☐ yes ☐ no | |
| pH range | 5.5 – 7 | ______ | ______ | ☐ yes ☐ no | |
| Minimum organic carbon (%) | 0.6 | ______ | ______ | ☐ yes ☐ no | |
| Yield baseline (t/ha) — **not shown to users** | 45 | ______ | ______ | ☐ yes ☐ no ☐ leave omitted | |
| Max yield loss fraction — **not shown to users** | 0.5 | ______ | ______ | ☐ yes ☐ no ☐ leave omitted | |

Reviewer: ____________ role: ____________ date (YYYY-MM-DD): ____________  Decision: ☐ approve as is ☐ approve with the changes above ☐ reject (keep `insufficient_data`)

### Coconut (`coconut`) — status: **NOT APPROVED** (no source, no reviewer)

| Item | Value in the engine today | Source (publication, edition, year, page/table) | Applies to (stage, region) | Matches source? | Notes / change required |
|---|---|---|---|---|---|
| N target (kg/ha) | 170 | ______ | ______ | ☐ yes ☐ no | |
| P target (kg/ha, basis: **elemental**) | 32 | ______ | ______ | ☐ yes ☐ no | |
| K target (kg/ha, basis: **elemental**) | 280 | ______ | ______ | ☐ yes ☐ no | |
| pH range | 5.2 – 8 | ______ | ______ | ☐ yes ☐ no | |
| Minimum organic carbon (%) | 0.5 | ______ | ______ | ☐ yes ☐ no | |
| Yield baseline (t/ha) — **not shown to users** | 12 | ______ | ______ | ☐ yes ☐ no ☐ leave omitted | |
| Max yield loss fraction — **not shown to users** | 0.4 | ______ | ______ | ☐ yes ☐ no ☐ leave omitted | |

Reviewer: ____________ role: ____________ date (YYYY-MM-DD): ____________  Decision: ☐ approve as is ☐ approve with the changes above ☐ reject (keep `insufficient_data`)

### Maize (`maize`) — status: **NOT APPROVED** (no source, no reviewer)

| Item | Value in the engine today | Source (publication, edition, year, page/table) | Applies to (stage, region) | Matches source? | Notes / change required |
|---|---|---|---|---|---|
| N target (kg/ha) | 150 | ______ | ______ | ☐ yes ☐ no | |
| P target (kg/ha, basis: **elemental**) | 35 | ______ | ______ | ☐ yes ☐ no | |
| K target (kg/ha, basis: **elemental**) | 60 | ______ | ______ | ☐ yes ☐ no | |
| pH range | 5.8 – 7.2 | ______ | ______ | ☐ yes ☐ no | |
| Minimum organic carbon (%) | 0.5 | ______ | ______ | ☐ yes ☐ no | |
| Yield baseline (t/ha) — **not shown to users** | 7.5 | ______ | ______ | ☐ yes ☐ no ☐ leave omitted | |
| Max yield loss fraction — **not shown to users** | 0.5 | ______ | ______ | ☐ yes ☐ no ☐ leave omitted | |

Reviewer: ____________ role: ____________ date (YYYY-MM-DD): ____________  Decision: ☐ approve as is ☐ approve with the changes above ☐ reject (keep `insufficient_data`)

### Oil Palm (`oil_palm`) — status: **NOT APPROVED** (no source, no reviewer)

| Item | Value in the engine today | Source (publication, edition, year, page/table) | Applies to (stage, region) | Matches source? | Notes / change required |
|---|---|---|---|---|---|
| N target (kg/ha) | 280 | ______ | ______ | ☐ yes ☐ no | |
| P target (kg/ha, basis: **elemental**) | 45 | ______ | ______ | ☐ yes ☐ no | |
| K target (kg/ha, basis: **elemental**) | 340 | ______ | ______ | ☐ yes ☐ no | |
| pH range | 4.5 – 6.5 | ______ | ______ | ☐ yes ☐ no | |
| Minimum organic carbon (%) | 0.75 | ______ | ______ | ☐ yes ☐ no | |
| Yield baseline (t/ha) — **not shown to users** | 22 | ______ | ______ | ☐ yes ☐ no ☐ leave omitted | |
| Max yield loss fraction — **not shown to users** | 0.45 | ______ | ______ | ☐ yes ☐ no ☐ leave omitted | |

Reviewer: ____________ role: ____________ date (YYYY-MM-DD): ____________  Decision: ☐ approve as is ☐ approve with the changes above ☐ reject (keep `insufficient_data`)

### Rice (Paddy) (`rice`) — status: **NOT APPROVED** (no source, no reviewer)

| Item | Value in the engine today | Source (publication, edition, year, page/table) | Applies to (stage, region) | Matches source? | Notes / change required |
|---|---|---|---|---|---|
| N target (kg/ha) | 120 | ______ | ______ | ☐ yes ☐ no | |
| P target (kg/ha, basis: **elemental**) | 26 | ______ | ______ | ☐ yes ☐ no | |
| K target (kg/ha, basis: **elemental**) | 60 | ______ | ______ | ☐ yes ☐ no | |
| pH range | 5.5 – 7 | ______ | ______ | ☐ yes ☐ no | |
| Minimum organic carbon (%) | 0.5 | ______ | ______ | ☐ yes ☐ no | |
| Yield baseline (t/ha) — **not shown to users** | 6 | ______ | ______ | ☐ yes ☐ no ☐ leave omitted | |
| Max yield loss fraction — **not shown to users** | 0.5 | ______ | ______ | ☐ yes ☐ no ☐ leave omitted | |

Reviewer: ____________ role: ____________ date (YYYY-MM-DD): ____________  Decision: ☐ approve as is ☐ approve with the changes above ☐ reject (keep `insufficient_data`)

### Sugarcane (`sugarcane`) — status: **NOT APPROVED** (no source, no reviewer)

| Item | Value in the engine today | Source (publication, edition, year, page/table) | Applies to (stage, region) | Matches source? | Notes / change required |
|---|---|---|---|---|---|
| N target (kg/ha) | 250 | ______ | ______ | ☐ yes ☐ no | |
| P target (kg/ha, basis: **elemental**) | 50 | ______ | ______ | ☐ yes ☐ no | |
| K target (kg/ha, basis: **elemental**) | 120 | ______ | ______ | ☐ yes ☐ no | |
| pH range | 6 – 7.5 | ______ | ______ | ☐ yes ☐ no | |
| Minimum organic carbon (%) | 0.6 | ______ | ______ | ☐ yes ☐ no | |
| Yield baseline (t/ha) — **not shown to users** | 90 | ______ | ______ | ☐ yes ☐ no ☐ leave omitted | |
| Max yield loss fraction — **not shown to users** | 0.4 | ______ | ______ | ☐ yes ☐ no ☐ leave omitted | |

Reviewer: ____________ role: ____________ date (YYYY-MM-DD): ____________  Decision: ☐ approve as is ☐ approve with the changes above ☐ reject (keep `insufficient_data`)

<!-- END GENERATED -->

## 5. Record template

```json
{
  "crop": "coconut",
  "rule_version": "2026-01",
  "status": "approved",
  "applicable_stage": "<e.g. bearing palms, irrigated>",
  "region": "<e.g. Karnataka, coastal>",
  "units": {"nutrient_targets": "kg/ha", "organic_carbon": "%"},
  "soil_test_basis": {"phosphorus": "elemental", "potassium": "elemental"},
  "targets": {"n_target_kg_ha": 0, "p_target_kg_ha": 0, "k_target_kg_ha": 0, "ph_min": 0, "ph_max": 0, "organic_carbon_min_percent": 0},
  "assumptions": ["<what the numbers assume>"],
  "source": {"id": "<short id>", "title": "<publication>", "publisher": "<body>", "edition": "<edition/version>", "year": 0,
             "locator": "<Table N, p. N>", "quote": "<verbatim passage that states the numbers>", "url": "https://..."},
  "reviewed_by": {"name": "<name>", "role": "<role>"},
  "reviewed_on": "YYYY-MM-DD",
  "product_grades_verified": {"urea": "<where checked>", "dap": "<where checked>", "mop": "<where checked>"},
  "covers_yield_and_economics": false
}
```
(The zeros above are deliberately invalid — the validator rejects non-positive numbers. Replace every placeholder with the cited value.)

For a published schedule, start from `candidate_rules/oil_palm_iiopr_indian_farming_2019.json` or `coconut_cpcri_indian_horticulture_2022.json` (complete records in the `published_schedule` shape: `schedule`, `nutrient_basis`, `age_basis`, `applicable_states`, `timing_note`, `soil_test_adjustment`). Resolve its `_candidate.open_questions`, then set `status: "approved"`, `reviewed_by`, `reviewed_on`, and copy the record into the rule pack.

## 6. Candidate material already in the repository (pending review — not approved, not active)

All files are in `backend/app/services/data/candidate_rules/`. The loader never reads that folder (`test_candidate_rules.py` pins this).

| File | What it holds | Engine |
|---|---|---|
| `oil_palm_iiopr_indian_farming_2019.json` | A complete `published_schedule` record from S1 Table 1, with open questions | ready |
| `coconut_cpcri_indian_horticulture_2022.json` | A complete `published_schedule` record from S2 Table 1 (annual totals are the sums of the two printed applications), with open questions incl. the North East disagreement | ready |
| `coconut_cpcri_bulletin156_2023.json` | Worksheet for S3 Table 3 (tall / hybrid, North East India), the 690 g vs 500 g N disagreement inside the bulletin, and the undated CPCRI web page | blocked: no plot variety; region |
| `arecanut_cpcri_kvk_folder2.json` | Worksheet: S2 Table 2 (dated) and the undated KVK leaflet | blocked: D11 |
| `hegde_card_arecanut.json` | What the only real laboratory card in the repository prints (a Nitte RSVC soil health card, `backend/tests/fixtures/P_P_Hegde_Rayee.pdf`): arecanut doses labelled "Source: State Agricultural Universities" and the lab's ranges | cannot be approved: publication not named, crop not in the engine, label-to-range mapping from an interleaved text layer, and the card forbids reproduction without the laboratory's written approval |

One observation for D3/D4: the card's printed phosphate quantities equal 60 kg P2O5 divided by the product's P2O5 grade, i.e. that laboratory computes fertilizer on the oxide basis. That says nothing about the basis of its soil-test values.
