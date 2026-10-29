"""
api.py

Pydantic request/response models for the public recommendation API. These
are intentionally separate from the internal service dataclasses
(app/services/*.py) so the HTTP contract can evolve independently of
internal computation types.
"""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from app.ocr.schemas import ExtractedField
from app.services.dosage_calculator import DosagePlan
from app.services.explanation_engine import Explanation
from app.services.nutrient_analyzer import NutrientAnalysisResult
from app.services.recommendation_service import RecommendationResult
from app.services.roi_calculator import RoiResult
from app.services.severity_calculator import SeverityResult
from app.services.yield_predictor import YieldPrediction


class SoilReportUploadResponse(BaseModel):
    """
    Response for POST /api/soil-reports/upload, GET /extractions/{id} and
    POST /extractions/{id}/confirm.

    `status` is the processing state:
      failed        nothing could be read; nothing was saved
      needs_review  values were read but a human must confirm/correct some of
                    them (see `review_required`); no soil report exists yet
      completed     a verified soil report exists (`soil_report_id`)
    """

    success: bool
    status: Literal["failed", "needs_review", "completed"] = "failed"
    persisted: bool = Field(
        description="True once a verified soil report exists for this extraction."
    )
    reused: bool = Field(
        default=False,
        description="True when this exact document was already processed for the plot (OCR not repeated).",
    )
    extraction_id: str | None = None
    soil_report_id: str | None = None
    verification_status: str | None = None
    plot_id: str
    raw_text: str = Field(
        default="",
        description="Document text, returned only for a fresh read and never stored.",
    )
    nitrogen: ExtractedField
    phosphorus: ExtractedField
    potassium: ExtractedField
    ph: ExtractedField
    electrical_conductivity: ExtractedField
    organic_carbon: ExtractedField
    extras: list[ExtractedField] = Field(default_factory=list)
    micronutrients: list[ExtractedField] = Field(
        default_factory=list,
        description="Zn, Fe, Mn, Cu, B, and S (when explicitly reported).",
    )
    review_required: list[str] = Field(
        default_factory=list,
        description="Required parameters that are not yet 'valid' and need a decision.",
    )
    not_saved: list[str] = Field(
        default_factory=list,
        description="Optional parameters left out of the soil report (unconfirmed or unusable).",
    )
    corrections: list[dict] = Field(default_factory=list)
    pipeline_version: str | None = None
    page_count: int = 0
    warnings: list[str] = Field(default_factory=list)


class FieldCorrection(BaseModel):
    """A value the owner typed in place of (or for) an extracted one."""

    value: float = Field(allow_inf_nan=False)
    unit: str | None = Field(default=None, max_length=16)
    reason: str | None = Field(default=None, max_length=300)


class ConfirmExtractionRequest(BaseModel):
    corrections: dict[str, FieldCorrection] = Field(default_factory=dict)
    confirmed: list[str] = Field(
        default_factory=list,
        description="Parameters the owner checked against the report and accepts exactly as read.",
    )


class RecommendationRequest(BaseModel):
    plot_id: str = Field(..., description="Real plot id from the Plot module.")
    soil_report_id: str = Field(..., description="Real soil report id from the OCR module.")

    crop_price_per_ton_inr: float | None = Field(
        default=None,
        ge=0,
        description=(
            "Real/current crop selling price. If omitted, a V1 default from "
            "market_config.py is used when available."
        ),
    )
    fertilizer_price_overrides: dict[str, float] | None = Field(
        default=None,
        description="Optional {product_code: price_per_kg_inr} to override catalog defaults.",
    )


class NutrientFindingOut(BaseModel):
    nutrient: str
    display_name: str
    soil_value_kg_ha: float
    target_kg_ha: float
    status: str
    deficit_kg_ha: float
    percent_of_target: float


class FertilizerDosageOut(BaseModel):
    nutrient: str
    product_code: str
    product_display_name: str
    quantity_kg_per_ha: float
    quantity_kg_total: float
    nutrient_basis: str = "elemental"
    estimated_cost_inr: float | None = Field(
        default=None,
        description="Only set when the caller supplied a price for this product; catalog prices are not market data.",
    )


class YieldPredictionOut(BaseModel):
    optimal_yield_t_ha: float
    current_yield_t_ha: float
    expected_yield_t_ha: float
    additional_yield_t_ha: float
    ph_limiting: bool
    organic_carbon_limiting: bool


