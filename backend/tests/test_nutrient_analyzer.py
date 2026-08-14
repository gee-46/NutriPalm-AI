from app.services import crop_rules, nutrient_analyzer
from app.services.nutrient_analyzer import NutrientStatus
from tests.fixtures.sample_data import (
    acidic_low_oc_maize_soil,
    deficient_oil_palm_soil,
    healthy_rice_soil,
)


def test_deficient_soil_flags_n_and_p():
    requirement = crop_rules.get_crop_requirement("oil_palm")
    result = nutrient_analyzer.analyze(deficient_oil_palm_soil(), requirement)

    by_nutrient = {f.nutrient: f for f in result.findings}
    assert by_nutrient["n"].status == NutrientStatus.DEFICIENT
    assert by_nutrient["n"].deficit_kg_ha > 0
    assert by_nutrient["p"].status == NutrientStatus.DEFICIENT
    assert by_nutrient["k"].status == NutrientStatus.ADEQUATE


def test_healthy_soil_has_no_deficiencies():
    requirement = crop_rules.get_crop_requirement("rice")
    result = nutrient_analyzer.analyze(healthy_rice_soil(), requirement)

    assert result.deficient_nutrients() == []
    assert result.ph_finding.in_range
    assert result.organic_carbon_finding.in_range


def test_acidic_low_oc_soil_flags_ph_and_organic_carbon():
    requirement = crop_rules.get_crop_requirement("maize")
    result = nutrient_analyzer.analyze(acidic_low_oc_maize_soil(), requirement)

    assert result.ph_finding.in_range is False
    assert result.organic_carbon_finding.in_range is False
