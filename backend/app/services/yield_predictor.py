"""
yield_predictor.py

Estimates the plot's current (unimproved) yield and the expected yield after
the recommended fertilizer plan is correctly applied.

MODEL, EXPLICITLY STATED
-------------------------
current_yield = optimal_yield * (1 - max_yield_loss_fraction * severity) * ph_penalty * oc_penalty
expected_yield = optimal_yield * ph_penalty * oc_penalty

i.e. correcting the nutrient deficiency (severity -> 0) recovers the yield
lost to nutrient deficiency, but pH and organic-carbon limitations are NOT
resolved by fertilizer dosing alone in V1 (that would need soil amendment /
liming / organic matter addition, which is out of this module's scope) -
their penalty is applied to both current and expected yield so the
prediction doesn't overstate benefit.

`ph_penalty_fraction` / `organic_carbon_penalty_fraction` below are
configurable V1 defaults, isolated here rather than hardcoded inline.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.services.crop_rules import CropRequirement
from app.services.nutrient_analyzer import NutrientAnalysisResult
from app.services.severity_calculator import SeverityResult

# Yield penalty applied (multiplicatively, i.e. 1 - fraction) when the soil
# pH is outside the crop's acceptable range.
_PH_OUT_OF_RANGE_PENALTY_FRACTION = 0.15

# Yield penalty applied when organic carbon is below the crop's recommended
# minimum.
_LOW_ORGANIC_CARBON_PENALTY_FRACTION = 0.10


@dataclass(frozen=True)
class YieldPrediction:
    crop: str
    optimal_yield_t_ha: float
    current_yield_t_ha: float
    expected_yield_t_ha: float
    additional_yield_t_ha: float
    ph_limiting: bool
    organic_carbon_limiting: bool

    def additional_yield_total(self, area_ha: float) -> float:
        return round(self.additional_yield_t_ha * area_ha, 3)


def _structural_multiplier(analysis: NutrientAnalysisResult) -> tuple[float, bool, bool]:
    ph_limiting = not analysis.ph_finding.in_range
    oc_limiting = not analysis.organic_carbon_finding.in_range

    multiplier = 1.0
    if ph_limiting:
        multiplier *= 1.0 - _PH_OUT_OF_RANGE_PENALTY_FRACTION
    if oc_limiting:
        multiplier *= 1.0 - _LOW_ORGANIC_CARBON_PENALTY_FRACTION

    return multiplier, ph_limiting, oc_limiting


def predict(
    requirement: CropRequirement,
    analysis: NutrientAnalysisResult,
    severity: SeverityResult,
) -> YieldPrediction:
    """
    Pure function: combine the crop baseline, the nutrient severity, and
    structural soil limitations (pH, organic carbon) into a yield estimate.
    """
    structural_multiplier, ph_limiting, oc_limiting = _structural_multiplier(analysis)

    current_yield = (
        requirement.optimal_yield_t_ha
        * (1.0 - requirement.max_yield_loss_fraction * severity.overall_score)
        * structural_multiplier
    )
    expected_yield = requirement.optimal_yield_t_ha * structural_multiplier

    current_yield = max(current_yield, 0.0)
    expected_yield = max(expected_yield, current_yield)  # never predict a decrease

    return YieldPrediction(
        crop=requirement.crop,
        optimal_yield_t_ha=round(requirement.optimal_yield_t_ha, 3),
        current_yield_t_ha=round(current_yield, 3),
        expected_yield_t_ha=round(expected_yield, 3),
        additional_yield_t_ha=round(expected_yield - current_yield, 3),
        ph_limiting=ph_limiting,
        organic_carbon_limiting=oc_limiting,
    )
