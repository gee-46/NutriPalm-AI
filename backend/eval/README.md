# OCR evaluation dataset

`python -m eval.ocr_eval` scores the reader against **human-verified ground truth** listed in `manifest.json` (schema v2).
`--validate-only` checks the manifest; `--strict` also fails while any document's `authorization_confirmed` is not `true`.

## Current state (2026-10-30)

| Report type | Documents | Ground-truth fields | Authorization confirmed |
|---|---|---|---|
| digital_pdf | 1 | 12 | **no** |
| scanned_pdf | 0 | 0 | – |
| scanned_image | 0 | 0 | – |
| photo_image | 0 | 0 | – |

One document is **not** an evaluation set. The harness prints `INSUFFICIENT SAMPLE` for any report type with fewer than 30
documents (a heuristic floor, not a statistical guarantee) and never reports a figure as "accuracy". The generated regression
documents (`--include-synthetic`) test the pipeline's behaviour on known cases and are reported separately.

## What is still missing - the exact samples needed

For each cell, **at least 30 distinct reports** (from different laboratories where possible, so layout variety is represented):

| Need | Why |
|---|---|
| **Scanned PDFs** of printed lab reports (flatbed/ADF, 150-300 dpi) | the Tesseract path; no real scan is in the repository |
| **Phone photographs** (angle, shadow, curl, mixed light) | the hardest case; Tesseract has no deskew here |
| **Digital PDFs from several labs**, incl. multi-column "soil health cards" and plain tables | only one two-column card exists |
| Reports that **print P and K as P2O5 / K2O** | to confirm they are routed as extras, not taken as elemental |
| Reports with **mg/kg, ppm, mS/cm, uS/cm, kg/acre** units | ambiguous-unit routing on real wording |
| Reports with **missing parameters**, handwritten values, stamps over numbers | missing/obscured routing |
| Reports in **Kannada / Hindi** or bilingual headers | `TESSERACT_LANG` is English only today |

## Format of one manifest entry

```json
{
  "id": "unique-slug",
  "file": "dataset/lab-x-2026-001.pdf",
  "sha256": "<sha-256 of exactly this file>",
  "report_type": "digital_pdf | scanned_pdf | scanned_image | photo_image",
  "laboratory": "who produced the report",
  "authorization": "who allowed this document to be used for evaluation, and how (e.g. signed consent from the farmer and lab)",
  "authorization_confirmed": true,
  "verified_by": "name(s) of the person(s) who compared every value with the paper/original; add a second reviewer if possible",
  "recorded_on": "YYYY-MM-DD",
  "ground_truth": {
    "nitrogen": {"value": 211.0, "unit": "kg/ha", "unit_stated": true},
    "iron": {"value": ">5", "unit": "mg/kg", "unit_stated": false}
  }
}
```

Rules: values are what the **report prints**, in the report's own unit (no conversion); list only parameters the report prints
(omitted = not on the report, never `0`); a bound such as `>5` is a string; `unit_stated` is `true` only if the unit is printed
beside that value. Never commit a report you are not authorized to share - keep real reports under `eval/dataset/` (add it to
`.gitignore` if they must stay private; the manifest then names them and the hash pins them).

## Reading the output

* **AUTO_WRONG** - read confidently (would be saved with no human) and wrong. This is the number that must stay at 0; its upper
  95% bound shrinks only as the sample grows (0 of 6 still allows up to 39%).
* **review_wrong** - wrong, but routed to a human: the safety net working. **review_right** - right but a human is asked anyway.
* Every proportion carries its count and a 95% Wilson interval; read the interval, not just the percentage.
