"""
severity_calculator.py

Converts the deficits found by nutrient_analyzer.py into a normalized
severity score per nutrient (0.0 = no deficiency, 1.0 = maximally severe)
and an overall plot severity score, plus a human-readable category.

The overall severity feeds yield_predictor.py (bigger deficiency -> bigger
yield penalty) and explanation_engine.py (for farmer-facing urgency
language). Isolating this here means both consumers agree on one number.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from app.services.nutrient_analyzer import NutrientAnalysisResult, NutrientFinding

# A deficit equal to or greater than this fraction of the target is treated
# as maximally severe (severity=1.0) for that nutrient. Configurable V1
# assumption, isolated here rather than buried in the formula.
_MAX_SEVERITY_DEFICIT_FRACTION = 0.60


class SeverityCategory(str, Enum):
    NONE = "none"
    MILD = "mild"
    MODERATE = "moderate"
    SEVERE = "severe"


@dataclass(frozen=True)
class NutrientSeverity:
    nutrient: str
    display_name: str
    deficit_kg_ha: float
    severity_score: float  # 0.0 - 1.0
    category: SeverityCategory


@dataclass(frozen=True)
class SeverityResult:
    per_nutrient: list[NutrientSeverity]
    overall_score: float  # 0.0 - 1.0, weighted average across nutrients
    overall_category: SeverityCategory


def _score_to_category(score: float) -> SeverityCategory:
    if score <= 0.0:
        return SeverityCategory.NONE
    if score < 0.34:
        return SeverityCategory.MILD
    if score < 0.67:
        return SeverityCategory.MODERATE
    return SeverityCategory.SEVERE


def _nutrient_severity(finding: NutrientFinding) -> NutrientSeverity:
    if finding.target_kg_ha <= 0 or finding.deficit_kg_ha <= 0:
        score = 0.0
    else:
        deficit_fraction = finding.deficit_kg_ha / finding.target_kg_ha
        score = min(deficit_fraction / _MAX_SEVERITY_DEFICIT_FRACTION, 1.0)

    return NutrientSeverity(
        nutrient=finding.nutrient,
        display_name=finding.display_name,
        deficit_kg_ha=finding.deficit_kg_ha,
        severity_score=round(score, 3),
        category=_score_to_category(score),
    )


def calculate(analysis: NutrientAnalysisResult) -> SeverityResult:
    """
    Pure function: turn a NutrientAnalysisResult into severity scores.
    """
    per_nutrient = [_nutrient_severity(f) for f in analysis.findings]

    if per_nutrient:
        overall_score = sum(s.severity_score for s in per_nutrient) / len(per_nutrient)
    else:
        overall_score = 0.0

    return SeverityResult(
        per_nutrient=per_nutrient,
        overall_score=round(overall_score, 3),
        overall_category=_score_to_category(overall_score),
    )
