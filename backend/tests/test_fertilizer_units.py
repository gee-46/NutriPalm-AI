"""Unit conversions, product composition and basis-aware dosing.

The reference numbers below are hand-written from published conversion tables (P = 0.436 x P2O5, K = 0.830 x K2O;
e.g. Eurofins Agro "Phosphorus (P) versus phosphate (P2O5)", Cropaia agricultural conversion tables) and from the
nominal labelled grades; they are deliberately NOT computed from the module under test.
"""
import pytest
from pydantic import ValidationError

from app.exceptions import UnsupportedCrop, ValidationFailed
from app.schemas.inputs import SoilTestInput
from app.services import crop_rules, dosage_calculator, fertilizer_catalog as fc, nutrient_analyzer
from app.services.fertilizer_catalog import NutrientBasis
from tests.fixtures.sample_data import deficient_oil_palm_soil


# ------------------------------------------------------------------ stoichiometry
def test_conversion_factors_match_the_published_values():
    assert fc.P_PER_P2O5 == pytest.approx(0.436, abs=5e-4)
    assert fc.K_PER_K2O == pytest.approx(0.830, abs=5e-4)
    assert 1 / fc.P_PER_P2O5 == pytest.approx(2.29, abs=5e-3)
    assert 1 / fc.K_PER_K2O == pytest.approx(1.205, abs=5e-3)


def test_conversions_round_trip_and_leave_nitrogen_alone():
    for nutrient in ("p", "k"):
        oxide = fc.to_oxide(nutrient, 10.0, NutrientBasis.ELEMENTAL)
        assert fc.to_elemental(nutrient, oxide, NutrientBasis.OXIDE) == pytest.approx(10.0)
        # already on the requested basis: unchanged
        assert fc.to_oxide(nutrient, 10.0, NutrientBasis.OXIDE) == 10.0
        assert fc.to_elemental(nutrient, 10.0, NutrientBasis.ELEMENTAL) == 10.0
    assert fc.to_elemental("n", 10.0, NutrientBasis.OXIDE) == 10.0
    with pytest.raises(ValidationFailed):
        fc.to_oxide("n", 10.0, NutrientBasis.ELEMENTAL)
    with pytest.raises(ValidationFailed):
        fc.to_elemental("s", 1.0, NutrientBasis.ELEMENTAL)


def test_10kg_p2o5_is_4_36_kg_p_and_10kg_k2o_is_8_30_kg_k():
    assert fc.to_elemental("p", 10.0, NutrientBasis.OXIDE) == pytest.approx(4.36, abs=0.01)
    assert fc.to_elemental("k", 10.0, NutrientBasis.OXIDE) == pytest.approx(8.30, abs=0.01)


# ------------------------------------------------------------------ product composition
@pytest.mark.parametrize(
    "code,n,p2o5,k2o",
    [("urea", 46, 0, 0), ("dap", 18, 46, 0), ("mop", 0, 0, 60), ("ssp", 0, 16, 0), ("npk_complex_19_19_19", 19, 19, 19)],
)
def test_labelled_grades(code, n, p2o5, k2o):
    p = fc.get_product(code)
    assert (p.grade_n_pct, p.grade_p2o5_pct, p.grade_k2o_pct) == (n, p2o5, k2o)


def test_dap_carries_20_percent_elemental_p_not_46():
    dap = fc.get_product("dap")
    assert dap.fraction("p", NutrientBasis.OXIDE) == pytest.approx(0.46)
    assert dap.fraction("p", NutrientBasis.ELEMENTAL) == pytest.approx(0.2008, abs=5e-4)
    assert dap.fraction("n") == pytest.approx(0.18)
    assert dap.p_fraction == dap.fraction("p", NutrientBasis.ELEMENTAL)


def test_mop_carries_49_8_percent_elemental_k():
    assert fc.get_product("mop").fraction("k", NutrientBasis.ELEMENTAL) == pytest.approx(0.498, abs=1e-3)


def test_every_product_is_physically_possible_and_documents_where_its_grade_came_from():
    for code in fc.list_products():
        p = fc.get_product(code)
        grades = (p.grade_n_pct, p.grade_p2o5_pct, p.grade_k2o_pct)
        assert all(g >= 0 for g in grades)
        assert sum(grades) <= 100, "nutrient content cannot exceed the product's weight"
        assert p.grade_source.strip()
        assert p.default_price_per_kg_inr >= 0
        assert p.fraction("p", NutrientBasis.ELEMENTAL) <= p.fraction("p", NutrientBasis.OXIDE) + 1e-12


def test_product_with_invented_composition_is_gone_and_unknown_products_are_refused():
    assert "organic_compost" not in fc.list_products()
    with pytest.raises(ValidationFailed):
        fc.get_product("organic_compost")
    with pytest.raises(ValidationFailed):
        fc.get_product("magic-dust")
    with pytest.raises(ValidationFailed):
        fc.get_primary_source_for_nutrient("s")


# ------------------------------------------------------------------ dosing on an explicit basis
def _analysis_with_deficits():
    return nutrient_analyzer.analyze(deficient_oil_palm_soil(), crop_rules.get_crop_requirement("oil_palm"))


def _dose(plan, code):
    return next(d for d in plan.dosages if d.product_code == code)


