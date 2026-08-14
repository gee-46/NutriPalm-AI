import pytest

from app.exceptions import ValidationFailed
from app.services import crop_rules, dosage_calculator, nutrient_analyzer
from tests.fixtures.sample_data import deficient_oil_palm_soil, healthy_rice_soil


def test_dosage_plan_has_entries_for_each_deficient_nutrient():
    requirement = crop_rules.get_crop_requirement("oil_palm")
    analysis = nutrient_analyzer.analyze(deficient_oil_palm_soil(), requirement)
    plan = dosage_calculator.calculate(analysis, area_ha=2.0)

    products = {d.product_code for d in plan.dosages}
    assert "urea" in products  # nitrogen source
    assert "dap" in products  # phosphorus source
    assert plan.total_fertilizer_kg() > 0
    assert plan.total_fertilizer_cost_inr() > 0


def test_dosage_plan_empty_for_healthy_soil():
    requirement = crop_rules.get_crop_requirement("rice")
    analysis = nutrient_analyzer.analyze(healthy_rice_soil(), requirement)
    plan = dosage_calculator.calculate(analysis, area_ha=1.0)

    assert plan.dosages == []
    assert plan.total_fertilizer_cost_inr() == 0


def test_dosage_scales_with_area():
    requirement = crop_rules.get_crop_requirement("oil_palm")
    analysis = nutrient_analyzer.analyze(deficient_oil_palm_soil(), requirement)
    plan_small = dosage_calculator.calculate(analysis, area_ha=1.0)
    plan_large = dosage_calculator.calculate(analysis, area_ha=2.0)

    assert plan_large.total_fertilizer_kg() == pytest.approx(
        plan_small.total_fertilizer_kg() * 2, rel=1e-6
    )


def test_dosage_rejects_zero_area():
    requirement = crop_rules.get_crop_requirement("oil_palm")
    analysis = nutrient_analyzer.analyze(deficient_oil_palm_soil(), requirement)
    with pytest.raises(ValidationFailed):
        dosage_calculator.calculate(analysis, area_ha=0)


def test_dosage_respects_price_overrides():
    requirement = crop_rules.get_crop_requirement("oil_palm")
    analysis = nutrient_analyzer.analyze(deficient_oil_palm_soil(), requirement)
    default_plan = dosage_calculator.calculate(analysis, area_ha=1.0)
    overridden_plan = dosage_calculator.calculate(
        analysis, area_ha=1.0, price_overrides={"urea": 100.0}
    )

    default_urea_cost = next(d.estimated_cost_inr for d in default_plan.dosages if d.product_code == "urea")
    overridden_urea_cost = next(
        d.estimated_cost_inr for d in overridden_plan.dosages if d.product_code == "urea"
    )
    assert overridden_urea_cost != default_urea_cost
