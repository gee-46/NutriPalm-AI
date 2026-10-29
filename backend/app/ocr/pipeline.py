"""
app/ocr/pipeline.py

The single entry point that turns one uploaded soil-report file into a
structured, validated OcrExtractionResult:

    bytes -> load pages -> (text layer | OCR) per page -> parse -> validate -> status

Outcome (`OcrExtractionResult.status`):

    failed        nothing usable was read; the caller must persist nothing
    needs_review  text was read but a human has to confirm/correct values
    completed     every required value is valid, stated with its unit, unrepaired

The pipeline never persists anything and never invents a value. Persistence,
review and the hand-off to the recommendation engine live in
app/services/soil_extraction_service.py.
"""
from __future__ import annotations

import hashlib
import logging
import time

from app.config import get_settings
from app.ocr import extractor, validator
from app.ocr.engine import OcrEngine, OcrEngineUnavailable, OcrTimeout
from app.ocr.preprocess import DocumentRejected, LoadedPage, clean_for_ocr, load_document
from app.ocr.schemas import (
    MICRONUTRIENT_PARAMETERS,
    ExtractedField,
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


def sha256_hex(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def run_pipeline(
    filename: str,
    content: bytes,
    engine: OcrEngine | None = None,
) -> OcrExtractionResult:
    settings = get_settings()
    engine = engine or OcrEngine()
    digest = sha256_hex(content)
    errors: list[str] = []
    started = time.monotonic()

    try:
        pages: list[LoadedPage] = load_document(
            filename, content, max_pages=settings.ocr_max_pages
        )
    except DocumentRejected as exc:
        return _failed(digest, [str(exc)])

    page_results: list[PageResult] = []

    for page in pages:
        if time.monotonic() - started > settings.ocr_total_timeout_seconds:
            # A partial read of a multi-page report could silently drop the page
            # that holds a value, so a timeout fails the whole document.
            return _failed(
                digest,
                [
                    f"Processing exceeded the {settings.ocr_total_timeout_seconds}s limit "
                    f"before page {page.page_number}. Try a smaller or clearer file."
                ],
                pages=page_results,
                page_count=len(pages),
            )

        if page.text_layer is not None:
            page_results.append(
                PageResult(page_number=page.page_number, route="text_layer", text=page.text_layer)
            )
            continue

        if page.image is None:
            errors.append(
                f"Page {page.page_number} has no text layer and could not "
                "be rasterized for OCR."
            )
            continue

        try:
            cleaned = clean_for_ocr(page.image)
            text, mean_conf = engine.run(
                cleaned, timeout_seconds=settings.ocr_page_timeout_seconds
            )
        except OcrEngineUnavailable as exc:
            errors.append(str(exc))
            continue
        except OcrTimeout as exc:
            return _failed(digest, [f"Page {page.page_number}: {exc}"], pages=page_results, page_count=len(pages))
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

    raw_text = "\n".join(p.text for p in page_results)

    # A page we could not read means values on it may be missing from the
    # result; surface that rather than presenting a partial read as complete.
    if not raw_text.strip():
        return _failed(
            digest,
            errors or ["No text could be extracted from the document."],
            pages=page_results,
            page_count=len(pages),
        )

    extracted = extractor.extract_pages([(p.page_number, p.text) for p in page_results])

    # Fold in the OCR page confidence: a value read from a low-confidence OCR
    # page is discounted rather than trusting the label-match confidence alone.
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
        and getattr(soil_parameters, key).unit in (validator.TARGET_UNIT[key], None)
        for key in REQUIRED_FOR_PERSISTENCE
    )
    # An unreadable page means the read may be incomplete: always a human decision.
    if errors:
        ready = False

    logger.info(
        "ocr.pipeline.done",
        extra={
            "sha256": digest[:12],
            "pages": len(pages),
            "routes": ",".join(sorted({p.route for p in page_results})),
            "ready": ready,
            "elapsed_s": round(time.monotonic() - started, 2),
        },
    )

    return OcrExtractionResult(
        success=True,
        raw_text=raw_text,
        pages=page_results,
        soil_parameters=soil_parameters,
        status="completed" if ready else "needs_review",
        document_sha256=digest,
        page_count=len(pages),
        ready_for_persistence=ready,
        errors=errors,
    )


def _failed(
    digest: str,
    errors: list[str],
    *,
    pages: list[PageResult] | None = None,
    page_count: int = 0,
) -> OcrExtractionResult:
    return OcrExtractionResult(
        success=False,
        raw_text="",
        pages=pages or [],
        soil_parameters=_empty_parameters(),
        status="failed",
        document_sha256=digest,
        page_count=page_count,
        ready_for_persistence=False,
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
