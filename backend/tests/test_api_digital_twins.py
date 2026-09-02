"""
Tests for GET /api/plots/{plot_id}/twin/prediction.
Verifies JWT authentication, plot ownership scoping, and prediction outputs.
"""
from __future__ import annotations

import pytest
from datetime import datetime
from uuid import UUID, uuid4
from fastapi.testclient import TestClient

from app.dependencies import AuthenticatedUser, get_current_user
from app.exceptions import PlotNotFound
from app.main import app
from app.repositories.plot_geometry_repository import (
    PlotGeometry,
    get_plot_geometry_repository,
)
from app.schemas.twin_snapshot import PredictionOutput
from app.services.twin_prediction_service import (
    TwinPredictionService,
    get_twin_prediction_service,
)

TEST_USER_ID = "twin-owner-1"
OTHER_USER_ID = "twin-owner-2"

TEST_PLOT_ID = UUID("11111111-1111-1111-1111-111111111111")
OTHER_PLOT_ID = UUID("22222222-2222-2222-2222-222222222222")
UNKNOWN_PLOT_ID = UUID("33333333-3333-3333-3333-333333333333")


class FakePlotGeometryRepository:
    def __init__(self):
        self.plots = {
            str(TEST_PLOT_ID): PlotGeometry(
                plot_id=str(TEST_PLOT_ID),
                owner_id=TEST_USER_ID,
                boundary={"type": "Polygon", "coordinates": [[[78.49, 17.39], [78.50, 17.39], [78.50, 17.40], [78.49, 17.40], [78.49, 17.39]]]},
                latitude=17.395,
                longitude=78.495,
            ),
            str(OTHER_PLOT_ID): PlotGeometry(
                plot_id=str(OTHER_PLOT_ID),
                owner_id=OTHER_USER_ID,
                boundary={"type": "Polygon", "coordinates": [[[78.49, 17.39], [78.50, 17.39], [78.50, 17.40], [78.49, 17.40], [78.49, 17.39]]]},
                latitude=17.395,
                longitude=78.495,
            ),
        }

    def get_geometry(self, plot_id: str) -> PlotGeometry:
        plot = self.plots.get(plot_id)
        if plot is None:
            raise PlotNotFound(f"Plot '{plot_id}' was not found.")
        return plot


class FakeTwinPredictionService:
    def predict_for_plot(self, plot_id: UUID) -> PredictionOutput:
        return PredictionOutput(
            plot_id=plot_id,
            target_date=datetime(2026, 9, 2, 12, 0, 0),
            predicted_ndvi=0.82,
            trend_direction="up",
            is_projection=True,
        )


@pytest.fixture
def client():
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(user_id=TEST_USER_ID)
    app.dependency_overrides[get_plot_geometry_repository] = lambda: FakePlotGeometryRepository()
    app.dependency_overrides[get_twin_prediction_service] = lambda: FakeTwinPredictionService()

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def test_twin_prediction_success(client):
    response = client.get(f"/api/plots/{TEST_PLOT_ID}/twin/prediction")
    assert response.status_code == 200
    data = response.json()
    assert data["plot_id"] == str(TEST_PLOT_ID)
    assert data["predicted_ndvi"] == 0.82
    assert data["trend_direction"] == "up"
    assert data["is_projection"] is True


def test_twin_prediction_404_for_unknown_plot(client):
    response = client.get(f"/api/plots/{UNKNOWN_PLOT_ID}/twin/prediction")
    assert response.status_code == 404


def test_twin_prediction_404_for_other_users_plot(client):
    response = client.get(f"/api/plots/{OTHER_PLOT_ID}/twin/prediction")
    assert response.status_code == 404


def test_twin_prediction_requires_auth():
    with TestClient(app) as unauth_client:
        response = unauth_client.get(f"/api/plots/{TEST_PLOT_ID}/twin/prediction")
    assert response.status_code == 401
    app.dependency_overrides.clear()
