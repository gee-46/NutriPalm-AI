"""
dosage_calculator.py

Converts nutrient deficits (kg/ha, from severity_calculator.py /
nutrient_analyzer.py) into an actual fertilizer application plan: which
product, how much per hectare, and how much in total for the plot.

V1 strategy: one dedicated single-nutrient product per deficient nutrient
(urea for N, DAP for P, MOP for K - see fertilizer_catalog.py). A
least-cost blended-product optimizer is out of scope for V1 and can replace
this module later without touching upstream services.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.exceptions import ValidationFailed
from app.services import fertilizer_catalog
from app.services.nutrient_analyzer import NutrientAnalysisResult, NutrientFinding


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
        return round(sum(d.estimated_cost_inr for d in self.dosages), 2)

    def total_fertilizer_kg(self) -> float:
        return round(sum(d.quantity_kg_total for d in self.dosages), 2)


def _dosage_for_finding(
    finding: NutrientFinding, area_ha: float, price_overrides: dict[str, float] | None
) -> FertilizerDosage | None:
    if finding.deficit_kg_ha <= 0:
        return None

    product = fertilizer_catalog.get_primary_source_for_nutrient(finding.nutrient)
    nutrient_fraction = {
        "n": product.n_fraction,
        "p": product.p_fraction,
        "k": product.k_fraction,
    }[finding.nutrient]

    if nutrient_fraction <= 0:
        raise ValidationFailed(
            f"Catalog product '{product.code}' has no nutrient content for "
            f"'{finding.nutrient}'; cannot compute dosage."
        )

    quantity_kg_per_ha = finding.deficit_kg_ha / nutrient_fraction
    quantity_kg_total = quantity_kg_per_ha * area_ha

    price_per_kg = (price_overrides or {}).get(product.code, product.default_price_per_kg_inr)
    if price_per_kg < 0:
        raise ValidationFailed(f"Price for '{product.code}' must be >= 0")

    estimated_cost = quantity_kg_total * price_per_kg

    return FertilizerDosage(
        nutrient=finding.nutrient,
        product_code=product.code,
        product_display_name=product.display_name,
        quantity_kg_per_ha=round(quantity_kg_per_ha, 2),
        quantity_kg_total=round(quantity_kg_total, 2),
        estimated_cost_inr=round(estimated_cost, 2),
    )


def calculate(
    analysis: NutrientAnalysisResult,
    area_ha: float,
    price_overrides: dict[str, float] | None = None,
) -> DosagePlan:
    """
    Pure function (aside from reading the fertilizer_catalog, which is
    static config): build a dosage plan for every deficient nutrient found
    in `analysis`.

    price_overrides: optional {product_code: price_per_kg_inr} to override
    fertilizer_catalog defaults with real/current market prices, without
    hardcoding prices into this function.
    """
    if area_ha <= 0:
        raise ValidationFailed("area_ha must be greater than 0")

    dosages = [
        d
        for finding in analysis.findings
        if (d := _dosage_for_finding(finding, area_ha, price_overrides)) is not None
    ]

    return DosagePlan(crop=analysis.crop, area_ha=area_ha, dosages=dosages)
