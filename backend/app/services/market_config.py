"""
market_config.py

Default crop selling prices (INR per ton), used ONLY as a fallback by
roi_calculator.py when the caller does not supply a real, current price.

IMPORTANT
---------
These are illustrative V1 defaults, not live market data. A production
deployment should pass `crop_price_per_ton_inr` explicitly (e.g. from a
market-price API or admin-managed table) on every request. Isolating the
fallback values here means roi_calculator.py never hardcodes a price.
"""
from __future__ import annotations

DEFAULT_CROP_PRICE_PER_TON_INR: dict[str, float] = {
    "oil_palm": 13500.0,   # fresh fruit bunches
    "rice": 21000.0,
    "maize": 20000.0,
    "sugarcane": 3200.0,
    "banana": 12000.0,
    "coconut": 15000.0,
}


def get_default_price(crop: str) -> float | None:
    return DEFAULT_CROP_PRICE_PER_TON_INR.get((crop or "").strip().lower())
