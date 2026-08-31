"""Tests for app.ocr.validator: range/unit/confidence checks that never
silently rewrite a value."""
from __future__ import annotations

from app.ocr.schemas import ExtractedField
from app.ocr.validator import MIN_CONFIDENCE_FOR_AUTO_VALID, validate


def _field(parameter: str, value, unit=None, confidence=0.95) -> ExtractedField:
    return ExtractedField(
        parameter=parameter,
        value=value,
        unit=unit,
        confidence=confidence,
        validation="review",
    )


def test_in_range_high_confidence_correct_unit_is_valid():
    fields = {"nitrogen": _field("nitrogen", 245.0, "kg/ha", 0.9)}
    result = validate(fields)
    assert result["nitrogen"].validation == "valid"
    assert result["nitrogen"].value == 245.0  # untouched


def test_missing_value_stays_missing():
    fields = {"potassium": ExtractedField(parameter="potassium", value=None)}
    result = validate(fields)
    assert result["potassium"].validation == "missing"


def test_impossible_value_is_unusable_but_not_altered():
    fields = {"nitrogen": _field("nitrogen", 50000.0, "kg/ha")}
    result = validate(fields)
    assert result["nitrogen"].validation == "unusable"
    assert result["nitrogen"].value == 50000.0  # never silently clamped/changed
    assert result["nitrogen"].warnings


def test_wrong_unit_flagged_for_review_value_preserved():
    fields = {"phosphorus": _field("phosphorus", 18.0, "mg/kg")}
    result = validate(fields)
    assert result["phosphorus"].validation == "review"
    assert result["phosphorus"].value == 18.0
    assert "mg/kg" in result["phosphorus"].warnings[0]


def test_low_confidence_forces_review_even_if_in_range():
    fields = {
        "ph": _field(
            "ph", 6.8, None, confidence=MIN_CONFIDENCE_FOR_AUTO_VALID - 0.1
        )
    }
    result = validate(fields)
    assert result["ph"].validation == "review"


def test_out_of_typical_but_within_hard_range_flagged_review():
    # pH 2.0 is within the hard [0, 14] range but well outside typical soil pH.
    fields = {"ph": _field("ph", 2.0, None, confidence=0.95)}
    result = validate(fields)
    assert result["ph"].validation == "review"


def test_equivalent_unit_ms_per_cm_accepted_for_ec():
    fields = {
        "electrical_conductivity": _field(
            "electrical_conductivity", 0.8, "mS/cm", confidence=0.9
        )
    }
    result = validate(fields)
    assert result["electrical_conductivity"].validation == "valid"


def test_missing_unit_does_not_block_validity_by_itself():
    fields = {"organic_carbon": _field("organic_carbon", 0.62, None, confidence=0.9)}
    result = validate(fields)
    assert result["organic_carbon"].validation == "valid"


def test_extra_oxide_field_always_marked_for_review():
    fields = {
        "phosphorus_pentoxide": _field(
            "phosphorus_pentoxide", 40.0, "kg/ha", confidence=0.95
        )
    }
    result = validate(fields)
    assert result["phosphorus_pentoxide"].validation == "review"
