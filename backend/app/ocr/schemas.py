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

# Where the unit attached to an extracted value came from. A unit that the
# report does not state next to the value is NEVER treated as confirmed: the
# parameter's conventional unit is attached for display only ("assumed_default")
# and the field is held for human review (see validator.py).
UnitSource = Literal["stated", "assumed_default", "not_applicable"]

# Overall pipeline outcome for one document.
#   failed        - nothing usable could be read (corrupt file, OCR unavailable,
#                   timeout...). Nothing is persisted.
#   needs_review  - text was read, but at least one required value is missing,
#                   uncertain, repaired or out of range. A human must confirm
#                   or correct it before a soil report exists.
#   completed     - every required value was read clearly and validated.
ProcessingStatus = Literal["failed", "needs_review", "completed"]

# Bump when extraction/validation behaviour changes, so stored extractions can
# be traced to the logic that produced them.
PIPELINE_VERSION = "ocr-2.0"

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
    # --- provenance (where this value came from in the source document) ---
    extracted_text: str | None = Field(
        default=None,
        description="The numeric token exactly as read, before parsing (e.g. '>5', '245').",
    )
    source_text: str | None = Field(
        default=None,
        description="The line(s) of the document the value was read from (truncated).",
    )
    page: int | None = Field(default=None, description="1-based page of the source line.")
    unit_source: UnitSource | None = None
    normalizations: list[str] = Field(
        default_factory=list,
        description=(
            "Any automatic repair applied to the text this value was read from "
            "(OCR digit fixes, slash repair, value taken from a neighbouring line). "
            "A non-empty list always forces review."
        ),
    )


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
    status: ProcessingStatus = "failed"
    document_sha256: str | None = None
    pipeline_version: str = PIPELINE_VERSION
    page_count: int = 0
    ready_for_persistence: bool = Field(
        description=(
            "True only if every required field (nitrogen, phosphorus, "
            "potassium, ph, organic_carbon) is 'valid' and in the target "
            "unit. electrical_conductivity is optional in the DB schema so "
            "it does not gate this flag."
        )
    )
    errors: list[str] = Field(default_factory=list)


def all_fields(params: SoilParametersOut) -> dict[str, ExtractedField]:
    """Flatten SoilParametersOut into {parameter: field} (canonical, extras, micronutrients)."""
    out: dict[str, ExtractedField] = {
        key: getattr(params, key) for key in CANONICAL_PARAMETERS
    }
    for f in params.extras:
        out[f.parameter] = f
    for f in params.micronutrients:
        out[f.parameter] = f
    return out
