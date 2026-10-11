"""
POST /api/disease/assess and history, through the real FastAPI app with REAL signed JWTs
(get_current_user is not overridden). Repositories are in-memory fakes; the knowledge base is the
shipped, source-verified one unless a test says otherwise.
"""
from __future__ import annotations

import logging
import time
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from jose import jwt

from app.config import Settings, get_settings
from app.disease.knowledge_base import KnowledgeBaseError
from app.disease.repository import PlotContext, get_assessment_repository, get_plot_context_repository
from app.exceptions import DiseaseAssessmentNotFound, NotAuthorized, PlotNotFound, RepositoryNotConfigured
from app.main import app
from app.routers import disease as disease_router

SECRET = "unit-test-signing-secret"
A, B = "user-a", "user-b"
A_COCO, A_AREC, B_COCO = "plot-a-coconut", "plot-a-arecanut", "plot-b-coconut"


def token(sub, **o):
    return jwt.encode({"sub": sub, "aud": "authenticated", "exp": int(time.time()) + 600, **o}, SECRET, algorithm="HS256")


def H(sub=A):
    return {"Authorization": f"Bearer {token(sub)}"}


class FakePlots:
    def __init__(self):
        self.plots = {
            A_COCO: PlotContext(A_COCO, A, "Coconut", "Karnataka", "Udupi"),
            A_AREC: PlotContext(A_AREC, A, "arecanut", "Karnataka", None),
            B_COCO: PlotContext(B_COCO, B, "coconut", "Kerala", "Thrissur"),
            "plot-a-unknown-crop": PlotContext("plot-a-unknown-crop", A, None, None, None),
        }

    def get_plot_context(self, plot_id):
        if plot_id not in self.plots:
            raise PlotNotFound(plot_id)
        return self.plots[plot_id]


class FakeAssessments:
    def __init__(self):
        self.rows = {}
        self.n = 0
        self.fail = False

    def save(self, owner_id, request, result, top):
        if self.fail:
            raise RuntimeError("database down: password=hunter2")
        self.n += 1
        rid = f"as-{self.n}"
        self.rows[rid] = {"id": rid, "owner_id": owner_id, "plot_id": request.plot_id, "crop": result.crop, "risk_level": result.risk_level.value,
                          "top_disease_id": top, "request": request.model_dump(mode="json"), "result": result.model_dump(mode="json"),
                          "kb_version": result.kb_version, "rule_version": result.rule_version, "created_at": result.assessed_at.isoformat()}
        return self.rows[rid]

    def list_for_owner(self, owner_id, plot_id=None, limit=100):
        return [r for r in self.rows.values() if r["owner_id"] == owner_id and (plot_id is None or r["plot_id"] == plot_id)]

    def get_for_owner(self, assessment_id, owner_id):
        row = self.rows.get(assessment_id)
        if row is None:
            raise DiseaseAssessmentNotFound(assessment_id)
        if row["owner_id"] != owner_id:
            raise NotAuthorized(assessment_id)
        return row


@pytest.fixture
def api():
    plots, store = FakePlots(), FakeAssessments()
    app.dependency_overrides[get_settings] = lambda: Settings(supabase_jwt_secret=SECRET)
    app.dependency_overrides[get_plot_context_repository] = lambda: plots
    app.dependency_overrides[get_assessment_repository] = lambda: store

    class Ctx:
        client = TestClient(app)
        quiet_client = TestClient(app, raise_server_exceptions=False)

    Ctx.plots, Ctx.store = plots, store
    yield Ctx
    app.dependency_overrides.clear()


BUD_ROT = {"plot_id": A_COCO, "crop": "coconut", "crop_stage": "adult", "symptom_codes": ["spear_leaf_withering", "spindle_pulls_out"],
           "context": {"high_rainfall_area": "yes"}}


# ------------------------------------------------------------------ success + contract
def test_authenticated_assessment_succeeds_and_matches_the_frontend_contract(api):
    r = api.client.post("/api/disease/assess", json=BUD_ROT, headers=H())
    assert r.status_code == 201, r.text
    body = r.json()
    # fields the existing frontend contract (src/lib/phase2/contracts.ts) already requires
    for key in ("plot_id", "crop", "risk_level", "candidates", "limitations", "missing_inputs", "assessed_at"):
        assert key in body
    assert body["risk_level"] in ("low", "moderate", "high", "insufficient_evidence")
    top = body["candidates"][0]
    assert top["disease_id"] == "coconut_bud_rot" and body["risk_level"] == "high"
    for key in ("disease_name", "contributing_factors", "evidence", "management", "precautions"):
        assert key in top
    assert all({"description", "source"} <= set(e) for e in top["evidence"]) and top["evidence"]
    assert top["is_confirmed_diagnosis"] is False
    assert body["kb_version"] and body["rule_version"] and body["disclaimer"]
    assert "not a diagnosis" in body["risk_explanation"]


