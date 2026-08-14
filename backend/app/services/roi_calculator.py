"""
roi_calculator.py

Computes the financial return of applying the recommended fertilizer plan,
from real, request-specific inputs. It NEVER returns a fixed/canned ROI -
every field is derived from the caller-supplied plot area, dosage plan
(fertilizer cost), yield prediction (additional yield), and crop price.

Economic assumptions (default crop prices) live in market_config.py, not
here - see that module's docstring.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.exceptions import ValidationFailed
from app.services import market_config
from app.services.dosage_calculator import DosagePlan
from app.services.yield_predictor import YieldPrediction


@dataclass(frozen=True)
class RoiResult:
    crop: str
    area_ha: float
    fertilizer_cost: float
    current_yield_total_t: float
    expected_yield_total_t: float
    expected_additional_yield_t: float
    crop_price_per_ton_inr: float
    crop_value: float
    expected_additional_revenue: float
    estimated_profit: float
    roi_percentage: float | None  # None when fertilizer_cost is 0 (undefined ROI)


def calculate(
    dosage_plan: DosagePlan,
    yield_prediction: YieldPrediction,
    area_ha: float,
    crop_price_per_ton_inr: float | None = None,
) -> RoiResult:
    """
    Compute ROI dynamically.

    crop_price_per_ton_inr: pass the real/current selling price when known.
    If omitted, falls back to market_config's illustrative default for the
    crop (and raises if no default exists for that crop - callers should
    supply a real price rather than silently guessing).
    """
    if area_ha <= 0:
        raise ValidationFailed("area_ha must be greater than 0")

    if crop_price_per_ton_inr is None:
        crop_price_per_ton_inr = market_config.get_default_price(dosage_plan.crop)
        if crop_price_per_ton_inr is None:
            raise ValidationFailed(
                f"No crop_price_per_ton_inr supplied and no default exists for "
                f"crop '{dosage_plan.crop}'. Supply a real market price."
            )

    if crop_price_per_ton_inr < 0:
        raise ValidationFailed("crop_price_per_ton_inr must be >= 0")

    fertilizer_cost = dosage_plan.total_fertilizer_cost_inr()
    if fertilizer_cost < 0:
        raise ValidationFailed("fertilizer_cost must be >= 0")

    current_yield_total_t = round(yield_prediction.current_yield_t_ha * area_ha, 3)
    expected_yield_total_t = round(yield_prediction.expected_yield_t_ha * area_ha, 3)
    expected_additional_yield_t = round(
        yield_prediction.additional_yield_total(area_ha), 3
    )

    if expected_additional_yield_t < 0:
        raise ValidationFailed("expected_additional_yield_t must be >= 0")

    crop_value = round(crop_price_per_ton_inr, 2)
    expected_additional_revenue = round(expected_additional_yield_t * crop_price_per_ton_inr, 2)
    estimated_profit = round(expected_additional_revenue - fertilizer_cost, 2)

    roi_percentage: float | None
    if fertilizer_cost > 0:
        roi_percentage = round((estimated_profit / fertilizer_cost) * 100.0, 2)
    else:
        roi_percentage = None

    return RoiResult(
        crop=dosage_plan.crop,
        area_ha=area_ha,
        fertilizer_cost=round(fertilizer_cost, 2),
        current_yield_total_t=current_yield_total_t,
        expected_yield_total_t=expected_yield_total_t,
        expected_additional_yield_t=expected_additional_yield_t,
        crop_price_per_ton_inr=crop_price_per_ton_inr,
        crop_value=crop_value,
        expected_additional_revenue=expected_additional_revenue,
        estimated_profit=estimated_profit,
        roi_percentage=roi_percentage,
    )
