"""
Cross-account isolation (IDOR) and token-validation tests.

Plot / soil-report / recommendation identifiers are substituted with ones that
belong to a different user. Every attempt must look exactly like "not found".
"""
from __future__ import annotations

import time

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from jose import jwt

from app.config import Settings
from app.dependencies import AuthenticatedUser, get_current_user
from app.main import app
from app.repositories.plot_repository import get_plot_repository
from app.repositories.recommendation_repository import get_recommendation_repository
from app.repositories.soil_report_repository import get_soil_report_repository
from tests.conftest import (
    FakePlotRepository,
    FakeRecommendationRepository,
    FakeSoilReportRepository,
)
from tests.fixtures.sample_data import (
    deficient_oil_palm_plot,
    deficient_oil_palm_soil,
    healthy_rice_plot,
    healthy_rice_soil,
)

ALICE = "test-owner-1"  # owns test-plot-1 / test-soil-1
BOB = "test-owner-2"  # owns test-plot-2 / test-soil-2
PRICE = 25000.0


class _TwoUserPlots(FakePlotRepository):
    def __init__(self):
        super().__init__()
        self.plots[healthy_rice_plot().plot_id] = healthy_rice_plot()


class _TwoUserSoil(FakeSoilReportRepository):
    def __init__(self):
        super().__init__()
        self.reports[healthy_rice_soil().soil_report_id] = healthy_rice_soil()


@pytest.fixture
def as_user():
    repo = FakeRecommendationRepository()

    def _login(user_id: str) -> TestClient:
        app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(user_id=user_id)
        app.dependency_overrides[get_plot_repository] = lambda: _TwoUserPlots()
        app.dependency_overrides[get_soil_report_repository] = lambda: _TwoUserSoil()
        app.dependency_overrides[get_recommendation_repository] = lambda: repo
        return TestClient(app)

    yield _login
    app.dependency_overrides.clear()


def _create(client, plot_id, soil_id):
    return client.post(
        "/api/recommendations",
        json={
            "plot_id": plot_id,
            "soil_report_id": soil_id,
            "crop_price_per_ton_inr": PRICE,
        },
    )


def test_cannot_create_recommendation_for_another_users_plot(as_user):
    bob = as_user(BOB)
    response = _create(
        bob, deficient_oil_palm_plot().plot_id, deficient_oil_palm_soil().soil_report_id
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Plot not found."


def test_cannot_pair_own_plot_with_another_users_soil_report(as_user):
    bob = as_user(BOB)
    response = _create(
        bob, healthy_rice_plot().plot_id, deficient_oil_palm_soil().soil_report_id
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Soil report not found."


def test_cannot_pair_soil_report_with_a_different_plot_of_same_owner(as_user):
    """Report belongs to plot 2; using it against plot 1 must fail."""
    alice = as_user(ALICE)
    app.dependency_overrides[get_plot_repository] = lambda: _TwoUserPlots()
    # make plot-2 Alice's so only the plot/report mismatch is under test
    plots = _TwoUserPlots()
    plots.plots["test-plot-2"] = plots.plots["test-plot-2"].model_copy(update={"owner_id": ALICE})
    soil = _TwoUserSoil()
    soil.reports["test-soil-2"] = soil.reports["test-soil-2"].model_copy(update={"owner_id": ALICE})
    app.dependency_overrides[get_plot_repository] = lambda: plots
    app.dependency_overrides[get_soil_report_repository] = lambda: soil

    response = _create(alice, "test-plot-1", "test-soil-2")
    assert response.status_code == 404


def test_recommendation_is_invisible_to_other_users(as_user):
    alice = as_user(ALICE)
    created = _create(
        alice, deficient_oil_palm_plot().plot_id, deficient_oil_palm_soil().soil_report_id
    )
    assert created.status_code == 201
    rec_id = created.json()["recommendation_id"]

    assert alice.get(f"/api/recommendations/{rec_id}").status_code == 200

    bob = as_user(BOB)
    probe = bob.get(f"/api/recommendations/{rec_id}")
    missing = bob.get("/api/recommendations/does-not-exist")
    assert probe.status_code == 404
    # Identical body for "exists but not yours" and "does not exist".
    assert probe.json() == missing.json()
    assert bob.get("/api/recommendations").json() == []


def test_upload_to_another_users_plot_is_refused_and_nothing_is_saved(as_user):
    from app.repositories.soil_report_repository import get_soil_report_writer
    from tests.conftest import FakeSoilReportWriter
    from tests.fixtures.soil_report_files import text_layer_pdf_bytes

    writer = FakeSoilReportWriter()
    bob = as_user(BOB)
    app.dependency_overrides[get_soil_report_writer] = lambda: writer
    response = bob.post(
        "/api/soil-reports/upload",
        data={"plot_id": deficient_oil_palm_plot().plot_id},
        files={"file": ("r.pdf", text_layer_pdf_bytes(), "application/pdf")},
    )
    assert response.status_code == 404
    assert writer.rows == {}


# ------------------------------------------------------------------ tokens

SECRET = "test-jwt-secret"


def _settings() -> Settings:
    return Settings(supabase_jwt_secret=SECRET)


def _token(**claims) -> str:
    payload = {"sub": "user-1", "aud": "authenticated", **claims}
    return jwt.encode(payload, SECRET, algorithm="HS256")


def test_expired_token_is_rejected():
    token = _token(exp=int(time.time()) - 60)
    with pytest.raises(HTTPException) as exc:
        get_current_user(authorization=f"Bearer {token}", settings=_settings())
    assert exc.value.status_code == 401


def test_token_for_wrong_audience_is_rejected():
    token = _token(aud="some-other-service")
    with pytest.raises(HTTPException) as exc:
        get_current_user(authorization=f"Bearer {token}", settings=_settings())
    assert exc.value.status_code == 401


def test_unsigned_alg_none_token_is_rejected():
    import base64
    import json

    def b64(obj):
        return base64.urlsafe_b64encode(json.dumps(obj).encode()).rstrip(b"=").decode()

    forged = f"{b64({'alg': 'none', 'typ': 'JWT'})}.{b64({'sub': 'victim', 'aud': 'authenticated'})}."
    with pytest.raises(HTTPException) as exc:
        get_current_user(authorization=f"Bearer {forged}", settings=_settings())
    assert exc.value.status_code == 401


def test_hs256_token_is_refused_when_no_secret_is_configured():
    with pytest.raises(HTTPException) as exc:
        get_current_user(
            authorization=f"Bearer {_token()}", settings=Settings(supabase_jwt_secret="")
        )
    assert exc.value.status_code in (401, 500)


def test_client_supplied_owner_id_is_ignored(as_user):
    """owner_id in the request body must never override the token identity."""
    bob = as_user(BOB)
    response = bob.post(
        "/api/recommendations",
        json={
            "plot_id": deficient_oil_palm_plot().plot_id,
            "soil_report_id": deficient_oil_palm_soil().soil_report_id,
            "crop_price_per_ton_inr": PRICE,
            "owner_id": ALICE,
        },
    )
    assert response.status_code == 404
