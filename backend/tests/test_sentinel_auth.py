"""Sentinel Hub token handling: documented endpoint, actionable-but-safe error reasons, no secret leakage."""
import httpx
import pytest

from app.config import Settings
from app.exceptions import GeospatialServiceUnavailable
from app.services import sentinel_service as ss

CLIENT_ID = "11111111-2222-3333-4444-555555555555"
CLIENT_SECRET = "s3cr3t-value-that-must-never-leak"


@pytest.fixture(autouse=True)
def _fresh_cache():
    ss._TOKEN_CACHE.update(token=None, expires_at=0.0)
    yield
    ss._TOKEN_CACHE.update(token=None, expires_at=0.0)


def settings(**kw):
    return Settings(_env_file=None, sentinel_hub_client_id=kw.pop("cid", f" {CLIENT_ID} "), sentinel_hub_client_secret=kw.pop("sec", CLIENT_SECRET), **kw)


def fake_post(status, body=None, calls=None):
    def post(url, data=None, timeout=None):
        if calls is not None:
            calls.append((url, dict(data)))
        return httpx.Response(status, json=body if body is not None else {}, request=httpx.Request("POST", url))

    return post


def test_uses_the_documented_token_endpoint_and_trims_whitespace(monkeypatch):
    calls = []
    monkeypatch.setattr(httpx, "post", fake_post(200, {"access_token": "tok", "expires_in": 3600}, calls))
    assert ss._get_access_token(settings()) == "tok"
    url, data = calls[0]
    assert url == "https://services.sentinel-hub.com/auth/realms/main/protocol/openid-connect/token"
    assert data == {"grant_type": "client_credentials", "client_id": CLIENT_ID, "client_secret": CLIENT_SECRET}


def test_token_is_cached_until_shortly_before_expiry(monkeypatch):
    calls = []
    monkeypatch.setattr(httpx, "post", fake_post(200, {"access_token": "tok", "expires_in": 3600}, calls))
    ss._get_access_token(settings())
    ss._get_access_token(settings())
    assert len(calls) == 1


@pytest.mark.parametrize("code", ["unauthorized_client", "invalid_client"])
def test_rejected_credentials_give_an_actionable_reason_without_leaking_anything(monkeypatch, code):
    monkeypatch.setattr(httpx, "post", fake_post(401, {"error": code, "error_description": f"echo {CLIENT_SECRET}"}))
    with pytest.raises(GeospatialServiceUnavailable) as exc:
        ss._get_access_token(settings())
    msg = str(exc.value)
    assert "rejected the configured OAuth client credentials" in msg and "Create a new OAuth client" in msg
    assert code in msg and "HTTP 401" in msg
    assert CLIENT_SECRET not in msg and CLIENT_ID not in msg and "echo" not in msg


def test_other_http_failures_are_reported_by_status_only(monkeypatch):
    monkeypatch.setattr(httpx, "post", fake_post(503, {"message": CLIENT_SECRET}))
    with pytest.raises(GeospatialServiceUnavailable) as exc:
        ss._get_access_token(settings())
    assert "HTTP 503" in str(exc.value) and CLIENT_SECRET not in str(exc.value)


def test_network_failure_is_distinguished_from_rejected_credentials(monkeypatch):
    def boom(url, data=None, timeout=None):
        raise httpx.ConnectError("no route", request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx, "post", boom)
    with pytest.raises(GeospatialServiceUnavailable) as exc:
        ss._get_access_token(settings())
    assert "Could not reach Sentinel Hub" in str(exc.value) and "rejected" not in str(exc.value)


def test_a_200_without_a_token_is_not_treated_as_success(monkeypatch):
    monkeypatch.setattr(httpx, "post", fake_post(200, {"expires_in": 10}))
    with pytest.raises(GeospatialServiceUnavailable):
        ss._get_access_token(settings())


def test_unconfigured_ndvi_never_calls_the_provider(monkeypatch):
    def forbidden(*a, **k):
        raise AssertionError("no network call may happen without credentials")

    monkeypatch.setattr(httpx, "post", forbidden)
    st = Settings(_env_file=None, sentinel_hub_client_id="", sentinel_hub_client_secret="")
    ring = [[75, 13], [75.001, 13], [75.001, 13.001], [75, 13.001], [75, 13]]
    with pytest.raises(GeospatialServiceUnavailable) as exc:
        ss.get_ndvi_for_geometry({"type": "Polygon", "coordinates": [ring]}, settings=st)
    assert "not configured" in str(exc.value)
