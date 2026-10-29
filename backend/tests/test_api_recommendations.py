from tests.conftest import TEST_USER_ID
from tests.fixtures.sample_data import (
    deficient_oil_palm_plot,
    deficient_oil_palm_soil,
)


TEST_CROP_PRICE = 13500.0


def test_create_recommendation_success(client):
    payload = {
        "plot_id": deficient_oil_palm_plot().plot_id,
        "soil_report_id": deficient_oil_palm_soil().soil_report_id,
        "crop_price_per_ton_inr": TEST_CROP_PRICE,
    }

    response = client.post(
        "/api/recommendations",
        json=payload,
    )

    assert response.status_code == 201

    body = response.json()

    assert body["state"] == "generated"
    assert body["crop"] == "oil_palm"
    assert body["recommendation_id"] == "rec-1"
    assert len(body["fertilizer_plan"]) > 0
    assert "summary" in body["explanation"]
    # traceability: engine version, timestamp, inputs and the rule used
    assert body["engine_version"] and body["generated_at"]
    prov = body["provenance"]
    assert prov["soil_report_id"] == deficient_oil_palm_soil().soil_report_id
    assert prov["soil_verification_status"] == "user_confirmed"
    assert prov["soil_values_used"]["nitrogen_kg_ha"] == 140.0
    assert prov["rule"]["rule_version"] == "test-fixture"
    assert "Crop age and growth stage" in prov["not_considered"]
    # the economics baselines are unsourced, so they are withheld unless the rule covers them
    assert body["roi"] is None and body["yield_prediction"] is None
    assert body["explanation"]["expected_benefit"] is None
    assert all(d["estimated_cost_inr"] is None for d in body["fertilizer_plan"])


