"""
severity_calculator.py

Converts the deficits found by nutrient_analyzer.py into normalized
severity scores per nutrient (0.0 = no deficiency, 1.0 = maximally
severe), an overall plot severity score, and human-readable categories.

Severity scores are rounded to three decimal places before category
classification so the numeric score and displayed category always use
the same value.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from app.services.nutrient_analyzer import (
    NutrientAnalysisResult,
    NutrientFinding,
)

# A deficit equal to or greater than this fraction of the target is treated
# as maximally severe (severity=1.0) for that nutrient.
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
    severity_score: float
    category: SeverityCategory


@dataclass(frozen=True)
class SeverityResult:
    per_nutrient: list[NutrientSeverity]
    overall_score: float
    overall_category: SeverityCategory


def _score_to_category(score: float) -> SeverityCategory:
    """
    Convert a normalized severity score into a severity category.

    The caller is expected to provide the final rounded score used for
    classification.
    """
    if score <= 0.0:
        return SeverityCategory.NONE

    if score < 0.34:
        return SeverityCategory.MILD

    if score < 0.67:
        return SeverityCategory.MODERATE

    return SeverityCategory.SEVERE


def _nutrient_severity(
    finding: NutrientFinding,
) -> NutrientSeverity:
    """Calculate one nutrient's rounded severity score and category."""

    if (
        finding.target_kg_ha <= 0
        or finding.deficit_kg_ha <= 0
    ):
        score = 0.0
    else:
        deficit_fraction = (
            finding.deficit_kg_ha
            / finding.target_kg_ha
        )

        score = min(
            deficit_fraction
            / _MAX_SEVERITY_DEFICIT_FRACTION,
            1.0,
        )

    # IMPORTANT:
    # Round first, then derive the category from the same rounded value.
    rounded_score = round(score, 3)

    return NutrientSeverity(
        nutrient=finding.nutrient,
        display_name=finding.display_name,
        deficit_kg_ha=finding.deficit_kg_ha,
        severity_score=rounded_score,
        category=_score_to_category(rounded_score),
    )


def calculate(
    analysis: NutrientAnalysisResult,
) -> SeverityResult:
    """
    Convert a NutrientAnalysisResult into per-nutrient and overall
    severity scores.

    Categories are always derived from the corresponding rounded scores.
    """

    per_nutrient = [
        _nutrient_severity(finding)
        for finding in analysis.findings
    ]

    if per_nutrient:
        raw_overall_score = (
            sum(
                severity.severity_score
                for severity in per_nutrient
            )
            / len(per_nutrient)
        )
    else:
        raw_overall_score = 0.0

    # Round first, then classify using that exact rounded value.
    overall_score = round(
        raw_overall_score,
        3,
    )

    return SeverityResult(
        per_nutrient=per_nutrient,
        overall_score=overall_score,
        overall_category=_score_to_category(
            overall_score
        ),
    )
