"""
crop_rules.py

Catalog of per-crop agronomic reference values used by the rest of the AI
pipeline (nutrient sufficiency thresholds, pH range, organic carbon
requirement, and yield-modelling baselines).

IMPORTANT - AGRICULTURAL VALIDITY
----------------------------------
These numbers are V1 *default, configurable* engineering assumptions, not a
peer-reviewed agronomic model. They are isolated here, in one place, on
purpose, so they can be replaced or calibrated by an agronomist / real
regional soil-test correlation data later WITHOUT changing any business
logic in nutrient_analyzer.py, severity_calculator.py, dosage_calculator.py,
or yield_predictor.py.

Do not scatter new magic numbers into other services - add them here.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.exceptions import UnsupportedCrop


@dataclass(frozen=True)
class CropRequirement:
    """Reference nutrient/soil targets for a single crop."""

    crop: str
    display_name: str

    # Soil-available nutrient targets for optimal growth, in kg/ha.
    # These are "sufficiency" targets used to compute a deficit, NOT total
    # fertilizer application rates (fertilizer rates are derived later by
    # dosage_calculator.py from the deficit + fertilizer nutrient content).
    n_target_kg_ha: float
    p_target_kg_ha: float
    k_target_kg_ha: float

    # Acceptable soil pH range for the crop.
    ph_min: float
    ph_max: float

    # Minimum recommended organic carbon percentage.
    organic_carbon_min_percent: float

    # Yield modelling baseline: the yield (tons/ha/year) achievable when the
    # crop receives full/optimal nutrition on this soil.
    optimal_yield_t_ha: float

    # Fraction (0-1) of optimal yield lost per unit of aggregate deficiency
    # severity (severity is 0-1, see severity_calculator.py). E.g. 0.4 means
    # a fully-severe (severity=1.0) nutrient deficiency situation caps yield
    # at 60% of optimal_yield_t_ha.
    max_yield_loss_fraction: float


# NOTE: values below are illustrative V1 defaults. See module docstring.
_CROP_CATALOG: dict[str, CropRequirement] = {
    "oil_palm": CropRequirement(
        crop="oil_palm",
        display_name="Oil Palm",
        n_target_kg_ha=280.0,
        p_target_kg_ha=45.0,
        k_target_kg_ha=340.0,
        ph_min=4.5,
        ph_max=6.5,
        organic_carbon_min_percent=0.75,
        optimal_yield_t_ha=22.0,  # fresh fruit bunches, t/ha/yr
        max_yield_loss_fraction=0.45,
    ),
    "rice": CropRequirement(
        crop="rice",
        display_name="Rice (Paddy)",
        n_target_kg_ha=120.0,
        p_target_kg_ha=26.0,
        k_target_kg_ha=60.0,
        ph_min=5.5,
        ph_max=7.0,
        organic_carbon_min_percent=0.5,
        optimal_yield_t_ha=6.0,
        max_yield_loss_fraction=0.5,
    ),
    "maize": CropRequirement(
        crop="maize",
        display_name="Maize",
        n_target_kg_ha=150.0,
        p_target_kg_ha=35.0,
        k_target_kg_ha=60.0,
        ph_min=5.8,
        ph_max=7.2,
        organic_carbon_min_percent=0.5,
        optimal_yield_t_ha=7.5,
        max_yield_loss_fraction=0.5,
    ),
    "sugarcane": CropRequirement(
        crop="sugarcane",
        display_name="Sugarcane",
        n_target_kg_ha=250.0,
        p_target_kg_ha=50.0,
        k_target_kg_ha=120.0,
        ph_min=6.0,
        ph_max=7.5,
        organic_carbon_min_percent=0.6,
        optimal_yield_t_ha=90.0,
        max_yield_loss_fraction=0.4,
    ),
    "banana": CropRequirement(
        crop="banana",
        display_name="Banana",
        n_target_kg_ha=200.0,
        p_target_kg_ha=40.0,
        k_target_kg_ha=300.0,
        ph_min=5.5,
        ph_max=7.0,
        organic_carbon_min_percent=0.6,
        optimal_yield_t_ha=45.0,
        max_yield_loss_fraction=0.5,
    ),
    "coconut": CropRequirement(
        crop="coconut",
        display_name="Coconut",
        n_target_kg_ha=170.0,
        p_target_kg_ha=32.0,
        k_target_kg_ha=280.0,
        ph_min=5.2,
        ph_max=8.0,
        organic_carbon_min_percent=0.5,
        optimal_yield_t_ha=12.0,
        max_yield_loss_fraction=0.4,
    ),
}


def list_supported_crops() -> list[str]:
    return sorted(_CROP_CATALOG.keys())


def get_crop_requirement(crop: str) -> CropRequirement:
    """
    Look up the agronomic reference values for a crop.

    Raises UnsupportedCrop if the crop is not in the V1 catalog.
    """
    key = (crop or "").strip().lower().replace(" ", "_")
    requirement = _CROP_CATALOG.get(key)
    if requirement is None:
        raise UnsupportedCrop(
            f"Crop '{crop}' is not supported in V1. "
            f"Supported crops: {', '.join(list_supported_crops())}"
        )
    return requirement
