"""Tests for app.ocr.extractor: context-aware label/number/unit extraction."""
from __future__ import annotations

from app.ocr import extractor


SAMPLE_REPORT_TEXT = """
SAMRUDDHI AGRI LABS - SOIL HEALTH REPORT
Sample ID: 9981
Farmer: Test Farmer   Plot: East-3A

Available Nitrogen (N)      245 kg/ha
Available Phosphorus (P)    18 kg/ha
Available Potassium (K)     142 kg/ha
Soil pH                     6.8
Electrical Conductivity (EC) 0.42 dS/m
Organic Carbon (OC)         0.62 %
"""


def test_extracts_all_canonical_parameters_with_context():
    fields = extractor.extract(SAMPLE_REPORT_TEXT)

    assert fields["nitrogen"].value == 245.0
    assert fields["nitrogen"].unit == "kg/ha"
    assert fields["phosphorus"].value == 18.0
    assert fields["potassium"].value == 142.0
    assert fields["ph"].value == 6.8
    assert fields["electrical_conductivity"].value == 0.42
    assert fields["organic_carbon"].value == 0.62


def test_does_not_confuse_sample_id_with_a_parameter():
    text = "Sample ID: 245\nSoil pH  6.8\n"
    fields = extractor.extract(text)

    # "Sample ID: 245" must never be picked up as nitrogen/phosphorus/etc.
    assert fields["nitrogen"].value is None
    assert fields["phosphorus"].value is None
    assert fields["potassium"].value is None
    assert fields["ph"].value == 6.8


def test_prefers_more_specific_label_over_bare_letter():
    text = "N  50\nAvailable Nitrogen (N)  245 kg/ha\n"
    fields = extractor.extract(text)

    # The specific "Available Nitrogen (N)" match should win over the bare
    # "N  50" match because of its higher base confidence.
    assert fields["nitrogen"].value == 245.0
    assert fields["nitrogen"].raw_label is not None
    assert "available" in fields["nitrogen"].raw_label.lower()


def test_missing_parameter_returns_null_not_a_guess():
    text = "Soil pH  6.8\nOrganic Carbon (OC)  0.62 %\n"
    fields = extractor.extract(text)

    assert fields["potassium"].value is None
    assert fields["potassium"].validation == "missing"
    assert fields["electrical_conductivity"].value is None


def test_handles_comma_thousands_separator():
    text = "Available Nitrogen (N)  1,245 kg/ha\n"
    fields = extractor.extract(text)
    assert fields["nitrogen"].value == 1245.0


def test_handles_ocr_digit_confusion_fallback():
    # 'O' substituted for '0' by a noisy scan.
    text = "Soil pH  6.O\n"
    fields = extractor.extract(text)
    assert fields["ph"].value == 6.0


def test_oxide_forms_kept_separate_from_elemental_values():
    text = "P2O5  40 kg/ha\nK2O  60 kg/ha\n"
    fields = extractor.extract(text)

    assert fields["phosphorus"].value is None
    assert fields["potassium"].value is None
    assert fields["phosphorus_pentoxide"].value == 40.0
    assert fields["potassium_oxide"].value == 60.0


def test_unit_normalization_variants():
    text = "Electrical Conductivity (EC)  0.8 mS/cm\n"
    fields = extractor.extract(text)
    assert fields["electrical_conductivity"].unit == "mS/cm"


def test_no_value_on_label_with_no_trailing_number():
    text = "Available Nitrogen (N) is within the optimal range this season.\n"
    fields = extractor.extract(text)
    assert fields["nitrogen"].value is None