class RoiOut(BaseModel):
    fertilizer_cost: float
    current_yield_total_t: float
    expected_yield_total_t: float
    expected_additional_yield_t: float
    crop_price_per_ton_inr: float
    expected_additional_revenue: float
    estimated_profit: float
    roi_percentage: float | None


class ExplanationOut(BaseModel):
    summary: str
    identified_issues: list[str]
    recommended_actions: list[str]
    expected_benefit: str | None = None
    warnings: list[str]


class RecommendationProvenance(BaseModel):
    """Everything needed to trace a recommendation back to its inputs and its rule."""

    crop: str
    area_ha: float
    soil_report_id: str
    soil_verification_status: str
    soil_values_used: dict[str, float]
    rule: dict
    assumptions: list[str]
    not_considered: list[str]
    schedule: dict | None = Field(
        default=None,
        description="Published-schedule rules only: palm age year, per-palm doses, palm count and the arithmetic that led to the product quantities.",
    )


class RecommendationResponse(BaseModel):
    state: Literal["generated"] = "generated"
    recommendation_id: str | None = None
    plot_id: str
    soil_report_id: str
    crop: str
    status: str = "generated"
    created_at: str | None = None
    engine_version: str
    generated_at: str
    provenance: RecommendationProvenance

    findings: list[NutrientFindingOut] = Field(default_factory=list)
    ph_in_range: bool | None = None
    organic_carbon_in_range: bool | None = None
    overall_severity: str | None = None
    fertilizer_plan: list[FertilizerDosageOut]
    yield_prediction: YieldPredictionOut | None = Field(
        default=None,
        description="Present only when the verified rule's source also supports a yield model.",
    )
    roi: RoiOut | None = None
    explanation: ExplanationOut


class InsufficientReason(BaseModel):
    code: Literal[
        "crop_not_set",
        "unsupported_crop",
        "no_verified_rule",
        "state_not_recorded",
        "region_not_covered",
        "plant_count_missing",
        "planting_date_missing",
        "planting_date_in_future",
        "age_outside_schedule",
    ]
    message: str


class InsufficientDataResponse(BaseModel):
    """
    Returned (HTTP 200) instead of a recommendation when the engine must not give
    one. Nothing is saved. `required` says what would make a recommendation possible.
    """

    state: Literal["insufficient_data"] = "insufficient_data"
    plot_id: str
    soil_report_id: str
    crop: str | None
    engine_version: str
    generated_at: str
    reasons: list[InsufficientReason]
    required: list[str]


def to_response(
    result: RecommendationResult,
    recommendation_id: str | None = None,
    status: str = "generated",
    created_at: str | None = None,
    *,
    engine_version: str,
    generated_at: str,
    provenance: RecommendationProvenance,
    include_economics: bool = False,
    priced_products: set[str] | None = None,
) -> RecommendationResponse:
    """
    Serialize a RecommendationResult (service layer) into the API shape.

    Yield and revenue figures come from illustrative per-crop baselines
    (crop_rules.optimal_yield_t_ha, market_config), so they are included only when
    the verified rule says its source supports them. Costs are included only for
    products the caller priced; catalog prices are placeholders, not market data.
    """
    priced = priced_products or set()
    return RecommendationResponse(
        recommendation_id=recommendation_id,
        plot_id=result.plot_id,
        soil_report_id=result.soil_report_id,
        crop=result.crop,
        status=status,
        created_at=created_at,
        engine_version=engine_version,
        generated_at=generated_at,
        provenance=provenance,
        findings=[
            NutrientFindingOut(
                nutrient=f.nutrient,
                display_name=f.display_name,
                soil_value_kg_ha=f.soil_value_kg_ha,
                target_kg_ha=f.target_kg_ha,
                status=f.status.value,
                deficit_kg_ha=f.deficit_kg_ha,
                percent_of_target=f.percent_of_target,
            )
            for f in result.analysis.findings
        ],
        ph_in_range=result.analysis.ph_finding.in_range,
        organic_carbon_in_range=result.analysis.organic_carbon_finding.in_range,
        overall_severity=result.severity.overall_category.value,
        fertilizer_plan=[
            FertilizerDosageOut(
                nutrient=d.nutrient,
                product_code=d.product_code,
                product_display_name=d.product_display_name,
                quantity_kg_per_ha=d.quantity_kg_per_ha,
                quantity_kg_total=d.quantity_kg_total,
                nutrient_basis=d.nutrient_basis,
                estimated_cost_inr=d.estimated_cost_inr if d.product_code in priced else None,
            )
            for d in result.dosage_plan.dosages
        ],
        yield_prediction=(
            YieldPredictionOut(
                optimal_yield_t_ha=result.yield_prediction.optimal_yield_t_ha,
                current_yield_t_ha=result.yield_prediction.current_yield_t_ha,
                expected_yield_t_ha=result.yield_prediction.expected_yield_t_ha,
                additional_yield_t_ha=result.yield_prediction.additional_yield_t_ha,
                ph_limiting=result.yield_prediction.ph_limiting,
                organic_carbon_limiting=result.yield_prediction.organic_carbon_limiting,
            )
            if include_economics
            else None
        ),
        roi=(
            RoiOut(
                fertilizer_cost=result.roi.fertilizer_cost,
                current_yield_total_t=result.roi.current_yield_total_t,
                expected_yield_total_t=result.roi.expected_yield_total_t,
                expected_additional_yield_t=result.roi.expected_additional_yield_t,
                crop_price_per_ton_inr=result.roi.crop_price_per_ton_inr,
                expected_additional_revenue=result.roi.expected_additional_revenue,
                estimated_profit=result.roi.estimated_profit,
                roi_percentage=result.roi.roi_percentage,
            )
            if include_economics
            else None
        ),
        explanation=ExplanationOut(
            summary=result.explanation.summary,
            identified_issues=result.explanation.identified_issues,
            recommended_actions=result.explanation.recommended_actions,
            expected_benefit=result.explanation.expected_benefit if include_economics else None,
            warnings=result.explanation.warnings,
        ),
    )


