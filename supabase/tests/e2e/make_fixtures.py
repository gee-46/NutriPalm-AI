"""
Writes the E2E fixtures into the directory given as argv[1] (run with cwd = backend/ so `app` and `tests` import):

  soil_full.pdf       a clearly readable text-layer soil report        -> saved directly (auto_validated)
  soil_partial.pdf    N and P only; K, OC and pH are absent             -> goes to review
  test_schedule_rule_pack.json  a TEST-ONLY published-schedule pack (round placeholder doses: 100/50/100, 200/100/200, 1000/500/1000 g
                      per palm per year for years 1, 2, 3+). NOT agronomy and NOT a citation; used by the staging smoke self-test.
  test_rule_pack.json a TEST-ONLY verified-rule pack for oil palm. Its "source" is a placeholder, NOT a citation;
                      the shipped pack (backend/app/services/data/verified_rules.json) is empty on purpose.
"""
import json
import pathlib
import sys

from app.services import crop_rules
from tests.fixtures.soil_report_files import SAMPLE_LINES, text_layer_pdf_bytes

out = pathlib.Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=True)

(out / "soil_full.pdf").write_bytes(text_layer_pdf_bytes())

partial = [
    line.replace("18 kg/ha", "22 kg/ha")
    for line in SAMPLE_LINES
    if not any(k in line for k in ("Potassium", "Organic Carbon", "Soil pH"))
]
(out / "soil_partial.pdf").write_bytes(text_layer_pdf_bytes(lines=partial))

req = crop_rules.get_crop_requirement("oil_palm")
rule = {
    "crop": "oil_palm",
    "rule_version": "e2e-test-fixture",
    "status": "approved",
    "test_fixture": True,  # accepted only when ENVIRONMENT=development; rejected in staging/production
    "applicable_stage": "E2E TEST FIXTURE - no real stage",
    "region": "E2E TEST FIXTURE - no real region",
    "units": {"nutrient_targets": "kg/ha", "organic_carbon": "%"},
    "soil_test_basis": {"phosphorus": req.p_basis.value, "potassium": req.k_basis.value},
    "assumptions": ["E2E TEST FIXTURE: these numbers are the project's unverified defaults and are NOT agronomic advice."],
    "source": {
        "id": "e2e",
        "title": "E2E TEST FIXTURE - not a real source",
        "publisher": "NutriPalm tests",
        "edition": "none",
        "year": 2000,
        "locator": "n/a (fixture)",
        "quote": "E2E TEST FIXTURE - this text is a placeholder, not a quotation.",
    },
    "reviewed_by": {"name": "e2e harness", "role": "test fixture"},
    "reviewed_on": "2000-01-01",
    "product_grades_verified": {"urea": "fixture", "dap": "fixture", "mop": "fixture"},
    "targets": {
        k: getattr(req, k)
        for k in ("n_target_kg_ha", "p_target_kg_ha", "k_target_kg_ha", "ph_min", "ph_max", "organic_carbon_min_percent")
    },
}
(out / "test_rule_pack.json").write_text(json.dumps({"pack_version": "e2e", "rules": [rule]}))

schedule_rule = {
    "rule_kind": "published_schedule",
    "crop": "oil_palm",
    "rule_version": "e2e-schedule-fixture",
    "status": "approved",
    "test_fixture": True,
    "applicable_stage": "E2E TEST FIXTURE - no real stage",
    "region": "E2E TEST FIXTURE - no real region",
    "applicable_states": None,
    "units": {"dose": "g/palm/year"},
    "nutrient_basis": {"phosphorus": "oxide", "potassium": "oxide"},
    "age_basis": "E2E TEST FIXTURE: year N is the Nth 12-month period after planting.",
    "schedule": [
        {"age_year_from": 1, "age_year_to": 1, "n_g": 100, "p_g": 50, "k_g": 100},
        {"age_year_from": 2, "age_year_to": 2, "n_g": 200, "p_g": 100, "k_g": 200},
        {"age_year_from": 3, "age_year_to": None, "n_g": 1000, "p_g": 500, "k_g": 1000},
    ],
    "soil_test_adjustment": "none",
    "assumptions": ["E2E TEST FIXTURE: placeholder doses, NOT agronomic advice."],
    "source": {
        "id": "e2e-schedule",
        "title": "E2E TEST FIXTURE - not a real source",
        "publisher": "NutriPalm tests",
        "edition": "none",
        "year": 2000,
        "locator": "n/a (fixture)",
        "quote": "E2E TEST FIXTURE - this text is a placeholder, not a quotation.",
    },
    "reviewed_by": {"name": "e2e harness", "role": "test fixture"},
    "reviewed_on": "2000-01-01",
    "product_grades_verified": {"urea": "fixture", "dap": "fixture", "mop": "fixture"},
}
(out / "test_schedule_rule_pack.json").write_text(json.dumps({"pack_version": "e2e", "rules": [schedule_rule]}))
print("fixtures written to", out)
