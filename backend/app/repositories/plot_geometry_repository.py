"""
plot_geometry_repository.py

Read-only access to a plot's boundary geometry/centroid for the geospatial
integration (Sentinel-2 NDVI, cadastral lookup). Kept separate from
plot_repository.py (used by the recommendation pipeline) so this new
integration never touches that existing, already-tested contract.

Expected `plots` table columns used here: id, owner_id, boundary (jsonb
GeoJSON Polygon), latitude, longitude.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

from postgrest.exceptions import APIError

from app.database import get_supabase_client
from app.exceptions import PlotNotFound, RepositoryNotConfigured


@dataclass(frozen=True)
class PlotGeometry:
    plot_id: str
    owner_id: str
    boundary: dict[str, Any] | None  # GeoJSON Polygon, or None if not yet mapped
    latitude: float | None
    longitude: float | None


class PlotGeometryRepository(Protocol):
    def get_geometry(self, plot_id: str) -> PlotGeometry:
        """Return the plot's boundary/centroid data, or raise PlotNotFound."""
        ...


def _row_to_geometry(row: dict) -> PlotGeometry:
    return PlotGeometry(
        plot_id=row["id"],
        owner_id=row["owner_id"],
        boundary=row.get("boundary"),
        latitude=row.get("latitude"),
        longitude=row.get("longitude"),
    )


class SupabasePlotGeometryRepository:
    """Reads plot boundary/centroid from Supabase's `plots` table."""

    def get_geometry(self, plot_id: str) -> PlotGeometry:
        client = get_supabase_client()

        try:
            response = (
                client.table("plots")
                .select("id, owner_id, boundary, latitude, longitude")
                .eq("id", plot_id)
                .maybe_single()
                .execute()
            )
        except APIError as exc:
            if getattr(exc, "code", None) == "42P01":
                raise RepositoryNotConfigured(
                    "Plot data source is not configured: "
                    "the 'plots' table does not exist."
                ) from exc
            raise

        row = getattr(response, "data", None)

        if not row:
            raise PlotNotFound(f"Plot '{plot_id}' was not found.")

        return _row_to_geometry(row)


def get_plot_geometry_repository() -> PlotGeometryRepository:
    return SupabasePlotGeometryRepository()
