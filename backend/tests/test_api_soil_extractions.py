"""HTTP-level tests of the upload -> review -> confirm workflow."""
from __future__ import annotations

from tests.conftest import TEST_USER_ID
from tests.fixtures.sample_data import deficient_oil_palm_plot
from tests.fixtures.soil_report_files import SAMPLE_LINES, SAMPLE_VALUES, text_layer_pdf_bytes

PLOT_ID = deficient_oil_palm_plot().plot_id


def upload(client, pdf, name="report.pdf"):
    return client.post(
        "/api/soil-reports/upload",
        data={"plot_id": PLOT_ID},
        files={"file": (name, pdf, "application/pdf")},
    )


def report_with(*, drop=(), replace=None):
    replace = replace or {}
    lines = []
    for line in SAMPLE_LINES:
        if any(d in line for d in drop):
            continue
        for old, new in replace.items():
            if old in line:
                line = new
        lines.append(line)
    return text_layer_pdf_bytes(lines=lines)


# --------------------------------------------------------------- clear read
def test_clear_report_is_verified_automatically_and_traceable(client, fake_soil_report_writer, fake_extraction_repo):
    body = upload(client, text_layer_pdf_bytes()).json()
    assert body["status"] == "completed" and body["persisted"] is True
    assert body["verification_status"] == "auto_validated"
    assert body["review_required"] == []
    ext = fake_extraction_repo.rows[body["extraction_id"]]
    soil = fake_soil_report_writer.rows[body["soil_report_id"]]
    assert ext["status"] == "completed" and ext["soil_report_id"] == soil["id"]
    assert soil["extraction_id"] == ext["id"] and soil["verification_status"] == "auto_validated"
    assert len(ext["source_sha256"]) == 64
    # provenance of each value survives
    n = body["nitrogen"]
    assert n["page"] == 1 and n["unit_source"] == "stated" and "245" in n["source_text"]


def test_document_text_and_file_are_not_stored(fake_extraction_repo, client):
    upload(client, text_layer_pdf_bytes())
    stored = next(iter(fake_extraction_repo.rows.values()))
    assert "raw_text" not in stored
    # only the matched label/value lines are kept, never the surrounding document
    assert "SAMRUDDHI AGRI LABS" not in str(stored)
    assert "Test Farmer" not in str(stored)
    assert all(len(f.get("source_text") or "") <= 200 for f in stored["fields"].values())


def test_filename_is_sanitised_and_never_used_as_a_path(client, fake_extraction_repo):
    upload(client, text_layer_pdf_bytes(), name="..\\..\\evil/../../etc/passwd.pdf")
    stored = next(iter(fake_extraction_repo.rows.values()))
    assert stored["source_filename"] == "passwd.pdf"


# ---------------------------------------------------------- review workflow
def test_incomplete_report_waits_for_review_and_creates_no_soil_report(client, fake_soil_report_writer):
    body = upload(client, report_with(drop=("Potassium", "Organic Carbon"))).json()
    assert body["status"] == "needs_review" and body["persisted"] is False
    assert body["soil_report_id"] is None and body["extraction_id"]
    assert set(body["review_required"]) == {"potassium", "organic_carbon"}
    assert body["potassium"]["value"] is None  # absent stays absent, never zero
    assert fake_soil_report_writer.rows == {}


def test_confirm_with_corrections_creates_report_and_audit_trail(client, fake_soil_report_writer, fake_extraction_repo):
    body = upload(client, report_with(drop=("Potassium",))).json()
    eid = body["extraction_id"]

    # refusing: the missing value has not been supplied
    r = client.post(f"/api/soil-reports/extractions/{eid}/confirm", json={})
    assert r.status_code == 422
    detail = r.json()["detail"]
    assert detail["code"] == "extraction_not_confirmable" and "potassium" in detail["problems"]
    assert fake_soil_report_writer.rows == {}

    r = client.post(
        f"/api/soil-reports/extractions/{eid}/confirm",
        json={"corrections": {"potassium": {"value": 150, "unit": "kg/ha", "reason": "from page 2"}}},
    )
    assert r.status_code == 200, r.text
    done = r.json()
    assert done["status"] == "completed" and done["persisted"] and done["verification_status"] == "user_corrected"
    soil = fake_soil_report_writer.rows[done["soil_report_id"]]
    assert soil["potassium_kg_ha"] == 150.0 and soil["nitrogen_kg_ha"] == SAMPLE_VALUES["nitrogen"]
    assert soil["verification_status"] == "user_corrected" and soil["owner_id"] == TEST_USER_ID
    log = fake_extraction_repo.rows[eid]["corrections"]
    assert log[0]["parameter"] == "potassium" and log[0]["original_value"] is None
    assert log[0]["corrected_value"] == 150.0 and log[0]["reason"] == "from page 2"

    # can't be confirmed twice, and the second attempt creates nothing
    again = client.post(f"/api/soil-reports/extractions/{eid}/confirm", json={})
    assert again.status_code == 409
    assert len(fake_soil_report_writer.rows) == 1


