# Fertilizer source register

Every source consulted for the fertilizer rules, what was actually read, and what it supports. **Nothing here is approved by an agronomist and no institution has endorsed or supplied data to NutriPalm AI.**
Sources were read on **2026-10-30** from the publisher's public PDF/page: text extracted with `pdftotext`, and every table that feeds a number was **rendered to an image and read visually** (several text layers were scrambled).
A search-result snippet was never used as evidence; where a snippet disagreed with the document (e.g. oil-palm doses shown in product terms) the document won.

Reuse and reproduction permission was **not established for any of them** (none of the pages read carries a licence). Numbers and short quotations are cited with attribution; the owner should confirm reuse terms before reproducing tables in product material.

## A. Sources that supply doses (candidate rules in `backend/app/services/data/candidate_rules/`)

| ID | Document | Publisher / authors | Date | Locator | Type | Applies to | Engine can express it? | Candidate file |
|---|---|---|---|---|---|---|---|---|
| S1 | *4R Nutrient management practices for higher oil palm yield*, Indian Farming 69(08): 05-06 · [landing page](https://epubs.icar.org.in/index.php/IndFarm/article/view/94456) | ICAR (Indian Farming); S K Behera, K Suresh, R K Mathur (ICAR-IIOPR, ICAR-IISS) | Aug 2019 | Table 1, p. 5; timing p. 6 | Journal/extension article by ICAR scientists (not a formal package of practices) | Oil palm, by palm age (yr 1, 2, 3+); no region, variety or soil split stated | **Yes** (age + palm count) | `oil_palm_iiopr_indian_farming_2019.json` |
| S2 | *Adoption of advanced agro-technologies: A harbinger of enhanced income from Coconut, Arecanut and Cocoa farming*, Indian Horticulture, pp. 44-48 · [PDF](https://epubs.icar.org.in/index.php/IndHort/article/download/129748/48482/472819) | ICAR (Indian Horticulture); Surekha, Bhavishya, Subramanian P., Ravi Bhat, S. Elain Apshara (ICAR-CPCRI) | Nov-Dec 2022 | Coconut Table 1, p. 45; arecanut Table 2, p. 48 | Technology article by ICAR-CPCRI scientists ("the nutrient recommendations of ICAR-CPCRI should be followed (Table 1)") | Coconut by palm age (yr 1, 2, 3, 4+); arecanut by palm age (yr 1, 2, 3+); no region or variety stated | Coconut **yes**; arecanut **blocked by decision D11** (not an engine crop) | `coconut_cpcri_indian_horticulture_2022.json`; arecanut data in `arecanut_cpcri_kvk_folder2.json` |
| S3 | *Cultivation Practices of Coconut - North East India*, ICAR-CPCRI Technical Bulletin No. 156 · [PDF](https://cpcri.gov.in/filemgr/webfs/download/Coconut-NE-2023.pdf) | ICAR-CPCRI with the Coconut Development Board; Subramanian P. et al. | Aug 2023 | Table 3, p. 20 (text pp. 19-20) | Institute technical bulletin (primary, regional) | **North East India** (Assam trials), tall and hybrid separately | **No** (plots have no variety; region is North East only) | `coconut_cpcri_bulletin156_2023.json` (worksheet) |
| S4 | *Arecanut Cultivation Practices*, KVK Folder No. 2 · [PDF](https://cpcri.gov.in/filemgr/webfs/publication/arecanut_cultivation_practices(eng).pdf) | ICAR-CPCRI Krishi Vigyan Kendra, Kasaragod; published by M. K. Nair; compiled by V. M. Reddy, Ravi Bhat, M. R. Hegde | **year not printed** | "Fertilizer application", p. 3 of the PDF | Extension leaflet (scanned) | Arecanut, 100 g N : 40 g P2O5 : 140 g K2O per palm per year, 1/3 and 2/3 in years 1-2 | No (decision D11; no year) | `arecanut_cpcri_kvk_folder2.json` (worksheet; S2 Table 2 is the dated source) |
| S5 | ICAR-CPCRI web page *Research Achievements - Crop Production - Coconut Cultivation practices - Nutrient management* · [page](https://cpcri.gov.in/page/research_achievements_crop_production/) | ICAR-CPCRI | undated (site footer only) | item 3 | Institute web summary | Coconut adult palm: 500 g N, 320 g P2O5, 1200 g K2O per palm per year; "soil test based nutrient application is recommended"; "In acid soils, for soil test values of more than 20 ppm, P application can be skipped" | No (no edition/year; corroborates S2's year-4+ total) | cited inside the coconut files |

### What the sources say, exactly as used

* **S1 Table 1 (g/palm/year; N, P2O5, K2O, MgSO4):** 1st year 400, 200, 400, 125 · 2nd 800, 400, 800, 250 · 3rd and above 1,200, 600, 1,200, 500. Quote: "The details of nutrient recommendation in oil palm, based on the palm age is given in Table 1." The article also says the authors "suggested the need for modifying the existing rates based on soil and leaf analysis" (no rule given), and gives timing: four equal splits at three-month intervals under irrigation; two splits before the rains when rain-fed.
* **S2 coconut Table 1 (g/palm; May-June | September-October):** 1st year (planting May-June) 50, 40, 135 (Sept-Oct only) · 2nd 50, 40, 135 | 110, 80, 270 · 3rd 110, 80, 270 | 220, 160, 540 · 4th onwards 170, 120, 400 | 330, 200, 800. Annual totals (arithmetic): 50/40/135, 160/120/405, 330/240/810, **500/320/1200**.
* **S2 arecanut Table 2 (g/palm/year; N, P2O5, K2O):** first year 33, 13, 46 · second 66, 26, 92 · third onwards 100, 40, 140 (plus product-term columns).
* **S3 Table 3:** tall adult 250/200/525 + 250/200/525 (= 500/400/1050); hybrid adult 250/250/1000 + 250/250/1000 (= 500/500/2000). **The text on p. 19 says 690 g N for tall palms; the table sums to 500 g N** - an internal disagreement recorded, not resolved.
* **S3 vs S2 (adult coconut):** 500 : 400 : 1050 (tall, NE India) and 500 : 500 : 2000 (hybrid, NE India) against 500 : 320 : 1200 (S2, general). Region applicability is an agronomist decision (D15).

## B. Supporting sources (no doses)

| ID | Document | What it supports | Limits |
|---|---|---|---|
| S6 | Rajendiran S, Dotaniya M L, Coumar M V. *Paradigm shift in soil fertility ratings for sustainable crop production and environmental quality*. Indian Farming 70(03): 18-21, March 2020 (ICAR-DRMR) | Table 2 (p. 19, "adopted from Dhyan-Singh et al. 2005"): low / medium / high ratings - organic carbon <0.50 / 0.50-0.75 / >0.75 %; available P <10 / 10-25 / >25 kg/ha; K <120 / 120-280 / >280 kg/ha; N <280 / 280-560 / >560 kg/ha. States that "In low or high categories, the fertilizer doses are raised or lowered by 25% of general recommended doses, respectively" and that the fixed-rate approach "needs to be discouraged". | Extractant (Olsen/Bray, ammonium acetate...) and element-vs-oxide basis are **not stated**; the 25 % rule is a general statement, not crop-specific. **Not used by the engine.** |
| S7 | *The Fertiliser (Control) Order, 1985*, G.S.R. 758(E), 25 Sep 1985, Ministry of Agriculture (two public PDF copies read; consolidated; both copies refer to amendments up to at least 2003 and the current amendment level is unknown) | Schedule I Part A minimum guaranteed contents: **urea 46.00 % N** (1(a) no. 2); **DAP (18-46-0) total N 18.0 %, NAC-soluble P2O5 46.0 %** (1(d) no. 2); **muriate of potash water-soluble K2O 60.0 %** (1(c) no. 1); **single superphosphate 16.0 % water-soluble P2O5** (1(b) no. 1). Recorded in `fertilizer_catalog.py` (`_FCO_EVIDENCE`). | Not the **current** consolidated Schedule I (amended many times). The NPK 19:19:19 entry could not be read unambiguously and stays unconfirmed. A reviewer must confirm against the current Schedule I. |

## C. Looked for but not read (so not relied on)

| Candidate | Why unresolved |
|---|---|
| ICAR-IIOPR's own package of practices / bulletin (iiopr.icar.gov.in) | host did not resolve from this machine |
| KVK document `k0208_29.pdf` quoted by a search result (oil-palm product doses) | host did not resolve; the snippet expressed doses as urea/SSP/MOP weights, which disagree in form with S1 |
| *Coconut English No133* (CPCRI, `14.139.158.118`) | TLS handshake failed |
| TNAU "Fertilizer schedule for plantation crops", KAU package of practices, Vikaspedia / CELKAU pages, Akvopedia | seen only as search results; not opened, so not evidence |
| ICAR-IISS soil-test-crop-response (STCR) equations; state agricultural university soil-test calibration | only a search snippet was seen; not opened |
| Rice, maize, sugarcane, banana | **no source was found or read** - these crops have no candidate rule and stay `insufficient_data` |

## D. How the status of each crop reads today

| Crop | Source-backed candidate | Can the engine run it? | Active rule? |
|---|---|---|---|
| Oil palm | S1 (journal article) | yes | **no** - needs agronomist |
| Coconut | S2 (+ S5 corroboration; S3 conflicts for North East India) | yes | **no** - needs agronomist, incl. region decision |
| Arecanut | S2 Table 2 (+ S4) | no - not an engine crop (D11) | no |
| Rice, maize, sugarcane, banana | none | no sourced model | no |
