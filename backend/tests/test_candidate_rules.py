"""
The candidate rule files hold source-backed material that NO agronomist has approved. These tests make sure they (a) stay inert,
(b) say exactly what the sources printed, and (c) are one signature away from valid where the engine can express them.
"""
import json
from datetime import date
from pathlib import Path

import pytest

from app.services import fertilizer_catalog as fc
from app.services import rule_provenance as rp

CANDIDATES = Path(rp.DEFAULT_PACK_PATH).parent / "candidate_rules"


def load(name):
    return json.loads((CANDIDATES / name).read_text(encoding="utf-8"))


ALL = sorted(p.name for p in CANDIDATES.glob("*.json"))


def test_every_candidate_file_is_inert():
    assert ALL, "no candidate files found"
    # the default pack is the empty shipped file; candidates are never read by the loader
    assert rp.load_pack() == {}
    shipped = json.loads(Path(rp.DEFAULT_PACK_PATH).read_text(encoding="utf-8"))
    assert shipped["rules"] == []
    import re

    for name in ALL:
        raw = (CANDIDATES / name).read_text(encoding="utf-8")
        assert not re.search(r'"status"\s*:\s*"approved"', raw), f"{name} contains an approved record"
        doc = json.loads(raw)
        assert doc.get("status", "pending_review") == "pending_review", name
        assert not doc.get("reviewed_by") and not doc.get("reviewed_on"), f"{name} carries a reviewer; only an agronomist may add one"
        if "_candidate" in doc:
            assert "PENDING" in doc["_candidate"]["state"], name


def test_candidates_cannot_be_activated_even_by_pointing_the_pack_at_them(tmp_path):
    """The loader wraps records as {"rules": [...]}; a candidate placed there is still rejected for lacking approval."""
    oil = load("oil_palm_iiopr_indian_farming_2019.json")
    pack = tmp_path / "pack.json"
    pack.write_text(json.dumps({"rules": [oil]}), encoding="utf-8")
    assert rp.load_pack(pack, allow_test_fixture=True) == {}


def test_oil_palm_candidate_lacks_only_the_agronomists_approval():
    problems = rp.validate_record(load("oil_palm_iiopr_indian_farming_2019.json"), today=date(2026, 10, 30))
    assert problems == [
        "status is 'pending_review', not 'approved'",
        "reviewed_by must be {name, role}",
        "reviewed_on must be a YYYY-MM-DD date",
    ]


def test_oil_palm_candidate_signed_off_would_activate():
    """Shows the engine path is complete: adding a reviewer to a COPY (in memory, nothing saved) is all that is missing."""
    rec = load("oil_palm_iiopr_indian_farming_2019.json")
    rec.update(status="approved", reviewed_by={"name": "TEST", "role": "TEST"}, reviewed_on="2026-10-30")
    assert rp.validate_record(rec, today=date(2026, 10, 30)) == []


def test_oil_palm_candidate_matches_table_1_of_indian_farming_2019():
    """Table 1 (read from the rendered page): year 1 400/200/400, year 2 800/400/800, year 3 and above 1,200/600/1,200 g N/P2O5/K2O per palm per year."""
    rec = load("oil_palm_iiopr_indian_farming_2019.json")
    got = [(b["age_year_from"], b["age_year_to"], b["n_g"], b["p_g"], b["k_g"]) for b in rec["schedule"]]
    assert got == [(1, 1, 400, 200, 400), (2, 2, 800, 400, 800), (3, None, 1200, 600, 1200)]
    assert rec["nutrient_basis"] == {"phosphorus": "oxide", "potassium": "oxide"}      # the table is headed P2O5 / K2O
    assert rec["units"] == {"dose": "g/palm/year"}
    assert rec["applicable_states"] is None                                               # an open question, recorded as such
    assert rec["source"]["year"] == 2019 and "Table 1" in rec["source"]["locator"]
    assert any("Region" in q for q in rec["_candidate"]["open_questions"])


def test_oil_palm_candidate_worked_example_for_a_real_sized_plot():
    """Year-3+ palms, 143 palms on 1 ha (an illustrative plot, not a claim about spacing): products from the printed dose."""
    from app.schemas.inputs import PlotInput
    from app.services import schedule_engine as se

    rec = load("oil_palm_iiopr_indian_farming_2019.json")
    rec.update(status="approved", reviewed_by={"name": "TEST", "role": "TEST"}, reviewed_on="2026-10-30")
    pack_rule = rp.VerifiedRule(
        crop="oil_palm", rule_version=rec["rule_version"], source=rec["source"], reviewed_by="TEST, TEST", reviewed_on="2026-10-30",
        covers_yield_and_economics=False, applicable_stage=rec["applicable_stage"], region=rec["region"],
        assumptions=tuple(rec["assumptions"]), kind=rp.KIND_SCHEDULE, schedule=tuple(rec["schedule"]),
        nutrient_basis=rec["nutrient_basis"], age_basis=rec["age_basis"], applicable_states=None,
    )
    plot = PlotInput(plot_id="p", owner_id="o", crop="oil_palm", area=1, area_unit="hectare",
                     planting_date=date(2018, 5, 1), plant_count=143)
    out = se.build(plot, "s", pack_rule, today=date(2026, 10, 30))
    # 143 palms x 1.2 kg N = 171.6 kg; x 0.6 kg P2O5 = 85.8 kg; x 1.2 kg K2O = 171.6 kg (per 1 ha)
    assert out.detail["required_kg_per_ha"] == {"n": 171.6, "p": 85.8, "k": 171.6}
    by = {d.product_code: d.quantity_kg_per_ha for d in out.dosage_plan.dosages}
    assert by["dap"] == pytest.approx(85.8 / 0.46, abs=0.01)         # 186.52 kg DAP
    assert by["mop"] == pytest.approx(171.6 / 0.60, abs=0.01)        # 286.00 kg MOP
    assert by["urea"] == pytest.approx((171.6 - 186.52 * 0.18) / 0.46, abs=0.05)   # 299.6 kg urea after the DAP nitrogen credit


