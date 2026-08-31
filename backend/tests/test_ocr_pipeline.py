"""Tests for app.ocr.preprocess and app.ocr.pipeline using real generated
PDFs/images (not just hand-written strings) so the pdfplumber / pdf2image /
Tesseract code paths are actually exercised."""
from __future__ import annotations

from app.ocr.pipeline import run_pipeline
from app.ocr.preprocess import is_pdf, load_document
from tests.fixtures.soil_report_files import (
    SAMPLE_VALUES,
    multi_page_pdf_bytes,
    scanned_pdf_bytes,
    scanned_png_bytes,
    text_layer_pdf_bytes,
)


def test_is_pdf_detects_by_extension_and_magic_bytes():
    assert is_pdf("report.pdf", b"whatever")
    assert is_pdf("report.PDF", b"whatever")
    assert is_pdf("upload", b"%PDF-1.4 ...")
    assert not is_pdf("report.png", b"\x89PNG...")


def test_text_layer_pdf_routes_without_ocr():
    pages = load_document("report.pdf", text_layer_pdf_bytes())
    assert len(pages) == 1
    assert pages[0].text_layer is not None
    assert "Available Nitrogen" in pages[0].text_layer
    assert pages[0].image is None


def test_scanned_pdf_routes_to_image_for_ocr():
    pages = load_document("scan.pdf", scanned_pdf_bytes())
    assert len(pages) == 1
    assert pages[0].text_layer is None
    assert pages[0].image is not None


def test_image_upload_routes_to_ocr():
    pages = load_document("scan.png", scanned_png_bytes())
    assert len(pages) == 1
    assert pages[0].text_layer is None
    assert pages[0].image is not None


def _assert_all_values_match(result):
    for key, expected in SAMPLE_VALUES.items():
        field = getattr(result.soil_parameters, key)
        assert field.value == expected, f"{key}: got {field.value}, want {expected}"
        assert field.validation == "valid"


def test_pipeline_end_to_end_text_layer_pdf():
    result = run_pipeline("report.pdf", text_layer_pdf_bytes())

    assert result.success is True
    assert result.pages[0].route == "text_layer"
    assert result.ready_for_persistence is True
    _assert_all_values_match(result)


def test_pipeline_end_to_end_scanned_pdf_real_ocr():
    result = run_pipeline("scan.pdf", scanned_pdf_bytes())

    assert result.success is True
    assert result.pages[0].route == "ocr_image"
    assert result.pages[0].ocr_mean_confidence is not None
    assert result.ready_for_persistence is True
    _assert_all_values_match(result)


def test_pipeline_multi_page_mixed_routes():
    result = run_pipeline("multi.pdf", multi_page_pdf_bytes())

    assert result.success is True
    routes = [p.route for p in result.pages]
    assert routes == ["text_layer", "ocr_image"]
    assert result.ready_for_persistence is True
    _assert_all_values_match(result)


def test_pipeline_on_empty_content_fails_gracefully():
    result = run_pipeline("empty.pdf", b"")
    assert result.success is False
    assert result.ready_for_persistence is False
    assert result.errors


def test_pipeline_never_returns_success_with_no_text():
    # Garbage bytes that are neither a real PDF nor an image.
    result = run_pipeline("garbage.pdf", b"not a real file at all")
    assert result.success is False
    assert result.ready_for_persistence is False


def test_pipeline_hegde_report():
    import os
    fixture_path = os.path.join(os.path.dirname(__file__), "fixtures", "P_P_Hegde_Rayee.pdf")
    assert os.path.exists(fixture_path), f"Fixture not found at {fixture_path}"
    
    with open(fixture_path, "rb") as f:
        content = f.read()
        
    result = run_pipeline("P_P_Hegde_Rayee.pdf", content)
    
    assert result.success is True
    assert result.ready_for_persistence is True
    
    # Assert exact target values:
    assert result.soil_parameters.nitrogen.value == 211.0
    assert result.soil_parameters.phosphorus.value == 23.46
    assert result.soil_parameters.potassium.value == 319.0
    assert result.soil_parameters.ph.value == 5.81
    assert result.soil_parameters.electrical_conductivity.value == 0.08
    assert result.soil_parameters.organic_carbon.value == 0.64
    
    # Micronutrients assertions:
    zn = next((m for m in result.soil_parameters.micronutrients if m.parameter == "zinc"), None)
    assert zn is not None
    assert zn.value == 0.73
    
    s = next((m for m in result.soil_parameters.micronutrients if m.parameter == "sulfur"), None)
    assert s is not None
    assert s.value == 28.13
    
    b = next((m for m in result.soil_parameters.micronutrients if m.parameter == "boron"), None)
    assert b is not None
    assert b.value == 0.49
    
    fe = next((m for m in result.soil_parameters.micronutrients if m.parameter == "iron"), None)
    assert fe is not None
    assert fe.value == ">5"
    
    mn = next((m for m in result.soil_parameters.micronutrients if m.parameter == "manganese"), None)
    assert mn is not None
    assert mn.value == 3.25
    
    cu = next((m for m in result.soil_parameters.micronutrients if m.parameter == "copper"), None)
    assert cu is not None
    assert cu.value == 0.40

