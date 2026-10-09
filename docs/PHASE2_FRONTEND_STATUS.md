# Phase 2 frontend status — farmer-first UI, English + Kannada

Branch `phase2/farmer-first-frontend` (from `audit/phase1-hardening`). Frontend only: no migrations were run, the
remote Supabase database was not touched, and nothing was pushed.

Everything below was checked in a real browser against the **emulated** Supabase stack described in
`docs/PHASE1_AUDIT.md` (not managed Supabase). The backend ships no disease or crop-suitability service, so those two
screens are interfaces plus an honest "not available" state — they were **not** exercised against a real result.

## 1. Gap analysis and outcome

| Area | Before | UI change | Backend dependency | Kannada | Tests | Status |
|---|---|---|---|---|---|---|
| i18n infrastructure | en/kn context, **no persistence**, no interpolation, 4 languages offered in Settings | persisted `nutripalm_lang`, `t(key, {vars})`, `renderRich`, silent `tOptional`, only en/kn selectable | none | n/a | unit + E2E | **Done** |
| Navigation | flat list of 9 items | 7 groups (Home, My Farms, Farm Health, Crop Suitability, Recommendations, History, Profile), 13 destinations, `aria-current`, 44 px targets, mobile drawer | none | all labels | E2E (all 13 walked in Kannada) | **Done** |
| Dashboard | 947-line page with invented tiles | rewritten around the farmer's questions; real counts, real latest soil report, real weather, real saved advice, quick actions | recommendations API, Supabase | all strings | E2E | **Done** |
| Disease Intelligence | none | form for arecanut / coconut, risk states, `RecommendationCard` result layout, strict response validation | **`POST /api/disease/assess` does not exist** | all strings | unit (validators) + E2E | **UI + boundary only** — shows "not available", never a result |
| What Should I Grow? | none | shows the plot's real inputs (location, saved soil values, weather, irrigation) and what is missing; ranked-result layout | **`POST /api/crop-suitability/assess` does not exist** | all strings | unit + E2E | **UI + boundary only** |
| Nutrient & Fertilizer | `RecommendationScreen` (English) | rewritten: observed / derived / recommendation / predicted blocks, unified card, per-plant/method/timing explicitly "not provided", unsupported-crop notice | existing `/api/recommendations` | all UI strings (backend sentences stay English) | E2E | **Done for the 6 backend crops**; arecanut unsupported by backend |
| Weather Advisory | dashboard card only | full page: current, forecast table, Kannada condition text; advisory rules marked unavailable | no advisory rule service | all strings | E2E | **Weather done; advice unavailable** |
| Unified recommendation card | none | `RecommendationCard` (what / do / how / how much / when / why / evidence / limitations / missing) used by disease, suitability, fertilizer | none | all strings | E2E | **Done** |
| History | none | soil reports + saved advice + plots, filter | existing | all strings | E2E | **Done** |
| Soil report | English-heavy | processing steps, labels, "Not Found", save state translated; no invented values (unchanged) | existing | JSX literals | E2E (Phase 1 checks kept) | **Partial** — see limitations |
| Digital Twin / Analytics / Farms / Plots / Surveyor / Maps | mixed | JSX text, attributes, toasts, conditional labels translated; **fabricated static content removed** (section 4) | existing | JSX + data labels | E2E (render + layout in Kannada) | **Partial** |
| Settings | 4 extra languages + a dead selector | real two-option language switch (applies immediately, best-effort saves to the profile) | profiles table | all | E2E | **Done** |

## 2. Translation coverage (measured, not claimed)

* `en.json` and `kn.json` hold the same **2,586** keys (unit test fails on any difference or mismatched `{placeholder}`).
* **674** keys were added this phase (`p2.*`); 668 of them contain Kannada script and the other 6 are product names /
  standards on a fixed allow-list (test enforced).
* `npm run i18n:scan` (ts-morph) reports **0** untranslated JSX text nodes, text attributes
  (`placeholder`, `title`, `aria-label`, `alt`, `label`), toast/error-setter strings and conditional display strings across
  all farmer-facing screens. Data-driven labels in the Digital Twin and the soil-processing steps are looked up at render time
  (`tx()` / `t(step.label)`); the scanner cannot see those, so `DEEP=1` still lists 26 of them as false positives.
