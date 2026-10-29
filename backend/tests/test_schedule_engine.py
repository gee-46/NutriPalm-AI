"""
Published-schedule rules: record validation, the per-palm -> per-hectare -> product arithmetic, the refusals, and the API.

The fixture below uses ROUND PLACEHOLDER numbers (100/50/100 g ...) so expected values can be worked out by hand. They are
not agronomy. Real transcribed numbers are pinned separately in test_candidate_rules.py.
"""
import copy
import json
from datetime import date

import pytest

from app.schemas.inputs import PlotInput
from app.services import rule_provenance as rp
from app.services import schedule_engine as se
from app.services.fertilizer_catalog import P_PER_P2O5

TODAY = date(2026, 10, 30)


def schedule_record(**over):
    rec = {
        "rule_kind": "published_schedule",
        "crop": "oil_palm",
        "rule_version": "sched-test-1",
        "status": "approved",
        "test_fixture": True,
        "applicable_stage": "PLACEHOLDER stage",
        "region": "PLACEHOLDER region",
        "applicable_states": None,
        "units": {"dose": "g/palm/year"},
        "nutrient_basis": {"phosphorus": "oxide", "potassium": "oxide"},
        "age_basis": "Year N is the Nth 12-month period after planting.",
        "schedule": [
            {"age_year_from": 1, "age_year_to": 1, "n_g": 100, "p_g": 50, "k_g": 100},
            {"age_year_from": 2, "age_year_to": 2, "n_g": 200, "p_g": 100, "k_g": 200},
            {"age_year_from": 3, "age_year_to": None, "n_g": 400, "p_g": 200, "k_g": 400},
        ],
        "soil_test_adjustment": "none",
        "assumptions": ["PLACEHOLDER assumption"],
        "source": {"id": "ph", "title": "PLACEHOLDER", "publisher": "PLACEHOLDER", "edition": "1st", "year": 2020,
                   "locator": "Table 1", "quote": "PLACEHOLDER quotation of at least twenty characters"},
        "reviewed_by": {"name": "Placeholder Reviewer", "role": "agronomist"},
        "reviewed_on": "2026-10-01",
        "product_grades_verified": {"urea": "ref", "dap": "ref", "mop": "ref"},
        "covers_yield_and_economics": False,
    }
    rec.update(over)
    return rec


def problems(rec):
    return rp.validate_record(rec, today=TODAY, allow_test_fixture=True)


def rule_from(rec=None, tmp_path=None):
    rec = rec or schedule_record()
    path = tmp_path / "pack.json"
    path.write_text(json.dumps({"pack_version": "1", "rules": [rec]}), encoding="utf-8")
    pack = rp.load_pack(path, allow_test_fixture=True, today=TODAY)
    return pack[rec["crop"]]


def plot(**over):
    base = dict(plot_id="p1", owner_id="o1", crop="oil_palm", area=2, area_unit="hectare",
                planting_date=date(2020, 1, 15), plant_count=500, state="Karnataka")
    base.update(over)
    return PlotInput(**base)


# ------------------------------------------------------------------------------------------------ validation
def test_a_complete_approved_schedule_record_is_activatable():
    assert problems(schedule_record()) == []


@pytest.mark.parametrize("crop", ["oil_palm", "coconut"])
def test_schedule_records_work_for_catalog_crops(crop):
    assert problems(schedule_record(crop=crop)) == []


def test_unknown_rule_kind_is_rejected():
    assert any("rule_kind" in p for p in problems(schedule_record(rule_kind="magic")))


def test_a_crop_outside_the_catalog_is_rejected_even_with_a_schedule():
    assert any("not in the engine's crop catalog" in p for p in problems(schedule_record(crop="arecanut")))


