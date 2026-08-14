"""
api.py

Pydantic request/response models for the public recommendation API. These
are intentionally separate from the internal service dataclasses
(app/services/*.py) so the HTTP contract can evolve independently of
internal computation types.
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from app.services.dosage_calculator import DosagePlan
from app.services.explanation_engine import Explanation
from app.services.nutrient_analyzer import NutrientAnalysisResult
from app.services.recommendation_service import RecommendationResult
from app.services.roi_calculator import RoiResult
from app.services.severity_calculator import SeverityResult
from app.services.yield_predictor import YieldPrediction


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
    estimated_cost_inr: float


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
    expected_benefit: str
    warnings: list[str]


class RecommendationResponse(BaseModel):
    recommendation_id: str | None = None
    plot_id: str
    soil_report_id: str
    crop: str
    status: str = "generated"
    created_at: str | None = None

    findings: list[NutrientFindingOut]
    ph_in_range: bool
    organic_carbon_in_range: bool
    overall_severity: str
    fertilizer_plan: list[FertilizerDosageOut]
    yield_prediction: YieldPredictionOut
    roi: RoiOut
    explanation: ExplanationOut


def to_response(
    result: RecommendationResult,
    recommendation_id: str | None = None,
    status: str = "generated",
    created_at: str | None = None,
) -> RecommendationResponse:
    """Serialize a RecommendationResult (service layer) into the API shape."""
    return RecommendationResponse(
        recommendation_id=recommendation_id,
        plot_id=result.plot_id,
        soil_report_id=result.soil_report_id,
        crop=result.crop,
        status=status,
        created_at=created_at,
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
                estimated_cost_inr=d.estimated_cost_inr,
            )
            for d in result.dosage_plan.dosages
        ],
        yield_prediction=YieldPredictionOut(
            optimal_yield_t_ha=result.yield_prediction.optimal_yield_t_ha,
            current_yield_t_ha=result.yield_prediction.current_yield_t_ha,
            expected_yield_t_ha=result.yield_prediction.expected_yield_t_ha,
            additional_yield_t_ha=result.yield_prediction.additional_yield_t_ha,
            ph_limiting=result.yield_prediction.ph_limiting,
            organic_carbon_limiting=result.yield_prediction.organic_carbon_limiting,
        ),
        roi=RoiOut(
            fertilizer_cost=result.roi.fertilizer_cost,
            current_yield_total_t=result.roi.current_yield_total_t,
            expected_yield_total_t=result.roi.expected_yield_total_t,
            expected_additional_yield_t=result.roi.expected_additional_yield_t,
            crop_price_per_ton_inr=result.roi.crop_price_per_ton_inr,
            expected_additional_revenue=result.roi.expected_additional_revenue,
            estimated_profit=result.roi.estimated_profit,
            roi_percentage=result.roi.roi_percentage,
        ),
        explanation=ExplanationOut(
            summary=result.explanation.summary,
            identified_issues=result.explanation.identified_issues,
            recommended_actions=result.explanation.recommended_actions,
            expected_benefit=result.explanation.expected_benefit,
            warnings=result.explanation.warnings,
        ),
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
    )
