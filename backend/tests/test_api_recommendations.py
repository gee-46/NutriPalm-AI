from tests.conftest import TEST_USER_ID
from tests.fixtures.sample_data import deficient_oil_palm_plot, deficient_oil_palm_soil


def test_create_recommendation_success(client):
    payload = {
        "plot_id": deficient_oil_palm_plot().plot_id,
        "soil_report_id": deficient_oil_palm_soil().soil_report_id,
    }
    response = client.post("/api/recommendations", json=payload)

    assert response.status_code == 201
    body = response.json()
    assert body["crop"] == "oil_palm"
    assert body["recommendation_id"] == "rec-1"
    assert len(body["fertilizer_plan"]) > 0
    assert body["roi"]["fertilizer_cost"] > 0
    assert "summary" in body["explanation"]


def test_create_recommendation_missing_plot_returns_404(client):
    payload = {"plot_id": "does-not-exist", "soil_report_id": deficient_oil_palm_soil().soil_report_id}
    response = client.post("/api/recommendations", json=payload)
    assert response.status_code == 404


def test_create_recommendation_missing_soil_report_returns_404(client):
    payload = {"plot_id": deficient_oil_palm_plot().plot_id, "soil_report_id": "does-not-exist"}
    response = client.post("/api/recommendations", json=payload)
    assert response.status_code == 404


def test_create_recommendation_requires_auth(unauthenticated_client):
    payload = {
        "plot_id": deficient_oil_palm_plot().plot_id,
        "soil_report_id": deficient_oil_palm_soil().soil_report_id,
    }
    response = unauthenticated_client.post("/api/recommendations", json=payload)
    assert response.status_code == 401


def test_create_recommendation_invalid_body_returns_422(client):
    response = client.post("/api/recommendations", json={"plot_id": "only-plot"})
    assert response.status_code == 422


def test_create_recommendation_negative_crop_price_returns_422(client):
    payload = {
        "plot_id": deficient_oil_palm_plot().plot_id,
        "soil_report_id": deficient_oil_palm_soil().soil_report_id,
        "crop_price_per_ton_inr": -10,
    }
    response = client.post("/api/recommendations", json=payload)
    assert response.status_code == 422


def test_list_recommendations_returns_only_own(client, fake_recommendation_repo):
    payload = {
        "plot_id": deficient_oil_palm_plot().plot_id,
        "soil_report_id": deficient_oil_palm_soil().soil_report_id,
    }
    client.post("/api/recommendations", json=payload)
    # a recommendation belonging to a different owner, inserted directly
    fake_recommendation_repo._rows["rec-other"] = {
        "id": "rec-other",
        "owner_id": "someone-else",
        "plot_id": "p",
        "soil_report_id": "s",
        "crop": "rice",
        "deficiencies": "[]",
        "fertilizer_plan": "[]",
        "yield_prediction": "{}",
        "roi": "{}",
        "explanation": "{}",
        "status": "generated",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
    }

    response = client.get("/api/recommendations")
    assert response.status_code == 200
    body = response.json()
    owner_ids = {r["owner_id"] for r in body}
    assert owner_ids == {TEST_USER_ID}


def test_get_recommendation_by_id_success(client):
    payload = {
        "plot_id": deficient_oil_palm_plot().plot_id,
        "soil_report_id": deficient_oil_palm_soil().soil_report_id,
    }
    created = client.post("/api/recommendations", json=payload).json()

    response = client.get(f"/api/recommendations/{created['recommendation_id']}")
    assert response.status_code == 200
    assert response.json()["id"] == created["recommendation_id"]


def test_get_recommendation_unauthorized_access_returns_404(client, fake_recommendation_repo):
    fake_recommendation_repo._rows["rec-other"] = {
        "id": "rec-other",
        "owner_id": "someone-else",
        "plot_id": "p",
        "soil_report_id": "s",
        "crop": "rice",
        "deficiencies": "[]",
        "fertilizer_plan": "[]",
        "yield_prediction": "{}",
        "roi": "{}",
        "explanation": "{}",
        "status": "generated",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
    }

    response = client.get("/api/recommendations/rec-other")
    # Must behave identically to a truly missing id - never reveal that a
    # recommendation with this id exists but belongs to someone else.
    assert response.status_code == 404


def test_get_recommendation_missing_id_returns_404(client):
    response = client.get("/api/recommendations/does-not-exist")
    assert response.status_code == 404
