"""
nutrient_analyzer.py

Compares an actual soil test (SoilTestInput) against a crop's agronomic
targets (crop_rules.CropRequirement) and produces a structured, per-nutrient
analysis: status classification and the deficit (or surplus) in kg/ha.

This module does NOT decide fertilizer products or quantities - that is
dosage_calculator.py's job, using fertilizer_catalog.py. It does NOT decide
severity scoring - that is severity_calculator.py's job. Keeping these
concerns separate avoids duplicated business logic across services.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from app.schemas.inputs import SoilTestInput
from app.services.crop_rules import CropRequirement


class NutrientStatus(str, Enum):
    DEFICIENT = "deficient"
    ADEQUATE = "adequate"
    SURPLUS = "surplus"


@dataclass(frozen=True)
class NutrientFinding:
    nutrient: str  # "n" | "p" | "k"
    display_name: str
    soil_value_kg_ha: float
    target_kg_ha: float
    status: NutrientStatus
    deficit_kg_ha: float  # 0 if not deficient
    percent_of_target: float  # soil_value / target * 100


@dataclass(frozen=True)
class PhFinding:
    ph: float
    ph_min: float
    ph_max: float
    in_range: bool


@dataclass(frozen=True)
class OrganicCarbonFinding:
    organic_carbon_percent: float
    minimum_recommended_percent: float
    in_range: bool


@dataclass(frozen=True)
class NutrientAnalysisResult:
    crop: str
    findings: list[NutrientFinding]
    ph_finding: PhFinding
    organic_carbon_finding: OrganicCarbonFinding

    def deficient_nutrients(self) -> list[NutrientFinding]:
        return [f for f in self.findings if f.status == NutrientStatus.DEFICIENT]


# A soil value within this tolerance band of the target is still considered
# "adequate" rather than triggering a surplus/deficient classification for
# marginal noise. Isolated here as a configurable constant.
_ADEQUATE_TOLERANCE_FRACTION = 0.05


def _classify(soil_value: float, target: float) -> tuple[NutrientStatus, float]:
    if target <= 0:
        return NutrientStatus.ADEQUATE, 0.0

    ratio = soil_value / target
    lower_bound = 1.0 - _ADEQUATE_TOLERANCE_FRACTION
    upper_bound = 1.0 + _ADEQUATE_TOLERANCE_FRACTION

    if ratio < lower_bound:
        deficit = max(target - soil_value, 0.0)
        return NutrientStatus.DEFICIENT, deficit
    if ratio > upper_bound:
        return NutrientStatus.SURPLUS, 0.0
    return NutrientStatus.ADEQUATE, 0.0


def analyze(soil: SoilTestInput, requirement: CropRequirement) -> NutrientAnalysisResult:
    """
    Pure function: given a soil test and a crop's requirement, return the
    structured nutrient analysis. No I/O, no hidden state.
    """
    nutrient_specs = [
        ("n", "Nitrogen", soil.nitrogen_kg_ha, requirement.n_target_kg_ha),
        ("p", "Phosphorus", soil.phosphorus_kg_ha, requirement.p_target_kg_ha),
        ("k", "Potassium", soil.potassium_kg_ha, requirement.k_target_kg_ha),
    ]

    findings: list[NutrientFinding] = []
    for code, name, soil_value, target in nutrient_specs:
        status, deficit = _classify(soil_value, target)
        percent_of_target = (soil_value / target * 100.0) if target > 0 else 100.0
        findings.append(
            NutrientFinding(
                nutrient=code,
                display_name=name,
                soil_value_kg_ha=soil_value,
                target_kg_ha=target,
                status=status,
                deficit_kg_ha=round(deficit, 2),
                percent_of_target=round(percent_of_target, 1),
            )
        )

    ph_finding = PhFinding(
        ph=soil.ph,
        ph_min=requirement.ph_min,
        ph_max=requirement.ph_max,
        in_range=requirement.ph_min <= soil.ph <= requirement.ph_max,
    )

    oc_finding = OrganicCarbonFinding(
        organic_carbon_percent=soil.organic_carbon_percent,
        minimum_recommended_percent=requirement.organic_carbon_min_percent,
        in_range=soil.organic_carbon_percent >= requirement.organic_carbon_min_percent,
    )

    return NutrientAnalysisResult(
        crop=requirement.crop,
        findings=findings,
        ph_finding=ph_finding,
        organic_carbon_finding=oc_finding,
    )
