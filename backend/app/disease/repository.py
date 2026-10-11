"""
repository.py

Persistence boundary for Disease Intelligence.

Ownership is enforced twice, exactly as for recommendations: every query here is scoped by the
authenticated user's id in application code (this backend uses the service-role key, which bypasses
row-level security), and migration 012's RLS policies protect any direct database access.

* PlotContextRepository reads the few plot columns an assessment may use. The plot's STATE is read
  from the database; a client can never supply or override it.
* AssessmentRepository stores immutable assessment rows owned by the caller.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional, Protocol

from postgrest.exceptions import APIError

from app.database import get_supabase_client
from app.disease.schemas import AssessmentRequest, AssessmentResponse
from app.exceptions import DiseaseAssessmentNotFound, NotAuthorized, PlotNotFound, RepositoryNotConfigured


@dataclass(frozen=True)
class PlotContext:
    plot_id: str
    owner_id: str
    crop: Optional[str]
    state: Optional[str]
    district: Optional[str]


class PlotContextRepository(Protocol):
    def get_plot_context(self, plot_id: str) -> PlotContext: ...


class AssessmentRepository(Protocol):
    def save(self, owner_id: str, request: AssessmentRequest, result: AssessmentResponse, top_disease_id: Optional[str]) -> dict: ...

    def list_for_owner(self, owner_id: str, plot_id: Optional[str] = None, limit: int = 100) -> list[dict]: ...

    def get_for_owner(self, assessment_id: str, owner_id: str) -> dict: ...


def _is_malformed_uuid(exc: APIError) -> bool:
    return getattr(exc, "code", None) == "22P02"


class SupabasePlotContextRepository:
    def get_plot_context(self, plot_id: str) -> PlotContext:
        client = get_supabase_client()
        try:
            resp = client.table("plots").select("id, owner_id, crop, state, district").eq("id", plot_id).maybe_single().execute()
        except APIError as exc:
            if _is_malformed_uuid(exc):
                raise PlotNotFound(f"Plot '{plot_id}' was not found.") from exc
            if getattr(exc, "code", None) == "42P01":
                raise RepositoryNotConfigured("The plots table does not exist.") from exc
            raise
        row = getattr(resp, "data", None)
        if not row:
            raise PlotNotFound(f"Plot '{plot_id}' was not found.")
        return PlotContext(plot_id=row["id"], owner_id=row["owner_id"], crop=row.get("crop"), state=row.get("state"), district=row.get("district"))


class SupabaseAssessmentRepository:
    TABLE = "disease_assessments"

    def save(self, owner_id: str, request: AssessmentRequest, result: AssessmentResponse, top_disease_id: Optional[str]) -> dict:
        client = get_supabase_client()
        row = {
            "id": str(uuid.uuid4()),
            "owner_id": owner_id,  # always the authenticated user, never a client-supplied value
            "plot_id": request.plot_id,
            "crop": result.crop,
            "risk_level": result.risk_level.value,
            "top_disease_id": top_disease_id,
            "request": request.model_dump(mode="json"),
            "result": result.model_dump(mode="json"),
            "kb_version": result.kb_version,
            "rule_version": result.rule_version,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        resp = client.table(self.TABLE).insert(row).execute()
        data = getattr(resp, "data", None)
        if not data:
            raise RuntimeError("Failed to persist disease assessment - no row returned.")
        return data[0]

    def list_for_owner(self, owner_id: str, plot_id: Optional[str] = None, limit: int = 100) -> list[dict]:
        client = get_supabase_client()
        q = client.table(self.TABLE).select("*").eq("owner_id", owner_id)
        if plot_id:
            q = q.eq("plot_id", plot_id)
        try:
            resp = q.order("created_at", desc=True).limit(max(1, min(limit, 200))).execute()
        except APIError as exc:
            if _is_malformed_uuid(exc):
                return []
            raise
        return getattr(resp, "data", None) or []

    def get_for_owner(self, assessment_id: str, owner_id: str) -> dict:
        client = get_supabase_client()
        try:
            resp = client.table(self.TABLE).select("*").eq("id", assessment_id).maybe_single().execute()
        except APIError as exc:
            if _is_malformed_uuid(exc):
                raise DiseaseAssessmentNotFound(f"Assessment '{assessment_id}' was not found.") from exc
            raise
        row = getattr(resp, "data", None)
        if not row:
            raise DiseaseAssessmentNotFound(f"Assessment '{assessment_id}' was not found.")
        if row["owner_id"] != owner_id:
            raise NotAuthorized("You do not have access to this assessment.")
        return row


def get_plot_context_repository() -> PlotContextRepository:
    return SupabasePlotContextRepository()


def get_assessment_repository() -> AssessmentRepository:
    return SupabaseAssessmentRepository()
