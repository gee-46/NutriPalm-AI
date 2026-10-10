from typing import Optional, List, Literal
from pydantic import BaseModel, Field

class LocationData(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    region: str
    elevation: Optional[float] = None

class SoilData(BaseModel):
    ph: float = Field(ge=0, le=14)
    ec: float = Field(ge=0)
    organic_carbon_percent: float = Field(ge=0, le=100)
    n_kg_ha: float = Field(ge=0)
    p_kg_ha: float = Field(ge=0)
    k_kg_ha: float = Field(ge=0)
    ca_kg_ha: Optional[float] = None
    mg_kg_ha: Optional[float] = None
    s_kg_ha: Optional[float] = None
    micronutrients: Optional[dict] = None
    texture: Optional[str] = None
    drainage: Optional[str] = None
    depth_cm: Optional[float] = None

class WaterData(BaseModel):
    irrigation_availability: bool
    reliability: Literal["high", "medium", "low"]
    condition: Literal["rainfed", "irrigated"]

class FarmConditions(BaseModel):
    land_area_ha: float = Field(gt=0)
    infrastructure: List[str] = Field(default_factory=list)
    crop_history: List[str] = Field(default_factory=list)

class ClimateData(BaseModel):
    avg_temperature_c: float
    avg_annual_rainfall_mm: float
    current_temperature_c: Optional[float] = None
    current_humidity_pct: Optional[float] = None

class CropRequirement(BaseModel):
    """
    Mirrors the public.crop_requirements table in Supabase.
    """
    crop_name: str
    ph_min: Optional[float] = None
    ph_max: Optional[float] = None
    ec_max: Optional[float] = None
    organic_carbon_min: Optional[float] = None
    n_min: Optional[float] = None
    p_min: Optional[float] = None
    k_min: Optional[float] = None
    temperature_min: Optional[float] = None
    temperature_max: Optional[float] = None
    annual_rainfall_min: Optional[float] = None
    annual_rainfall_max: Optional[float] = None
    water_needs_mm_per_day: Optional[float] = None
    known_limitations: List[str] = Field(default_factory=list)
