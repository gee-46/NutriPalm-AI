"""
Input schemas consumed by the AI pipeline.

SoilTestInput and PlotInput are the internal shape my services need. They
mirror (but are decoupled from) the CONTRACT documented in
backend/docs/integration_contract.md, which is what Team Member 2 (Plot) and
Team Member 3 (Soil Report/OCR) need to supply.

Keeping these as separate Pydantic models means:
- my services never depend on Supabase row shapes directly
- the repository layer (app/repositories/) is the only place that maps
  teammate schemas -> these input models
"""
from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class SoilTestInput(BaseModel):
    """
    Structured soil-test values, as produced by the Soil Report/OCR module
    (Team Member 3) after they parse an uploaded lab report.
    """

    soil_report_id: str
    plot_id: str
    owner_id: str

    # kg/ha available nutrient, as reported by a standard soil test.
    nitrogen_kg_ha: float = Field(ge=0)
    phosphorus_kg_ha: float = Field(ge=0)
    potassium_kg_ha: float = Field(ge=0)

    organic_carbon_percent: float = Field(ge=0, le=100)
    ph: float = Field(ge=0, le=14)

    @field_validator("ph")
    @classmethod
    def _sane_ph(cls, v: float) -> float:
        # 0-14 is the theoretical scale; reject clearly-invalid OCR noise
        # while still allowing the full valid agronomic range.
        if v <= 0:
            raise ValueError("ph must be greater than 0")
        return v


class PlotInput(BaseModel):
    """
    Structured plot/farm data, as produced by the Plot/Digital Twin module
    (Team Member 2).
    """

    plot_id: str
    owner_id: str
    crop: str
    area: float = Field(gt=0)
    area_unit: str = Field(default="hectare")

    @field_validator("area_unit")
    @classmethod
    def _known_unit(cls, v: str) -> str:
        allowed = {"hectare", "acre", "square_meter"}
        if v not in allowed:
            raise ValueError(f"area_unit must be one of {sorted(allowed)}")
        return v

    def area_in_hectares(self) -> float:
        if self.area_unit == "hectare":
            return self.area
        if self.area_unit == "acre":
            return self.area * 0.4046856422
        if self.area_unit == "square_meter":
            return self.area / 10_000.0
        raise ValueError(f"Unhandled area_unit {self.area_unit}")