def test_a_misread_value_can_be_corrected_and_the_reading_is_kept(client, fake_extraction_repo):
    pdf = report_with(replace={"Soil pH": "Soil pH                     68"})  # lost decimal point
    body = upload(client, pdf).json()
    assert body["status"] == "needs_review" and body["ph"]["validation"] == "unusable"
    r = client.post(
        f"/api/soil-reports/extractions/{body['extraction_id']}/confirm",
        json={"corrections": {"ph": {"value": 6.8}}},
    )
    assert r.status_code == 200 and r.json()["ph"]["value"] == 68.0  # the original reading is still shown
    entry = fake_extraction_repo.rows[body["extraction_id"]]["corrections"][0]
    assert entry["original_value"] == 68.0 and entry["corrected_value"] == 6.8


def test_negative_value_is_unusable_and_cannot_be_confirmed(client, fake_soil_report_writer):
    pdf = report_with(replace={"Available Nitrogen": "Available Nitrogen (N)      -245 kg/ha"})
    body = upload(client, pdf).json()
    assert body["status"] == "needs_review" and body["nitrogen"]["validation"] == "unusable"
    r = client.post(
        f"/api/soil-reports/extractions/{body['extraction_id']}/confirm",
        json={"confirmed": ["nitrogen"]},
    )
    assert r.status_code == 422 and "nitrogen" in r.json()["detail"]["problems"]
    assert fake_soil_report_writer.rows == {}


def test_unit_missing_next_to_value_requires_confirmation(client):
    pdf = report_with(replace={"Available Phosphorus": "Available Phosphorus (P)    18"})
    body = upload(client, pdf).json()
    assert body["status"] == "needs_review"
    assert body["phosphorus"]["unit_source"] == "assumed_default"
    assert body["review_required"] == ["phosphorus"]
    ok = client.post(
        f"/api/soil-reports/extractions/{body['extraction_id']}/confirm", json={"confirmed": ["phosphorus"]}
    )
    assert ok.status_code == 200 and ok.json()["verification_status"] == "user_confirmed"


def test_unknown_correction_keys_and_bad_numbers_are_rejected(client):
    body = upload(client, report_with(drop=("Potassium",))).json()
    url = f"/api/soil-reports/extractions/{body['extraction_id']}/confirm"
    assert client.post(url, json={"corrections": {"moisture": {"value": 1}}}).status_code == 422
    assert client.post(url, json={"corrections": {"potassium": {"value": "NaN", "unit": "kg/ha"}}}).status_code == 422


# ---------------------------------------------------------------- idempotency
def test_same_document_twice_does_not_repeat_ocr_or_duplicate_rows(
    client, monkeypatch, fake_soil_report_writer, fake_extraction_repo
):
    from app.services import soil_extraction_service as svc

    calls = []
    real = svc.run_pipeline
    monkeypatch.setattr(svc, "run_pipeline", lambda *a, **k: calls.append(1) or real(*a, **k))
    # `ingest_upload` binds the default at definition time, so patch through the router instead
    from app.routers import soil_reports as router_mod

    original_ingest = router_mod.svc.ingest_upload

    def counting(**kwargs):
        kwargs["pipeline"] = lambda n, c: calls.append(1) or real(n, c)
        return original_ingest(**kwargs)

    monkeypatch.setattr(router_mod.svc, "ingest_upload", counting)

    pdf = text_layer_pdf_bytes()
    first, second = upload(client, pdf).json(), upload(client, pdf).json()
    assert len(calls) == 1
    assert first["reused"] is False and second["reused"] is True
    assert first["extraction_id"] == second["extraction_id"]
    assert second["status"] == "completed" and second["soil_report_id"] == first["soil_report_id"]
    assert len(fake_extraction_repo.rows) == 1 and len(fake_soil_report_writer.rows) == 1


