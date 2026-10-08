"""
Application-level ownership with REAL signed Supabase-style JWTs.

Unlike the other API tests, `get_current_user` is NOT overridden: every request
goes through the real bearer-token verification. User A's token is replayed
against User B's resources, and invalid tokens are tried against every route.
"""
from __future__ import annotations

import time
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from jose import jwt

from app.config import Settings, get_settings
from app.main import app
from app.repositories.plot_geometry_repository import get_plot_geometry_repository
from app.repositories.plot_repository import get_plot_repository
from app.repositories.recommendation_repository import get_recommendation_repository
from app.repositories.soil_report_repository import (
    get_soil_report_repository,
    get_soil_report_writer,
)
from app.services import sentinel_service
from app.services.live_twin_service import get_live_twin_service_dependency
from app.services.twin_prediction_service import get_twin_prediction_service
from app.schemas.inputs import PlotInput, SoilTestInput
from tests.conftest import (
    FakePlotRepository,
    FakeRecommendationRepository,
    FakeSoilReportRepository,
    FakeSoilReportWriter,
)
from tests.fixtures.soil_report_files import text_layer_pdf_bytes
from tests.test_api_digital_twins import FakePlotGeometryRepository, FakeTwinPredictionService
from tests.test_live_twin import FakeSupabase

SECRET = "unit-test-signing-secret"

A_ID, B_ID = "twin-owner-1", "twin-owner-2"  # owners baked into FakePlotGeometryRepository
A_PLOT = UUID("11111111-1111-1111-1111-111111111111")
B_PLOT = UUID("22222222-2222-2222-2222-222222222222")


def token(sub: str, **overrides) -> str:
    claims = {"sub": sub, "aud": "authenticated", "exp": int(time.time()) + 600, **overrides}
    return jwt.encode(claims, SECRET, algorithm="HS256")


def bearer(t: str) -> dict:
    return {"Authorization": f"Bearer {t}"}


class _Plots(FakePlotRepository):
    def __init__(self):
        super().__init__()
        self.plots = {
            "plot-a": PlotInput(plot_id="plot-a", owner_id=A_ID, crop="oil_palm", area=2, area_unit="hectare"),
            "plot-b": PlotInput(plot_id="plot-b", owner_id=B_ID, crop="oil_palm", area=2, area_unit="hectare"),
        }


class _Soil(FakeSoilReportRepository):
    def __init__(self):
        super().__init__()
        mk = lambda sid, pid, oid: SoilTestInput(
            soil_report_id=sid, plot_id=pid, owner_id=oid, nitrogen_kg_ha=140, phosphorus_kg_ha=20,
            potassium_kg_ha=300, organic_carbon_percent=0.9, ph=5.5,
        )
        self.reports = {"soil-a": mk("soil-a", "plot-a", A_ID), "soil-b": mk("soil-b", "plot-b", B_ID)}


class _LiveService:
    def compute_live_state(self, plot_id):  # only reached for the owner
        return None


@pytest.fixture
def api(monkeypatch):
    rec_repo = FakeRecommendationRepository()
    writer = FakeSoilReportWriter()
    app.dependency_overrides[get_settings] = lambda: Settings(supabase_jwt_secret=SECRET)
    app.dependency_overrides[get_plot_geometry_repository] = lambda: FakePlotGeometryRepository()
    app.dependency_overrides[get_plot_repository] = lambda: _Plots()
    app.dependency_overrides[get_soil_report_repository] = lambda: _Soil()
    app.dependency_overrides[get_soil_report_writer] = lambda: writer
    app.dependency_overrides[get_recommendation_repository] = lambda: rec_repo
    app.dependency_overrides[get_twin_prediction_service] = lambda: FakeTwinPredictionService()
    app.dependency_overrides[get_live_twin_service_dependency] = lambda: _LiveService()

    class Ctx:
        client = TestClient(app)
        recs = rec_repo
        soil_writer = writer

    # a recommendation owned by B (the target) and one owned by A
    from app.services import recommendation_service

    for owner, plot, soil in ((A_ID, "plot-a", "soil-a"), (B_ID, "plot-b", "soil-b")):
        result = recommendation_service.build_recommendation(
            _Plots().get_plot(plot), _Soil().get_soil_report(soil), crop_price_per_ton_inr=10000.0
        )
        row = rec_repo.save(result)
        setattr(Ctx, f"rec_{'a' if owner == A_ID else 'b'}", row["id"])
    yield Ctx
    app.dependency_overrides.clear()


