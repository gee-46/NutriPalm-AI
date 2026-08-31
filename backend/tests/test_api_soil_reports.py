"""API integration tests for POST /api/soil-reports/upload."""
from __future__ import annotations

from tests.fixtures.sample_data import deficient_oil_palm_plot
from tests.fixtures.soil_report_files import (
    SAMPLE_VALUES,
    scanned_pdf_bytes,
    text_layer_pdf_bytes,
)

PLOT_ID = deficient_oil_palm_plot().plot_id


def test_upload_text_pdf_extracts_and_persists(client):
    files = {"file": ("report.pdf", text_layer_pdf_bytes(), "application/pdf")}
    response = client.post(
        "/api/soil-reports/upload",
        data={"plot_id": PLOT_ID},
        files=files,
    )

    assert response.status_code == 200
    body = response.json()

    assert body["success"] is True
    assert body["persisted"] is True
    assert body["soil_report_id"] is not None
    assert body["plot_id"] == PLOT_ID

    for key, expected in SAMPLE_VALUES.items():
        assert body[key]["value"] == expected
        assert body[key]["validation"] == "valid"


def test_upload_scanned_pdf_real_ocr_extracts_and_persists(client):
    files = {"file": ("scan.pdf", scanned_pdf_bytes(), "application/pdf")}
    response = client.post(
        "/api/soil-reports/upload",
        data={"plot_id": PLOT_ID},
        files=files,
    )

    assert response.status_code == 200
    body = response.json()

    assert body["persisted"] is True
    assert body["nitrogen"]["value"] == SAMPLE_VALUES["nitrogen"]
    assert body["ph"]["value"] == SAMPLE_VALUES["ph"]


def test_upload_rejects_unknown_plot(client):
    files = {"file": ("report.pdf", text_layer_pdf_bytes(), "application/pdf")}
    response = client.post(
        "/api/soil-reports/upload",
        data={"plot_id": "does-not-exist"},
        files=files,
    )
    assert response.status_code == 404


def test_upload_requires_authentication(unauthenticated_client):
    files = {"file": ("report.pdf", text_layer_pdf_bytes(), "application/pdf")}
    response = unauthenticated_client.post(
        "/api/soil-reports/upload",
        data={"plot_id": PLOT_ID},
        files=files,
    )
    assert response.status_code == 401


def test_upload_rejects_unsupported_file_type(client):
    files = {"file": ("report.txt", b"Available Nitrogen 245 kg/ha", "text/plain")}
    response = client.post(
        "/api/soil-reports/upload",
        data={"plot_id": PLOT_ID},
        files=files,
    )
    assert response.status_code == 415


def test_upload_rejects_empty_file(client):
    files = {"file": ("report.pdf", b"", "application/pdf")}
    response = client.post(
        "/api/soil-reports/upload",
        data={"plot_id": PLOT_ID},
        files=files,
    )
    assert response.status_code == 422


def test_upload_with_missing_required_fields_does_not_persist(client):
    incomplete_pdf = text_layer_pdf_bytes(
        lines=[
            "SAMRUDDHI AGRI LABS - SOIL HEALTH REPORT",
            "Sample ID: 9981",
            "Available Nitrogen (N)      245 kg/ha",
            # phosphorus, potassium, ph, organic_carbon deliberately absent
        ]
    )
    files = {"file": ("incomplete.pdf", incomplete_pdf, "application/pdf")}
    response = client.post(
        "/api/soil-reports/upload",
        data={"plot_id": PLOT_ID},
        files=files,
    )

    assert response.status_code == 200
    body = response.json()

    # Extraction succeeded (we got text and read nitrogen), but the report
    # is NOT auto-saved because required fields are missing -- never
    # persist fabricated/partial data.
    assert body["success"] is True
    assert body["persisted"] is False
    assert body["soil_report_id"] is None
    assert body["nitrogen"]["value"] == 245.0
    assert body["potassium"]["value"] is None
    assert body["potassium"]["validation"] == "missing"


def test_upload_never_fabricates_data_on_ocr_failure(client):
    files = {"file": ("garbage.pdf", b"not a real pdf", "application/pdf")}
    response = client.post(
        "/api/soil-reports/upload",
        data={"plot_id": PLOT_ID},
        files=files,
    )

    assert response.status_code == 200
    body = response.json()
    assert body["persisted"] is False
    assert body["soil_report_id"] is None
    for key in (
        "nitrogen",
        "phosphorus",
        "potassium",
        "ph",
        "electrical_conductivity",
        "organic_carbon",
    ):
        assert body[key]["value"] is None
