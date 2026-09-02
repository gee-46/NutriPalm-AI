"""
schemas/geospatial.py

Pydantic models for the geospatial endpoints (Sentinel-2 NDVI, cadastral).
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict


class NdviResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    plot_id: str
    available: bool
    mean_ndvi: float | None = None
    min_ndvi: float | None = None
    max_ndvi: float | None = None
    acquisition_date: str | None = None
    cloud_cover_percent: float | None = None
    status: Literal["Healthy", "Moderate", "Stressed"] | None = None
    source: str = "Sentinel-2"
    reason: str | None = None


class CadastralResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    plot_id: str
    available: bool
    parcel_reference: str | None = None
    geometry: dict[str, Any] | None = None
    source: str = "Karnataka Bhu-Naksha"
    reason: str | None = None