@pytest.mark.parametrize(
    "field,value,needle",
    [
        ("units", {"dose": "kg/ha"}, "units must be exactly"),
        ("units", {"dose": "g/palm/year", "x": 1}, "units must be exactly"),
        ("units", None, "units must be exactly"),
        ("nutrient_basis", None, "nutrient_basis"),
        ("nutrient_basis", {"phosphorus": "oxide"}, "nutrient_basis"),
        ("nutrient_basis", {"phosphorus": "oxide", "potassium": "ash"}, "nutrient_basis"),
        ("age_basis", "", "age_basis"),
        ("age_basis", None, "age_basis"),
        ("soil_test_adjustment", "multiply", "soil_test_adjustment"),
        ("soil_test_adjustment", None, "soil_test_adjustment"),
        ("applicable_states", [], "applicable_states"),
        ("applicable_states", ["Karnataka", ""], "applicable_states"),
        ("applicable_states", "Karnataka", "applicable_states"),
        ("timing_note", "  ", "timing_note"),
        ("schedule", [], "schedule must be a non-empty list"),
        ("schedule", "x", "schedule must be a non-empty list"),
        ("status", "pending_review", "not 'approved'"),
        ("reviewed_by", None, "reviewed_by"),
        ("reviewed_on", None, "reviewed_on"),
    ],
)
def test_incomplete_or_wrong_schedule_fields_block_activation(field, value, needle):
    rec = schedule_record()
    rec[field] = value
    assert any(needle in p for p in problems(rec)), problems(rec)


def band(lo, hi, n=100, p=50, k=100):
    return {"age_year_from": lo, "age_year_to": hi, "n_g": n, "p_g": p, "k_g": k}


@pytest.mark.parametrize(
    "bands,needle",
    [
        ([band(2, None)], "starts at year 2, expected 1"),                       # must start at year 1
        ([band(1, 1), band(3, None)], "starts at year 3, expected 2"),           # gap
        ([band(1, 2), band(2, None)], "starts at year 2, expected 3"),           # overlap
        ([band(1, None), band(2, None)], "not the last band"),                    # open band not last
        ([band(1, 0)], "age_year_to must be null or an integer >= age_year_from"),
        ([band(0, 1)], "age_year_from must be an integer >= 1"),
        ([band(True, 1)], "age_year_from must be an integer >= 1"),
        ([band(1.5, 2)], "age_year_from must be an integer >= 1"),
        ([band(1, None, n=-1)], "n_g must be a finite number >= 0"),
        ([band(1, None, p=float("nan"))], "p_g must be a finite number >= 0"),
        ([band(1, None, k=float("inf"))], "k_g must be a finite number >= 0"),
        ([band(1, None, n=True)], "n_g must be a finite number >= 0"),
        ([band(1, None, n="400")], "n_g must be a finite number >= 0"),
        ([band(1, None, n=0, p=0, k=0)], "gives no nutrient at all"),
        ([band(1, None, n=5001)], "exceeds the plausibility limit"),               # a kg value typed as g x 1000
        ([band(1, None, p=3001)], "exceeds the plausibility limit"),
        ([band(1, None, k=8001)], "exceeds the plausibility limit"),
        ([{"age_year_from": 1, "age_year_to": None, "n_g": 1, "p_g": 1}], "exactly the keys"),
        (["x"], "exactly the keys"),
    ],
)
def test_schedule_band_defects_block_activation(bands, needle):
    assert any(needle in p for p in problems(schedule_record(schedule=bands))), problems(schedule_record(schedule=bands))


def test_zero_is_allowed_for_one_nutrient_when_the_source_states_zero():
    assert problems(schedule_record(schedule=[band(1, None, n=100, p=0, k=100)])) == []


def test_a_closed_last_band_is_allowed_and_the_engine_then_refuses_older_palms(tmp_path):
    rule = rule_from(schedule_record(schedule=[band(1, 3)]), tmp_path)
    out = se.build(plot(planting_date=date(2015, 1, 1)), "s1", rule, today=TODAY)
    assert isinstance(out, se.Blocked)
    assert [r.code for r in out.reasons] == ["age_outside_schedule"]
    assert "covers year 1 to year 3" in out.reasons[0].message


def test_two_records_for_one_crop_disable_the_crop_even_across_kinds(tmp_path):
    from tests.test_rule_validation import valid_record

    path = tmp_path / "pack.json"
    path.write_text(json.dumps({"rules": [schedule_record(), valid_record("oil_palm")]}), encoding="utf-8")
    assert rp.load_pack(path, allow_test_fixture=True, today=TODAY) == {}


