"""
soil_report_repository.py

Integration boundary with Team Member 3's Soil Report Upload / OCR module.

I do NOT own the soil_reports table. This repository defines the interface
my AI backend needs (`SoilReportRepository.get_soil_report`) and a
Supabase-backed implementation reading from a `soil_reports` table using the
column names in the CONTRACT (see backend/docs/integration_contract.md).

STATUS: BLOCKED BY TEAMMATE CONTRACT until Team Member 3 confirms the real
`soil_reports` table name/columns and confirms the OCR pipeline writes
*numeric, structured* values (not raw OCR text) to these columns. If their
schema differs, only `_row_to_soil_input` below needs to change.
"""
from __future__ import annotations

from typing import Protocol

from app.database import get_supabase_client
from app.exceptions import SoilReportNotFound
from app.schemas.inputs import SoilTestInput


class SoilReportRepository(Protocol):
    def get_soil_report(self, soil_report_id: str) -> SoilTestInput:
        """Return the structured soil-test data, or raise SoilReportNotFound."""
        ...


def _row_to_soil_input(row: dict) -> SoilTestInput:
    """
    Maps a `soil_reports` table row (per the CONTRACT) to SoilTestInput.

    Expected columns (see integration_contract.md):
        id, plot_id, owner_id, nitrogen_kg_ha, phosphorus_kg_ha,
        potassium_kg_ha, organic_carbon_percent, ph
    """
    return SoilTestInput(
        soil_report_id=row["id"],
        plot_id=row["plot_id"],
        owner_id=row["owner_id"],
        nitrogen_kg_ha=row["nitrogen_kg_ha"],
        phosphorus_kg_ha=row["phosphorus_kg_ha"],
        potassium_kg_ha=row["potassium_kg_ha"],
        organic_carbon_percent=row["organic_carbon_percent"],
        ph=row["ph"],
    )


class SupabaseSoilReportRepository:
    """
    Reads structured soil-test data from Supabase's `soil_reports` table
    (owned by Team Member 3).
    """

    def get_soil_report(self, soil_report_id: str) -> SoilTestInput:
        client = get_supabase_client()
        response = (
            client.table("soil_reports")
            .select(
                "id, plot_id, owner_id, nitrogen_kg_ha, phosphorus_kg_ha, "
                "potassium_kg_ha, organic_carbon_percent, ph"
            )
            .eq("id", soil_report_id)
            .maybe_single()
            .execute()
        )
        row = getattr(response, "data", None)
        if not row:
            raise SoilReportNotFound(f"Soil report '{soil_report_id}' was not found.")
        return _row_to_soil_input(row)


def get_soil_report_repository() -> SoilReportRepository:
    return SupabaseSoilReportRepository()
