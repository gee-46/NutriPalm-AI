"""
app/ocr/preprocess.py

Document loading and image preprocessing for the OCR pipeline.

Responsibilities:
- Detect PDF vs. image input.
- For PDFs: per page, decide whether the page has a usable embedded text
  layer (text-based PDF) or needs to be rasterized and OCR'd (scanned PDF).
  A single report can mix both (e.g. a cover page that's a scan of a
  letterhead, followed by text-layer pages), so the decision is per page,
  not per document.
- Render pages to PIL Images when OCR is required.
- Clean up an image so Tesseract performs better: upscale small scans,
  convert to grayscale, boost contrast, and binarize.

Deskewing is intentionally NOT implemented in V1 (see SKILL/README notes):
a robust deskew needs OpenCV's minAreaRect/Hough-transform machinery, which
is a heavy dependency for a CPU-only, easy-to-deploy V1. Reports that are
scanned noticeably crooked will get lower OCR confidence and should be
flagged for manual review rather than silently guessed at.
"""
from __future__ import annotations

import io
import logging
from dataclasses import dataclass

from PIL import Image, ImageOps

logger = logging.getLogger("nutripalm.ocr.preprocess")

# A text layer with fewer than this many non-whitespace characters per page
# is treated as "no usable text layer" (e.g. a scanned page with only a
# stray watermark string embedded).
MIN_TEXT_LAYER_CHARS = 40

# Scans below this width get upscaled before OCR; small/low-DPI scans are
# the single biggest cause of poor Tesseract accuracy.
MIN_OCR_WIDTH_PX = 1800

PDF_RENDER_DPI = 300


@dataclass
class LoadedPage:
    page_number: int  # 1-indexed
    text_layer: str | None  # None if no usable embedded text
    image: "Image.Image | None"  # only populated when OCR is required


def is_pdf(filename: str, content: bytes) -> bool:
    if filename.lower().endswith(".pdf"):
        return True
    return content[:5] == b"%PDF-"


def load_document(filename: str, content: bytes) -> list[LoadedPage]:
    """
    Load an uploaded soil report (PDF or image) into per-page LoadedPage
    entries, deciding the text-layer-vs-OCR route for each page.
    """
    if is_pdf(filename, content):
        return _load_pdf(content)
    return _load_image(content)


def _load_pdf(content: bytes) -> list[LoadedPage]:
    import pdfplumber

    pages: list[LoadedPage] = []
    text_layers: dict[int, str] = {}
    page_count = 0

    with pdfplumber.open(io.BytesIO(content)) as pdf:
        page_count = len(pdf.pages)
        for i, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            text_layers[i] = text

    needs_ocr = {
        i: len(text.strip()) < MIN_TEXT_LAYER_CHARS
        for i, text in text_layers.items()
    }

    images_by_page: dict[int, Image.Image] = {}
    if any(needs_ocr.values()):
        images_by_page = _render_pdf_pages(
            content, [i for i, need in needs_ocr.items() if need]
        )

    for i in range(1, page_count + 1):
        if needs_ocr[i]:
            pages.append(
                LoadedPage(
                    page_number=i,
                    text_layer=None,
                    image=images_by_page.get(i),
                )
            )
        else:
            pages.append(
                LoadedPage(
                    page_number=i,
                    text_layer=text_layers[i],
                    image=None,
                )
            )

    return pages


def _render_pdf_pages(
    content: bytes, page_numbers: list[int]
) -> dict[int, Image.Image]:
    """Rasterize only the pages that actually need OCR, at print-quality DPI."""
    if not page_numbers:
        return {}

    try:
        from pdf2image import convert_from_bytes

        first = min(page_numbers)
        last = max(page_numbers)
        rendered = convert_from_bytes(
            content,
            dpi=PDF_RENDER_DPI,
            first_page=first,
            last_page=last,
        )
        offset = first
        wanted = set(page_numbers)
        return {
            offset + idx: img
            for idx, img in enumerate(rendered)
            if (offset + idx) in wanted
        }
    except Exception:
        logger.exception("PDF rasterization via pdf2image/poppler failed")
        return {}


def _load_image(content: bytes) -> list[LoadedPage]:
    image = Image.open(io.BytesIO(content))
    image.load()
    return [LoadedPage(page_number=1, text_layer=None, image=image)]


def clean_for_ocr(image: Image.Image) -> Image.Image:
    """Grayscale, upscale small scans, boost contrast, and binarize."""
    img = image.convert("L")  # grayscale

    if img.width < MIN_OCR_WIDTH_PX:
        scale = MIN_OCR_WIDTH_PX / max(img.width, 1)
        new_size = (int(img.width * scale), int(img.height * scale))
        img = img.resize(new_size, Image.LANCZOS)

    img = ImageOps.autocontrast(img, cutoff=1)

    # Simple global threshold binarization. Adequate for typical printed
    # lab-report scans; documented as a known limitation for reports with
    # heavy shadows or uneven lighting (see SKILL/README "Known
    # limitations" -- those need adaptive thresholding, left for V2).
    threshold = 180
    img = img.point(lambda p: 255 if p > threshold else 0)

    return img