# -------------------------------------------------------------- failures
def test_corrupt_document_fails_and_stores_nothing(client, fake_soil_report_writer, fake_extraction_repo):
    body = upload(client, b"%PDF-1.4 truncated nonsense").json()
    assert body["status"] == "failed" and body["success"] is False and body["persisted"] is False
    assert body["extraction_id"] is None
    assert body["warnings"] and "could not be read" in body["warnings"][0]
    assert fake_soil_report_writer.rows == {} and fake_extraction_repo.rows == {}


def test_too_many_pages_is_refused(client, monkeypatch, fake_extraction_repo):
    from app.config import Settings, get_settings
    from app.main import app
    from tests.fixtures.soil_report_files import multi_page_pdf_bytes

    app.dependency_overrides[get_settings] = lambda: Settings(ocr_max_pages=1)
    monkeypatch.setattr("app.ocr.pipeline.get_settings", lambda: Settings(ocr_max_pages=1))
    body = upload(client, multi_page_pdf_bytes()).json()
    assert body["status"] == "failed" and "limit is 1" in body["warnings"][0]
    assert fake_extraction_repo.rows == {}


def test_ocr_engine_missing_is_reported_not_faked(client, monkeypatch, fake_extraction_repo):
    from app.ocr.engine import OcrEngine, OcrEngineUnavailable
    from tests.fixtures.soil_report_files import scanned_pdf_bytes

    def boom(self, image, timeout_seconds=None):
        raise OcrEngineUnavailable("The tesseract binary was not found on PATH.")

    monkeypatch.setattr(OcrEngine, "run", boom)
    body = upload(client, scanned_pdf_bytes()).json()
    assert body["status"] == "failed" and "tesseract" in body["warnings"][0].lower()
    assert fake_extraction_repo.rows == {}


def test_ocr_timeout_fails_the_whole_document(client, monkeypatch, fake_extraction_repo):
    from app.ocr.engine import OcrEngine, OcrTimeout
    from tests.fixtures.soil_report_files import scanned_pdf_bytes

    def slow(self, image, timeout_seconds=None):
        raise OcrTimeout("OCR of one page exceeded the 60s limit.")

    monkeypatch.setattr(OcrEngine, "run", slow)
    body = upload(client, scanned_pdf_bytes()).json()
    assert body["status"] == "failed" and "exceeded" in body["warnings"][0]
    assert fake_extraction_repo.rows == {}


# --------------------------------------------------------------- ownership
def _as(user_id):
    from app.dependencies import AuthenticatedUser, get_current_user
    from app.main import app

    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(user_id=user_id)


def test_other_users_cannot_read_list_or_confirm_an_extraction(client, fake_soil_report_writer):
    body = upload(client, report_with(drop=("Potassium",))).json()
    eid = body["extraction_id"]
    _as("intruder")

    assert client.get(f"/api/soil-reports/extractions/{eid}").status_code == 404
    assert client.get(f"/api/soil-reports/extractions/does-not-exist").status_code == 404
    denied = client.post(
        f"/api/soil-reports/extractions/{eid}/confirm",
        json={"corrections": {"potassium": {"value": 1, "unit": "kg/ha"}}},
    )
    assert denied.status_code == 404
    assert denied.json() == client.post("/api/soil-reports/extractions/nope/confirm", json={}).json()
    assert client.get("/api/soil-reports/extractions", params={"plot_id": PLOT_ID}).status_code == 404
    assert fake_soil_report_writer.rows == {}


def test_owner_can_read_and_list_their_extractions(client):
    body = upload(client, report_with(drop=("Potassium",))).json()
    got = client.get(f"/api/soil-reports/extractions/{body['extraction_id']}").json()
    assert got["status"] == "needs_review" and got["raw_text"] == ""  # text is never re-served
    listed = client.get("/api/soil-reports/extractions", params={"plot_id": PLOT_ID}).json()
    assert [e["extraction_id"] for e in listed] == [body["extraction_id"]]
