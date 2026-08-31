"""
app/ocr/engine.py

Thin wrapper around the chosen OCR engine: Tesseract OCR (via pytesseract).

Why Tesseract for V1
---------------------
- Free, Apache-2.0 licensed, no API keys / no per-page cost / no network
  dependency at inference time (important: soil data can be sensitive
  farmer/agri data -- V1 should not require shipping report images to a
  third-party cloud OCR API).
- Runs entirely on CPU; no GPU requirement, which matches "practical on a
  normal developer machine" and typical low-cost deployment targets.
- Mature Python bindings (pytesseract), already used across the existing
  Python OCR ecosystem alongside pdfplumber/pdf2image, which are already
  present in this environment.
- Good accuracy on clean, printed, reasonably high-DPI scans, which is the
  dominant case for printed Indian agricultural soil-testing lab reports
  (SHC-style and private-lab reports are typically printed, not
  handwritten).

Alternatives considered
------------------------
- Cloud OCR (Google Vision, AWS Textract, Azure Document Intelligence):
  better accuracy on messy scans and native table structure extraction,
  but requires API keys, per-page billing, and sending farmer soil data to
  a third party -- not appropriate as the V1 default. Could be added later
  as an optional, explicitly-opt-in engine behind the same OcrEngine
  interface.
- EasyOCR / PaddleOCR (deep-learning OCR): better on natural-scene/curved
  text, but noticeably heavier (large model downloads, slower CPU
  inference) for a gain that mostly doesn't matter on printed lab-report
  scans. Worth revisiting if real-world reports turn out to be low-quality
  phone photos rather than scans.
- Training a custom OCR model from scratch: no repository evidence of a
  labeled training set for this; would be a multi-month effort for V1.
  Not justified.

Limitations
------------
- Handwritten values are unreliable with Tesseract; such reports should be
  flagged for manual entry.
- Rotated/skewed scans reduce accuracy (see preprocess.py -- deskew is not
  implemented in V1).
- Dense multi-column tables can have their reading order scrambled;
  extractor.py is written to be tolerant of this (it searches line-by-line
  and does not assume strict left-to-right column order), but very complex
  table layouts may still need manual review.

Installation requirements
---------------------------
- System package: `tesseract-ocr` (Debian/Ubuntu: `apt-get install
  tesseract-ocr`). Already present in this environment.
- System package: `poppler-utils` (for pdf2image's `pdftoppm`), used to
  rasterize scanned PDF pages. Already present in this environment.
- Python packages (see requirements.txt): pytesseract, pdf2image,
  pdfplumber, Pillow.
"""
from __future__ import annotations

import logging

from PIL import Image

logger = logging.getLogger("nutripalm.ocr.engine")

# Soil reports are printed documents with numbers, units, and Latin-script
# labels -- English is the right default. Extend this if reports arrive in
# other scripts (e.g. Hindi report headers).
TESSERACT_LANG = "eng"

# Tesseract page segmentation mode 6 = "assume a single uniform block of
# text", which works well for lab-report body text/tables. PSM 4 (single
# column of variable-sized text) is used as a fallback for sparse pages.
TESSERACT_CONFIG = "--oem 3 --psm 6"


class OcrEngineUnavailable(RuntimeError):
    """Raised when the Tesseract binary / pytesseract cannot run at all."""


class OcrEngine:
    """Runs Tesseract OCR on a preprocessed page image."""

    def __init__(self, lang: str = TESSERACT_LANG):
        self.lang = lang

    def run(self, image: Image.Image) -> tuple[str, float | None]:
        """
        Run OCR on a single page image.

        Returns (text, mean_confidence) where mean_confidence is the average
        Tesseract word-level confidence (0-1), or None if it could not be
        computed.
        """
        try:
            import pytesseract
        except ImportError as exc:
            raise OcrEngineUnavailable(
                "pytesseract is not installed. Add it to requirements.txt "
                "and install the tesseract-ocr system package."
            ) from exc

        try:
            text = pytesseract.image_to_string(
                image, lang=self.lang, config=TESSERACT_CONFIG
            )
        except pytesseract.TesseractNotFoundError as exc:
            raise OcrEngineUnavailable(
                "The tesseract binary was not found on PATH. Install the "
                "tesseract-ocr system package."
            ) from exc

        mean_conf = self._mean_confidence(image)
        return text, mean_conf

    def _mean_confidence(self, image: Image.Image) -> float | None:
        try:
            import pytesseract

            data = pytesseract.image_to_data(
                image,
                lang=self.lang,
                config=TESSERACT_CONFIG,
                output_type=pytesseract.Output.DICT,
            )
        except Exception:
            logger.warning(
                "Could not compute Tesseract word confidences", exc_info=True
            )
            return None

        confidences = [
            int(c) for c in data.get("conf", []) if str(c).strip() not in ("", "-1")
        ]
        if not confidences:
            return None
        return round(sum(confidences) / len(confidences) / 100.0, 4)
