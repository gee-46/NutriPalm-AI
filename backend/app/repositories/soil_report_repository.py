"""
soil_report_repository.py

Integration boundary with Team Member 3's Soil Report / OCR module.

This repository defines the interface required by the AI backend and reads
structured soil-test data from the `soil_reports` table.

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
    RepositoryNotConfigured,
    SoilReportNotFound,
)
from app.schemas.inputs import SoilTestInput


class SoilReportRepository(Protocol):
    def get_soil_report(self, soil_report_id: str) -> SoilTestInput:
        """Return structured soil-test data, or raise SoilReportNotFound."""
        ...


def _row_to_soil_input(row: dict) -> SoilTestInput:
    """
    Map a `soil_reports` table row to SoilTestInput.

    Expected columns:
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
    """Read structured soil-test data from Supabase's `soil_reports` table."""

    def get_soil_report(self, soil_report_id: str) -> SoilTestInput:
        client = get_supabase_client()

        try:
            response = (
                client.table("soil_reports")
                .select(
                    "id, plot_id, owner_id, nitrogen_kg_ha, "
                    "phosphorus_kg_ha, potassium_kg_ha, "
                    "organic_carbon_percent, ph"
                )
                .eq("id", soil_report_id)
                .maybe_single()
                .execute()
            )
        except APIError as exc:
            if getattr(exc, "code", None) == "42P01":
                raise RepositoryNotConfigured(
                    "Soil report data source is not configured: "
                    "the 'soil_reports' table does not exist."
                ) from exc
            raise

        row = getattr(response, "data", None)

        if not row:
            raise SoilReportNotFound(
                f"Soil report '{soil_report_id}' was not found."
            )

        return _row_to_soil_input(row)


def get_soil_report_repository() -> SoilReportRepository:
    return SupabaseSoilReportRepository()
