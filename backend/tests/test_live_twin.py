"""
Tests for GET /api/plots/{plot_id}/twin/live and the services behind it.

Covers ownership (IDOR), the unavailable state, and the rule that missing
weather data is never replaced with invented numbers.
"""
from __future__ import annotations

from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.dependencies import AuthenticatedUser, get_current_user
from app.main import app
from app.repositories.plot_geometry_repository import get_plot_geometry_repository
from app.services import live_twin_service
from app.services.live_twin_service import (
    LiveTwinService,
    get_live_twin_service_dependency,
)
from app.services.twin_prediction_service import TwinPredictionService
from tests.test_api_digital_twins import (
    OTHER_PLOT_ID,
    OTHER_USER_ID,
    TEST_PLOT_ID,
    TEST_USER_ID,
    UNKNOWN_PLOT_ID,
    FakePlotGeometryRepository,
)


class _Result:
    def __init__(self, data):
        self.data = data


class _Query:
    """Minimal chainable stand-in for a supabase-py query builder."""

    def __init__(self, table, rows, log):
        self.table, self.rows, self.log = table, rows, log

    def __getattr__(self, name):
        def chain(*args, **kwargs):
            self.log.append((self.table, name, args))
            return self

        return chain

    @property
    def not_(self):
        return self

    def execute(self):
        return _Result(self.rows.get(self.table))


class FakeSupabase:
    def __init__(self, rows):
        self.rows = rows
        self.log: list[tuple] = []

    def table(self, name):
        return _Query(name, self.rows, self.log)


def _weather(**current_overrides):
    current = {
        "temperature_c": 31.0,
        "apparent_temp_c": 34.0,
        "humidity_pct": 80.0,
        "rainfall_mm": 0.0,
        "wind_kph": 6.0,
        "uv_index": 7.0,
        "cloud_cover_pct": 40.0,
    }
    current.update(current_overrides)
    return {
        "current": current,
        "daily_7d": [{"date": "2026-09-01", "rainfall_mm": 12.0}],
        "fetched_at": "2026-09-02T10:00:00Z",
    }


def _service(plot_row, twin_rows=None):
    return LiveTwinService(
        FakeSupabase({"plots": plot_row, "digital_twins": twin_rows or []})
    )


PLOT_ROW = {
    "id": str(TEST_PLOT_ID),
    "name": "Plot A",
    "latitude": 17.395,
    "longitude": 78.495,
    "stage": "Fruit Dev",
    "crop": "Oil Palm",
}


@pytest.fixture
def client():
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(user_id=TEST_USER_ID)
    app.dependency_overrides[get_plot_geometry_repository] = lambda: FakePlotGeometryRepository()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _use_service(service):
    app.dependency_overrides[get_live_twin_service_dependency] = lambda: service


# ---------------------------------------------------------------- endpoint


def test_live_twin_success_uses_plot_coordinates(client, monkeypatch):
    seen = {}

    def fake_fetch(lat, lon):
        seen["coords"] = (lat, lon)
        return _weather()

    monkeypatch.setattr(live_twin_service, "fetch_live_weather", fake_fetch)
    _use_service(_service(PLOT_ROW))

    response = client.get(f"/api/plots/{TEST_PLOT_ID}/twin/live")

    assert response.status_code == 200
    body = response.json()
    assert body["plot_id"] == str(TEST_PLOT_ID)
    # Weather is requested for THIS plot's stored coordinates, nothing else.
    assert seen["coords"] == (17.395, 78.495)
    assert body["live_weather"]["temperature_c"] == 31.0


def test_live_twin_other_users_plot_is_404(client):
    _use_service(_service(PLOT_ROW))
    response = client.get(f"/api/plots/{OTHER_PLOT_ID}/twin/live")
    assert response.status_code == 404
    assert response.json()["detail"] == "Plot not found."


def test_live_twin_unknown_plot_is_404_with_same_message(client):
    _use_service(_service(PLOT_ROW))
    response = client.get(f"/api/plots/{UNKNOWN_PLOT_ID}/twin/live")
    assert response.status_code == 404
    assert response.json()["detail"] == "Plot not found."


