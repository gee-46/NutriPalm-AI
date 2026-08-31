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
    NotAuthorized,
    PlotNotFound,
    RecommendationNotFound,
    SoilReportNotFound,
)
from app.main import app
from app.repositories.plot_repository import get_plot_repository
from app.repositories.recommendation_repository import get_recommendation_repository
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

    def save(self, result):
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


@pytest.fixture
def fake_soil_report_writer():
    return FakeSoilReportWriter()


@pytest.fixture
def client(fake_recommendation_repo, fake_soil_report_writer):
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(user_id=TEST_USER_ID)
    app.dependency_overrides[get_plot_repository] = lambda: FakePlotRepository()
    app.dependency_overrides[get_soil_report_repository] = lambda: FakeSoilReportRepository()
    app.dependency_overrides[get_recommendation_repository] = lambda: fake_recommendation_repo
    app.dependency_overrides[get_soil_report_writer] = lambda: fake_soil_report_writer

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture
def unauthenticated_client():
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
