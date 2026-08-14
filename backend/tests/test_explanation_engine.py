from app.services import (
    crop_rules,
    dosage_calculator,
    explanation_engine,
    nutrient_analyzer,
    roi_calculator,
    severity_calculator,
    yield_predictor,
)
from tests.fixtures.sample_data import deficient_oil_palm_soil, healthy_rice_soil


def _run_pipeline(soil, area_ha, crop):
    requirement = crop_rules.get_crop_requirement(crop)
    analysis = nutrient_analyzer.analyze(soil, requirement)
    severity = severity_calculator.calculate(analysis)
    dosage_plan = dosage_calculator.calculate(analysis, area_ha=area_ha)
    prediction = yield_predictor.predict(requirement, analysis, severity)
    roi = roi_calculator.calculate(dosage_plan, prediction, area_ha=area_ha)
    return requirement, analysis, severity, dosage_plan, prediction, roi


def test_explanation_mentions_deficient_nutrients_in_plain_language():
    requirement, analysis, severity, dosage_plan, prediction, roi = _run_pipeline(
        deficient_oil_palm_soil(), 2.0, "oil_palm"
    )
    explanation = explanation_engine.generate(
        requirement, analysis, severity, dosage_plan, prediction, roi
    )

    assert "Nitrogen" in explanation.summary or "Phosphorus" in explanation.summary
    assert len(explanation.identified_issues) >= 1
    assert len(explanation.recommended_actions) >= 1
    assert explanation.expected_benefit != ""
    # no leaking of raw technical internals
    joined = " ".join(explanation.identified_issues).lower()
    assert "severity_score" not in joined
    assert "kg_ha" not in joined


def test_explanation_for_healthy_soil_has_no_actions_needed_message():
    requirement, analysis, severity, dosage_plan, prediction, roi = _run_pipeline(
        healthy_rice_soil(), 1.0, "rice"
    )
    explanation = explanation_engine.generate(
        requirement, analysis, severity, dosage_plan, prediction, roi
    )

    assert "healthy" in explanation.summary.lower() or "no major" in explanation.summary.lower()
    assert any("no additional fertilizer" in a.lower() for a in explanation.recommended_actions)
