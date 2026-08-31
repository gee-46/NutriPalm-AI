"""
app/ocr/pipeline.py

Orchestrates the full OCR + extraction + validation pipeline for one
uploaded soil report file, producing an OcrExtractionResult.

This is the single function the API router should call.
"""
from __future__ import annotations

import logging

from app.ocr import extractor, validator
from app.ocr.engine import OcrEngine, OcrEngineUnavailable
from app.ocr.preprocess import LoadedPage, clean_for_ocr, load_document
from app.ocr.schemas import (
    CANONICAL_PARAMETERS,
    ExtractedField,
    MICRONUTRIENT_PARAMETERS,
    OcrExtractionResult,
    PageResult,
    SoilParametersOut,
)

logger = logging.getLogger("nutripalm.ocr.pipeline")

REQUIRED_FOR_PERSISTENCE = (
    "nitrogen",
    "phosphorus",
    "potassium",
    "ph",
    "organic_carbon",
)


def run_pipeline(
    filename: str,
    content: bytes,
    engine: OcrEngine | None = None,
) -> OcrExtractionResult:
    engine = engine or OcrEngine()
    errors: list[str] = []

    try:
        pages: list[LoadedPage] = load_document(filename, content)
    except Exception as exc:  # malformed upload, unsupported format, etc.
        logger.exception("Failed to load uploaded document")
        empty = _empty_parameters()
        return OcrExtractionResult(
            success=False,
            raw_text="",
            pages=[],
            soil_parameters=empty,
            ready_for_persistence=False,
            errors=[f"Could not read the uploaded file: {exc}"],
        )

    page_results: list[PageResult] = []
    full_text_parts: list[str] = []

    for page in pages:
        if page.text_layer is not None:
            page_results.append(
                PageResult(
                    page_number=page.page_number,
                    route="text_layer",
                    text=page.text_layer,
                )
            )
            full_text_parts.append(page.text_layer)
            continue

        if page.image is None:
            errors.append(
                f"Page {page.page_number} has no text layer and could not "
                "be rasterized for OCR."
            )
            continue

        try:
            cleaned = clean_for_ocr(page.image)
            text, mean_conf = engine.run(cleaned)
        except OcrEngineUnavailable as exc:
            errors.append(str(exc))
            continue
        except Exception:
            logger.exception("OCR failed on page %s", page.page_number)
            errors.append(f"OCR failed on page {page.page_number}.")
            continue

        page_results.append(
            PageResult(
                page_number=page.page_number,
                route="ocr_image",
                text=text,
                ocr_mean_confidence=mean_conf,
            )
        )
        full_text_parts.append(text)

    raw_text = "\n".join(full_text_parts)

    if not raw_text.strip():
        empty = _empty_parameters()
        return OcrExtractionResult(
            success=False,
            raw_text="",
            pages=page_results,
            soil_parameters=empty,
            ready_for_persistence=False,
            errors=errors or ["No text could be extracted from the document."],
        )

    extracted = extractor.extract(raw_text)

    # Fold in the OCR page confidence: if a parameter's best match came
    # from a low-confidence OCR page, discount it accordingly rather than
    # trusting the label-match confidence alone.
    page_conf_by_route_present = any(
        p.route == "ocr_image" and p.ocr_mean_confidence is not None
        for p in page_results
    )
    if page_conf_by_route_present:
        avg_ocr_conf = _average_ocr_confidence(page_results)
        if avg_ocr_conf is not None:
            for field_obj in extracted.values():
                if field_obj.value is not None:
                    field_obj.confidence = round(
                        field_obj.confidence * (0.5 + 0.5 * avg_ocr_conf), 4
                    )

    validated = validator.validate(extracted)

    soil_parameters = SoilParametersOut(
        nitrogen=validated["nitrogen"],
        phosphorus=validated["phosphorus"],
        potassium=validated["potassium"],
        ph=validated["ph"],
        electrical_conductivity=validated["electrical_conductivity"],
        organic_carbon=validated["organic_carbon"],
        extras=[
            validated[k]
            for k in ("phosphorus_pentoxide", "potassium_oxide")
            if validated[k].value is not None
        ],
        micronutrients=[validated[k] for k in MICRONUTRIENT_PARAMETERS],
    )

    ready = all(
        getattr(soil_parameters, key).validation == "valid"
        and getattr(soil_parameters, key).unit
        in (validator.TARGET_UNIT[key], None)
        for key in REQUIRED_FOR_PERSISTENCE
    )

    return OcrExtractionResult(
        success=True,
        raw_text=raw_text,
        pages=page_results,
        soil_parameters=soil_parameters,
        ready_for_persistence=ready,
        errors=errors,
    )


def _average_ocr_confidence(page_results: list[PageResult]) -> float | None:
    confidences = [
        p.ocr_mean_confidence
        for p in page_results
        if p.route == "ocr_image" and p.ocr_mean_confidence is not None
    ]
    if not confidences:
        return None
    return sum(confidences) / len(confidences)


def _empty_parameters() -> SoilParametersOut:
    def missing(key: str) -> ExtractedField:
        return ExtractedField(parameter=key, value=None, validation="missing")

    return SoilParametersOut(
        nitrogen=missing("nitrogen"),
        phosphorus=missing("phosphorus"),
        potassium=missing("potassium"),
        ph=missing("ph"),
        electrical_conductivity=missing("electrical_conductivity"),
        organic_carbon=missing("organic_carbon"),
        extras=[],
        micronutrients=[missing(k) for k in MICRONUTRIENT_PARAMETERS],
    )