# ----------------------------------------------------------- cross-account
def test_user_a_token_cannot_reach_user_b_resources(api):
    c, h = api.client, bearer(token(A_ID))
    attempts = {
        "twin live": c.get(f"/api/plots/{B_PLOT}/twin/live", headers=h),
        "twin prediction": c.get(f"/api/plots/{B_PLOT}/twin/prediction", headers=h),
        "ndvi": c.get(f"/api/geospatial/ndvi/{B_PLOT}", headers=h),
        "bhunaksha": c.get(f"/api/geospatial/bhunaksha/{B_PLOT}", headers=h),
        "recommendation by id": c.get(f"/api/recommendations/{api.rec_b}", headers=h),
        "create recommendation on B's plot": c.post(
            "/api/recommendations",
            json={"plot_id": "plot-b", "soil_report_id": "soil-b", "crop_price_per_ton_inr": 1000},
            headers=h,
        ),
        "create recommendation, A's plot + B's report": c.post(
            "/api/recommendations",
            json={"plot_id": "plot-a", "soil_report_id": "soil-b", "crop_price_per_ton_inr": 1000},
            headers=h,
        ),
        "soil upload to B's plot": c.post(
            "/api/soil-reports/upload",
            data={"plot_id": "plot-b"},
            files={"file": ("r.pdf", text_layer_pdf_bytes(), "application/pdf")},
            headers=h,
        ),
    }
    for name, resp in attempts.items():
        assert resp.status_code == 404, f"{name}: expected 404, got {resp.status_code} {resp.text[:120]}"
        # the denial must not echo anything about the other user's data
        for secret in (B_ID, "soil-b", api.rec_b):
            assert secret not in resp.text, f"{name}: response leaks {secret}"
    assert api.soil_writer.rows == {}, "nothing may be saved for a rejected upload"


def test_denial_is_indistinguishable_from_not_found(api):
    c, h = api.client, bearer(token(A_ID))
    other = c.get(f"/api/plots/{B_PLOT}/twin/prediction", headers=h)
    missing = c.get("/api/plots/33333333-3333-3333-3333-333333333333/twin/prediction", headers=h)
    assert other.status_code == missing.status_code == 404
    assert other.json() == missing.json()
    other_rec = c.get(f"/api/recommendations/{api.rec_b}", headers=h)
    missing_rec = c.get("/api/recommendations/does-not-exist", headers=h)
    assert other_rec.json() == missing_rec.json()


def test_recommendation_list_contains_only_the_callers_rows(api):
    rows = api.client.get("/api/recommendations", headers=bearer(token(A_ID))).json()
    assert [r["id"] for r in rows] == [api.rec_a]
    rows_b = api.client.get("/api/recommendations", headers=bearer(token(B_ID))).json()
    assert [r["id"] for r in rows_b] == [api.rec_b]


def test_owner_can_access_own_resources(api):
    c = api.client
    ha, hb = bearer(token(A_ID)), bearer(token(B_ID))
    assert c.get(f"/api/plots/{A_PLOT}/twin/prediction", headers=ha).status_code == 200
    assert c.get(f"/api/plots/{B_PLOT}/twin/prediction", headers=hb).status_code == 200
    assert c.get(f"/api/recommendations/{api.rec_a}", headers=ha).status_code == 200
    # unconfigured Sentinel is a normal "unavailable" answer, not an error
    r = c.get(f"/api/geospatial/ndvi/{A_PLOT}", headers=ha)
    assert r.status_code == 200 and r.json()["available"] is False