def test_citation_carries_kind_basis_age_convention_and_region(tmp_path):
    rule = rule_from(None, tmp_path)
    c = rule.citation()
    assert c["rule_kind"] == "published_schedule"
    assert c["nutrient_basis"] == {"phosphorus": "oxide", "potassium": "oxide"}
    assert c["age_basis"].startswith("Year N")
    assert c["applicable_states"] is None


# ------------------------------------------------------------------------------------------------ age
@pytest.mark.parametrize(
    "planted,today,expected",
    [
        (date(2025, 10, 30), date(2026, 10, 29), 1),   # the day before the first anniversary
        (date(2025, 10, 30), date(2026, 10, 30), 2),   # the anniversary starts year 2
        (date(2025, 10, 30), date(2025, 10, 30), 1),   # planted today
        (date(2020, 1, 15), date(2026, 10, 30), 7),
        (date(2024, 2, 29), date(2025, 2, 28), 1),     # leap-day planting: not yet one year on 28 Feb
        (date(2024, 2, 29), date(2025, 3, 1), 2),
        (date(2026, 12, 31), date(2027, 12, 30), 1),   # year-end boundary
        (date(2026, 12, 31), date(2027, 12, 31), 2),
    ],
)
def test_age_year_counts_whole_years_since_planting(planted, today, expected):
    assert se.age_year_on(planted, today) == expected


def test_the_band_follows_the_age(tmp_path):
    rule = rule_from(None, tmp_path)
    got = {}
    for label, planted in {"y1": date(2026, 1, 1), "y2": date(2025, 6, 1), "y3": date(2024, 6, 1), "y9": date(2018, 1, 1)}.items():
        out = se.build(plot(planting_date=planted), "s1", rule, today=TODAY)
        got[label] = out.detail["per_palm_g_per_year"]["n"]
    assert got == {"y1": 100.0, "y2": 200.0, "y3": 400.0, "y9": 400.0}


# ------------------------------------------------------------------------------------------------ arithmetic (worked by hand)
def test_per_palm_doses_scale_to_plot_and_hectare_and_convert_to_products(tmp_path):
    """2 ha, 500 palms, year 7 band = 400 g N, 200 g P2O5, 400 g K2O per palm per year.

    plot total  : N 500 x 0.4 = 200 kg, P2O5 100 kg, K2O 200 kg      per hectare: 100 / 50 / 100 kg
    DAP (46 % P2O5)  : 50 / 0.46 = 108.70 kg/ha, carrying 108.70 x 0.18 = 19.57 kg N
    urea (46 % N)    : (100 - 19.57) / 0.46 = 174.86 kg/ha
    MOP (60 % K2O)   : 100 / 0.60 = 166.67 kg/ha
    """
    rule = rule_from(None, tmp_path)
    out = se.build(plot(), "s1", rule, today=TODAY)
    assert isinstance(out, se.ScheduleRecommendation)
    d = out.detail
    assert d["age_year"] == 7 and d["plant_count"] == 500 and d["palms_per_ha"] == 250.0
    assert d["plot_total_kg"] == {"n": 200.0, "p": 100.0, "k": 200.0}
    assert d["required_kg_per_ha"] == {"n": 100.0, "p": 50.0, "k": 100.0}
    by = {x.product_code: x for x in out.dosage_plan.dosages}
    assert by["dap"].quantity_kg_per_ha == pytest.approx(50 / 0.46, abs=0.01)
    assert by["urea"].quantity_kg_per_ha == pytest.approx((100 - 50 / 0.46 * 0.18) / 0.46, abs=0.05)
    assert by["mop"].quantity_kg_per_ha == pytest.approx(100 / 0.60, abs=0.01)
    assert by["dap"].quantity_kg_total == pytest.approx(2 * 50 / 0.46, abs=0.02)   # x 2 ha
    assert d["n_credited_from_dap_kg_per_ha"] == pytest.approx(50 / 0.46 * 0.18, abs=0.01)
    # per palm, in grams of product
    assert d["products_g_per_palm_per_year"]["mop"] == pytest.approx(200 / 0.60 / 500 * 1000, abs=0.1)