* Browser check: every one of the 13 pages renders Kannada text and has no horizontal overflow in Kannada at desktop;
  Dashboard, Nutrient & Fertilizer and Disease also at tablet (820 px) and phone (390 px). Six pages are additionally
  checked for "no English sentences left": Dashboard, Disease, Crop Suitability, Weather, History, Nutrient & Fertilizer.
  The remaining pages are only checked loosely (`p2-kannada-english-leftovers.json` in the E2E output lists what was found).
* Kannada was written for natural farmer-facing wording (e.g. "ನಾನು ಯಾವ ಬೆಳೆ ಬೆಳೆಯಬೇಕು?"), keeping crop/product names, units and
  N / P / K / pH / EC / NDVI.

**Not covered / known gaps**

* **No native-speaker or agronomist review has happened.** The 674 new strings were written by the assistant. The
  ~1,900 older strings were produced earlier with machine translation (`google-translate-api-x`) and were not re-reviewed.
  Treat all Kannada as a draft until someone fluent has read it.
* Sentences generated by the **backend** (recommendation summary, warnings, identified issues, actions) are English only.
  The UI says so in Kannada mode. Translating them needs backend message codes, not frontend string tables.
* Nutrient names N / P / K are translated; any other backend `display_name` and fertilizer product names are shown as received.
* The recommendation **PDF is English only** (the built-in PDF fonts cannot draw Kannada).
* User-entered data (names, plot names, crop names such as "Oil Palm") is shown as typed.
* Error text raised by the data layer (`throw new Error("…")` in `src/data/*`) and the soil-processing log lines are still English.
* Numbers use Latin digits in both languages.
* Several legacy screens (Digital Twin, Surveyor, Overview map) still use 9–11 px text. The new pages use ≥ 12 px.
  A full "no tiny text" pass was not done.

## 3. APIs

Connected and used by the new/changed screens:

| Call | Used by |
|---|---|
| `GET/POST /api/recommendations` (`listRecommendations`, `createRecommendation`) | Dashboard, Nutrient & Fertilizer, History |
| Supabase `soil_reports` (RLS, caller's rows) | Dashboard, Suitability, Nutrient & Fertilizer, History |
| Open-Meteo through the existing `fetchWeather` (new weather-only hook `usePlotWeather`, no NDVI call) | Dashboard, Weather, Suitability |
| `GET /health` (existing) | header status |
| `GET /openapi.json` (read once) | capability probe for the two missing modules |

Not duplicated: no second weather client, no second API client (`authenticatedFetch` in `apiClient.ts` reuses the token logic).

### Missing backend contracts (proposed — nothing calls them until the backend publishes them)

`src/lib/phase2/capabilities.ts` reads the backend's own OpenAPI document and enables a module **only if the path is
published as POST**. Responses are validated field by field (`validate.ts`); an unknown risk level / category / malformed
evidence is an error, never displayed. The frontend never computes a score, a ranking or a dosage.

`POST /api/disease/assess` (Bearer token; owner check on `plot_id` → 404 otherwise)

```json
{ "plot_id": "uuid", "crop": "arecanut|coconut", "crop_stage": "…", "symptoms": ["…"], "affected_parts": ["leaves"], "observations": "…" }
→ { "plot_id": "uuid", "crop": "coconut", "risk_level": "low|moderate|high|insufficient_evidence",
    "candidates": [{ "disease_name": "…", "contributing_factors": ["…"], "evidence": [{"description":"…","source":"…"}],
                     "management": ["…"], "precautions": ["…"] }],
    "limitations": ["…"], "missing_inputs": ["…"], "assessed_at": "ISO-8601" }
```

`POST /api/crop-suitability/assess`

```json
{ "plot_id": "uuid", "soil_report_id": "uuid (optional)" }
→ { "plot_id": "uuid",
    "ranked": [{ "crop": "…", "category": "suitable|partial|unsuitable|insufficient_information", "score": 0.0 /* optional */,
                 "reasons": ["…"], "limitations": ["…"], "water_requirement": "…", "evidence": [{"description":"…","source":"…"}] }],
    "missing_inputs": ["…"], "assessed_at": "ISO-8601" }
```

Other backend work the UI is waiting for:

* **Arecanut** is not in `crop_rules.py` (only oil palm, rice, maize, sugarcane, banana, coconut). The Nutrient page says so
  instead of borrowing another crop's numbers.
* Fertilizer **quantity per palm, application method and timing** are not returned by `/api/recommendations`; the card lists
  them under "information that is missing".
* Weather-based **advisory rules** (spray / fertilise windows) do not exist; the page shows weather only and says so.
* Image input for disease assessment; an evidence/source catalogue.
* Message codes (instead of English sentences) in recommendation explanations so they can be translated.

## 4. Fabricated content found and removed (Phase 1 audit miss)

The Phase 1 audit claimed the Digital Twin had honest N/A states. Phase 2 inspection found hard-coded values that the
audit did not catch. They are removed:

* Digital Twin: "Foliar Chlorophyll: 78 %", "Root Tension: Optimal", a static growth-stage stepper ("Fruit Dev — 82 % completed",
  "Expected Harvest: Oct 2026"), "Model Accuracy 98 %", "Reliability HIGH", the explanation bullets "Stable ambient humidity
  index (64 %)" and "NDVI greenness ratio meets chlorophyll expectations", and chart fallback lines drawn when there was no
  history ("0.90 Index / Optimal Bounds" labels). The chart now says there is not enough history; crop-health shows N/A without NDVI.
* App shell: two seeded notifications ("Sentinel-2 coordinates updated for Plot 2A", "AI advisor completed Mix-B analysis")
  and the "Investor Guided Tour" with unmeasured claims (e.g. "+18.2 %", "12-6-22 NPK").
* Dashboard: replaced by a smaller page built only from account data (counts, latest soil report, weather, saved advice).

## 5. Verification actually run

| Check | Result |
|---|---|
| `npm run build` (tsc -b + vite) | passes |
| `npm run lint` (oxlint) | 0 errors; warnings are hook-dependency and fast-refresh notices (legacy + `LanguageContext` exports) |
| `npm test` (vitest) | **48 / 48** (30 Phase 1 + 18 new: key parity, placeholders, Kannada script, persistence, WMO mapping, capability probe, response validators) |
| `npm run i18n:scan` | 0 untranslated literals |
| Backend `pytest` | 173 pass, 6 fail — the same 6 real-OCR tests that need Tesseract/Poppler on this machine (unchanged; OCR was verified manually) |
| Browser E2E, two users (`supabase/tests`, `npm run e2e`) | **137 / 137** on the final run. 87 Phase 1 checks kept (selectors updated for the new navigation labels) plus ~50 Phase 2 checks: unavailable states with no request sent, real soil values on the Suitability page, weather page with no spray advice, history, English → Kannada switch, persistence across refresh, all 13 pages in Kannada, tablet/phone overflow, label/keyboard basics, switch back to English |

Honest caveats on the E2E: it runs on the emulated Supabase stack; the final run passed, but one earlier run of the new
suite failed in the plot-creation step (map click timing — the same run of the Phase 1 flow had passed before and passed
again afterwards); the cause was not isolated. The "no untranslated English" browser assertion only detects runs of three
or more English words, so short English labels can slip through; the static scanner covers those for JSX.

## 6. Known limitations

* Disease and Crop Suitability results are not demonstrated because no backend exists; the success path is covered only by
  unit tests of the validators, not by an end-to-end run.
* Kannada text has not been reviewed by a person who reads Kannada (see section 2).
* Colour contrast was designed to AA (dark text on light tinted badges, status always icon + text) but not measured with a tool.
* The language preference is saved on the device; the profile row gets a best-effort copy but it is not applied on login.
* Legacy screens keep their older visual style (smaller text, mixed card styles) apart from the changes listed above.

## 7. Recommended next frontend task

Have a Kannada reader review `kn.json` (start with the `p2.*` keys and the farmer-facing screens), then raise the
remaining 9–11 px text in the Digital Twin and Surveyor to ≥ 12 px. When the backend publishes the disease and
crop-suitability endpoints, run the same E2E with a real response (the capability probe will enable the forms by itself).