def test_response_separates_observed_inputs_from_derived_results(api):
    body = api.client.post("/api/disease/assess", json=BUD_ROT, headers=H()).json()
    assert body["observed"]["kind"] == "farmer_reported"
    assert {s["code"] for s in body["observed"]["symptoms"]} == {"spear_leaf_withering", "spindle_pulls_out"}
    assert body["inputs_used"] and isinstance(body["inputs_not_used"], list)
    assert "treatment" in body["candidates"][0] and body["candidates"][0]["treatment"]["chemical_status"] in (
        "not_applicable", "verification_required", "institutional_recommendation_only")


def test_chemical_guidance_in_the_api_is_never_actionable_with_the_shipped_data(api):
    body = api.client.post("/api/disease/assess", json=BUD_ROT, headers=H()).json()
    for cand in body["candidates"]:
        for c in cand["treatment"]["chemical_management"]:
            assert c["actionable"] is False and c["label_summary"] is None


def test_no_symptoms_returns_insufficient_evidence_with_follow_up_questions(api):
    r = api.client.post("/api/disease/assess", json={"plot_id": A_COCO, "crop": "coconut"}, headers=H())
    body = r.json()
    assert r.status_code == 201 and body["risk_level"] == "insufficient_evidence" and body["candidates"] == []
    assert body["follow_up_questions"] and body["missing_inputs"] and body["next_steps"]


def test_arecanut_and_coconut_plots_are_assessed_with_their_own_knowledge(api):
    areca = api.client.post("/api/disease/assess", json={"plot_id": A_AREC, "crop": "arecanut", "symptom_codes": ["nut_water_soaked_lesions", "nuts_lose_lustre"],
                                                         "context": {"monsoon_period": "yes"}}, headers=H()).json()
    assert [c["disease_id"] for c in areca["candidates"]] == ["areca_fruit_rot"] and areca["risk_level"] == "high"
    # the same arecanut symptoms on a coconut plot find no coconut disease
    coco = api.client.post("/api/disease/assess", json={"plot_id": A_COCO, "crop": "coconut", "symptom_codes": ["nut_water_soaked_lesions"]}, headers=H()).json()
    assert coco["candidates"] == [] and coco["risk_level"] == "insufficient_evidence"


def test_free_text_symptoms_are_matched_literally_and_unmatched_text_is_reported(api):
    body = api.client.post("/api/disease/assess", json={"plot_id": A_COCO, "crop": "coconut", "symptoms": ["spear leaf drying, purple spots"]}, headers=H()).json()
    assert body["candidates"] and any("purple spots" in s for s in body["inputs_not_used"])


def test_weather_values_are_accepted_but_reported_as_not_used(api):
    payload = {**BUD_ROT, "weather": {"source": "Open-Meteo", "temperature_c": 24, "humidity_pct": 90, "rainfall_mm_7d": 80}}
    body = api.client.post("/api/disease/assess", json=payload, headers=H()).json()
    assert any("did not change the result" in s for s in body["inputs_not_used"])
    assert body["risk_level"] == "high"  # identical to the same request without weather


# ------------------------------------------------------------------ validation
@pytest.mark.parametrize(
    "mutation",
    [
        lambda p: p.pop("plot_id"),
        lambda p: p.pop("crop"),
        lambda p: p.update(crop=""),
        lambda p: p.update(severity="catastrophic"),
        lambda p: p.update(observation_date=str(date.today() + timedelta(days=2))),
        lambda p: p.update(duration_days=-3),
        lambda p: p.update(symptom_codes=["x"] * 41),
        lambda p: p.update(observations="y" * 1001),
        lambda p: p.update(context={"high_rainfall_area": "maybe"}),
        lambda p: p.update(weather={"humidity_pct": 140}),
        lambda p: p.update(weather={"temperature_c": "hot"}),
    ],
)
def test_invalid_requests_are_rejected_with_422(api, mutation):
    payload = dict(BUD_ROT)
    mutation(payload)
    assert api.client.post("/api/disease/assess", json=payload, headers=H()).status_code == 422
    assert api.store.rows == {}


