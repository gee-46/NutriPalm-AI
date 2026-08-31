"""
app/ocr/schemas.py

Strict structured-output models for the OCR / soil-report extraction layer.

These are intentionally separate from `app.schemas.inputs.SoilTestInput`
(the model the Recommendation Engine consumes). SoilTestInput represents a
*persisted, already-validated* soil report row. The models here represent
the richer intermediate result of extraction: per-field confidence, units,
validation status, and the raw label the text was matched against -- data
the Recommendation Engine does not need (per the integration contract) but
that the frontend/reviewer needs to trust or correct the OCR output.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

ValidationStatus = Literal["valid", "review", "missing", "unusable"]

# Canonical parameter keys this module recognizes.
CANONICAL_PARAMETERS = (
    "nitrogen",
    "phosphorus",
    "potassium",
    "ph",
    "electrical_conductivity",
    "organic_carbon",
)

# Extra parameters we may find on a report but do NOT silently fold into
# the canonical ones above, because they are chemically different
# measurements (oxide forms vs. elemental form).
EXTRA_PARAMETERS = (
    "phosphorus_pentoxide",  # P2O5
    "potassium_oxide",       # K2O
)

# Micronutrients. Reported separately from the extras above because they
# are always distinct, standalone measurements (never derived from N/P/K).
# Sulfur is only extracted here when explicitly labeled/classified as a
# secondary-nutrient "Sulphur"/"S" reading, not conflated with anything
# else on the report.
MICRONUTRIENT_PARAMETERS = (
    "zinc",       # Zn
    "iron",       # Fe
    "manganese",  # Mn
    "copper",     # Cu
    "boron",      # B
    "sulfur",     # S
)


class ExtractedField(BaseModel):
    """One extracted soil parameter, with provenance and quality info."""

    parameter: str
    raw_label: str | None = Field(
        default=None,
        description="The exact label text this value was matched against, e.g. 'Available Nitrogen'.",
    )
    value: float | str | None = None
    unit: str | None = None
    confidence: float = Field(ge=0.0, le=1.0, default=0.0)
    validation: ValidationStatus = "missing"
    warnings: list[str] = Field(default_factory=list)


class SoilParametersOut(BaseModel):
    """The six canonical parameters the Recommendation Engine cares about,
    plus any oxide-form values found (kept separate, never auto-converted),
    plus any micronutrients found on the report."""

    nitrogen: ExtractedField
    phosphorus: ExtractedField
    potassium: ExtractedField
    ph: ExtractedField
    electrical_conductivity: ExtractedField
    organic_carbon: ExtractedField
    extras: list[ExtractedField] = Field(default_factory=list)
    micronutrients: list[ExtractedField] = Field(
        default_factory=list,
        description=(
            "Zn, Fe, Mn, Cu, B, and (when explicitly reported) S. Always "
            "one entry per MICRONUTRIENT_PARAMETERS key -- entries for "
            "micronutrients not found on the report have value=None / "
            "validation='missing' rather than being omitted, so callers "
            "can distinguish 'not on this report' from 'not checked'."
        ),
    )


class PageResult(BaseModel):
    page_number: int
    route: Literal["text_layer", "ocr_image"]
    text: str
    ocr_mean_confidence: float | None = None


class OcrExtractionResult(BaseModel):
    """Full result of running the pipeline on one uploaded document."""

    success: bool
    raw_text: str
    pages: list[PageResult] = Field(default_factory=list)
    soil_parameters: SoilParametersOut
    ready_for_persistence: bool = Field(
        description=(
            "True only if every required field (nitrogen, phosphorus, "
            "potassium, ph, organic_carbon) is 'valid' and in the target "
            "unit. electrical_conductivity is optional in the DB schema so "
            "it does not gate this flag."
        )
    )
    errors: list[str] = Field(default_factory=list)
