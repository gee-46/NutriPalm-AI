from typing import TypedDict, Optional
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict
from uuid import UUID

class DataCompleteness(TypedDict):
    ndvi: bool
    weather: bool
    soil: bool

class TwinSnapshotBase(BaseModel):
    plot_id: UUID
    analysis_date: datetime
    
    # Core output
    crop_health_score: Optional[float] = None
    water_stress_score: Optional[float] = None
    nutrient_health_score: Optional[float] = None
    growth_stage: Optional[str] = None
    yield_prediction: Optional[float] = None
    risk_level: Optional[str] = None
    model_version: Optional[str] = None
    confidence_score: Optional[float] = None
    
    # Extended fields
    ndvi: Optional[float] = None
    disease_name: Optional[str] = None
    disease_probability: Optional[float] = None
    disease_explanation: Optional[str] = None
    recommended_action: Optional[str] = None
    advisory_reason: Optional[str] = None
    
    # New Fusion fields (Phase 2)
    temperature_c: Optional[float] = None
    humidity_pct: Optional[float] = None
    rainfall_mm: Optional[float] = None
    soil_health_index: Optional[float] = None
    foliar_health_score: Optional[float] = None
    data_completeness: Optional[DataCompleteness] = None
    is_synthetic: Optional[bool] = False

    model_config = ConfigDict(from_attributes=True)

class PredictionOutput(BaseModel):
    plot_id: UUID
    target_date: datetime
    predicted_ndvi: Optional[float] = None
    trend_direction: str  # "up", "down", "flat", "insufficient_data"
    is_projection: bool = True
    
    model_config = ConfigDict(from_attributes=True)


class LiveWeather(BaseModel):
    temperature_c: Optional[float] = None
    apparent_temp_c: Optional[float] = None
    humidity_pct: Optional[float] = None
    rainfall_now_mm: Optional[float] = None
    rainfall_7d_mm: Optional[float] = None
    wind_kph: Optional[float] = None
    uv_index: Optional[float] = None
    cloud_cover_pct: Optional[float] = None
    weather_fetched_at: Optional[str] = None


class LiveScores(BaseModel):
    water_stress: float = 0.0
    disease_risk: float = 0.0
    crop_health: float = 0.0
    soil_score: float = 0.0
    yield_estimate_t_ha: float = 0.0


class LiveTwinResponse(BaseModel):
    plot_id: str
    plot_name: Optional[str] = None
    computed_at: str
    model_version: str

    live_weather: LiveWeather
    scores: LiveScores

    soil_state: str = "Unknown"
    soil_interpretation: str = ""
    disease_name: str = "No Significant Risk"
    disease_explanation: str = ""
    yield_risk: str = "Unknown"
    risk_level: str = "Low"

    ndvi_last_known: Optional[float] = None
    daily_7d: list = []

    model_config = ConfigDict(from_attributes=True)
