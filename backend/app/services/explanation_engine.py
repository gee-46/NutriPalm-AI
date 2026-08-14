"""
explanation_engine.py

Converts the technical output of the AI pipeline (nutrient analysis,
severity, dosage plan, yield prediction, ROI) into simple, farmer-friendly
language. No severity scores, model internals, or database IDs are exposed
in the farmer-facing text.

Every sentence generated here is derived directly from the structured
results passed in - nothing is fabricated.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.services.crop_rules import CropRequirement
from app.services.dosage_calculator import DosagePlan
from app.services.nutrient_analyzer import NutrientAnalysisResult
from app.services.roi_calculator import RoiResult
from app.services.severity_calculator import SeverityCategory, SeverityResult
from app.services.yield_predictor import YieldPrediction

_NUTRIENT_ROLE_HINTS: dict[str, str] = {
    "n": "leaf and shoot growth",
    "p": "root development and flowering",
    "k": "fruit quality and disease resistance",
}


@dataclass(frozen=True)
class Explanation:
    summary: str
    identified_issues: list[str]
    recommended_actions: list[str]
    expected_benefit: str
    warnings: list[str]


def _identified_issues(analysis: NutrientAnalysisResult, severity: SeverityResult) -> list[str]:
    issues: list[str] = []
    severity_by_nutrient = {s.nutrient: s for s in severity.per_nutrient}

    for finding in analysis.deficient_nutrients():
        sev = severity_by_nutrient.get(finding.nutrient)
        level = sev.category.value if sev else "unknown"
        role = _NUTRIENT_ROLE_HINTS.get(finding.nutrient, "plant growth")
        issues.append(
            f"Your soil has a {level} {finding.display_name.lower()} deficiency, "
            f"which affects {role}."
        )

    if not analysis.ph_finding.in_range:
        if analysis.ph_finding.ph < analysis.ph_finding.ph_min:
            issues.append(
                f"Your soil pH ({analysis.ph_finding.ph}) is more acidic than ideal "
                f"for this crop ({analysis.ph_finding.ph_min}-{analysis.ph_finding.ph_max})."
            )
        else:
            issues.append(
                f"Your soil pH ({analysis.ph_finding.ph}) is more alkaline than ideal "
                f"for this crop ({analysis.ph_finding.ph_min}-{analysis.ph_finding.ph_max})."
            )

    if not analysis.organic_carbon_finding.in_range:
        issues.append(
            "Your soil's organic matter is lower than recommended, which reduces "
            "how well it holds nutrients and water."
        )

    if not issues:
        issues.append("No significant nutrient deficiencies were found in this soil test.")

    return issues


def _recommended_actions(dosage_plan: DosagePlan) -> list[str]:
    if not dosage_plan.dosages:
        return ["No additional fertilizer is currently needed for this plot."]

    actions = []
    for dosage in dosage_plan.dosages:
        actions.append(
            f"Apply {dosage.quantity_kg_total:.1f} kg of {dosage.product_display_name} "
            f"across the plot ({dosage.quantity_kg_per_ha:.1f} kg per hectare)."
        )
    actions.append(
        "Split large applications into 2-3 doses over the growing season rather than "
        "applying everything at once, to reduce nutrient loss."
    )
    return actions


def _expected_benefit(yield_prediction: YieldPrediction, roi: RoiResult) -> str:
    if yield_prediction.additional_yield_t_ha <= 0:
        return (
            "Your soil is already close to optimal for this crop, so no major "
            "yield increase is expected from additional fertilizer."
        )

    benefit = (
        f"If applied correctly, you can expect an additional "
        f"{roi.expected_additional_yield_t:.2f} tons of yield from this plot "
        f"(from {roi.current_yield_total_t:.2f} to {roi.expected_yield_total_t:.2f} tons), "
        f"worth an estimated ₹{roi.expected_additional_revenue:,.0f} in extra revenue."
    )
    if roi.roi_percentage is not None:
        benefit += f" After the ₹{roi.fertilizer_cost:,.0f} fertilizer cost, this is roughly a {roi.roi_percentage:.0f}% return."
    return benefit


def _warnings(analysis: NutrientAnalysisResult, severity: SeverityResult) -> list[str]:
    warnings: list[str] = []

    if severity.overall_category == SeverityCategory.SEVERE:
        warnings.append(
            "Nutrient deficiency is severe - consider consulting a local agronomist "
            "before applying large fertilizer quantities."
        )

    surplus_nutrients = [f for f in analysis.findings if f.status.value == "surplus"]
    for f in surplus_nutrients:
        warnings.append(
            f"{f.display_name} levels are already above the recommended target - "
            f"avoid adding more {f.display_name.lower()} fertilizer."
        )

    if not analysis.ph_finding.in_range:
        warnings.append(
            "Fertilizer alone will not fix soil pH. Consider a soil test-guided "
            "lime or sulfur amendment as a separate step."
        )

    warnings.append(
        "This recommendation is generated from your soil test and general crop "
        "guidelines. Local conditions (rainfall, previous crop, irrigation) can "
        "affect actual results."
    )

    return warnings


def generate(
    requirement: CropRequirement,
    analysis: NutrientAnalysisResult,
    severity: SeverityResult,
    dosage_plan: DosagePlan,
    yield_prediction: YieldPrediction,
    roi: RoiResult,
) -> Explanation:
    """
    Pure function: assemble a farmer-friendly Explanation from already-computed
    structured results. Does not perform any new calculation.
    """
    deficient_count = len(analysis.deficient_nutrients())
    if deficient_count == 0:
        summary = (
            f"Your soil looks healthy for growing {requirement.display_name}. "
            f"No major fertilizer correction is needed right now."
        )
    else:
        nutrient_names = ", ".join(
            f.display_name for f in analysis.deficient_nutrients()
        )
        summary = (
            f"Your soil has low {nutrient_names} for growing {requirement.display_name}. "
            f"The recommended fertilizer plan below will help correct this."
        )

    return Explanation(
        summary=summary,
        identified_issues=_identified_issues(analysis, severity),
        recommended_actions=_recommended_actions(dosage_plan),
        expected_benefit=_expected_benefit(yield_prediction, roi),
        warnings=_warnings(analysis, severity),
    )