def test_delivered_nutrients_equal_the_published_requirement_with_no_double_counting(tmp_path):
    out = se.build(plot(), "s1", rule_from(None, tmp_path), today=TODAY)
    kg_ha = {x.product_code: x.quantity_kg_per_ha for x in out.dosage_plan.dosages}
    n_delivered = kg_ha["urea"] * 0.46 + kg_ha["dap"] * 0.18
    p2o5_delivered = kg_ha["dap"] * 0.46
    k2o_delivered = kg_ha["mop"] * 0.60
    assert n_delivered == pytest.approx(100.0, abs=0.1)      # DAP's N is counted once, urea tops up
    assert p2o5_delivered == pytest.approx(50.0, abs=0.1)
    assert k2o_delivered == pytest.approx(100.0, abs=0.1)


def test_the_basis_stated_by_the_source_decides_how_much_product_is_needed(tmp_path):
    """Same 50 kg/ha of phosphorus: 'oxide' means 50 kg P2O5 (108.7 kg DAP); 'elemental' means 50 kg P (= 114.6 kg P2O5 -> 249.1 kg DAP)."""
    as_oxide = se.build(plot(), "s1", rule_from(None, tmp_path), today=TODAY)
    elemental_rec = schedule_record(nutrient_basis={"phosphorus": "elemental", "potassium": "elemental"})
    sub = tmp_path / "e"
    sub.mkdir()
    as_element = se.build(plot(), "s1", rule_from(elemental_rec, sub), today=TODAY)
    dap_o = next(x for x in as_oxide.dosage_plan.dosages if x.product_code == "dap").quantity_kg_per_ha
    dap_e = next(x for x in as_element.dosage_plan.dosages if x.product_code == "dap").quantity_kg_per_ha
    assert dap_o == pytest.approx(50 / 0.46, abs=0.01)
    assert dap_e == pytest.approx(50 / P_PER_P2O5 / 0.46, abs=0.02)
    assert dap_e / dap_o == pytest.approx(1 / P_PER_P2O5, rel=0.001)   # 2.29x
    assert next(x for x in as_element.dosage_plan.dosages if x.product_code == "dap").nutrient_basis == "elemental"


def test_area_only_rescales_per_hectare_figures_never_the_per_palm_dose(tmp_path):
    rule = rule_from(None, tmp_path)
    small = se.build(plot(area=1), "s1", rule, today=TODAY)
    big = se.build(plot(area=4), "s1", rule, today=TODAY)
    assert small.detail["plot_total_kg"] == big.detail["plot_total_kg"]            # same palms, same total
    assert small.detail["required_kg_per_ha"]["n"] == 4 * big.detail["required_kg_per_ha"]["n"]
    assert small.detail["products_g_per_palm_per_year"] == big.detail["products_g_per_palm_per_year"]


def test_acres_are_converted_to_hectares(tmp_path):
    out = se.build(plot(area=5, area_unit="acre"), "s1", rule_from(None, tmp_path), today=TODAY)
    assert out.dosage_plan.area_ha == pytest.approx(5 * 0.4046856422)


def test_summary_states_source_dose_and_totals(tmp_path):
    out = se.build(plot(), "s1", rule_from(None, tmp_path), today=TODAY)
    s = out.explanation.summary
    assert "400 g N, 200 g P2O5, 400 g K2O per palm per year" in s and "500 palms" in s and "Table 1" in s
    assert any("do not change the dose" in w for w in out.explanation.warnings)
    assert out.explanation.expected_benefit is None   # no yield / revenue claim


def test_timing_text_is_shown_only_when_the_record_quotes_it(tmp_path):
    without = se.build(plot(), "s1", rule_from(None, tmp_path), today=TODAY)
    assert not any("Timing" in a for a in without.explanation.recommended_actions)
    sub = tmp_path / "t"
    sub.mkdir()
    with_note = se.build(plot(), "s1", rule_from(schedule_record(timing_note="QUOTED TEXT"), sub), today=TODAY)
    assert any("QUOTED TEXT" in a for a in with_note.explanation.recommended_actions)


# ------------------------------------------------------------------------------------------------ refusals
def test_missing_inputs_are_named_together_not_guessed(tmp_path):
    rule = rule_from(None, tmp_path)
    out = se.build(plot(planting_date=None, plant_count=None), "s1", rule, today=TODAY)
    assert isinstance(out, se.Blocked)
    assert {r.code for r in out.reasons} == {"planting_date_missing", "plant_count_missing"}
    assert "Record the planting date of the palms." in out.required and "Record the number of palms on the plot." in out.required


