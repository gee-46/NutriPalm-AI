"""Boundary validation before external NDVI calls, and deployment config guards."""
from __future__ import annotations

import pytest

from app.config import Settings
from app.exceptions import GeospatialServiceUnavailable
from app.services import sentinel_service
from app.services.sentinel_service import validate_polygon

SQUARE = {
    "type": "Polygon",
    "coordinates": [[[78.49, 17.39], [78.50, 17.39], [78.50, 17.40], [78.49, 17.40], [78.49, 17.39]]],
}


def test_valid_closed_polygon_passes():
    validate_polygon(SQUARE)


@pytest.mark.parametrize(
    "geometry",
    [
        None,
        {},
        {"type": "Point", "coordinates": [78.49, 17.39]},
        {"type": "Polygon", "coordinates": []},
        {"type": "Polygon", "coordinates": [[[78.49, 17.39], [78.50, 17.39], [78.49, 17.39]]]},  # too few points
        # not closed
        {"type": "Polygon", "coordinates": [[[78.49, 17.39], [78.50, 17.39], [78.50, 17.40], [78.49, 17.40]]]},
        # latitude out of range
        {"type": "Polygon", "coordinates": [[[78.49, 95.0], [78.50, 95.0], [78.50, 96.0], [78.49, 96.0], [78.49, 95.0]]]},
        # lng/lat swapped beyond range (lat 78 is valid, lng 17 valid) -> still valid; use NaN instead
        {"type": "Polygon", "coordinates": [[[float("nan"), 17.39], [78.50, 17.39], [78.50, 17.40], [78.49, 17.40], [float("nan"), 17.39]]]},
        # degenerate: collinear
        {"type": "Polygon", "coordinates": [[[78.0, 17.0], [78.1, 17.0], [78.2, 17.0], [78.3, 17.0], [78.0, 17.0]]]},
        # absurdly large
        {"type": "Polygon", "coordinates": [[[70.0, 10.0], [80.0, 10.0], [80.0, 20.0], [70.0, 20.0], [70.0, 10.0]]]},
        # non-numeric
        {"type": "Polygon", "coordinates": [[["a", 17.39], [78.50, 17.39], [78.50, 17.40], [78.49, 17.40], ["a", 17.39]]]},
    ],
)
def test_invalid_geometry_is_rejected(geometry):
    with pytest.raises(GeospatialServiceUnavailable):
        validate_polygon(geometry)


def test_ndvi_never_calls_network_for_invalid_geometry(monkeypatch):
    def boom(*a, **k):  # pragma: no cover - must not run
        raise AssertionError("network must not be reached")

    monkeypatch.setattr(sentinel_service.httpx, "post", boom)
    settings = Settings(sentinel_hub_client_id="id", sentinel_hub_client_secret="secret")
    with pytest.raises(GeospatialServiceUnavailable):
        sentinel_service.get_ndvi_for_geometry({"type": "Polygon", "coordinates": [[[0, 0]]]}, settings=settings)


def test_wildcard_cors_rejected_in_production():
    with pytest.raises(ValueError):
        Settings(environment="production", cors_allow_origins="*")
    with pytest.raises(ValueError):
        Settings(environment="staging", cors_allow_origins="https://a.example, *")


def test_wildcard_cors_allowed_only_in_development():
    assert Settings(environment="development", cors_allow_origins="*").cors_origins_list() == ["*"]


def test_production_requires_strict_mode():
    with pytest.raises(ValueError):
        Settings(environment="production", strict_no_mock_data=False, cors_allow_origins="https://a.example")