def to_schedule_response(
    result,
    *,
    engine_version: str,
    generated_at: str,
    provenance: RecommendationProvenance,
    priced_products: set[str] | None = None,
) -> RecommendationResponse:
    """Serialize a schedule_engine.ScheduleRecommendation. No findings, severity, yield or revenue exist for it."""
    priced = priced_products or set()
    return RecommendationResponse(
        plot_id=result.plot_id,
        soil_report_id=result.soil_report_id,
        crop=result.crop,
        engine_version=engine_version,
        generated_at=generated_at,
        provenance=provenance,
        fertilizer_plan=[
            FertilizerDosageOut(
                nutrient=d.nutrient,
                product_code=d.product_code,
                product_display_name=d.product_display_name,
                quantity_kg_per_ha=d.quantity_kg_per_ha,
                quantity_kg_total=d.quantity_kg_total,
                nutrient_basis=d.nutrient_basis,
                estimated_cost_inr=d.estimated_cost_inr if d.product_code in priced else None,
            )
            for d in result.dosage_plan.dosages
        ],
        explanation=ExplanationOut(**result.explanation.model_dump()),
    )


class RecommendationRecordOut(BaseModel):
    """
    Shape returned by the history endpoints (GET /api/recommendations,
    GET /api/recommendations/{id}). Reads directly from the persisted
    `recommendations` row - the JSONB columns are already the structured
    output produced at generation time, so we return them as-is instead of
    re-deriving them.
    """

    id: str
    owner_id: str
    plot_id: str
    soil_report_id: str
    crop: str
    status: str
    created_at: str
    updated_at: str
    deficiencies: Any
    fertilizer_plan: Any
    yield_prediction: Any
    roi: Any
    explanation: Any
    engine_version: str | None = None
    generated_at: str | None = None
    provenance: Any = None


def row_to_record(row: dict) -> RecommendationRecordOut:
    import json

    def _maybe_parse(value: Any) -> Any:
        if isinstance(value, str):
            try:
                return json.loads(value)
            except (json.JSONDecodeError, TypeError):
                return value
        return value

    return RecommendationRecordOut(
        id=row["id"],
        owner_id=row["owner_id"],
        plot_id=row["plot_id"],
        soil_report_id=row["soil_report_id"],
        crop=row["crop"],
        status=row["status"],
        created_at=str(row["created_at"]),
        updated_at=str(row["updated_at"]),
        deficiencies=_maybe_parse(row.get("deficiencies")),
        fertilizer_plan=_maybe_parse(row.get("fertilizer_plan")),
        yield_prediction=_maybe_parse(row.get("yield_prediction")),
        roi=_maybe_parse(row.get("roi")),
        explanation=_maybe_parse(row.get("explanation")),
        engine_version=row.get("engine_version"),
        generated_at=str(row["generated_at"]) if row.get("generated_at") else None,
        provenance=_maybe_parse(row.get("provenance")),
    )
