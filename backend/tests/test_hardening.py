"""Startup validation, readiness, CORS and rate limiting."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import app
from tests.fixtures.soil_report_files import text_layer_pdf_bytes
from tests.test_api_soil_extractions import PLOT_ID


def test_production_refuses_to_start_without_core_configuration():
    with pytest.raises(ValueError) as exc:
        Settings(_env_file=None, environment="production", cors_allow_origins="https://app.example.test")
    msg = str(exc.value)
    assert "SUPABASE_URL" in msg and "SUPABASE_SERVICE_ROLE_KEY" in msg


def test_production_starts_with_core_configuration_and_no_optional_integrations():
    s = Settings(
        _env_file=None,
        environment="production",
        cors_allow_origins="https://app.example.test",
        supabase_url="https://x.supabase.co",
        supabase_service_role_key="k",
        supabase_jwt_secret="s",
    )
    assert s.sentinel_hub_client_id == ""  # optional integrations are not required


def test_development_does_not_require_configuration():
    Settings(_env_file=None, environment="development")


def test_liveness_is_always_ok(unauthenticated_client):
    assert unauthenticated_client.get("/health").json() == {"status": "ok"}


def test_readiness_reports_each_dependency_without_secrets(unauthenticated_client, monkeypatch):
    monkeypatch.setattr("app.main.get_settings", lambda: Settings(_env_file=None, supabase_url="", supabase_service_role_key="ssshhh"))
    r = unauthenticated_client.get("/health/ready")
    body = r.json()
    assert set(body["required"]) == {
        "database_configured", "token_verification_configured",
        "ocr_tesseract_available", "ocr_poppler_available",
    }
    assert body["required"]["database_configured"] is False
    assert r.status_code == 503 and body["status"] == "degraded"
    assert "ssshhh" not in r.text


def test_readiness_is_ready_when_everything_required_is_present(unauthenticated_client, monkeypatch):
    monkeypatch.setattr(
        "app.main.get_settings",
        lambda: Settings(_env_file=None, supabase_url="https://x.supabase.co", supabase_service_role_key="k"),
    )
    monkeypatch.setattr("app.ocr.engine._find_tesseract_cmd", lambda: "tesseract")
    monkeypatch.setattr("app.ocr.preprocess._find_poppler_path", lambda: "/poppler")
    r = unauthenticated_client.get("/health/ready")
    assert r.status_code == 200 and r.json()["status"] == "ready"


def test_cors_allows_only_the_configured_origin_and_needed_methods(unauthenticated_client):
    ok = unauthenticated_client.options(
        "/api/recommendations",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST",
                 "Access-Control-Request-Headers": "authorization,content-type"},
    )
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
    bad = unauthenticated_client.options(
        "/api/recommendations",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"},
    )
    assert "access-control-allow-origin" not in bad.headers
    delete = unauthenticated_client.options(
        "/api/recommendations",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "DELETE"},
    )
    assert delete.status_code == 400  # DELETE is not an allowed method


def test_heavy_endpoints_are_rate_limited_per_account(client):
    pdf = text_layer_pdf_bytes()
    codes = [
        client.post("/api/soil-reports/upload", data={"plot_id": PLOT_ID},
                    files={"file": ("r.pdf", pdf, "application/pdf")}).status_code
        for _ in range(22)
    ]
    assert codes[:20] == [200] * 20
    assert codes[20:] == [429, 429]
    again = client.post("/api/soil-reports/upload", data={"plot_id": PLOT_ID},
                        files={"file": ("r.pdf", pdf, "application/pdf")})
    assert again.status_code == 429 and int(again.headers["retry-after"]) >= 1


def test_rate_limit_is_per_account(client):
    from app.dependencies import AuthenticatedUser, get_current_user

    pdf = text_layer_pdf_bytes()
    for _ in range(21):
        client.post("/api/soil-reports/upload", data={"plot_id": PLOT_ID},
                    files={"file": ("r.pdf", pdf, "application/pdf")})
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(user_id="another-user")
    r = client.post("/api/soil-reports/upload", data={"plot_id": PLOT_ID},
                    files={"file": ("r.pdf", pdf, "application/pdf")})
    assert r.status_code == 404  # reaches the ownership check, i.e. not throttled


# ---------------------------------------------------------------- missing migrations
@pytest.mark.parametrize("code", ["42P01", "PGRST205"])
def test_a_missing_table_is_reported_as_not_configured_not_as_a_crash(code):
    """PostgREST says PGRST205 for a table it cannot see; both mean 'migration not applied'."""
    from postgrest.exceptions import APIError

    from app.exceptions import RepositoryNotConfigured
    from app.repositories.soil_extraction_repository import _translate

    with pytest.raises(RepositoryNotConfigured) as exc:
        _translate(APIError({"message": "missing", "code": code, "hint": None, "details": None}))
    assert "migration 013" in str(exc.value)


def test_upload_answers_503_when_extraction_storage_is_not_migrated(client, fake_extraction_repo):
    from app.exceptions import RepositoryNotConfigured

    def boom(*a, **k):
        raise RepositoryNotConfigured("Soil extraction storage is not configured: apply migration 013.")

    fake_extraction_repo.find_by_hash = boom
    r = client.post("/api/soil-reports/upload", data={"plot_id": PLOT_ID},
                    files={"file": ("r.pdf", text_layer_pdf_bytes(), "application/pdf")})
    assert r.status_code == 503 and "migration 013" in r.json()["detail"]
