"""
recommendation_service.py

Orchestration layer. Coordinates, in order:

    Soil Data
        -> crop_rules            (load crop targets)
        -> nutrient_analyzer     (compare soil vs targets)
        -> severity_calculator   (score the deficiency)
        -> dosage_calculator     (turn deficits into fertilizer plan, using
                                   fertilizer_catalog)
        -> yield_predictor       (estimate current vs expected yield)
        -> roi_calculator        (estimate financial return)
        -> explanation_engine    (farmer-friendly write-up)
        -> Final Recommendation

This module contains NO business logic of its own beyond sequencing - every
calculation lives in its dedicated service. That keeps each piece unit
testable and replaceable independently (e.g. swapping the dosage strategy
later doesn't require touching this file).
"""
from __future__ import annotations

from dataclasses import dataclass

from app.schemas.inputs import PlotInput, SoilTestInput
from app.services import crop_rules, dosage_calculator, explanation_engine
from app.services import nutrient_analyzer, roi_calculator, severity_calculator
from app.services import yield_predictor
from app.services.dosage_calculator import DosagePlan
from app.services.explanation_engine import Explanation
from app.services.nutrient_analyzer import NutrientAnalysisResult
from app.services.roi_calculator import RoiResult
from app.services.severity_calculator import SeverityResult
from app.services.yield_predictor import YieldPrediction
from app.exceptions import ValidationFailed


@dataclass(frozen=True)
class RecommendationResult:
    plot_id: str
    soil_report_id: str
    owner_id: str
    crop: str
    analysis: NutrientAnalysisResult
    severity: SeverityResult
    dosage_plan: DosagePlan
    yield_prediction: YieldPrediction
    roi: RoiResult
    explanation: Explanation


def build_recommendation(
    plot: PlotInput,
    soil: SoilTestInput,
    crop_price_per_ton_inr: float | None = None,
    fertilizer_price_overrides: dict[str, float] | None = None,
) -> RecommendationResult:
    """
    Run the full pipeline for one plot + one soil report and return the
    complete, structured recommendation. Pure orchestration - all real
    computation happens in the individual services.

    Raises:
        UnsupportedCrop, ValidationFailed - propagated from the underlying
        services when inputs can't be processed.
    """
    if plot.plot_id != soil.plot_id:
        raise ValidationFailed(
            "soil.plot_id does not match plot.plot_id - refusing to mix data "
            "from two different plots."
        )
    if plot.owner_id != soil.owner_id:
        raise ValidationFailed(
            "soil.owner_id does not match plot.owner_id - refusing to build a "
            "recommendation across ownership boundaries."
        )

    requirement = crop_rules.get_crop_requirement(plot.crop)
    area_ha = plot.area_in_hectares()

    analysis = nutrient_analyzer.analyze(soil, requirement)
    severity = severity_calculator.calculate(analysis)
    dosage_plan = dosage_calculator.calculate(
        analysis, area_ha, price_overrides=fertilizer_price_overrides
    )
    yield_prediction = yield_predictor.predict(requirement, analysis, severity)
    roi = roi_calculator.calculate(
        dosage_plan, yield_prediction, area_ha, crop_price_per_ton_inr=crop_price_per_ton_inr
    )
    explanation = explanation_engine.generate(
        requirement, analysis, severity, dosage_plan, yield_prediction, roi
    )

    return RecommendationResult(
        plot_id=plot.plot_id,
        soil_report_id=soil.soil_report_id,
        owner_id=plot.owner_id,
        crop=requirement.crop,
        analysis=analysis,
        severity=severity,
        dosage_plan=dosage_plan,
        yield_prediction=yield_prediction,
        roi=roi,
        explanation=explanation,
    )