def test_future_planting_date_is_refused(tmp_path):
    out = se.build(plot(planting_date=date(2027, 1, 1)), "s1", rule_from(None, tmp_path), today=TODAY)
    assert [r.code for r in out.reasons] == ["planting_date_in_future"]


def test_region_bound_rule_needs_a_matching_recorded_state(tmp_path):
    rec = schedule_record(applicable_states=["Assam", "Meghalaya"])
    rule = rule_from(rec, tmp_path)
    assert [r.code for r in se.build(plot(state=None), "s1", rule, today=TODAY).reasons] == ["state_not_recorded"]
    out = se.build(plot(state="Karnataka"), "s1", rule, today=TODAY)
    assert [r.code for r in out.reasons] == ["region_not_covered"] and "Karnataka" in out.reasons[0].message
    ok = se.build(plot(state="  assam "), "s1", rule, today=TODAY)           # case / whitespace insensitive
    assert isinstance(ok, se.ScheduleRecommendation)


def test_a_rule_with_no_state_restriction_ignores_the_plot_state(tmp_path):
    out = se.build(plot(state=None), "s1", rule_from(None, tmp_path), today=TODAY)
    assert isinstance(out, se.ScheduleRecommendation)


def test_engine_will_not_run_a_deficit_rule(tmp_path):
    from tests.conftest import make_test_rule_pack

    with pytest.raises(ValueError):
        se.build(plot(), "s1", make_test_rule_pack()["oil_palm"], today=TODAY)


def test_plot_input_rejects_non_positive_palm_counts():
    with pytest.raises(Exception):
        PlotInput(plot_id="p", owner_id="o", crop="oil_palm", area=1, plant_count=0)


def test_repository_row_mapping_treats_bad_counts_as_not_recorded():
    from app.repositories.plot_repository import _row_to_plot_input

    base = {"id": "p", "owner_id": "o", "crop": "oil_palm", "area": 1, "area_unit": "acres"}
    assert _row_to_plot_input({**base, "plant_count": 0}).plant_count is None
    assert _row_to_plot_input({**base, "plant_count": -4}).plant_count is None
    assert _row_to_plot_input({**base, "plant_count": None}).plant_count is None
    assert _row_to_plot_input({**base, "plant_count": 120, "state": " Kerala ", "planting_date": "2021-05-01"}).plant_count == 120
    row = _row_to_plot_input({**base, "state": " Kerala ", "planting_date": "2021-05-01"})
    assert row.state == "Kerala" and row.planting_date == date(2021, 5, 1)


# ------------------------------------------------------------------------------------------------ API
@pytest.fixture
def api(client, tmp_path):
    """The shared client with a schedule rule installed and a plot that carries age and palm count."""
    from app.main import app
    from app.repositories.plot_repository import get_plot_repository
    from app.repositories.soil_report_repository import get_soil_report_repository
    from app.services.rule_provenance import get_rule_pack
    from tests.conftest import FakePlotRepository, FakeSoilReportRepository
    from tests.fixtures.sample_data import deficient_oil_palm_soil

    pack = rp.load_pack(_write(tmp_path, schedule_record()), allow_test_fixture=True, today=TODAY)

    class Plots(FakePlotRepository):
        def __init__(self):
            super().__init__()
            self.plots["test-plot-1"] = plot(plot_id="test-plot-1", owner_id="test-owner-1")
            self.plots["no-date"] = plot(plot_id="no-date", owner_id="test-owner-1", planting_date=None, plant_count=None)

    class Soils(FakeSoilReportRepository):
        def __init__(self):
            super().__init__()
            rich = deficient_oil_palm_soil().model_copy(update={
                "soil_report_id": "rich", "nitrogen_kg_ha": 900.0, "phosphorus_kg_ha": 400.0, "potassium_kg_ha": 1400.0})
            self.reports["rich"] = rich
            self.reports["soil-no-date"] = deficient_oil_palm_soil().model_copy(
                update={"soil_report_id": "soil-no-date", "plot_id": "no-date"})
            no_date_soil = deficient_oil_palm_soil().model_copy(update={
                "soil_report_id": "no-date-soil", "plot_id": "no-date"})
            self.reports["no-date-soil"] = no_date_soil

    app.dependency_overrides[get_rule_pack] = lambda: pack
    app.dependency_overrides[get_plot_repository] = lambda: Plots()
    app.dependency_overrides[get_soil_report_repository] = lambda: Soils()
    return client


