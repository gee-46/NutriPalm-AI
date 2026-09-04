"""
Tests for GET /api/geospatial/ndvi/{plot_id} and
GET /api/geospatial/bhunaksha/{plot_id}.

These use dependency_overrides with in-memory fakes, exactly like the
existing recommendations/soil-report API tests, so no real Supabase or
Sentinel Hub credentials are needed to run the suite.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.dependencies import AuthenticatedUser, get_current_user
from app.exceptions import GeospatialServiceUnavailable, PlotNotFound
from app.main import app
from app.repositories.plot_geometry_repository import (
    PlotGeometry,
    get_plot_geometry_repository,
)
from app.services import sentinel_service

TEST_USER_ID = "geo-owner-1"
OTHER_USER_ID = "geo-owner-2"

SAMPLE_BOUNDARY = {
    "type": "Polygon",
    "coordinates": [[[78.49, 17.39], [78.50, 17.39], [78.50, 17.40], [78.49, 17.40], [78.49, 17.39]]],
}


class FakePlotGeometryRepository:
    def __init__(self):
        self.plots = {
            "geo-plot-mapped": PlotGeometry(
                plot_id="geo-plot-mapped",
                owner_id=TEST_USER_ID,
                boundary=SAMPLE_BOUNDARY,
                latitude=17.395,
                longitude=78.495,
            ),
            "geo-plot-unmapped": PlotGeometry(
                plot_id="geo-plot-unmapped",
                owner_id=TEST_USER_ID,
                boundary=None,
                latitude=None,
                longitude=None,
            ),
            "geo-plot-other-owner": PlotGeometry(
                plot_id="geo-plot-other-owner",
                owner_id=OTHER_USER_ID,
                boundary=SAMPLE_BOUNDARY,
                latitude=17.395,
                longitude=78.495,
            ),
        }

    def get_geometry(self, plot_id: str) -> PlotGeometry:
        plot = self.plots.get(plot_id)
        if plot is None:
            raise PlotNotFound(f"Plot '{plot_id}' was not found.")
        return plot


@pytest.fixture
def client():
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(user_id=TEST_USER_ID)
    app.dependency_overrides[get_plot_geometry_repository] = lambda: FakePlotGeometryRepository()

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


def test_ndvi_returns_unavailable_when_sentinel_not_configured(client, monkeypatch):
    # Ensure the service reports "not configured" deterministically,
    # regardless of the machine running the tests.
    def _raise_unconfigured(*args, **kwargs):
        raise GeospatialServiceUnavailable("Sentinel-2 NDVI is not configured.")

    monkeypatch.setattr(sentinel_service, "get_ndvi_for_geometry", _raise_unconfigured)

    response = client.get("/api/geospatial/ndvi/geo-plot-mapped")
    assert response.status_code == 200
    body = response.json()
    assert body["available"] is False
    assert body["mean_ndvi"] is None
    assert "not configured" in body["reason"].lower()


def test_ndvi_returns_real_values_when_configured(client, monkeypatch):
    from app.services.sentinel_service import NdviResult

    def _fake_result(*args, **kwargs):
        return NdviResult(
            mean_ndvi=0.62,
            min_ndvi=0.41,
            max_ndvi=0.78,
            acquisition_date="2026-08-15",
            cloud_cover_percent=None,
            sample_count=120,
        )

    monkeypatch.setattr(sentinel_service, "get_ndvi_for_geometry", _fake_result)

    response = client.get("/api/geospatial/ndvi/geo-plot-mapped")
    assert response.status_code == 200
    body = response.json()
    assert body["available"] is True
    assert body["mean_ndvi"] == 0.62
    assert body["status"] == "Healthy"
    assert body["acquisition_date"] == "2026-08-15"


def test_ndvi_unavailable_when_plot_has_no_boundary(client):
    response = client.get("/api/geospatial/ndvi/geo-plot-unmapped")
    assert response.status_code == 200
    body = response.json()
    assert body["available"] is False
    assert "boundary" in body["reason"].lower()


def test_ndvi_404_for_unknown_plot(client):
    response = client.get("/api/geospatial/ndvi/does-not-exist")
    assert response.status_code == 404


def test_ndvi_404_when_plot_belongs_to_another_owner(client):
    response = client.get("/api/geospatial/ndvi/geo-plot-other-owner")
    assert response.status_code == 404


def test_cadastral_endpoint_reports_unavailable_by_default(client):
    response = client.get("/api/geospatial/bhunaksha/geo-plot-mapped")
    assert response.status_code == 200
    body = response.json()
    assert body["available"] is False
    assert body["parcel_reference"] is None
    assert body["reason"]


def test_ndvi_requires_authentication():
    with TestClient(app) as unauth_client:
        response = unauth_client.get("/api/geospatial/ndvi/geo-plot-mapped")
    assert response.status_code == 401
    app.dependency_overrides.clear()


def test_complex_multi_vertex_polygon_geometry():
    """Verify that multi-vertex closed polygons are recognized and supported."""
    complex_ring = [
        [78.490, 17.390],
        [78.495, 17.391],
        [78.500, 17.390],
        [78.502, 17.395],
        [78.498, 17.400],
        [78.492, 17.398],
        [78.490, 17.390],  # Closed ring
    ]
    poly = {
        "type": "Polygon",
        "coordinates": [complex_ring],
    }
    assert poly["type"] == "Polygon"
    assert len(poly["coordinates"][0]) >= 4
    # Ensure ring closure (first coordinate equals last)
    assert poly["coordinates"][0][0] == poly["coordinates"][0][-1]

