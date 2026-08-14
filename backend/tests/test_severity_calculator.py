from app.services import crop_rules, nutrient_analyzer, severity_calculator
from app.services.severity_calculator import SeverityCategory
from tests.fixtures.sample_data import deficient_oil_palm_soil, healthy_rice_soil


def test_severity_zero_for_healthy_soil():
    requirement = crop_rules.get_crop_requirement("rice")
    analysis = nutrient_analyzer.analyze(healthy_rice_soil(), requirement)
    result = severity_calculator.calculate(analysis)

    assert result.overall_score == 0.0
    assert result.overall_category == SeverityCategory.NONE


def test_severity_positive_for_deficient_soil():
    requirement = crop_rules.get_crop_requirement("oil_palm")
    analysis = nutrient_analyzer.analyze(deficient_oil_palm_soil(), requirement)
    result = severity_calculator.calculate(analysis)

    assert result.overall_score > 0.0
    assert result.overall_category in (
        SeverityCategory.MILD,
        SeverityCategory.MODERATE,
        SeverityCategory.SEVERE,
    )
    n_severity = next(s for s in result.per_nutrient if s.nutrient == "n")
    assert n_severity.severity_score > 0.0


def test_severity_score_capped_at_one():
    requirement = crop_rules.get_crop_requirement("oil_palm")
    from app.schemas.inputs import SoilTestInput

    extreme_soil = SoilTestInput(
        soil_report_id="s",
        plot_id="p",
        owner_id="o",
        nitrogen_kg_ha=0.0,
        phosphorus_kg_ha=0.0,
        potassium_kg_ha=0.0,
        organic_carbon_percent=1.0,
        ph=5.5,
    )
    analysis = nutrient_analyzer.analyze(extreme_soil, requirement)
    result = severity_calculator.calculate(analysis)

    assert all(s.severity_score <= 1.0 for s in result.per_nutrient)
