"""
The OCR evaluation harness: manifest validation, per-field metrics and review-routing.

The documents below are GENERATED TEST FIXTURES with known truth. They exercise the harness's arithmetic and the
pipeline's routing of negative signs, lost decimal points, ambiguous units and missing values; they are not added to the
evaluation manifest and say nothing about real-world accuracy.
"""
import copy
import json

import pytest

from eval import ocr_eval as ev
from tests.fixtures.soil_report_files import SAMPLE_LINES, scanned_pdf_bytes, text_layer_pdf_bytes

TRUTH = {
    "nitrogen": {"value": 245.0, "unit": "kg/ha", "unit_stated": True},
    "phosphorus": {"value": 18.0, "unit": "kg/ha", "unit_stated": True},
    "potassium": {"value": 142.0, "unit": "kg/ha", "unit_stated": True},
    "ph": {"value": 6.8, "unit": None, "unit_stated": False},
    "organic_carbon": {"value": 0.62, "unit": "%", "unit_stated": True},
}


def doc(lines):
    return ev.evaluate_document("t.pdf", text_layer_pdf_bytes(lines=lines), TRUTH, "digital_pdf")


def replace(old_start, new):
    return [new if line.startswith(old_start) else line for line in SAMPLE_LINES]


def drop(start):
    return [line for line in SAMPLE_LINES if not line.startswith(start)]


# ------------------------------------------------------------------ manifest validation
def manifest():
    return json.loads(json.dumps(ev.load_manifest()))


def test_the_shipped_manifest_is_valid_and_says_authorization_is_unconfirmed():
    m = ev.load_manifest()
    assert ev.validate_manifest(m) == []
    assert [d["authorization_confirmed"] for d in m["documents"]] == [False]


def mutate(fn):
    m = manifest()
    fn(m["documents"][0])
    return ev.validate_manifest(m)


@pytest.mark.parametrize(
    "fn,needle",
    [
        (lambda d: d.pop("authorization"), "'authorization'"),
        (lambda d: d.pop("authorization_confirmed"), "authorization_confirmed"),
        (lambda d: d.pop("verified_by"), "'verified_by'"),
        (lambda d: d.pop("laboratory"), "'laboratory'"),
        (lambda d: d.pop("id"), "'id'"),
        (lambda d: d.update(report_type="fax"), "report_type"),
        (lambda d: d.update(recorded_on="2999-01-01"), "recorded_on"),
        (lambda d: d.update(file="missing.pdf"), "file not found"),
        (lambda d: d.update(sha256="0" * 64), "sha256 does not match"),
        (lambda d: d.pop("sha256"), "sha256 of the document is required"),
        (lambda d: d.update(ground_truth={}), "ground_truth"),
        (lambda d: d["ground_truth"].update(moisture={"value": 1, "unit": None, "unit_stated": False}), "unknown parameter"),
        (lambda d: d["ground_truth"]["nitrogen"].update(unit="mg/kg"), "not valid for nitrogen"),
        (lambda d: d["ground_truth"]["ph"].update(unit="kg/ha"), "not valid for ph"),
        (lambda d: d["ground_truth"]["nitrogen"].update(value=float("nan")), "finite number"),
        (lambda d: d["ground_truth"]["nitrogen"].update(value="lots"), "finite number"),
        (lambda d: d["ground_truth"]["nitrogen"].update(value=True), "finite number"),
        (lambda d: d["ground_truth"]["nitrogen"].pop("unit_stated"), "unit_stated"),
        (lambda d: d["ground_truth"]["nitrogen"].pop("value"), "needs a 'value'"),
    ],
)
def test_manifest_problems_are_reported(fn, needle):
    assert any(needle in p for p in mutate(fn)), mutate(fn)


def test_duplicate_ids_and_wrong_schema_version_are_reported():
    m = manifest()
    m["documents"].append(copy.deepcopy(m["documents"][0]))
    assert any("duplicate id" in p for p in ev.validate_manifest(m))
    m2 = manifest(); m2["schema_version"] = 1
    assert any("schema_version" in p for p in ev.validate_manifest(m2))
    assert ev.validate_manifest({"schema_version": 2, "documents": []})


def test_bound_readings_are_valid_ground_truth():
    assert not any("finite" in p for p in mutate(lambda d: d["ground_truth"]["nitrogen"].update(value=">500")))


def test_a_changed_document_is_detected_by_its_hash(tmp_path):
    m = manifest()
    f = tmp_path / "r.pdf"; f.write_bytes(b"%PDF-1.4 original")
    d = m["documents"][0]; d["file"] = "r.pdf"; d["sha256"] = ev.sha256_file(f)
    assert ev.validate_manifest(m, tmp_path) == []
    f.write_bytes(b"%PDF-1.4 edited after verification")
    assert any("sha256 does not match" in p for p in ev.validate_manifest(m, tmp_path))