def test_unsupported_crop_unknown_symptom_and_unknown_condition_are_clear_422s(api):
    r = api.client.post("/api/disease/assess", json={**BUD_ROT, "crop": "oil palm"}, headers=H())
    assert r.status_code == 422 and "arecanut" in r.json()["detail"] and "coconut" in r.json()["detail"]
    r = api.client.post("/api/disease/assess", json={**BUD_ROT, "symptom_codes": ["made_up"]}, headers=H())
    assert r.status_code == 422 and "made_up" in r.json()["detail"]
    r = api.client.post("/api/disease/assess", json={**BUD_ROT, "context": {"made_up": "yes"}}, headers=H())
    assert r.status_code == 422


def test_plot_recorded_with_another_crop_cannot_be_assessed_as_that_crop(api):
    r = api.client.post("/api/disease/assess", json={**BUD_ROT, "plot_id": A_AREC, "crop": "coconut"}, headers=H())
    assert r.status_code == 422 and "arecanut" in r.json()["detail"]


def test_plot_recorded_with_an_unsupported_crop_cannot_be_assessed_as_a_supported_one(api):
    api.plots.plots["plot-a-oil"] = PlotContext("plot-a-oil", A, "Oil Palm", None, None)
    r = api.client.post("/api/disease/assess", json={**BUD_ROT, "plot_id": "plot-a-oil"}, headers=H())
    assert r.status_code == 422 and "Oil Palm" in r.json()["detail"]
    assert api.store.rows == {}


def test_plot_with_no_recorded_crop_can_be_assessed_for_a_supported_crop(api):
    r = api.client.post("/api/disease/assess", json={**BUD_ROT, "plot_id": "plot-a-unknown-crop"}, headers=H())
    assert r.status_code == 201


# ------------------------------------------------------------------ authentication
def test_missing_and_invalid_tokens_are_rejected_everywhere(api):
    for headers in ({}, {"Authorization": "Bearer nope"}, {"Authorization": f"Bearer {token(A, exp=int(time.time()) - 5)}"}):
        assert api.client.post("/api/disease/assess", json=BUD_ROT, headers=headers).status_code == 401
        assert api.client.get("/api/disease/assessments", headers=headers).status_code == 401
        assert api.client.get("/api/disease/vocabulary", headers=headers).status_code == 401
    assert api.store.rows == {}


# ------------------------------------------------------------------ ownership / IDOR
def test_user_a_cannot_assess_user_bs_plot_and_the_denial_looks_like_not_found(api):
    other = api.client.post("/api/disease/assess", json={**BUD_ROT, "plot_id": B_COCO}, headers=H(A))
    missing = api.client.post("/api/disease/assess", json={**BUD_ROT, "plot_id": "no-such-plot"}, headers=H(A))
    assert other.status_code == missing.status_code == 404 and other.json() == missing.json()
    assert B not in other.text and "Kerala" not in other.text and "Thrissur" not in other.text
    assert api.store.rows == {}


@pytest.mark.parametrize("forged", ["../../etc/passwd", "' OR 1=1 --", "00000000-0000-0000-0000-000000000000", "plot-b-coconut ", "PLOT-B-COCONUT", "null", "{}"])
def test_forged_plot_ids_are_not_found(api, forged):
    assert api.client.post("/api/disease/assess", json={**BUD_ROT, "plot_id": forged}, headers=H(A)).status_code == 404


def test_client_supplied_owner_and_region_fields_are_ignored(api):
    payload = {**BUD_ROT, "owner_id": B, "user_id": B, "state": "Tamil Nadu", "region": "Tamil Nadu", "district": "Thanjavur"}
    body = api.client.post("/api/disease/assess", json=payload, headers=H(A)).json()
    row = next(iter(api.store.rows.values()))
    assert row["owner_id"] == A
    assert body["observed"]["plot_state"] == "Karnataka"  # read from the plot row, not the body
    assert "owner_id" not in row["request"] and "state" not in row["request"]


def test_assessment_is_saved_for_the_token_owner_and_listed_only_for_them(api):
    ra = api.client.post("/api/disease/assess", json=BUD_ROT, headers=H(A)).json()
    rb = api.client.post("/api/disease/assess", json={**BUD_ROT, "plot_id": B_COCO}, headers=H(B)).json()
    assert ra["assessment_id"] and rb["assessment_id"] and ra["assessment_id"] != rb["assessment_id"]
    list_a = api.client.get("/api/disease/assessments", headers=H(A)).json()
    list_b = api.client.get("/api/disease/assessments", headers=H(B)).json()
    assert [x["id"] for x in list_a] == [ra["assessment_id"]] and [x["id"] for x in list_b] == [rb["assessment_id"]]
    assert all(x["result"] is None for x in list_a)  # list rows stay light