# ------------------------------------------------------------------------------------------------ coconut (engine-ready candidate)
COCONUT = "coconut_cpcri_indian_horticulture_2022.json"
# Table 1 as printed, p. 45 (rendered page): (May-June N, P2O5, K2O), (September-October N, P2O5, K2O); year 1 has only the second.
COCONUT_TABLE_1 = {
    1: (None, (50, 40, 135)),
    2: ((50, 40, 135), (110, 80, 270)),
    3: ((110, 80, 270), (220, 160, 540)),
    4: ((170, 120, 400), (330, 200, 800)),
}


def test_coconut_candidate_lacks_only_the_agronomists_approval():
    assert rp.validate_record(load(COCONUT), today=date(2026, 10, 30)) == [
        "status is 'pending_review', not 'approved'",
        "reviewed_by must be {name, role}",
        "reviewed_on must be a YYYY-MM-DD date",
    ]


def test_coconut_candidate_annual_totals_are_the_sum_of_the_two_printed_applications():
    rec = load(COCONUT)
    expected = {
        year: tuple(sum(part[i] for part in parts if part) for i in range(3)) for year, parts in COCONUT_TABLE_1.items()
    }
    assert expected == {1: (50, 40, 135), 2: (160, 120, 405), 3: (330, 240, 810), 4: (500, 320, 1200)}
    got = {b["age_year_from"]: (b["n_g"], b["p_g"], b["k_g"]) for b in rec["schedule"]}
    assert got == expected
    assert [b["age_year_to"] for b in rec["schedule"]] == [1, 2, 3, None]
    assert rec["_candidate"]["evidence"]["annual_totals_ENGINEER_ARITHMETIC_NOT_PRINTED"]["year_4_onwards"] == [500, 320, 1200]
    assert rec["nutrient_basis"] == {"phosphorus": "oxide", "potassium": "oxide"} and rec["source"]["year"] == 2022
    assert rec["applicable_states"] is None
    # the open questions must keep the disagreement with the North East bulletin visible
    assert any("North East" in q and "1050" in q for q in rec["_candidate"]["open_questions"])


def test_coconut_candidate_worked_example():
    """175 palms on 1 ha in year 6 (an illustrative plot): 500 : 320 : 1200 g per palm -> 87.5 / 56 / 210 kg per ha."""
    from app.schemas.inputs import PlotInput
    from app.services import schedule_engine as se

    rec = load(COCONUT)
    rule = rp.VerifiedRule(
        crop="coconut", rule_version=rec["rule_version"], source=rec["source"], reviewed_by="TEST, TEST", reviewed_on="2026-10-30",
        covers_yield_and_economics=False, applicable_stage=rec["applicable_stage"], region=rec["region"],
        assumptions=tuple(rec["assumptions"]), kind=rp.KIND_SCHEDULE, schedule=tuple(rec["schedule"]),
        nutrient_basis=rec["nutrient_basis"], age_basis=rec["age_basis"], applicable_states=None,
    )
    plot = PlotInput(plot_id="p", owner_id="o", crop="Coconut", area=1, area_unit="hectare",
                     planting_date=date(2020, 3, 1), plant_count=175)
    out = se.build(plot, "s", rule, today=date(2026, 10, 30))
    assert out.detail["age_year"] == 7 and out.detail["per_palm_g_per_year"] == {"n": 500.0, "p": 320.0, "k": 1200.0}
    assert out.detail["required_kg_per_ha"] == {"n": 87.5, "p": 56.0, "k": 210.0}
    by = {d.product_code: d.quantity_kg_per_ha for d in out.dosage_plan.dosages}
    assert by["dap"] == pytest.approx(56 / 0.46, abs=0.01)          # 121.74 kg
    assert by["mop"] == pytest.approx(210 / 0.60, abs=0.01)         # 350.00 kg
    assert by["urea"] == pytest.approx((87.5 - 121.74 * 0.18) / 0.46, abs=0.05)   # 142.6 kg after the DAP nitrogen credit
    young = se.build(plot.model_copy(update={"planting_date": date(2026, 3, 1)}), "s", rule, today=date(2026, 10, 30))
    assert young.detail["age_year"] == 1 and young.detail["per_palm_g_per_year"]["n"] == 50.0


