"""
plot_repository.py

Integration boundary with Team Member 2's Plot / Digital Twin module.

I do NOT own the plots table. This repository defines the interface my AI
backend needs (`PlotRepository.get_plot`) and a Supabase-backed
implementation that reads from a `plots` table using the column names in
the CONTRACT (see backend/docs/integration_contract.md).

STATUS: BLOCKED BY TEAMMATE CONTRACT until Team Member 2 confirms the real
`plots` table name/columns. If their schema differs, only
`_row_to_plot_input` below needs to change - nutrient_analyzer,
severity_calculator, dosage_calculator, yield_predictor, roi_calculator,
explanation_engine and recommendation_service are completely unaffected.
"""
from __future__ import annotations

from typing import Protocol

from app.database import get_supabase_client
from app.exceptions import PlotNotFound
from app.schemas.inputs import PlotInput


class PlotRepository(Protocol):
    def get_plot(self, plot_id: str) -> PlotInput:
        """Return the plot's data, or raise PlotNotFound."""
        ...


def _row_to_plot_input(row: dict) -> PlotInput:
    """
    Maps a `plots` table row (per the CONTRACT) to PlotInput.

    Expected columns (see integration_contract.md):
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
    """
    Reads plot data from Supabase's `plots` table (owned by Team Member 2).
    """

    def get_plot(self, plot_id: str) -> PlotInput:
        client = get_supabase_client()
        response = (
            client.table("plots")
            .select("id, owner_id, crop, area, area_unit")
            .eq("id", plot_id)
            .maybe_single()
            .execute()
        )
        row = getattr(response, "data", None)
        if not row:
            raise PlotNotFound(f"Plot '{plot_id}' was not found.")
        return _row_to_plot_input(row)


def get_plot_repository() -> PlotRepository:
    return SupabasePlotRepository()
