"""
fertilizer_catalog.py

Catalog of fertilizer products: their guaranteed nutrient content (used to
convert a nutrient deficit in kg/ha into a physical product quantity) and a
default market price per kg.

IMPORTANT
---------
`default_price_per_kg_inr` values are V1 illustrative defaults, isolated
here on purpose. Real deployments should override them (e.g. via env-driven
config, an admin-managed price table, or a request-time override) rather
than editing business logic in roi_calculator.py / dosage_calculator.py.
`roi_calculator.py` accepts an explicit price argument and only falls back
to these catalog defaults when the caller does not supply one.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.exceptions import ValidationFailed


@dataclass(frozen=True)
class FertilizerProduct:
    code: str
    display_name: str
    # Guaranteed nutrient content, expressed as fraction of product weight
    # that is available as elemental N, P (as P2O5-equivalent expressed in
    # elemental P terms is out of scope for V1 - we work directly in the
    # product's nutrient-supply fraction for the nutrient it targets), and K.
    n_fraction: float
    p_fraction: float
    k_fraction: float
    default_price_per_kg_inr: float


_FERTILIZER_CATALOG: dict[str, FertilizerProduct] = {
    "urea": FertilizerProduct(
        code="urea",
        display_name="Urea",
        n_fraction=0.46,
        p_fraction=0.0,
        k_fraction=0.0,
        default_price_per_kg_inr=6.5,
    ),
    "dap": FertilizerProduct(
        code="dap",
        display_name="Di-Ammonium Phosphate (DAP)",
        n_fraction=0.18,
        p_fraction=0.46,
        k_fraction=0.0,
        default_price_per_kg_inr=27.0,
    ),
    "mop": FertilizerProduct(
        code="mop",
        display_name="Muriate of Potash (MOP)",
        n_fraction=0.0,
        p_fraction=0.0,
        k_fraction=0.60,
        default_price_per_kg_inr=17.5,
    ),
    "ssp": FertilizerProduct(
        code="ssp",
        display_name="Single Super Phosphate (SSP)",
        n_fraction=0.0,
        p_fraction=0.16,
        k_fraction=0.0,
        default_price_per_kg_inr=9.0,
    ),
    "npk_complex_19_19_19": FertilizerProduct(
        code="npk_complex_19_19_19",
        display_name="NPK Complex 19:19:19",
        n_fraction=0.19,
        p_fraction=0.19,
        k_fraction=0.19,
        default_price_per_kg_inr=28.0,
    ),
    "organic_compost": FertilizerProduct(
        code="organic_compost",
        display_name="Organic Compost",
        n_fraction=0.01,
        p_fraction=0.005,
        k_fraction=0.01,
        default_price_per_kg_inr=4.0,
    ),
}

# Which single product is used, per nutrient, to correct a straight
# deficiency in V1's simple single-nutrient-product dosage strategy.
# (A blended/least-cost mix optimizer is out of scope for V1.)
_PRIMARY_SOURCE_BY_NUTRIENT: dict[str, str] = {
    "n": "urea",
    "p": "dap",
    "k": "mop",
}


def list_products() -> list[str]:
    return sorted(_FERTILIZER_CATALOG.keys())


def get_product(code: str) -> FertilizerProduct:
    key = (code or "").strip().lower()
    product = _FERTILIZER_CATALOG.get(key)
    if product is None:
        raise ValidationFailed(
            f"Unknown fertilizer product '{code}'. "
            f"Known products: {', '.join(list_products())}"
        )
    return product


def get_primary_source_for_nutrient(nutrient: str) -> FertilizerProduct:
    """
    nutrient must be one of 'n', 'p', 'k'.
    Returns the catalog product used as the primary correction source for
    that nutrient in V1's dosage strategy.
    """
    key = (nutrient or "").strip().lower()
    if key not in _PRIMARY_SOURCE_BY_NUTRIENT:
        raise ValidationFailed(f"Unknown nutrient '{nutrient}', expected one of n/p/k")
    return get_product(_PRIMARY_SOURCE_BY_NUTRIENT[key])
