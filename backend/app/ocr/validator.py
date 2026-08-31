"""
app/ocr/validator.py

Validates extracted soil parameters WITHOUT ever silently altering a value.

A value that looks suspicious is returned as-is, with validation="review"
and an explanatory warning. Only these transitions happen here:

    "review"  -> "valid"    (in range, in the target unit, confident enough)
    "review"  -> "unusable" (parse-adjacent nonsense: negative-after-fix,
                              wildly outside the physically possible range)
    "review"  -> "review"   (kept for manual confirmation)
    "missing" stays "missing" (no value was found at all)

Nothing here invents a value for a missing field.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from app.ocr.schemas import ExtractedField

# Target (persistable) unit for each canonical parameter. `None` means the
# parameter is dimensionless (pH).
TARGET_UNIT: dict[str, str | None] = {
    "nitrogen": "kg/ha",
    "phosphorus": "kg/ha",
    "potassium": "kg/ha",
    "ph": None,
    "electrical_conductivity": "dS/m",
    "organic_carbon": "%",
    "zinc": "mg/kg",
    "iron": "mg/kg",
    "manganese": "mg/kg",
    "copper": "mg/kg",
    "boron": "mg/kg",
    "sulfur": "mg/kg",
}

# Units that are numerically identical to the target unit and can be
# treated as equivalent without any conversion math (not a guess -- these
# are defined-equal units).
_UNIT_EQUIVALENTS: dict[str, set[str]] = {
    "dS/m": {"dS/m", "mS/cm"},
    "mg/kg": {"mg/kg", "ppm"},  # ppm == mg/kg for a solid matrix, by definition
}


@dataclass
class Range:
    hard_min: float
    hard_max: float
    typical_min: float
    typical_max: float


# Hard bounds: outside these, the value is physically implausible for this
# parameter regardless of confidence -> "unusable".
# Typical bounds: outside these but inside hard bounds -> flagged "review"
# even if otherwise well-formed, since it's an unusual reading worth a
# human glance.
RANGES: dict[str, Range] = {
    "nitrogen": Range(hard_min=0, hard_max=2000, typical_min=20, typical_max=800),
    "phosphorus": Range(hard_min=0, hard_max=500, typical_min=1, typical_max=200),
    "potassium": Range(hard_min=0, hard_max=1500, typical_min=20, typical_max=900),
    "ph": Range(hard_min=0, hard_max=14, typical_min=3.5, typical_max=10.0),
    "electrical_conductivity": Range(
        hard_min=0, hard_max=50, typical_min=0, typical_max=8
    ),
    "organic_carbon": Range(hard_min=0, hard_max=100, typical_min=0, typical_max=10),
    # Micronutrients, in mg/kg (== ppm). Typical bounds reflect the usual
    # range seen on Indian available-micronutrient soil tests (DTPA
    # extraction); hard bounds are wide, physically-implausible-value
    # backstops, not agronomic judgments.
    "zinc": Range(hard_min=0, hard_max=100, typical_min=0.1, typical_max=15),
    "iron": Range(hard_min=0, hard_max=1000, typical_min=1, typical_max=150),
    "manganese": Range(hard_min=0, hard_max=1000, typical_min=1, typical_max=150),
    "copper": Range(hard_min=0, hard_max=100, typical_min=0.05, typical_max=15),
    "boron": Range(hard_min=0, hard_max=50, typical_min=0.05, typical_max=8),
    "sulfur": Range(hard_min=0, hard_max=1000, typical_min=1, typical_max=150),
}

MIN_CONFIDENCE_FOR_AUTO_VALID = 0.65


def _unit_ok(parameter: str, unit: str | None) -> bool:
    target = TARGET_UNIT.get(parameter)
    if target is None:
        return True  # dimensionless (pH)
    if unit is None:
        # No unit was OCR'd at all. We allow this (common on Indian lab
        # reports where the units column is implied by convention) but it
        # is never auto-upgraded past "review" purely on that basis --
        # confidence/range checks still apply below.
        return True
    if unit == target:
        return True
    equivalents = _UNIT_EQUIVALENTS.get(target, set())
    return unit in equivalents


def _parse_numeric_value(val: float | str | None) -> float | None:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    # Extract the numeric part from inequality strings like ">5"
    m = re.search(r"[+-]?\d*\.?\d+", val)
    if m:
        try:
            return float(m.group(0))
        except ValueError:
            return None
    return None


def validate(fields: dict[str, ExtractedField]) -> dict[str, ExtractedField]:
    import re  # Ensure re is imported for helper

    for key, extracted_field in fields.items():
        if extracted_field.value is None:
            extracted_field.validation = "missing"
            continue

        range_ = RANGES.get(key)
        if range_ is None:
            # Extra/oxide-form fields: no persistence range defined, keep
            # as "review" so a human confirms before any conversion is
            # applied downstream.
            extracted_field.validation = "review"
            if not extracted_field.warnings:
                extracted_field.warnings.append(
                    "Oxide-form measurement -- not automatically converted "
                    "to the elemental value. Confirm before use."
                )
            continue

        val_numeric = _parse_numeric_value(extracted_field.value)
        if val_numeric is None:
            extracted_field.validation = "unusable"
            extracted_field.warnings.append(
                f"Value {extracted_field.value} could not be parsed as a number."
            )
            continue

        if not (range_.hard_min <= val_numeric <= range_.hard_max):
            extracted_field.validation = "unusable"
            extracted_field.warnings.append(
                f"Value {extracted_field.value} is outside the physically "
                f"plausible range [{range_.hard_min}, {range_.hard_max}] "
                "for this parameter. Likely OCR misread."
            )
            continue

        unit_ok = _unit_ok(key, extracted_field.unit)
        if not unit_ok:
            extracted_field.validation = "review"
            extracted_field.warnings.append(
                f"Unit '{extracted_field.unit}' does not match the expected "
                f"unit '{TARGET_UNIT[key]}' for {key}. Value is preserved "
                "as extracted; it will not be auto-converted."
            )
            continue

        out_of_typical = not (
            range_.typical_min <= val_numeric <= range_.typical_max
        )
        if out_of_typical:
            extracted_field.validation = "review"
            extracted_field.warnings.append(
                f"Value {extracted_field.value} is outside the typical "
                f"range [{range_.typical_min}, {range_.typical_max}] for "
                f"{key}. Worth a manual check."
            )
            continue

        if extracted_field.confidence < MIN_CONFIDENCE_FOR_AUTO_VALID:
            extracted_field.validation = "review"
            extracted_field.warnings.append(
                f"OCR confidence {extracted_field.confidence} is below the "
                f"auto-accept threshold ({MIN_CONFIDENCE_FOR_AUTO_VALID})."
            )
            continue

        extracted_field.validation = "valid"

    return fields