def test_client_supplied_owner_fields_are_ignored(api):
    resp = api.client.post(
        "/api/recommendations",
        json={"plot_id": "plot-b", "soil_report_id": "soil-b", "crop_price_per_ton_inr": 1000,
              "owner_id": A_ID, "user_id": A_ID},
        headers=bearer(token(A_ID)),
    )
    assert resp.status_code == 404  # still B's plot -> denied despite claiming A as owner
    # the saved owner of a legitimate request is always the token subject
    ok = api.client.post(
        "/api/recommendations",
        json={"plot_id": "plot-a", "soil_report_id": "soil-a", "crop_price_per_ton_inr": 1000, "owner_id": B_ID},
        headers=bearer(token(A_ID)),
    )
    assert ok.status_code == 201
    saved = api.recs.get_for_owner(ok.json()["recommendation_id"], A_ID)
    assert saved["owner_id"] == A_ID


# ------------------------------------------------------------ bad tokens
ROUTES = [
    ("GET", f"/api/plots/{A_PLOT}/twin/live"),
    ("GET", f"/api/plots/{A_PLOT}/twin/prediction"),
    ("GET", f"/api/geospatial/ndvi/{A_PLOT}"),
    ("GET", f"/api/geospatial/bhunaksha/{A_PLOT}"),
    ("GET", "/api/recommendations"),
    ("GET", "/api/recommendations/anything"),
    ("POST", "/api/recommendations"),
    ("POST", "/api/soil-reports/upload"),
]


def _bad_tokens():
    now = int(time.time())
    return {
        "missing header": None,
        "empty bearer": "Bearer ",
        "garbage": "Bearer not.a.jwt",
        "expired": f"Bearer {token(A_ID, exp=now - 60)}",
        "wrong signature": "Bearer " + jwt.encode({"sub": A_ID, "aud": "authenticated", "exp": now + 600}, "other-secret", algorithm="HS256"),
        "wrong audience": f"Bearer {token(A_ID, aud='anon')}",
        "no subject": "Bearer " + jwt.encode({"aud": "authenticated", "exp": now + 600}, SECRET, algorithm="HS256"),
        "basic scheme": "Basic dXNlcjpwYXNz",
    }


@pytest.mark.parametrize("method,path", ROUTES)
def test_every_route_rejects_invalid_tokens(api, method, path):
    for label, header in _bad_tokens().items():
        headers = {} if header is None else {"Authorization": header}
        resp = api.client.request(method, path, headers=headers)
        assert resp.status_code == 401, f"{method} {path} with {label}: got {resp.status_code}"


def test_public_health_route_needs_no_token(api):
    assert api.client.get("/health").status_code == 200


def test_user_id_comes_only_from_the_verified_token(api):
    # A forged-but-unsigned identity header/query must have no effect.
    r = api.client.get(f"/api/plots/{B_PLOT}/twin/prediction?user_id={B_ID}&owner_id={B_ID}",
                       headers={**bearer(token(A_ID)), "X-User-Id": B_ID})
    assert r.status_code == 404


def test_every_api_route_is_covered_by_the_auth_matrix():
    """Adding an /api route without adding it to ROUTES (and so to the 401 checks) fails here."""
    import re

    registered = {
        (method.upper(), path)
        for path, ops in app.openapi()["paths"].items()
        if path.startswith("/api")
        for method in ops
    }
    covered = set()
    for method, path in ROUTES:
        template = re.sub(r"/api/plots/[0-9a-f-]{36}/", "/api/plots/{plot_id}/", path)
        template = re.sub(r"/(ndvi|bhunaksha)/[0-9a-f-]{36}$", lambda m: f"/{m.group(1)}/{{plot_id}}", template)
        template = template.replace("/api/recommendations/anything", "/api/recommendations/{recommendation_id}")
        covered.add((method, template))
    assert registered == covered, f"uncovered: {registered - covered}; stale: {covered - registered}"
