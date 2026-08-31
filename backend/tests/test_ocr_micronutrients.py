"""
Tests for micronutrient (Zn, Fe, Mn, Cu, B, S) extraction.

Uses a real, generated soil-report sample run through actual Tesseract OCR
(not hand-written strings), matching the pattern in test_ocr_pipeline.py.
"""
from __future__ import annotations

from app.ocr import extractor, validator
from app.ocr.pipeline import run_pipeline
from tests.fixtures.soil_report_files import (
    MICRONUTRIENT_MACRO_VALUES,
    MICRONUTRIENT_VALUES,
    micronutrient_report_pdf_bytes,
    report_without_micronutrients_pdf_bytes,
)


def _micronutrients_by_key(result):
    return {f.parameter: f for f in result.soil_parameters.micronutrients}


def test_real_ocr_extracts_all_micronutrients_from_sample_report():
    result = run_pipeline("micronutrients.pdf", micronutrient_report_pdf_bytes())

    assert result.success is True
    assert result.pages[0].route == "ocr_image"

    micros = _micronutrients_by_key(result)
    assert set(micros.keys()) == set(MICRONUTRIENT_VALUES.keys())

    for key, expected in MICRONUTRIENT_VALUES.items():
        field = micros[key]
        assert field.value == expected, f"{key}: got {field.value}, want {expected}"
        assert field.unit == "ppm"
        assert field.validation == "valid"
        assert field.raw_label is not None


def test_real_ocr_still_extracts_macronutrients_alongside_micronutrients():
    result = run_pipeline("micronutrients.pdf", micronutrient_report_pdf_bytes())

    for key, expected in MICRONUTRIENT_MACRO_VALUES.items():
        field = getattr(result.soil_parameters, key)
        assert field.value == expected
        assert field.validation == "valid"


def test_report_with_no_micronutrient_section_returns_null_not_fabricated():
    """A real text-layer PDF with only macronutrients -- every
    micronutrient must come back null/missing, never guessed."""
    result = run_pipeline(
        "macro_only.pdf", report_without_micronutrients_pdf_bytes()
    )

    assert result.success is True
    micros = _micronutrients_by_key(result)
    assert len(micros) == 6  # always one entry per known micronutrient
    for key, field in micros.items():
        assert field.value is None
        assert field.validation == "missing"


def test_extractor_preserves_original_label_unit_and_value_for_micronutrients():
    text = "Available Zinc (Zn)  0.62 ppm\nAvailable Boron (B)  0.42 ppm\n"
    fields = extractor.extract(text)

    assert fields["zinc"].value == 0.62
    assert fields["zinc"].unit == "ppm"
    assert "Zinc" in fields["zinc"].raw_label

    assert fields["boron"].value == 0.42
    assert fields["boron"].unit == "ppm"


def test_micronutrient_not_confused_with_element_symbol_in_other_labels():
    # "B" inside "Available Boron (B)" for phosphorus/potassium oxide forms
    # must not leak into unrelated matches.
    text = "P2O5  40 kg/ha\nK2O  60 kg/ha\nAvailable Boron (B)  0.42 ppm\n"
    fields = extractor.extract(text)

    assert fields["boron"].value == 0.42
    assert fields["phosphorus_pentoxide"].value == 40.0
    assert fields["potassium_oxide"].value == 60.0


def test_micronutrient_out_of_range_value_flagged_not_silently_fixed():
    text = "Available Zinc (Zn)  9999 ppm\n"
    fields = extractor.extract(text)
    validated = validator.validate(fields)

    assert validated["zinc"].value == 9999.0  # never altered
    assert validated["zinc"].validation == "unusable"
    assert validated["zinc"].warnings


def test_bare_sulfur_letter_is_low_confidence_and_reviewed():
    # A bare "S" match is inherently ambiguous; validator should route it
    # to review via the confidence threshold rather than auto-accepting it.
    text = "S  14.6 ppm\n"
    fields = extractor.extract(text)
    assert fields["sulfur"].value == 14.6
    assert fields["sulfur"].confidence < 0.65

    validated = validator.validate(fields)
    assert validated["sulfur"].validation == "review"


def test_api_response_includes_micronutrients(client):
    files = {
        "file": (
            "micronutrients.pdf",
            micronutrient_report_pdf_bytes(),
            "application/pdf",
        )
    }
    from tests.fixtures.sample_data import deficient_oil_palm_plot

    response = client.post(
        "/api/soil-reports/upload",
        data={"plot_id": deficient_oil_palm_plot().plot_id},
        files=files,
    )

    assert response.status_code == 200
    body = response.json()
    assert "micronutrients" in body
    micros_by_key = {m["parameter"]: m for m in body["micronutrients"]}
    for key, expected in MICRONUTRIENT_VALUES.items():
        assert micros_by_key[key]["value"] == expected
        assert micros_by_key[key]["unit"] == "ppm"
