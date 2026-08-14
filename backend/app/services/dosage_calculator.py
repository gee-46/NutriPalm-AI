"""
dosage_calculator.py

Converts nutrient deficits into a fertilizer application plan.

V1 strategy:
- Phosphorus deficiency -> DAP
- Potassium deficiency -> MOP
- Remaining nitrogen deficiency -> Urea

Important:
DAP contains nitrogen as well as phosphorus. Therefore, when both N and P
are deficient, the nitrogen supplied by the required DAP quantity is
subtracted from the nitrogen deficit before calculating the Urea quantity.

A least-cost blended-product optimizer is out of scope for V1.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.exceptions import ValidationFailed
from app.services import fertilizer_catalog
from app.services.nutrient_analyzer import (
    NutrientAnalysisResult,
    NutrientFinding,
)


@dataclass(frozen=True)
class FertilizerDosage:
    nutrient: str
    product_code: str
    product_display_name: str
    quantity_kg_per_ha: float
    quantity_kg_total: float
    estimated_cost_inr: float


@dataclass(frozen=True)
class DosagePlan:
    crop: str
    area_ha: float
    dosages: list[FertilizerDosage]

    def total_fertilizer_cost_inr(self) -> float:
        return round(
            sum(d.estimated_cost_inr for d in self.dosages),
            2,
        )

    def total_fertilizer_kg(self) -> float:
        return round(
            sum(d.quantity_kg_total for d in self.dosages),
            2,
        )


def _get_deficit(
    findings: list[NutrientFinding],
    nutrient: str,
) -> float:
    """Return the positive nutrient deficit in kg/ha."""
    for finding in findings:
        if finding.nutrient == nutrient:
            return max(finding.deficit_kg_ha, 0.0)

    return 0.0


def _create_dosage(
    *,
    nutrient: str,
    deficit_kg_ha: float,
    area_ha: float,
    price_overrides: dict[str, float] | None,
) -> FertilizerDosage | None:
    """Convert a nutrient deficit into a physical fertilizer quantity."""
    if deficit_kg_ha <= 0:
        return None

    product = fertilizer_catalog.get_primary_source_for_nutrient(
        nutrient
    )

    nutrient_fraction = {
        "n": product.n_fraction,
        "p": product.p_fraction,
        "k": product.k_fraction,
    }[nutrient]

    if nutrient_fraction <= 0:
        raise ValidationFailed(
            f"Catalog product '{product.code}' has no nutrient content "
            f"for '{nutrient}'; cannot compute dosage."
        )

    quantity_kg_per_ha = deficit_kg_ha / nutrient_fraction
    quantity_kg_total = quantity_kg_per_ha * area_ha

    price_per_kg = (price_overrides or {}).get(
        product.code,
        product.default_price_per_kg_inr,
    )

    if price_per_kg < 0:
        raise ValidationFailed(
            f"Price for '{product.code}' must be >= 0"
        )

    estimated_cost = quantity_kg_total * price_per_kg

    return FertilizerDosage(
        nutrient=nutrient,
        product_code=product.code,
        product_display_name=product.display_name,
        quantity_kg_per_ha=round(
            quantity_kg_per_ha,
            2,
        ),
        quantity_kg_total=round(
            quantity_kg_total,
            2,
        ),
        estimated_cost_inr=round(
            estimated_cost,
            2,
        ),
    )


def calculate(
    analysis: NutrientAnalysisResult,
    area_ha: float,
    price_overrides: dict[str, float] | None = None,
) -> DosagePlan:
    """
    Build a fertilizer plan for all deficient nutrients.

    When phosphorus is deficient, DAP is calculated first because DAP also
    supplies nitrogen. The nitrogen supplied by that DAP quantity is then
    subtracted from the nitrogen deficit before Urea is calculated.
    """

    if area_ha <= 0:
        raise ValidationFailed(
            "area_ha must be greater than 0"
        )

    findings = analysis.findings

    n_deficit_kg_ha = _get_deficit(findings, "n")
    p_deficit_kg_ha = _get_deficit(findings, "p")
    k_deficit_kg_ha = _get_deficit(findings, "k")

    dosages: list[FertilizerDosage] = []

    # ---------------------------------------------------------
    # 1. Phosphorus -> DAP
    # ---------------------------------------------------------
    phosphorus_dosage = _create_dosage(
        nutrient="p",
        deficit_kg_ha=p_deficit_kg_ha,
        area_ha=area_ha,
        price_overrides=price_overrides,
    )

    if phosphorus_dosage is not None:
        dosages.append(phosphorus_dosage)

        # DAP also contributes nitrogen.
        dap = fertilizer_catalog.get_product(
            phosphorus_dosage.product_code
        )

        nitrogen_supplied_by_dap_kg_ha = (
            phosphorus_dosage.quantity_kg_per_ha
            * dap.n_fraction
        )

        n_deficit_kg_ha = max(
            n_deficit_kg_ha - nitrogen_supplied_by_dap_kg_ha,
            0.0,
        )

    # ---------------------------------------------------------
    # 2. Remaining nitrogen -> Urea
    # ---------------------------------------------------------
    nitrogen_dosage = _create_dosage(
        nutrient="n",
        deficit_kg_ha=n_deficit_kg_ha,
        area_ha=area_ha,
        price_overrides=price_overrides,
    )

    if nitrogen_dosage is not None:
        dosages.append(nitrogen_dosage)

    # ---------------------------------------------------------
    # 3. Potassium -> MOP
    # ---------------------------------------------------------
    potassium_dosage = _create_dosage(
        nutrient="k",
        deficit_kg_ha=k_deficit_kg_ha,
        area_ha=area_ha,
        price_overrides=price_overrides,
    )

    if potassium_dosage is not None:
        dosages.append(potassium_dosage)

    return DosagePlan(
        crop=analysis.crop,
        area_ha=area_ha,
        dosages=dosages,
    )