def _write(tmp_path, rec):
    p = tmp_path / "api_pack.json"
    p.write_text(json.dumps({"rules": [rec]}), encoding="utf-8")
    return p


def test_api_returns_a_cited_schedule_recommendation_and_persists_it(api):
    r = api.post("/api/recommendations", json={"plot_id": "test-plot-1", "soil_report_id": "test-soil-1"})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["state"] == "generated" and body["recommendation_id"] == "rec-1"
    assert body["engine_version"] == rp.ENGINE_VERSION == "rec-2.2"
    assert body["findings"] == [] and body["overall_severity"] is None and body["yield_prediction"] is None and body["roi"] is None
    assert {d["product_code"] for d in body["fertilizer_plan"]} == {"dap", "urea", "mop"}
    prov = body["provenance"]
    assert prov["rule"]["rule_kind"] == "published_schedule" and prov["rule"]["rule_version"] == "sched-test-1"
    assert prov["schedule"]["age_year"] == 7 and prov["schedule"]["plant_count"] == 500
    assert prov["soil_values_used"]["nitrogen_kg_ha"] == 140.0           # echoed ...
    assert any("Soil-test values" in n for n in prov["not_considered"])  # ... and stated as not used
    # the stored row is exactly what was shown, and traceable to rule + engine
    row = api.get(f"/api/recommendations/{body['recommendation_id']}").json()
    assert row["engine_version"] == "rec-2.2" and row["provenance"]["rule"]["source"]["locator"] == "Table 1"


def test_the_dose_does_not_depend_on_the_soil_test_values(api):
    a = api.post("/api/recommendations", json={"plot_id": "test-plot-1", "soil_report_id": "test-soil-1"}).json()
    b = api.post("/api/recommendations", json={"plot_id": "test-plot-1", "soil_report_id": "rich"}).json()
    plan = lambda x: [(d["product_code"], d["quantity_kg_per_ha"], d["quantity_kg_total"]) for d in x["fertilizer_plan"]]
    assert plan(a) == plan(b)
    assert a["provenance"]["soil_values_used"] != b["provenance"]["soil_values_used"]


def test_api_answers_insufficient_data_naming_the_missing_plot_facts(api):
    r = api.post("/api/recommendations", json={"plot_id": "no-date", "soil_report_id": "no-date-soil"})
    assert r.status_code == 200
    body = r.json()
    assert body["state"] == "insufficient_data"
    assert {x["code"] for x in body["reasons"]} == {"planting_date_missing", "plant_count_missing"}
    assert "fertilizer_plan" not in body
    assert api.get("/api/recommendations").json() == []          # nothing persisted for a refusal


def test_unverified_soil_report_is_still_refused_for_schedule_rules(api):
    from app.main import app
    from app.repositories.soil_report_repository import get_soil_report_repository
    from tests.conftest import FakeSoilReportRepository
    from tests.fixtures.sample_data import deficient_oil_palm_soil

    class Unverified(FakeSoilReportRepository):
        def __init__(self):
            super().__init__()
            self.reports["test-soil-1"] = deficient_oil_palm_soil().model_copy(update={"verification_status": None})

    app.dependency_overrides[get_soil_report_repository] = lambda: Unverified()
    r = api.post("/api/recommendations", json={"plot_id": "test-plot-1", "soil_report_id": "test-soil-1"})
    assert r.status_code == 422 and r.json()["detail"]["code"] == "soil_report_not_verified"


def test_cross_farmer_access_to_a_schedule_recommendation_is_denied(api):
    from app.main import app
    from app.dependencies import AuthenticatedUser, get_current_user

    made = api.post("/api/recommendations", json={"plot_id": "test-plot-1", "soil_report_id": "test-soil-1"}).json()
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(user_id="someone-else", email=None)
    assert api.get(f"/api/recommendations/{made['recommendation_id']}").status_code == 404
    assert api.post("/api/recommendations", json={"plot_id": "test-plot-1", "soil_report_id": "test-soil-1"}).status_code == 404
