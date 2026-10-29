"""Rules that decide when extracted soil values may become a verified soil report."""
from __future__ import annotations

import threading
from concurrent.futures import ThreadPoolExecutor

import pytest

from app.exceptions import ExtractionAlreadyResolved, ExtractionNotConfirmable
from app.ocr.pipeline import run_pipeline
from app.services import soil_extraction_service as svc
from tests.conftest import FakeExtractionRepository, FakeSoilReportWriter
from tests.fixtures.soil_report_files import text_layer_pdf_bytes


def field(value, *, unit="kg/ha", validation="valid", unit_source="stated", text=None, confidence=0.95):
    return {
        "value": value,
        "unit": unit,
        "validation": validation,
        "unit_source": unit_source,
        "extracted_text": text if text is not None else (None if value is None else str(value)),
        "confidence": confidence,
        "warnings": [],
    }


def clean_fields(**overrides):
    base = {
        "nitrogen": field(245.0),
        "phosphorus": field(18.0),
        "potassium": field(142.0),
        "ph": field(6.8, unit=None, unit_source="not_applicable"),
        "organic_carbon": field(0.62, unit="%"),
        "electrical_conductivity": field(0.42, unit="dS/m"),
    }
    base.update(overrides)
    return base


# ------------------------------------------------------------ resolve_confirmation
def test_all_valid_values_need_no_human_and_are_auto_validated():
    r = svc.resolve_confirmation(clean_fields())
    assert r.verification_status == "auto_validated"
    assert r.corrections == []
    assert r.values["nitrogen"] == {"value": 245.0, "unit": "kg/ha", "validation": "valid"}


def test_review_field_is_never_accepted_silently():
    fields = clean_fields(phosphorus=field(18.0, validation="review", unit_source="assumed_default"))
    with pytest.raises(ExtractionNotConfirmable) as exc:
        svc.resolve_confirmation(fields)
    assert list(exc.value.problems) == ["phosphorus"]


def test_review_field_confirmed_by_the_owner_is_user_confirmed():
    fields = clean_fields(phosphorus=field(18.0, validation="review", unit_source="assumed_default"))
    r = svc.resolve_confirmation(fields, confirmed=["phosphorus"])
    assert r.verification_status == "user_confirmed"
    assert r.values["phosphorus"]["validation"] == "user_confirmed"
    assert r.corrections == []


def test_missing_required_value_can_only_be_supplied_as_a_correction_with_audit():
    fields = clean_fields(potassium=field(None, validation="missing", unit=None, unit_source=None))
    with pytest.raises(ExtractionNotConfirmable) as exc:
        svc.resolve_confirmation(fields)
    assert "potassium" in exc.value.problems

    r = svc.resolve_confirmation(
        fields, corrections={"potassium": {"value": 150, "unit": "kg/ha", "reason": "read from page 2"}}
    )
    assert r.verification_status == "user_corrected"
    assert r.values["potassium"]["value"] == 150.0
    entry = r.corrections[0]
    assert entry["parameter"] == "potassium"
    assert entry["original_value"] is None  # absent is recorded as absent, not as zero
    assert entry["corrected_value"] == 150.0 and entry["reason"] == "read from page 2"


def test_correction_keeps_the_original_reading():
    fields = clean_fields(nitrogen=field(2450.0, validation="review", text="2450"))
    r = svc.resolve_confirmation(fields, corrections={"nitrogen": {"value": 245, "unit": "kg/ha"}})
    entry = r.corrections[0]
    assert entry["original_value"] == 2450.0 and entry["original_text"] == "2450"
    assert entry["corrected_value"] == 245.0


@pytest.mark.parametrize(
    "param,corr,needle",
    [
        ("nitrogen", {"value": 245, "unit": None}, "unit"),  # no assumed units
        ("nitrogen", {"value": 245, "unit": "mg/kg"}, "not accepted"),  # no silent conversion
        ("ph", {"value": 68, "unit": None}, "outside"),  # lost decimal point
        ("nitrogen", {"value": -5, "unit": "kg/ha"}, "outside"),  # lost/extra minus sign
        ("organic_carbon", {"value": 250, "unit": "%"}, "outside"),
        ("nitrogen", {"value": float("nan"), "unit": "kg/ha"}, "finite"),
        ("nitrogen", {"value": float("inf"), "unit": "kg/ha"}, "finite"),
    ],
)
def test_bad_corrections_are_rejected(param, corr, needle):
    with pytest.raises(ExtractionNotConfirmable) as exc:
        svc.resolve_confirmation(clean_fields(), corrections={param: corr})
    assert needle in exc.value.problems[param]


def test_a_bound_is_not_a_measurement():
    fields = clean_fields(nitrogen=field(">500", validation="review"))
    with pytest.raises(ExtractionNotConfirmable) as exc:
        svc.resolve_confirmation(fields, confirmed=["nitrogen"])  # confirming is not enough
    assert "not an exact number" in exc.value.problems["nitrogen"]
    r = svc.resolve_confirmation(fields, corrections={"nitrogen": {"value": 520, "unit": "kg/ha"}})
    assert r.values["nitrogen"]["value"] == 520.0


