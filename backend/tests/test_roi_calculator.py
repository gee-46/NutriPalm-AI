import pytest

from app.exceptions import ValidationFailed
from app.services import (
    crop_rules,
    dosage_calculator,
    nutrient_analyzer,
    roi_calculator,
    severity_calculator,
    yield_predictor,
)
from tests.fixtures.sample_data import (
    deficient_oil_palm_soil,
    healthy_rice_soil,
)


TEST_CROP_PRICE = 13500.0


def _full_pipeline(soil, plot_area_ha, crop):
    requirement = crop_rules.get_crop_requirement(crop)
    analysis = nutrient_analyzer.analyze(
        soil,
        requirement,
    )
    severity = severity_calculator.calculate(
        analysis,
    )
    dosage_plan = dosage_calculator.calculate(
        analysis,
        area_ha=plot_area_ha,
    )
    prediction = yield_predictor.predict(
        requirement,
        analysis,
        severity,
    )

    return dosage_plan, prediction


def test_roi_is_dynamic_not_fixed():
    dosage_plan, prediction = _full_pipeline(
        deficient_oil_palm_soil(),
        2.0,
        "oil_palm",
    )

    roi_small = roi_calculator.calculate(
        dosage_plan,
        prediction,
        area_ha=2.0,
        crop_price_per_ton_inr=TEST_CROP_PRICE,
    )

    dosage_plan_big, prediction_big = _full_pipeline(
        deficient_oil_palm_soil(),
        5.0,
        "oil_palm",
    )

    roi_big = roi_calculator.calculate(
        dosage_plan_big,
        prediction_big,
        area_ha=5.0,
        crop_price_per_ton_inr=TEST_CROP_PRICE,
    )

    # Different area -> different absolute revenue/cost.
    assert (
        roi_small.expected_additional_revenue
        != roi_big.expected_additional_revenue
    )

    assert (
        roi_small.fertilizer_cost
        != roi_big.fertilizer_cost
    )


def test_roi_structure_fields_present():
    dosage_plan, prediction = _full_pipeline(
        deficient_oil_palm_soil(),
        2.0,
        "oil_palm",
    )

    roi = roi_calculator.calculate(
        dosage_plan,
        prediction,
        area_ha=2.0,
        crop_price_per_ton_inr=TEST_CROP_PRICE,
    )

    assert roi.fertilizer_cost >= 0
    assert roi.expected_additional_yield_t >= 0
    assert roi.crop_value > 0
    assert roi.expected_additional_revenue >= 0
    assert isinstance(roi.estimated_profit, float)
    assert roi.crop_price_per_ton_inr == TEST_CROP_PRICE


def test_roi_none_fertilizer_cost_zero_gives_none_percentage():
    dosage_plan, prediction = _full_pipeline(
        healthy_rice_soil(),
        1.0,
        "rice",
    )

    roi = roi_calculator.calculate(
        dosage_plan,
        prediction,
        area_ha=1.0,
        crop_price_per_ton_inr=TEST_CROP_PRICE,
    )

    assert dosage_plan.total_fertilizer_cost_inr() == 0
    assert roi.roi_percentage is None


def test_roi_uses_explicit_crop_price_when_given():
    dosage_plan, prediction = _full_pipeline(
        deficient_oil_palm_soil(),
        2.0,
        "oil_palm",
    )

    roi_default = roi_calculator.calculate(
        dosage_plan,
        prediction,
        area_ha=2.0,
        crop_price_per_ton_inr=TEST_CROP_PRICE,
    )

    roi_custom = roi_calculator.calculate(
        dosage_plan,
        prediction,
        area_ha=2.0,
        crop_price_per_ton_inr=99999.0,
    )

    assert roi_default.crop_price_per_ton_inr == TEST_CROP_PRICE
    assert roi_custom.crop_price_per_ton_inr == 99999.0

    assert (
        roi_custom.expected_additional_revenue
        != roi_default.expected_additional_revenue
    )


def test_roi_requires_crop_price():
    dosage_plan, prediction = _full_pipeline(
        deficient_oil_palm_soil(),
        2.0,
        "oil_palm",
    )

    with pytest.raises(ValidationFailed):
        roi_calculator.calculate(
            dosage_plan,
            prediction,
            area_ha=2.0,
        )


def test_roi_rejects_zero_area():
    dosage_plan, prediction = _full_pipeline(
        deficient_oil_palm_soil(),
        2.0,
        "oil_palm",
    )

    with pytest.raises(ValidationFailed):
        roi_calculator.calculate(
            dosage_plan,
            prediction,
            area_ha=0,
            crop_price_per_ton_inr=TEST_CROP_PRICE,
        )


def test_roi_rejects_negative_price():
    dosage_plan, prediction = _full_pipeline(
        deficient_oil_palm_soil(),
        2.0,
        "oil_palm",
    )

    with pytest.raises(ValidationFailed):
        roi_calculator.calculate(
            dosage_plan,
            prediction,
            area_ha=2.0,
            crop_price_per_ton_inr=-1.0,
        )
