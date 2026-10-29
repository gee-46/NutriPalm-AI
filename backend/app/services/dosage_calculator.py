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
from app.services.fertilizer_catalog import NutrientBasis
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
    # Basis the nutrient deficit was expressed in when the product quantity was computed
    # ("n" = elemental nitrogen, otherwise elemental / oxide for P and K).
    nutrient_basis: str = "elemental"


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
    basis: NutrientBasis,
) -> FertilizerDosage | None:
    """Convert a nutrient deficit into a physical fertilizer quantity."""
    if deficit_kg_ha <= 0:
        return None

    product = fertilizer_catalog.get_primary_source_for_nutrient(
        nutrient
    )

    # kg of nutrient per kg of product ON THE BASIS THE DEFICIT IS EXPRESSED IN (P2O5/K2O-graded
    # products carry 2.29x / 1.20x less elemental P / K than their label number suggests).
    nutrient_fraction = product.fraction(nutrient, basis)

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
        nutrient_basis="elemental" if nutrient == "n" else basis.value,
    )


def plan_from_requirements(
    *,
    crop: str,
    area_ha: float,
    n_kg_ha: float,
    p_kg_ha: float,
    k_kg_ha: float,
    price_overrides: dict[str, float] | None = None,
    p_basis: NutrientBasis,
    k_basis: NutrientBasis,
) -> DosagePlan:
    """
    Turn nutrient quantities to supply (kg/ha; N elemental, P and K on the stated bases) into products.

    Phosphorus is supplied by DAP, which also carries nitrogen; that nitrogen is credited against the nitrogen
    quantity before urea is calculated, so nothing is counted twice. Potassium comes from MOP.
    """
    if area_ha <= 0:
        raise ValidationFailed("area_ha must be greater than 0")

    dosages: list[FertilizerDosage] = []

    phosphorus_dosage = _create_dosage(
        nutrient="p",
        deficit_kg_ha=max(p_kg_ha, 0.0),
        area_ha=area_ha,
        price_overrides=price_overrides,
        basis=p_basis,
    )
    n_remaining = max(n_kg_ha, 0.0)
    if phosphorus_dosage is not None:
        dosages.append(phosphorus_dosage)
        dap = fertilizer_catalog.get_product(phosphorus_dosage.product_code)
        # Credit the nitrogen carried by the DAP.
        n_remaining = max(n_remaining - phosphorus_dosage.quantity_kg_per_ha * dap.fraction("n"), 0.0)

    nitrogen_dosage = _create_dosage(
        nutrient="n",
        deficit_kg_ha=n_remaining,
        area_ha=area_ha,
        price_overrides=price_overrides,
        basis=NutrientBasis.ELEMENTAL,
    )
    if nitrogen_dosage is not None:
        dosages.append(nitrogen_dosage)

    potassium_dosage = _create_dosage(
        nutrient="k",
        deficit_kg_ha=max(k_kg_ha, 0.0),
        area_ha=area_ha,
        price_overrides=price_overrides,
        basis=k_basis,
    )
    if potassium_dosage is not None:
        dosages.append(potassium_dosage)

    return DosagePlan(crop=crop, area_ha=area_ha, dosages=dosages)


def calculate(
    analysis: NutrientAnalysisResult,
    area_ha: float,
    price_overrides: dict[str, float] | None = None,
    *,
    p_basis: NutrientBasis = NutrientBasis.ELEMENTAL,
    k_basis: NutrientBasis = NutrientBasis.ELEMENTAL,
) -> DosagePlan:
    """Build a fertilizer plan for all deficient nutrients (the deficit model; see plan_from_requirements)."""
    findings = analysis.findings
    return plan_from_requirements(
        crop=analysis.crop,
        area_ha=area_ha,
        n_kg_ha=_get_deficit(findings, "n"),
        p_kg_ha=_get_deficit(findings, "p"),
        k_kg_ha=_get_deficit(findings, "k"),
        price_overrides=price_overrides,
        p_basis=p_basis,
        k_basis=k_basis,
    )
