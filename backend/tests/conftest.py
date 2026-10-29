"""
Shared test fixtures.

API tests use FastAPI dependency_overrides to substitute in-memory fake
repositories and a fake authenticated user, so the test suite never needs
real Supabase credentials. Production code paths (SupabasePlotRepository
etc.) are exercised structurally in test_repositories.py without hitting a
live database.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.dependencies import AuthenticatedUser, get_current_user
from app.exceptions import (
    ExtractionConflict,
    ExtractionNotFound,
    NotAuthorized,
    PlotNotFound,
    RecommendationNotFound,
    SoilReportNotFound,
)
from app.main import app
from app.repositories.plot_repository import get_plot_repository
from app.repositories.recommendation_repository import get_recommendation_repository
from app.repositories.soil_extraction_repository import get_extraction_repository
from app.services import crop_rules
from app.services.rule_provenance import VerifiedRule, get_rule_pack
from app.repositories.soil_report_repository import (
    get_soil_report_repository,
    get_soil_report_writer,
)
from tests.fixtures.sample_data import deficient_oil_palm_plot, deficient_oil_palm_soil

TEST_USER_ID = "test-owner-1"


class FakePlotRepository:
    def __init__(self):
        self.plots = {deficient_oil_palm_plot().plot_id: deficient_oil_palm_plot()}

    def get_plot(self, plot_id: str):
        plot = self.plots.get(plot_id)
        if plot is None:
            raise PlotNotFound(f"Plot '{plot_id}' was not found.")
        return plot


class FakeSoilReportRepository:
    def __init__(self):
        self.reports = {deficient_oil_palm_soil().soil_report_id: deficient_oil_palm_soil()}

    def get_soil_report(self, soil_report_id: str):
        soil = self.reports.get(soil_report_id)
        if soil is None:
            raise SoilReportNotFound(f"Soil report '{soil_report_id}' was not found.")
        return soil


class FakeRecommendationRepository:
    def __init__(self):
        self._rows: dict[str, dict] = {}
        self._counter = 0

    def save(self, result, *, engine_version="test", generated_at=None, provenance=None, stored=None):
        import json
        from datetime import datetime, timezone

        self._counter += 1
        row_id = f"rec-{self._counter}"
        now = datetime.now(timezone.utc).isoformat()
        row = {
            "id": row_id,
            "owner_id": result.owner_id,
            "plot_id": result.plot_id,
            "soil_report_id": result.soil_report_id,
            "crop": result.crop,
            "deficiencies": json.dumps([]),
            "fertilizer_plan": json.dumps([]),
            "yield_prediction": json.dumps({}),
            "roi": json.dumps({}),
            "explanation": json.dumps({}),
            "status": "generated",
            "created_at": now,
            "updated_at": now,
            "engine_version": engine_version,
            "generated_at": generated_at,
            "provenance": provenance,
            "stored": stored,
        }
        self._rows[row_id] = row
        return row

    def list_for_owner(self, owner_id: str):
        return [r for r in self._rows.values() if r["owner_id"] == owner_id]

    def get_for_owner(self, recommendation_id: str, owner_id: str):
        row = self._rows.get(recommendation_id)
        if row is None:
            raise RecommendationNotFound(f"Recommendation '{recommendation_id}' was not found.")
        if row["owner_id"] != owner_id:
            raise NotAuthorized("You do not have access to this recommendation.")
        return row


def make_test_rule_pack(*, covers_yield_and_economics: bool = False) -> dict[str, VerifiedRule]:
    """
    TEST FIXTURE ONLY. A rule for every catalog crop so the engine's API behaviour can
    be exercised. The "source" is a placeholder, NOT a real citation -- the shipped
    pack (app/services/data/verified_rules.json) is empty on purpose.
    """
    return {
        crop: VerifiedRule(
            crop=crop,
            rule_version="test-fixture",
            source={"id": "test", "title": "TEST FIXTURE - not a real source", "publisher": "tests",
                    "edition": "none", "year": 2000, "locator": "n/a", "quote": "n/a"},
            reviewed_by="tests, test fixture",
            reviewed_on="2000-01-01",
            covers_yield_and_economics=covers_yield_and_economics,
            applicable_stage="TEST FIXTURE stage",
            region="TEST FIXTURE region",
            soil_test_basis={"phosphorus": "elemental", "potassium": "elemental"},
            assumptions=("TEST FIXTURE assumption",),
        )
        for crop in crop_rules.list_supported_crops()
    }


@pytest.fixture
def fake_recommendation_repo():
    return FakeRecommendationRepository()


class FakeSoilReportWriter:
    """In-memory stand-in for the Supabase-backed soil report writer used
    by the OCR upload endpoint (app/routers/soil_reports.py)."""

    def __init__(self):
        self.rows: dict[str, dict] = {}
        self._counter = 0

    def create_soil_report(self, **kwargs):
        from datetime import datetime, timezone

        self._counter += 1
        row_id = f"soil-{self._counter}"
        row = {
            "id": row_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            **kwargs,
        }
        self.rows[row_id] = row
        return row


    def delete_soil_report(self, soil_report_id: str, owner_id: str):
        row = self.rows.get(soil_report_id)
        if row and row["owner_id"] == owner_id:
            del self.rows[soil_report_id]


class FakeExtractionRepository:
    """In-memory stand-in for `soil_report_extractions` with the same guards:
    unique (owner, plot, sha256) and a status-guarded close."""

    def __init__(self):
        self.rows: dict[str, dict] = {}
        self._counter = 0
        self.fail_mark_completed = False

    def find_by_hash(self, owner_id, plot_id, sha256):
        for r in self.rows.values():
            if (r["owner_id"], r["plot_id"], r["source_sha256"]) == (owner_id, plot_id, sha256):
                return dict(r)
        return None

    def create(self, row):
        if self.find_by_hash(row["owner_id"], row["plot_id"], row["source_sha256"]):
            raise ExtractionConflict("duplicate")
        self._counter += 1
        stored = {
            "id": f"ext-{self._counter}",
            "soil_report_id": None,
            "verification_status": None,
            "confirmed_at": None,
            "created_at": "2026-01-01T00:00:00+00:00",
            **row,
        }
        self.rows[stored["id"]] = stored
        return dict(stored)

    def get_for_owner(self, extraction_id, owner_id):
        r = self.rows.get(extraction_id)
        if r is None or r["owner_id"] != owner_id:
            raise ExtractionNotFound("Extraction not found.")
        return dict(r)

    def list_for_plot(self, owner_id, plot_id, limit=10):
        rows = [dict(r) for r in self.rows.values() if r["owner_id"] == owner_id and r["plot_id"] == plot_id]
        return rows[:limit]

    def mark_completed(self, extraction_id, owner_id, *, soil_report_id, corrections, verification_status):
        if self.fail_mark_completed:
            raise RuntimeError("database unavailable")
        r = self.rows.get(extraction_id)
        if r is None or r["owner_id"] != owner_id or r["status"] != "needs_review":
            return None
        r.update(
            status="completed",
            soil_report_id=soil_report_id,
            corrections=corrections,
            verification_status=verification_status,
            confirmed_at="2026-01-01T00:00:01+00:00",
        )
        return dict(r)


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    from app.rate_limit import heavy_limiter

    heavy_limiter.reset()
    yield


@pytest.fixture
def fake_extraction_repo():
    return FakeExtractionRepository()


@pytest.fixture
def fake_soil_report_writer():
    return FakeSoilReportWriter()


@pytest.fixture
def client(fake_recommendation_repo, fake_soil_report_writer, fake_extraction_repo):
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(user_id=TEST_USER_ID)
    app.dependency_overrides[get_plot_repository] = lambda: FakePlotRepository()
    app.dependency_overrides[get_soil_report_repository] = lambda: FakeSoilReportRepository()
    app.dependency_overrides[get_recommendation_repository] = lambda: fake_recommendation_repo
    app.dependency_overrides[get_soil_report_writer] = lambda: fake_soil_report_writer
    app.dependency_overrides[get_extraction_repository] = lambda: fake_extraction_repo
    app.dependency_overrides[get_rule_pack] = lambda: make_test_rule_pack()

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture
def unauthenticated_client():
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