def test_history_detail_roundtrips_and_is_denied_across_users(api):
    created = api.client.post("/api/disease/assess", json=BUD_ROT, headers=H(A)).json()
    got = api.client.get(f"/api/disease/assessments/{created['assessment_id']}", headers=H(A))
    assert got.status_code == 200 and got.json()["result"]["candidates"][0]["disease_id"] == "coconut_bud_rot"
    other = api.client.get(f"/api/disease/assessments/{created['assessment_id']}", headers=H(B))
    missing = api.client.get("/api/disease/assessments/as-999", headers=H(B))
    assert other.status_code == missing.status_code == 404 and other.json() == missing.json()


def test_history_plot_filter_cannot_widen_access(api):
    api.client.post("/api/disease/assess", json=BUD_ROT, headers=H(A))
    api.client.post("/api/disease/assess", json={**BUD_ROT, "plot_id": B_COCO}, headers=H(B))
    assert api.client.get(f"/api/disease/assessments?plot_id={B_COCO}", headers=H(A)).json() == []
    assert len(api.client.get(f"/api/disease/assessments?plot_id={A_COCO}", headers=H(A)).json()) == 1
    assert api.client.get("/api/disease/assessments?plot_id=" + "x" * 100, headers=H(A)).status_code == 422


# ------------------------------------------------------------------ failures
def test_database_failure_on_save_still_returns_the_result_and_says_it_was_not_saved(api, caplog):
    api.store.fail = True
    with caplog.at_level(logging.ERROR):
        r = api.client.post("/api/disease/assess", json=BUD_ROT, headers=H())
    body = r.json()
    assert r.status_code == 201 and body["assessment_id"] is None and body["candidates"]
    assert any("could not be saved" in l for l in body["limitations"])
    assert "hunter2" not in r.text  # the raw error text never reaches the client


def test_plot_repository_not_configured_is_a_503(api):
    class Down:
        def get_plot_context(self, _):
            raise RepositoryNotConfigured("no db")

    app.dependency_overrides[get_plot_context_repository] = lambda: Down()
    r = api.client.post("/api/disease/assess", json=BUD_ROT, headers=H())
    assert r.status_code == 503 and "no db" not in r.text


def test_unexpected_database_error_is_a_500_without_details(api):
    class Broken:
        def get_plot_context(self, _):
            raise RuntimeError("connection string postgres://user:secret@host")

    app.dependency_overrides[get_plot_context_repository] = lambda: Broken()
    r = api.quiet_client.post("/api/disease/assess", json=BUD_ROT, headers=H())
    assert r.status_code == 500 and "secret" not in r.text


def test_knowledge_base_failure_is_a_503(api, monkeypatch):
    def boom():
        raise KnowledgeBaseError("data/diseases.json is corrupt")

    monkeypatch.setattr(disease_router, "get_knowledge_base", boom)
    r = api.client.post("/api/disease/assess", json=BUD_ROT, headers=H())
    assert r.status_code == 503 and "corrupt" not in r.text


def test_free_text_is_not_written_to_the_logs(api, caplog):
    secret = "my neighbour Ravi's private note 9448012345"
    with caplog.at_level(logging.DEBUG):
        api.client.post("/api/disease/assess", json={**BUD_ROT, "observations": secret, "symptoms": [secret]}, headers=H())
    assert "9448012345" not in caplog.text


def test_free_text_notes_are_stored_but_declared_unused(api):
    body = api.client.post("/api/disease/assess", json={**BUD_ROT, "observations": "<script>alert(1)</script>"}, headers=H()).json()
    assert any("Free-text notes" in s for s in body["inputs_not_used"])
    assert "<script>" not in str(body["candidates"])  # never echoed into the explanation


# ------------------------------------------------------------------ vocabulary
def test_vocabulary_endpoint_lists_what_the_engine_understands(api):
    v = api.client.get("/api/disease/vocabulary", headers=H()).json()
    assert {"arecanut", "coconut"} <= set(v["crops"]) and set(v["crops_with_verified_knowledge"]) == {"arecanut", "coconut"}
    codes = {s["code"] for s in v["symptoms"]}
    assert {"spear_leaf_withering", "nut_water_soaked_lesions", "trunk_base_bleeding"} <= codes
    assert {s["code"] for s in v["stages"]} == {"seedling", "young_palm", "adult_palm"} and v["conditions"]
