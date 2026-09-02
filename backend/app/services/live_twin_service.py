"""
live_twin_service.py

Near real-time Digital Twin scoring engine.

Fetches LIVE weather from Open-Meteo (free, no API key, updates every 15 min)
and computes 5 continuous AI scores for any farm plot:

  1. Water Stress Score   — Penman-Monteith simplified ET model
  2. Disease Risk Score   — Palm fungal epidemiology model
  3. Crop Health Score    — Weighted fusion of NDVI + stress + disease
  4. Soil State           — 7-day rainfall integration vs field capacity
  5. Yield Forecast       — Health trend × base FFB yield

All scores are computed on demand per API call — no caching, always fresh.
"""
from __future__ import annotations

import logging
import math
from datetime import datetime, timedelta
from typing import Optional

import requests

log = logging.getLogger(__name__)

OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
MODEL_VERSION = "live-v1.0"


# ─────────────────────────────────────────────────────────────────────────────
# Open-Meteo: Live + 7-day forecast weather
# ─────────────────────────────────────────────────────────────────────────────

def fetch_live_weather(lat: float, lon: float) -> Optional[dict]:
    """
    Fetches CURRENT weather conditions + past 7-day daily data for the given
    GPS coordinates from Open-Meteo (free, no API key, 15-min update cycle).

    Returns a dict with:
      current: {temperature_c, humidity_pct, rainfall_mm, wind_kph,
                uv_index, cloud_cover_pct, apparent_temp_c}
      daily_7d: list of {date, temp_max, temp_min, humidity_mean,
                         rainfall_mm, uv_index_max}
    """
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": [
            "temperature_2m",
            "relative_humidity_2m",
            "precipitation",
            "wind_speed_10m",
            "uv_index",
            "cloud_cover",
            "apparent_temperature",
        ],
        "daily": [
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_sum",
            "uv_index_max",
            "relative_humidity_2m_mean",
        ],
        "past_days": 7,
        "forecast_days": 3,
        "timezone": "Asia/Kolkata",
    }

    try:
        resp = requests.get(OPEN_METEO_FORECAST_URL, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        log.error("Open-Meteo live fetch failed: %s", e)
        return None

    cur = data.get("current", {})
    daily = data.get("daily", {})
    times = daily.get("time", [])

    daily_records = [
        {
            "date": times[i],
            "temp_max": daily.get("temperature_2m_max", [None] * len(times))[i],
            "temp_min": daily.get("temperature_2m_min", [None] * len(times))[i],
            "humidity_mean": daily.get("relative_humidity_2m_mean", [None] * len(times))[i],
            "rainfall_mm": daily.get("precipitation_sum", [0] * len(times))[i] or 0,
            "uv_index_max": daily.get("uv_index_max", [None] * len(times))[i],
        }
        for i in range(len(times))
    ]

    return {
        "current": {
            "temperature_c": cur.get("temperature_2m"),
            "apparent_temp_c": cur.get("apparent_temperature"),
            "humidity_pct": cur.get("relative_humidity_2m"),
            "rainfall_mm": cur.get("precipitation", 0) or 0,
            "wind_kph": cur.get("wind_speed_10m"),
            "uv_index": cur.get("uv_index"),
            "cloud_cover_pct": cur.get("cloud_cover"),
        },
        "daily_7d": daily_records,
        "fetched_at": datetime.utcnow().isoformat() + "Z",
    }


# ─────────────────────────────────────────────────────────────────────────────
# Score Models
# ─────────────────────────────────────────────────────────────────────────────

def compute_water_stress(temp_c: float, humidity_pct: float,
                          rainfall_7d_mm: float, wind_kph: float = 10.0) -> float:
    """
    Simplified Penman-Monteith reference evapotranspiration (ET₀).
    
    For tropical oil palm:
      - Daily ET₀ ≈ 4–6 mm/day in humid tropics
      - Stress starts when available water < 50% of ET₀ demand
    
    Returns a score from 0 (no stress) to 100 (severe stress).
    """
    # Saturation vapor pressure (kPa) using Magnus formula
    es = 0.6108 * math.exp(17.27 * temp_c / (temp_c + 237.3))
    ea = es * (humidity_pct / 100.0)
    vpd = es - ea  # Vapor pressure deficit

    # Simplified ET₀ (mm/day) — approximation for tropical conditions
    # Full FAO-56 requires solar radiation; we use a temperature-wind proxy
    et0_daily = max(0.0, 0.0023 * (temp_c + 17.8) * math.sqrt(max(0, temp_c - 0)) * (vpd + 0.5))
    et0_7day = et0_daily * 7

    # Available water from rainfall
    effective_rain = rainfall_7d_mm * 0.85  # 15% runoff/evaporation loss

    # Stress as deficit fraction
    deficit = max(0.0, et0_7day - effective_rain)
    stress = min(100.0, (deficit / max(et0_7day, 1.0)) * 100.0)

    return round(stress, 1)


def compute_disease_risk(temp_c: float, humidity_pct: float,
                          rainfall_7d_mm: float) -> tuple[float, str, str]:
    """
    Palm disease risk model based on tropical fungal epidemiology.
    
    Key diseases modelled:
      - Ganoderma (root rot): favours dry stress conditions paradoxically
      - Anthracnose: high humidity + moderate temp
      - Leaf blight: prolonged leaf wetness from heavy rain + humidity
    
    Returns (risk_score 0-100, disease_name, explanation).
    """
    # Anthracnose risk: peaks at humidity > 80% + temp 22–32°C
    anthracnose = 0.0
    if 22 <= temp_c <= 32 and humidity_pct > 75:
        anthracnose = ((humidity_pct - 75) / 25.0) * 70 + (rainfall_7d_mm / 100.0) * 30
        anthracnose = min(100.0, anthracnose)

    # Leaf blight risk: prolonged wet conditions (>50mm in 7 days + >85% humidity)
    blight = 0.0
    if rainfall_7d_mm > 30 and humidity_pct > 80:
        blight = min(100.0, (rainfall_7d_mm / 80.0) * 50 + ((humidity_pct - 80) / 20.0) * 50)

    # Ganoderma: high stress + dry conditions reduce immune response
    ganoderma = 0.0
    if rainfall_7d_mm < 20 and temp_c > 30:
        ganoderma = min(60.0, ((30 - rainfall_7d_mm) / 30.0) * 40 + ((temp_c - 30) / 10.0) * 20)

    risk_score = max(anthracnose, blight, ganoderma)

    if risk_score == anthracnose and anthracnose > 20:
        name = "Anthracnose Leaf Spot"
        explanation = f"High humidity ({humidity_pct:.0f}%) with warm temperatures ({temp_c:.1f}°C) creates conditions favorable for Anthracnose spread."
    elif risk_score == blight and blight > 20:
        name = "Leaf Blight"
        explanation = f"Sustained rainfall ({rainfall_7d_mm:.0f}mm over 7 days) with high humidity ({humidity_pct:.0f}%) risks prolonged leaf wetness."
    elif risk_score == ganoderma and ganoderma > 20:
        name = "Ganoderma (Root Rot)"
        explanation = f"Dry stress conditions (only {rainfall_7d_mm:.0f}mm last 7 days) weaken palm immune response to Ganoderma."
    else:
        name = "No Significant Risk"
        explanation = "Current weather conditions are within safe thresholds for palm disease development."

    return round(risk_score, 1), name, explanation


def compute_crop_health(ndvi: Optional[float], water_stress: float,
                         disease_risk: float) -> float:
    """
    Weighted fusion of satellite vegetation index + stress scores.
    
    Weights (agronomically calibrated for oil palm):
      40% NDVI (direct vegetation density measurement)
      35% Water stress (most limiting factor in tropics)
      25% Disease risk (secondary but compounding)
    """
    if ndvi is None:
        # Without NDVI, use weather-based health proxy
        return round(max(0.0, 100.0 - water_stress * 0.6 - disease_risk * 0.4), 1)

    ndvi_score = min(100.0, max(0.0, ndvi * 100.0))  # 0.0–1.0 → 0–100
    health = (
        0.40 * ndvi_score
        + 0.35 * (100.0 - water_stress)
        + 0.25 * (100.0 - disease_risk)
    )
    return round(min(100.0, max(0.0, health)), 1)


def compute_soil_state(rainfall_7d_mm: float, humidity_pct: float) -> tuple[str, float, str]:
    """
    Estimates soil moisture state from 7-day rainfall integration.
    
    Field capacity for loam/clay (typical Kerala/Pune oil palm soils):
      - Saturation: > 90mm / 7 days
      - Field Capacity (optimal): 30–90mm
      - Below FC (dry): 10–30mm
      - Wilting point (very dry): < 10mm
    
    Returns (state_label, score 0-100, interpretation).
    """
    if rainfall_7d_mm > 90:
        return "Saturated", 60.0, "Soil is at or above field capacity. Risk of waterlogging and root anoxia."
    elif rainfall_7d_mm > 30:
        score = 80.0 + min(20.0, (rainfall_7d_mm - 30) / 60.0 * 20.0)
        return "Optimal", round(score, 1), "Soil moisture is at field capacity. Ideal for nutrient uptake."
    elif rainfall_7d_mm > 10:
        score = 40.0 + (rainfall_7d_mm - 10) / 20.0 * 40.0
        return "Dry", round(score, 1), "Soil moisture below field capacity. Irrigation recommended."
    else:
        score = max(10.0, rainfall_7d_mm / 10.0 * 40.0)
        return "Very Dry", round(score, 1), "Soil approaching wilting point. Urgent irrigation needed."


def compute_yield_forecast(crop_health: float, water_stress: float,
                            growth_stage: str = "Fruit Dev") -> tuple[float, str]:
    """
    Estimates FFB (Fresh Fruit Bunch) yield for oil palm.
    
    Base yield (mature palm, 10+ years): 18–22 t/ha/year
    Adjustments:
      - Crop health < 60% → significant yield penalty
      - Water stress > 50 → yield loss proportional to stress
      - Growth stage matters (Fruit Dev stage is critical window)
    
    Returns (estimated_yield_t_ha, risk_label).
    """
    base_yield = 20.0  # t/ha/year (typical mature Malaysian/Indian oil palm)

    health_factor = crop_health / 100.0
    stress_penalty = max(0.0, (water_stress - 20.0) / 80.0)  # penalty starts at 20% stress

    stage_multiplier = 1.0
    if growth_stage == "Fruit Dev":
        stage_multiplier = 1.05  # critical window — good conditions boost yield
    elif growth_stage == "Harvest":
        stage_multiplier = 0.95

    estimated = base_yield * health_factor * (1.0 - stress_penalty * 0.3) * stage_multiplier

    if estimated >= 18:
        risk = "On Track"
    elif estimated >= 14:
        risk = "Below Average"
    elif estimated >= 10:
        risk = "At Risk"
    else:
        risk = "Critical"

    return round(estimated, 2), risk


# ─────────────────────────────────────────────────────────────────────────────
# Main Service
# ─────────────────────────────────────────────────────────────────────────────

class LiveTwinService:
    """
    Orchestrates live weather fetch + all 5 score computations.
    Called on every API request — always returns fresh data.
    """

    def __init__(self, supabase_client):
        self.client = supabase_client

    def _get_plot(self, plot_id: str) -> Optional[dict]:
        resp = (
            self.client.table("plots")
            .select("id, name, latitude, longitude, stage, crop")
            .eq("id", plot_id)
            .maybe_single()
            .execute()
        )
        return getattr(resp, "data", None)

    def _get_last_ndvi(self, plot_id: str) -> Optional[float]:
        """Fetches the most recent non-null NDVI from digital_twins."""
        resp = (
            self.client.table("digital_twins")
            .select("ndvi, analysis_date")
            .eq("plot_id", plot_id)
            .not_.is_("ndvi", "null")
            .order("analysis_date", desc=True)
            .limit(1)
            .execute()
        )
        rows = getattr(resp, "data", []) or []
        if rows:
            return rows[0].get("ndvi")
        return None

    def compute_live_state(self, plot_id: str) -> Optional[dict]:
        """
        Full pipeline: fetch live weather → compute all 5 scores → return JSON.
        """
        # 1. Get plot metadata
        plot = self._get_plot(plot_id)
        if not plot:
            log.error("Plot %s not found", plot_id)
            return None

        lat, lon = plot.get("latitude"), plot.get("longitude")
        if not lat or not lon:
            log.error("Plot %s has no GPS coordinates", plot_id)
            return None

        # 2. Fetch live weather from Open-Meteo
        weather = fetch_live_weather(float(lat), float(lon))
        if not weather:
            return None

        cur = weather["current"]
        daily = weather["daily_7d"]

        temp = cur.get("temperature_c") or 30.0
        humidity = cur.get("humidity_pct") or 70.0
        wind = cur.get("wind_kph") or 10.0
        rainfall_7d = sum(d["rainfall_mm"] for d in daily if d.get("rainfall_mm"))

        # 3. Get last known NDVI
        ndvi = self._get_last_ndvi(plot_id)

        # 4. Compute all 5 scores
        water_stress = compute_water_stress(temp, humidity, rainfall_7d, wind)
        disease_risk, disease_name, disease_explanation = compute_disease_risk(
            temp, humidity, rainfall_7d
        )
        crop_health = compute_crop_health(ndvi, water_stress, disease_risk)
        soil_state, soil_score, soil_interpretation = compute_soil_state(rainfall_7d, humidity)
        yield_est, yield_risk = compute_yield_forecast(
            crop_health, water_stress, plot.get("stage", "Fruit Dev")
        )

        # 5. Determine overall risk level
        if disease_risk > 65 or water_stress > 70:
            risk_level = "High"
        elif disease_risk > 40 or water_stress > 45:
            risk_level = "Moderate"
        else:
            risk_level = "Low"

        return {
            "plot_id": plot_id,
            "plot_name": plot.get("name"),
            "computed_at": datetime.utcnow().isoformat() + "Z",
            "model_version": MODEL_VERSION,
            "coordinates": {"lat": lat, "lon": lon},

            # Live weather snapshot
            "live_weather": {
                "temperature_c": cur.get("temperature_c"),
                "apparent_temp_c": cur.get("apparent_temp_c"),
                "humidity_pct": cur.get("humidity_pct"),
                "rainfall_now_mm": cur.get("rainfall_mm"),
                "rainfall_7d_mm": round(rainfall_7d, 1),
                "wind_kph": cur.get("wind_kph"),
                "uv_index": cur.get("uv_index"),
                "cloud_cover_pct": cur.get("cloud_cover_pct"),
                "weather_fetched_at": weather["fetched_at"],
            },

            # 7-day daily breakdown
            "daily_7d": daily,

            # AI-computed scores
            "scores": {
                "water_stress": water_stress,
                "disease_risk": disease_risk,
                "crop_health": crop_health,
                "soil_score": soil_score,
                "yield_estimate_t_ha": yield_est,
            },

            # Derived states
            "soil_state": soil_state,
            "soil_interpretation": soil_interpretation,
            "disease_name": disease_name,
            "disease_explanation": disease_explanation,
            "yield_risk": yield_risk,
            "risk_level": risk_level,
            "ndvi_last_known": ndvi,
            "ndvi_data_age_days": None,  # Could compute from analysis_date
        }


def get_live_twin_service(supabase_client) -> LiveTwinService:
    return LiveTwinService(supabase_client)