def test_a_stated_foreign_unit_cannot_be_confirmed_as_read():
    fields = clean_fields(electrical_conductivity=field(420.0, unit="uS/cm", validation="review"))
    r = svc.resolve_confirmation(fields, confirmed=["electrical_conductivity"])
    assert "electrical_conductivity" not in r.values  # optional: left out, not mis-stored
    assert r.not_saved == ["electrical_conductivity"]

    fields = clean_fields(nitrogen=field(245.0, unit="mg/kg", validation="review"))
    with pytest.raises(ExtractionNotConfirmable) as exc:
        svc.resolve_confirmation(fields, confirmed=["nitrogen"])
    assert "Convert it yourself" in exc.value.problems["nitrogen"]


def test_unusable_required_value_needs_a_correction():
    fields = clean_fields(ph=field(68.0, unit=None, validation="unusable", unit_source="not_applicable"))
    with pytest.raises(ExtractionNotConfirmable):
        svc.resolve_confirmation(fields, confirmed=["ph"])


def test_unconfirmed_optional_values_are_not_saved_and_say_so():
    fields = clean_fields(
        zinc=field(0.7, unit="mg/kg", validation="review", unit_source="assumed_default"),
        iron=field(12.4, unit="mg/kg", validation="valid"),
    )
    r = svc.resolve_confirmation(fields)
    assert "zinc" not in r.values and "zinc" in r.not_saved
    assert r.values["iron"]["value"] == 12.4


def test_unknown_parameters_are_rejected():
    with pytest.raises(ExtractionNotConfirmable) as exc:
        svc.resolve_confirmation(clean_fields(), corrections={"moisture": {"value": 1, "unit": None}})
    assert "moisture" in exc.value.problems


# --------------------------------------------------------------- finalize / ingest
def _stored(repo, fields=None, status="needs_review"):
    return repo.create(
        {
            "owner_id": "u1", "plot_id": "p1", "status": status, "source_sha256": "a" * 64,
            "pipeline_version": "t", "page_count": 1, "fields": fields or clean_fields(), "corrections": [],
        }
    )


def test_finalize_creates_the_report_and_closes_the_extraction():
    repo, writer = FakeExtractionRepository(), FakeSoilReportWriter()
    ext = _stored(repo)
    closed, row, res = svc.finalize(ext, "u1", repo=repo, writer=writer)
    assert closed["status"] == "completed" and closed["soil_report_id"] == row["id"]
    assert row["extraction_id"] == ext["id"] and row["verification_status"] == "auto_validated"
    assert row["nitrogen_kg_ha"] == 245.0


def test_failed_close_removes_the_soil_report_again():
    repo, writer = FakeExtractionRepository(), FakeSoilReportWriter()
    ext = _stored(repo)
    repo.fail_mark_completed = True
    with pytest.raises(RuntimeError):
        svc.finalize(ext, "u1", repo=repo, writer=writer)
    assert writer.rows == {}, "no verified report may outlive a failed close"


def test_concurrent_confirm_loses_cleanly_and_leaves_one_report():
    repo, writer = FakeExtractionRepository(), FakeSoilReportWriter()
    ext = _stored(repo)
    svc.finalize(ext, "u1", repo=repo, writer=writer)
    with pytest.raises(ExtractionAlreadyResolved):
        svc.finalize(ext, "u1", repo=repo, writer=writer)  # stale copy still says needs_review
    assert len(writer.rows) == 1


def test_nothing_is_written_when_confirmation_is_refused():
    repo, writer = FakeExtractionRepository(), FakeSoilReportWriter()
    ext = _stored(repo, clean_fields(phosphorus=field(None, validation="missing", unit=None, unit_source=None)))
    with pytest.raises(ExtractionNotConfirmable):
        svc.finalize(ext, "u1", repo=repo, writer=writer)
    assert writer.rows == {} and repo.rows[ext["id"]]["status"] == "needs_review"


def test_identical_concurrent_uploads_run_ocr_once():
    repo, writer = FakeExtractionRepository(), FakeSoilReportWriter()
    calls = []
    gate = threading.Event()

    def slow_pipeline(name, content):
        calls.append(name)
        gate.wait(0.3)
        return run_pipeline(name, content)

    pdf = text_layer_pdf_bytes()

    def go():
        return svc.ingest_upload(
            owner_id="u1", plot_id="p1", filename="r.pdf", content_type="application/pdf",
            content=pdf, repo=repo, writer=writer, pipeline=slow_pipeline,
        )

    with ThreadPoolExecutor(4) as pool:
        outcomes = [f.result() for f in [pool.submit(go) for _ in range(4)]]
    assert len(calls) == 1
    assert sorted(o.reused for o in outcomes) == [False, True, True, True]
    assert len(repo.rows) == 1 and len(writer.rows) == 1


def test_same_document_for_a_different_plot_is_processed_separately():
    repo, writer = FakeExtractionRepository(), FakeSoilReportWriter()
    pdf = text_layer_pdf_bytes()
    for plot in ("p1", "p2"):
        svc.ingest_upload(owner_id="u1", plot_id=plot, filename="r.pdf", content_type="application/pdf",
                          content=pdf, repo=repo, writer=writer)
    assert len(repo.rows) == 2 and len(writer.rows) == 2
