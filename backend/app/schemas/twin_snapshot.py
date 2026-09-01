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