# ------------------------------------------------------------------------------------------------ arecanut table as printed
def test_arecanut_dated_table_values_are_pinned_as_printed():
    t = load("arecanut_cpcri_kvk_folder2.json")["_candidate"]["evidence_dated_source"]["table_2_as_printed_g_per_palm_per_year"]
    assert t["nitrogen_N"] == [33, 66, 100] and t["phosphorus_P2O5"] == [13, 26, 40] and t["potassium_K2O"] == [46, 92, 140]
    assert t["products_when_phosphorus_source_is_DAP"]["DAP"] == [29, 58, 87]


# ------------------------------------------------------------------------------------------------ coconut worksheet
TABLE_3 = {  # (February-March, September-October) as (N, P2O5, K2O) g/palm, as printed on bulletin p. 20
    "tall": {
        "year_2": ((83, 67, 175), (83, 67, 175)),
        "year_3": ((167, 133, 350), (167, 133, 350)),
        "year_4_onwards": ((250, 200, 525), (250, 200, 525)),
    },
    "hybrid": {
        "year_2": ((83, 83, 333), (83, 83, 333)),
        "year_3": ((167, 167, 666), (167, 167, 666)),
        "year_4_onwards": ((250, 250, 1000), (250, 250, 1000)),
    },
}


def test_coconut_derived_annual_totals_are_the_sum_of_the_two_printed_applications():
    derived = load("coconut_cpcri_bulletin156_2023.json")["_candidate"]["evidence_primary"][
        "derived_annual_totals_g_per_palm_per_year__ENGINEER_ARITHMETIC_NOT_PRINTED"]
    for variety, years in TABLE_3.items():
        for year, (a, b) in years.items():
            assert derived[variety][year] == [a[i] + b[i] for i in range(3)], (variety, year)
    assert derived["tall"]["year_1"] == [50, 40, 105] and derived["hybrid"]["year_1"] == [50, 50, 200]   # one application only


def test_coconut_worksheet_records_the_internal_disagreement_and_the_engine_blockers():
    c = load("coconut_cpcri_bulletin156_2023.json")["_candidate"]
    assert "690" in c["evidence_primary"]["text_that_disagrees_with_the_table"]
    assert "variety" in c["engine_support"].lower() and "north east" in c["engine_support"].lower()
    assert any("690" in q for q in c["open_questions"])
    # the undated web page is kept as a secondary note and explicitly not used as an engine source
    assert "Cannot be an engine source" in c["evidence_secondary_not_a_dated_publication"]["note"]


def test_the_coconut_worksheet_cannot_be_loaded_as_a_rule():
    doc = load("coconut_cpcri_bulletin156_2023.json")
    assert rp.validate_record(doc, today=date(2026, 10, 30)), "a worksheet must never validate as a rule record"


# ------------------------------------------------------------------------------------------------ arecanut worksheet
def test_arecanut_derived_young_palm_doses_are_one_third_and_two_thirds_of_the_printed_dose():
    c = load("arecanut_cpcri_kvk_folder2.json")["_candidate"]
    full = (100, 40, 140)
    d = c["derived_by_engineer_arithmetic_not_printed"]["schedule_g_per_palm_per_year"]
    assert d["year_3_onwards"] == list(full)
    assert d["year_1"] == [round(x / 3, 1) for x in full]
    assert d["year_2"] == [round(x * 2 / 3, 1) for x in full]
    assert "NOT PRINTED" in c["evidence"]["year"]
    assert "100 g N, 40 g P2O5 and 140 g K2O per palm per year" in c["evidence"]["verbatim"]


def test_arecanut_is_not_a_catalog_crop_so_it_cannot_become_a_rule_yet():
    from app.services import crop_rules

    assert "arecanut" not in crop_rules.list_supported_crops()
    assert any("crop catalog" in p for p in rp.validate_record({"crop": "arecanut", "rule_kind": "published_schedule"}))


# ------------------------------------------------------------------------------------------------ catalog grades vs the FCO text read
@pytest.mark.parametrize(
    "code,needles",
    [
        ("urea", ("46.00", "Urea (46% N)")),
        ("dap", ("18.0", "46.0", "18-46-0")),
        ("mop", ("60.0", "Muriate of Potash")),
        ("ssp", ("16.0", "Single Superphosphate")),
    ],
)
def test_catalog_grades_agree_with_the_fco_evidence_recorded_for_them(code, needles):
    p = fc.get_product(code)
    assert "G.S.R. 758(E)" in p.grade_source and "not confirmed against the current Schedule I" in p.grade_source
    for n in needles:
        assert n in p.grade_source
    grades = {"urea": (46.0, 0, 0), "dap": (18.0, 46.0, 0), "mop": (0, 0, 60.0), "ssp": (0, 16.0, 0)}[code]
    assert (p.grade_n_pct, p.grade_p2o5_pct, p.grade_k2o_pct) == grades


def test_npk_19_19_19_is_still_marked_unconfirmed():
    assert "secondary sources only" in fc.get_product("npk_complex_19_19_19").grade_source
