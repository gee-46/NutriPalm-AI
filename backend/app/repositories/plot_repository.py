"""
plot_repository.py

Integration boundary with Team Member 2's Plot / Digital Twin module.

This repository defines the interface required by the AI backend and reads
plot data from the `plots` table using the documented integration contract.

If the integration table is not yet present, the repository translates only
PostgREST's PostgreSQL 42P01 ("undefined table") error into
RepositoryNotConfigured so the API can return HTTP 503.

Other database/query/data errors are deliberately not swallowed.
"""

from __future__ import annotations

from typing import Protocol

from postgrest.exceptions import APIError

from app.database import get_supabase_client
from app.exceptions import (
    PlotNotFound,
    RepositoryNotConfigured,
)
from app.schemas.inputs import PlotInput


class PlotRepository(Protocol):
    def get_plot(self, plot_id: str) -> PlotInput:
        """Return the plot's data, or raise PlotNotFound."""
        ...


def _row_to_plot_input(row: dict) -> PlotInput:
    """
    Map a `plots` table row to PlotInput.

    Expected columns:
        id, owner_id, crop, area, area_unit
    """
    return PlotInput(
        plot_id=row["id"],
        owner_id=row["owner_id"],
        crop=row["crop"],
        area=row["area"],
        area_unit=row.get("area_unit", "hectare"),
    )


class SupabasePlotRepository:
    """Read plot data from Supabase's `plots` table."""

    def get_plot(self, plot_id: str) -> PlotInput:
        client = get_supabase_client()

        try:
            response = (
                client.table("plots")
                .select("id, owner_id, crop, area, area_unit")
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
            raise PlotNotFound(
                f"Plot '{plot_id}' was not found."
            )

        return _row_to_plot_input(row)


def get_plot_repository() -> PlotRepository:
    return SupabasePlotRepository()
