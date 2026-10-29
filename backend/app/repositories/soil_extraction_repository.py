"""
soil_extraction_repository.py

Persistence for `soil_report_extractions` (migration 013): one row per distinct
document uploaded for a plot, with the per-field extraction exactly as read and
the append-only correction history.

Written only by the backend (service role). Every query is scoped by owner_id in
application code; RLS is the second line of defence for any direct access.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Protocol

from postgrest.exceptions import APIError

from app.database import get_supabase_client, is_missing_table
from app.exceptions import ExtractionConflict, ExtractionNotFound, RepositoryNotConfigured

_TABLE = "soil_report_extractions"


class ExtractionRepository(Protocol):
    def find_by_hash(self, owner_id: str, plot_id: str, sha256: str) -> dict | None: ...

    def create(self, row: dict) -> dict:
        """Insert; raise ExtractionConflict if (owner, plot, sha256) already exists."""
        ...

    def list_for_plot(self, owner_id: str, plot_id: str, limit: int = 10) -> list[dict]:
        """Newest first."""
        ...

    def get_for_owner(self, extraction_id: str, owner_id: str) -> dict:
        """Raise ExtractionNotFound for a missing OR foreign extraction (indistinguishable)."""
        ...

    def mark_completed(
        self,
        extraction_id: str,
        owner_id: str,
        *,
        soil_report_id: str,
        corrections: list[dict],
        verification_status: str,
    ) -> dict | None:
        """
        Atomically move a `needs_review` extraction to `completed` (single UPDATE
        guarded by status = 'needs_review'). Returns the updated row, or None if
        it was no longer awaiting review (already confirmed / concurrent confirm).
        """
        ...


def _translate(exc: APIError):
    code = getattr(exc, "code", None)
    if is_missing_table(exc):
        raise RepositoryNotConfigured(
            "Soil extraction storage is not configured: apply migration 013 "
            "(table 'soil_report_extractions' is missing)."
        ) from exc
    if code == "23505":
        raise ExtractionConflict("This document was already uploaded for this plot.") from exc
    if code == "22P02":  # malformed uuid
        raise ExtractionNotFound("Extraction not found.") from exc
    raise exc


class SupabaseExtractionRepository:
    def find_by_hash(self, owner_id: str, plot_id: str, sha256: str) -> dict | None:
        client = get_supabase_client()
        try:
            resp = (
                client.table(_TABLE)
                .select("*")
                .eq("owner_id", owner_id)
                .eq("plot_id", plot_id)
                .eq("source_sha256", sha256)
                .limit(1)
                .execute()
            )
        except APIError as exc:
            _translate(exc)
        rows = getattr(resp, "data", None) or []
        return rows[0] if rows else None

    def create(self, row: dict) -> dict:
        client = get_supabase_client()
        try:
            resp = client.table(_TABLE).insert(row).execute()
        except APIError as exc:
            _translate(exc)
        rows = getattr(resp, "data", None) or []
        if not rows:
            raise RepositoryNotConfigured("Insert into 'soil_report_extractions' returned no row.")
        return rows[0]

    def get_for_owner(self, extraction_id: str, owner_id: str) -> dict:
        client = get_supabase_client()
        try:
            resp = (
                client.table(_TABLE)
                .select("*")
                .eq("id", extraction_id)
                .eq("owner_id", owner_id)
                .limit(1)
                .execute()
            )
        except APIError as exc:
            _translate(exc)
        rows = getattr(resp, "data", None) or []
        if not rows:
            raise ExtractionNotFound("Extraction not found.")
        return rows[0]

    def list_for_plot(self, owner_id: str, plot_id: str, limit: int = 10) -> list[dict]:
        client = get_supabase_client()
        try:
            resp = (
                client.table(_TABLE)
                .select("*")
                .eq("owner_id", owner_id)
                .eq("plot_id", plot_id)
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )
        except APIError as exc:
            _translate(exc)
        return getattr(resp, "data", None) or []

    def mark_completed(
        self,
        extraction_id: str,
        owner_id: str,
        *,
        soil_report_id: str,
        corrections: list[dict],
        verification_status: str,
    ) -> dict | None:
        client = get_supabase_client()
        now = datetime.now(timezone.utc).isoformat()
        try:
            resp = (
                client.table(_TABLE)
                .update(
                    {
                        "status": "completed",
                        "soil_report_id": soil_report_id,
                        "verification_status": verification_status,
                        "corrections": corrections,
                        "confirmed_at": now,
                        "updated_at": now,
                    }
                )
                .eq("id", extraction_id)
                .eq("owner_id", owner_id)
                .eq("status", "needs_review")
                .execute()
            )
        except APIError as exc:
            _translate(exc)
        rows = getattr(resp, "data", None) or []
        return rows[0] if rows else None


def get_extraction_repository() -> ExtractionRepository:
    return SupabaseExtractionRepository()
