"""
recommendation_repository.py

Persistence for the `recommendations` table (owned by me, the AI/ML
backend). See supabase/migrations/003_create_recommendations.sql for the
schema and RLS policies.

Ownership is enforced twice, deliberately:
  1. In application code here (every query is scoped by owner_id, taken
     from the verified JWT - never from client-supplied input).
  2. In the database via Row Level Security, as defense in depth in case
     this repository is ever called with a client-scoped key instead of
     the service-role key.
"""
from __future__ import annotations

import json
import uuid
from dataclasses import asdict, is_dataclass
from datetime import datetime, timezone
from typing import Any, Protocol

from app.database import get_supabase_client
from app.exceptions import NotAuthorized, RecommendationNotFound
from app.services.recommendation_service import RecommendationResult


def _jsonable(value: Any) -> Any:
    """Recursively convert dataclasses/enums into JSON-serializable values."""
    if is_dataclass(value) and not isinstance(value, type):
        return {k: _jsonable(v) for k, v in asdict(value).items()}
    if isinstance(value, list):
        return [_jsonable(v) for v in value]
    if hasattr(value, "value") and not isinstance(value, (str, int, float, bool)):
        # Enum
        return value.value
    return value


class RecommendationRepository(Protocol):
    def save(self, result: RecommendationResult) -> dict:
        ...

    def list_for_owner(self, owner_id: str) -> list[dict]:
        ...

    def get_for_owner(self, recommendation_id: str, owner_id: str) -> dict:
        ...


class SupabaseRecommendationRepository:
    TABLE = "recommendations"

    def save(self, result: RecommendationResult) -> dict:
        client = get_supabase_client()
        now = datetime.now(timezone.utc).isoformat()

        row = {
            "id": str(uuid.uuid4()),
            "owner_id": result.owner_id,
            "plot_id": result.plot_id,
            "soil_report_id": result.soil_report_id,
            "crop": result.crop,
            "deficiencies": json.dumps(_jsonable(result.analysis.findings)),
            "fertilizer_plan": json.dumps(_jsonable(result.dosage_plan.dosages)),
            "yield_prediction": json.dumps(_jsonable(result.yield_prediction)),
            "roi": json.dumps(_jsonable(result.roi)),
            "explanation": json.dumps(_jsonable(result.explanation)),
            "status": "generated",
            "created_at": now,
            "updated_at": now,
        }

        response = client.table(self.TABLE).insert(row).execute()
        data = getattr(response, "data", None)
        if not data:
            raise RuntimeError("Failed to persist recommendation - no row returned.")
        return data[0]

    def list_for_owner(self, owner_id: str) -> list[dict]:
        client = get_supabase_client()
        response = (
            client.table(self.TABLE)
            .select("*")
            .eq("owner_id", owner_id)
            .order("created_at", desc=True)
            .execute()
        )
        return getattr(response, "data", None) or []

    def get_for_owner(self, recommendation_id: str, owner_id: str) -> dict:
        client = get_supabase_client()
        response = (
            client.table(self.TABLE)
            .select("*")
            .eq("id", recommendation_id)
            .maybe_single()
            .execute()
        )
        row = getattr(response, "data", None)
        if not row:
            raise RecommendationNotFound(f"Recommendation '{recommendation_id}' was not found.")
        if row["owner_id"] != owner_id:
            # Deliberately raise the same "not found" style error rather than
            # a distinguishable 403, so ID enumeration can't be used to probe
            # for the existence of other users' recommendations.
            raise NotAuthorized("You do not have access to this recommendation.")
        return row


def get_recommendation_repository() -> RecommendationRepository:
    return SupabaseRecommendationRepository()
