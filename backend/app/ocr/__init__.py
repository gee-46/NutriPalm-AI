"""
app.ocr

Soil-report OCR + structured-extraction pipeline (Team Member 3 module).

This package turns an uploaded lab report (PDF or image) into the
structured, numeric soil-test values the AI/Recommendation backend already
knows how to consume (see backend/docs/integration_contract.md and
app/repositories/soil_report_repository.py).

Pipeline:
    preprocess.load_document()  -> per-page raw text (+ which route was used)
    engine.OcrEngine.run()      -> raw OCR text for image-based pages
    extractor.extract()         -> ExtractedField per recognized parameter
    validator.validate()        -> confidence/range checks, review flags

Nothing in this package ever fabricates a value. Anything that cannot be
confidently extracted is returned as `value=None` with an explanatory
warning, never a guess.
"""
from __future__ import annotations

from app.ocr.schemas import (
    ExtractedField,
    OcrExtractionResult,
    SoilParametersOut,
)

__all__ = [
    "ExtractedField",
    "OcrExtractionResult",
    "SoilParametersOut",
]