def test_economics_are_returned_only_when_the_rule_covers_them(client):
    from app.main import app
    from app.services.rule_provenance import get_rule_pack
    from tests.conftest import make_test_rule_pack

    app.dependency_overrides[get_rule_pack] = lambda: make_test_rule_pack(covers_yield_and_economics=True)
    response = client.post(
        "/api/recommendations",
        json={
            "plot_id": deficient_oil_palm_plot().plot_id,
            "soil_report_id": deficient_oil_palm_soil().soil_report_id,
            "crop_price_per_ton_inr": TEST_CROP_PRICE,
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["roi"]["crop_price_per_ton_inr"] == TEST_CROP_PRICE
    assert body["yield_prediction"] is not None


def test_cost_is_returned_only_for_products_the_caller_priced(client):
    response = client.post(
        "/api/recommendations",
        json={
            "plot_id": deficient_oil_palm_plot().plot_id,
            "soil_report_id": deficient_oil_palm_soil().soil_report_id,
            "fertilizer_price_overrides": {"urea": 7.0},
        },
    )
    assert response.status_code == 201
    costs = {d["product_code"]: d["estimated_cost_inr"] for d in response.json()["fertilizer_plan"]}
    assert costs["urea"] is not None and costs["urea"] > 0
    assert all(v is None for k, v in costs.items() if k != "urea")


def test_no_verified_rule_means_insufficient_data_not_a_dose(client):
    from app.main import app
    from app.services.rule_provenance import get_rule_pack

    app.dependency_overrides[get_rule_pack] = lambda: {}
    response = client.post(
        "/api/recommendations",
        json={
            "plot_id": deficient_oil_palm_plot().plot_id,
            "soil_report_id": deficient_oil_palm_soil().soil_report_id,
            "crop_price_per_ton_inr": TEST_CROP_PRICE,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["state"] == "insufficient_data"
    assert [r["code"] for r in body["reasons"]] == ["no_verified_rule"]
    assert body["required"]
    assert "fertilizer_plan" not in body and "roi" not in body
    # nothing is persisted for a non-recommendation
    assert client.get("/api/recommendations").json() == []


def test_shipped_rule_pack_is_empty_so_no_crop_gets_a_dose_by_default():
    from app.services.rule_provenance import load_pack

    assert load_pack() == {}


def test_unsupported_crop_is_insufficient_data(client):
    from app.main import app
    from tests.conftest import FakePlotRepository
    from app.repositories.plot_repository import get_plot_repository
    from app.schemas.inputs import PlotInput

    class Plots(FakePlotRepository):
        def __init__(self):
            super().__init__()
            self.plots["test-plot-1"] = PlotInput(
                plot_id="test-plot-1", owner_id="test-owner-1", crop="Cocoa", area=2, area_unit="hectare"
            )

    app.dependency_overrides[get_plot_repository] = lambda: Plots()
    response = client.post(
        "/api/recommendations",
        json={"plot_id": "test-plot-1", "soil_report_id": deficient_oil_palm_soil().soil_report_id},
    )
    assert response.status_code == 200
    assert response.json()["reasons"][0]["code"] == "unsupported_crop"


def test_soil_report_without_verification_is_refused(client):
    from app.main import app
    from app.repositories.soil_report_repository import get_soil_report_repository
    from tests.conftest import FakeSoilReportRepository

    class Unverified(FakeSoilReportRepository):
        def __init__(self):
            super().__init__()
            self.reports["test-soil-1"] = deficient_oil_palm_soil().model_copy(
                update={"verification_status": None}
            )

    app.dependency_overrides[get_soil_report_repository] = lambda: Unverified()
    response = client.post(
        "/api/recommendations",
        json={
            "plot_id": deficient_oil_palm_plot().plot_id,
            "soil_report_id": "test-soil-1",
            "crop_price_per_ton_inr": TEST_CROP_PRICE,
        },
    )
    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "soil_report_not_verified"


def test_create_recommendation_missing_plot_returns_404(client):
    payload = {
        "plot_id": "does-not-exist",
        "soil_report_id": deficient_oil_palm_soil().soil_report_id,
        "crop_price_per_ton_inr": TEST_CROP_PRICE,
    }

    response = client.post(
        "/api/recommendations",
        json=payload,
    )

    assert response.status_code == 404


def test_create_recommendation_missing_soil_report_returns_404(client):
    payload = {
        "plot_id": deficient_oil_palm_plot().plot_id,
        "soil_report_id": "does-not-exist",
        "crop_price_per_ton_inr": TEST_CROP_PRICE,
    }

    response = client.post(
        "/api/recommendations",
        json=payload,
    )

    assert response.status_code == 404


def test_create_recommendation_requires_auth(unauthenticated_client):
    payload = {
        "plot_id": deficient_oil_palm_plot().plot_id,
        "soil_report_id": deficient_oil_palm_soil().soil_report_id,
        "crop_price_per_ton_inr": TEST_CROP_PRICE,
    }

    response = unauthenticated_client.post(
        "/api/recommendations",
        json=payload,
    )

    assert response.status_code == 401


def test_create_recommendation_invalid_body_returns_422(client):
    response = client.post(
        "/api/recommendations",
        json={"plot_id": "only-plot"},
    )

    assert response.status_code == 422


def test_create_recommendation_requires_crop_price_when_economics_are_covered(client):
    from app.main import app
    from app.services.rule_provenance import get_rule_pack
    from tests.conftest import make_test_rule_pack

    app.dependency_overrides[get_rule_pack] = lambda: make_test_rule_pack(covers_yield_and_economics=True)
    payload = {
        "plot_id": deficient_oil_palm_plot().plot_id,
        "soil_report_id": deficient_oil_palm_soil().soil_report_id,
    }

    response = client.post(
        "/api/recommendations",
        json=payload,
    )

    assert response.status_code == 422


def test_create_recommendation_negative_crop_price_returns_422(client):
    payload = {
        "plot_id": deficient_oil_palm_plot().plot_id,
        "soil_report_id": deficient_oil_palm_soil().soil_report_id,
        "crop_price_per_ton_inr": -10,
    }

    response = client.post(
        "/api/recommendations",
        json=payload,
    )

    assert response.status_code == 422


def test_list_recommendations_returns_only_own(
    client,
    fake_recommendation_repo,
):
    payload = {
        "plot_id": deficient_oil_palm_plot().plot_id,
        "soil_report_id": deficient_oil_palm_soil().soil_report_id,
        "crop_price_per_ton_inr": TEST_CROP_PRICE,
    }

    create_response = client.post(
        "/api/recommendations",
        json=payload,
    )

    assert create_response.status_code == 201

    # Insert a recommendation belonging to another owner.
    fake_recommendation_repo._rows["rec-other"] = {
        "id": "rec-other",
        "owner_id": "someone-else",
        "plot_id": "p",
        "soil_report_id": "s",
        "crop": "rice",
        "deficiencies": [],
        "fertilizer_plan": [],
        "yield_prediction": {},
        "roi": {},
        "explanation": {},
        "status": "generated",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
    }

    response = client.get(
        "/api/recommendations",
    )

    assert response.status_code == 200

    body = response.json()

    owner_ids = {
        recommendation["owner_id"]
        for recommendation in body
    }

    assert owner_ids == {TEST_USER_ID}


def test_get_recommendation_by_id_success(client):
    payload = {
        "plot_id": deficient_oil_palm_plot().plot_id,
        "soil_report_id": deficient_oil_palm_soil().soil_report_id,
        "crop_price_per_ton_inr": TEST_CROP_PRICE,
    }

    created_response = client.post(
        "/api/recommendations",
        json=payload,
    )

    assert created_response.status_code == 201

    created = created_response.json()

    response = client.get(
        f"/api/recommendations/{created['recommendation_id']}"
    )

    assert response.status_code == 200
    assert response.json()["id"] == created["recommendation_id"]


def test_get_recommendation_unauthorized_access_returns_404(
    client,
    fake_recommendation_repo,
):
    fake_recommendation_repo._rows["rec-other"] = {
        "id": "rec-other",
        "owner_id": "someone-else",
        "plot_id": "p",
        "soil_report_id": "s",
        "crop": "rice",
        "deficiencies": [],
        "fertilizer_plan": [],
        "yield_prediction": {},
        "roi": {},
        "explanation": {},
        "status": "generated",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
    }

    response = client.get(
        "/api/recommendations/rec-other"
    )

    assert response.status_code == 404


def test_get_recommendation_missing_id_returns_404(client):
    response = client.get(
        "/api/recommendations/does-not-exist"
    )

    assert response.status_code == 404