def test_live_twin_rejects_non_uuid_plot_id(client):
    _use_service(_service(PLOT_ROW))
    response = client.get("/api/plots/not-a-uuid/twin/live")
    assert response.status_code == 422


def test_live_twin_requires_authentication():
    app.dependency_overrides.clear()
    with TestClient(app) as anon:
        response = anon.get(f"/api/plots/{TEST_PLOT_ID}/twin/live")
    assert response.status_code == 401


def test_live_twin_503_when_weather_provider_fails(client, monkeypatch):
    monkeypatch.setattr(live_twin_service, "fetch_live_weather", lambda lat, lon: None)
    _use_service(_service(PLOT_ROW))
    response = client.get(f"/api/plots/{TEST_PLOT_ID}/twin/live")
    assert response.status_code == 503


# ---------------------------------------------------------------- service


@pytest.mark.parametrize("missing", ["temperature_c", "humidity_pct", "wind_kph"])
def test_missing_weather_field_is_unavailable_not_defaulted(monkeypatch, missing):
    monkeypatch.setattr(
        live_twin_service, "fetch_live_weather", lambda lat, lon: _weather(**{missing: None})
    )
    assert _service(PLOT_ROW).compute_live_state(str(TEST_PLOT_ID)) is None


def test_zero_valued_weather_is_kept_as_real_data(monkeypatch):
    monkeypatch.setattr(
        live_twin_service,
        "fetch_live_weather",
        lambda lat, lon: _weather(wind_kph=0.0),
    )
    state = _service(PLOT_ROW).compute_live_state(str(TEST_PLOT_ID))
    assert state is not None
    assert state["live_weather"]["wind_kph"] == 0.0


def test_plot_without_coordinates_is_unavailable(monkeypatch):
    called = []
    monkeypatch.setattr(
        live_twin_service, "fetch_live_weather", lambda lat, lon: called.append(1) or _weather()
    )
    row = {**PLOT_ROW, "latitude": None, "longitude": None}
    assert _service(row).compute_live_state(str(TEST_PLOT_ID)) is None
    assert called == []


def test_prediction_query_excludes_synthetic_rows():
    fake = FakeSupabase({"digital_twins": []})
    service = TwinPredictionService.__new__(TwinPredictionService)
    service.client = fake
    import pytz

    service.ist_tz = pytz.timezone("Asia/Kolkata")

    result = service.predict_for_plot(UUID(str(TEST_PLOT_ID)))

    assert result.trend_direction == "insufficient_data"
    assert result.predicted_ndvi is None
    filters = [args for table, name, args in fake.log if name == "or_"]
    assert filters and "is_synthetic.eq.false" in filters[0][0]


def test_other_user_constant_is_distinct():
    # Guard against a fixture edit silently weakening the IDOR tests above.
    assert OTHER_USER_ID != TEST_USER_ID


def test_yield_is_only_estimated_for_oil_palm(monkeypatch):
    monkeypatch.setattr(live_twin_service, "fetch_live_weather", lambda lat, lon: _weather())

    palm = _service(PLOT_ROW).compute_live_state(str(TEST_PLOT_ID))
    assert palm["scores"]["yield_estimate_t_ha"] is not None
    assert palm["model_note"] is None

    rice = _service({**PLOT_ROW, "crop": "Rice"}).compute_live_state(str(TEST_PLOT_ID))
    assert rice["scores"]["yield_estimate_t_ha"] is None  # no oil-palm yield invented for rice
    assert rice["yield_risk"] == "Not estimated for this crop"
    assert "oil palm" in rice["model_note"].lower()


def test_live_response_schema_accepts_missing_yield(client, monkeypatch):
    monkeypatch.setattr(live_twin_service, "fetch_live_weather", lambda lat, lon: _weather())
    _use_service(_service({**PLOT_ROW, "crop": "Coconut"}))
    response = client.get(f"/api/plots/{TEST_PLOT_ID}/twin/live")
    assert response.status_code == 200
    assert response.json()["scores"]["yield_estimate_t_ha"] is None
