from app.services import crop_rules, nutrient_analyzer, severity_calculator, yield_predictor
from tests.fixtures.sample_data import (
    acidic_low_oc_maize_soil,
    deficient_oil_palm_soil,
    healthy_rice_soil,
)


def test_expected_yield_exceeds_current_yield_when_deficient():
    requirement = crop_rules.get_crop_requirement("oil_palm")
    analysis = nutrient_analyzer.analyze(deficient_oil_palm_soil(), requirement)
    severity = severity_calculator.calculate(analysis)
    prediction = yield_predictor.predict(requirement, analysis, severity)

    assert prediction.expected_yield_t_ha > prediction.current_yield_t_ha
    assert prediction.additional_yield_t_ha > 0


def test_healthy_soil_current_equals_expected():
    requirement = crop_rules.get_crop_requirement("rice")
    analysis = nutrient_analyzer.analyze(healthy_rice_soil(), requirement)
    severity = severity_calculator.calculate(analysis)
    prediction = yield_predictor.predict(requirement, analysis, severity)

    assert prediction.current_yield_t_ha == prediction.expected_yield_t_ha
    assert prediction.additional_yield_t_ha == 0


def test_ph_and_oc_limiting_flags_set_and_penalty_applied_to_both():
    requirement = crop_rules.get_crop_requirement("maize")
    analysis = nutrient_analyzer.analyze(acidic_low_oc_maize_soil(), requirement)
    severity = severity_calculator.calculate(analysis)
    prediction = yield_predictor.predict(requirement, analysis, severity)

    assert prediction.ph_limiting is True
    assert prediction.organic_carbon_limiting is True
    # structural penalty means expected_yield is below optimal even after
    # nutrient correction
    assert prediction.expected_yield_t_ha < prediction.optimal_yield_t_ha


def test_yield_predictions_are_strictly_non_negative():
    samples = [
        ("oil_palm", deficient_oil_palm_soil()),
        ("rice", healthy_rice_soil()),
        ("maize", acidic_low_oc_maize_soil()),
    ]
    for crop_name, sample in samples:
        requirement = crop_rules.get_crop_requirement(crop_name)
        analysis = nutrient_analyzer.analyze(sample, requirement)
        severity = severity_calculator.calculate(analysis)
        prediction = yield_predictor.predict(requirement, analysis, severity)

        assert prediction.current_yield_t_ha >= 0
        assert prediction.expected_yield_t_ha >= 0
        assert prediction.additional_yield_t_ha >= 0