# ------------------------------------------------------------------ statistics
def test_wilson_interval():
    lo, hi = ev.wilson(12, 12)
    assert lo == pytest.approx(0.758, abs=0.005) and hi == 1.0
    assert ev.wilson(0, 0) == (0.0, 1.0)
    lo, hi = ev.wilson(0, 6)
    assert lo == 0.0 and hi == pytest.approx(0.39, abs=0.01)


def test_small_samples_are_labelled_insufficient_and_never_called_accuracy():
    d = doc(SAMPLE_LINES)
    text = ev.render("X", [d], ev.summarise([d]))
    assert "INSUFFICIENT SAMPLE" in text and "NOT an accuracy estimate" in text
    assert "95% CI" in text and "(floor 30)" in text


# ------------------------------------------------------------------ routing of the hard cases
def test_clean_report_is_read_and_auto_accepted():
    d = doc(SAMPLE_LINES)
    assert {r["bucket"] for r in d["rows"].values()} == {"auto_correct"}
    s = ev.summarise([d])["by_report_type"]["digital_pdf"]
    assert (s["value_ok"], s["found"], s["n"], s.get("AUTO_WRONG", 0)) == (5, 5, 5, 0)
    assert (s["unit_ok"], s["unit_n"]) == (4, 4)  # pH has no unit to score


def test_negative_sign_is_caught_by_review_not_silently_accepted():
    d = doc(replace("Available Nitrogen", "Available Nitrogen (N)      -245 kg/ha"))
    row = d["rows"]["nitrogen"]
    assert row["read"] == -245.0 and row["value_ok"] is False
    assert row["bucket"] == "review_wrong", row
    assert ev.summarise([d])["by_report_type"]["digital_pdf"].get("AUTO_WRONG", 0) == 0


def test_lost_decimal_point_is_caught_by_review():
    d = doc(replace("Soil pH", "Soil pH                     68"))
    assert d["rows"]["ph"]["read"] == 68.0
    assert d["rows"]["ph"]["bucket"] == "review_wrong"


def test_ambiguous_unit_is_right_but_routed_to_a_human_and_scored_as_a_unit_miss():
    d = doc(replace("Available Nitrogen", "Available Nitrogen (N)      245 mg/kg"))
    row = d["rows"]["nitrogen"]
    assert row["value_ok"] is True and row["unit_read"] == "mg/kg" and row["unit_ok"] is False
    assert row["bucket"] == "review_right"
    s = ev.summarise([d])["by_report_type"]["digital_pdf"]
    assert s["unit_n"] == 4 and s["unit_ok"] == 3


def test_missing_value_counts_against_completeness_and_numeric_accuracy():
    d = doc(drop("Available Potassium"))
    assert d["rows"]["potassium"]["bucket"] == "missing" and d["rows"]["potassium"]["read"] is None
    s = ev.summarise([d])["by_report_type"]["digital_pdf"]
    assert (s["found"], s["value_ok"], s["n"]) == (4, 4, 5)


def test_a_unit_not_printed_beside_the_value_is_not_scored_as_a_unit_miss():
    truth = {**TRUTH, "phosphorus": {"value": 18.0, "unit": "kg/ha", "unit_stated": False}}
    d = ev.evaluate_document("t.pdf", text_layer_pdf_bytes(lines=replace("Available Phosphorus", "Available Phosphorus (P)    18")), truth, "digital_pdf")
    assert d["rows"]["phosphorus"]["unit_scored"] is False and d["rows"]["phosphorus"]["bucket"] == "review_right"


def test_a_confidently_wrong_read_is_counted_as_the_dangerous_case():
    wrong_truth = {**TRUTH, "nitrogen": {"value": 999.0, "unit": "kg/ha", "unit_stated": True}}  # the page says 245
    d = ev.evaluate_document("t.pdf", text_layer_pdf_bytes(), wrong_truth, "digital_pdf")
    assert d["rows"]["nitrogen"]["bucket"] == "AUTO_WRONG"
    assert "AUTO_WRONG=1" in ev.render("X", [d], ev.summarise([d]))


def test_scanned_and_digital_reports_are_summarised_separately():
    digital = ev.evaluate_document("d.pdf", text_layer_pdf_bytes(), TRUTH, "digital_pdf")
    scanned = ev.evaluate_document("s.pdf", scanned_pdf_bytes(), TRUTH, "scanned_pdf")
    summary = ev.summarise([digital, scanned])
    assert set(summary["by_report_type"]) == {"digital_pdf", "scanned_pdf"}
    assert summary["documents_per_report_type"] == {"digital_pdf": 1, "scanned_pdf": 1}
    for t in summary["by_report_type"].values():
        assert t["n"] == 5 and t["found"] == 5
    assert scanned["rows"]["nitrogen"]["bucket"] in ("auto_correct", "review_right")  # real Tesseract read it


def test_bound_readings_compare_as_strings():
    assert ev._equal(">5", ">5") and not ev._equal(">5", 5.0) and ev._equal(0.64, 0.64)