def test_p_deficit_on_each_basis_gives_the_right_dap_quantity():
    analysis = _analysis_with_deficits()
    p_deficit = next(f.deficit_kg_ha for f in analysis.findings if f.nutrient == "p")  # 25 kg/ha for the fixture
    assert p_deficit == pytest.approx(25.0)

    elemental = dosage_calculator.calculate(analysis, 1.0, p_basis=NutrientBasis.ELEMENTAL)
    oxide = dosage_calculator.calculate(analysis, 1.0, p_basis=NutrientBasis.OXIDE)

    # 25 kg P / (0.46 x 0.4364) = 124.5 kg DAP ;  25 kg P2O5 / 0.46 = 54.3 kg DAP
    assert _dose(elemental, "dap").quantity_kg_per_ha == pytest.approx(124.5, abs=0.5)
    assert _dose(oxide, "dap").quantity_kg_per_ha == pytest.approx(54.35, abs=0.1)
    assert _dose(elemental, "dap").quantity_kg_per_ha / _dose(oxide, "dap").quantity_kg_per_ha == pytest.approx(2.29, abs=0.01)
    assert _dose(elemental, "dap").nutrient_basis == "elemental" and _dose(oxide, "dap").nutrient_basis == "oxide"


def test_k_basis_changes_the_mop_quantity_by_1_2x_and_never_affects_nitrogen_product():
    soil = SoilTestInput(
        soil_report_id="s", plot_id="p", owner_id="o", nitrogen_kg_ha=280, phosphorus_kg_ha=45,
        potassium_kg_ha=240, organic_carbon_percent=1.0, ph=5.5, verification_status="user_confirmed",
    )
    analysis = nutrient_analyzer.analyze(soil, crop_rules.get_crop_requirement("oil_palm"))  # K target 340 -> 100 kg/ha deficit
    elemental = dosage_calculator.calculate(analysis, 1.0, k_basis=NutrientBasis.ELEMENTAL)
    oxide = dosage_calculator.calculate(analysis, 1.0, k_basis=NutrientBasis.OXIDE)
    assert _dose(oxide, "mop").quantity_kg_per_ha == pytest.approx(100 / 0.60, abs=0.01)
    assert _dose(elemental, "mop").quantity_kg_per_ha == pytest.approx(100 / (0.60 * 0.8302), abs=0.1)
    assert _dose(elemental, "mop").quantity_kg_per_ha / _dose(oxide, "mop").quantity_kg_per_ha == pytest.approx(1.205, abs=0.005)


def test_nitrogen_credit_from_dap_uses_the_n_grade_not_the_p_basis():
    analysis = _analysis_with_deficits()
    a = dosage_calculator.calculate(analysis, 1.0, p_basis=NutrientBasis.ELEMENTAL)
    b = dosage_calculator.calculate(analysis, 1.0, p_basis=NutrientBasis.OXIDE)
    n_deficit = next(f.deficit_kg_ha for f in analysis.findings if f.nutrient == "n")
    for plan in (a, b):
        credited = _dose(plan, "dap").quantity_kg_per_ha * 0.18
        assert _dose(plan, "urea").quantity_kg_per_ha == pytest.approx((n_deficit - credited) / 0.46, abs=0.02)
    # more DAP (elemental basis) => more N credited => less urea
    assert _dose(a, "urea").quantity_kg_per_ha < _dose(b, "urea").quantity_kg_per_ha


def test_the_catalog_crops_default_to_a_declared_elemental_basis():
    for crop in crop_rules.list_supported_crops():
        req = crop_rules.get_crop_requirement(crop)
        assert req.p_basis == NutrientBasis.ELEMENTAL and req.k_basis == NutrientBasis.ELEMENTAL


def test_dosage_refuses_nonpositive_area_and_negative_prices():
    analysis = _analysis_with_deficits()
    with pytest.raises(ValidationFailed):
        dosage_calculator.calculate(analysis, 0.0)
    with pytest.raises(ValidationFailed):
        dosage_calculator.calculate(analysis, 1.0, price_overrides={"urea": -1.0})


# ------------------------------------------------------------------ missing / unsupported inputs
@pytest.mark.parametrize("missing", ["nitrogen_kg_ha", "phosphorus_kg_ha", "potassium_kg_ha", "organic_carbon_percent", "ph"])
def test_soil_input_without_a_required_value_cannot_be_built(missing):
    values = dict(
        soil_report_id="s", plot_id="p", owner_id="o", nitrogen_kg_ha=1, phosphorus_kg_ha=1, potassium_kg_ha=1,
        organic_carbon_percent=1, ph=6.0,
    )
    del values[missing]
    with pytest.raises(ValidationError):
        SoilTestInput(**values)


@pytest.mark.parametrize("field,value", [("nitrogen_kg_ha", -1), ("organic_carbon_percent", 101), ("ph", 0), ("ph", 15)])
def test_soil_input_rejects_impossible_values(field, value):
    values = dict(
        soil_report_id="s", plot_id="p", owner_id="o", nitrogen_kg_ha=1, phosphorus_kg_ha=1, potassium_kg_ha=1,
        organic_carbon_percent=1, ph=6.0,
    )
    values[field] = value
    with pytest.raises(ValidationError):
        SoilTestInput(**values)


@pytest.mark.parametrize("crop", ["", None, "cocoa", "arecanut", "Coconut Palm"])
def test_unsupported_or_blank_crops_have_no_requirement(crop):
    with pytest.raises(UnsupportedCrop):
        crop_rules.get_crop_requirement(crop)
