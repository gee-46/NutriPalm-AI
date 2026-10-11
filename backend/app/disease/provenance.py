"""
provenance.py

Quote normalisation and page-text extraction used to prove that every piece of
disease evidence really appears in the source document it cites.

Verification is deliberately mechanical: an evidence quote is "verified" only if,
after normalisation, it is a substring of the text extracted from the cited page of
the downloaded source. Nothing here judges whether the claim is agronomically right;
that is the job of expert review (see docs/DISEASE_INTELLIGENCE.md).
"""
from __future__ import annotations

import hashlib
import re
import unicodedata
from typing import Iterable

_DASHES = dict.fromkeys(map(ord, "‐‑‒–—−"), "-")
_QUOTES = {ord("‘"): "'", ord("’"): "'", ord("“"): '"', ord("”"): '"'}


def normalise(text: str) -> str:
    """Case-fold and flatten layout noise (hyphenated line breaks, dashes, quotes, whitespace)."""
    text = unicodedata.normalize("NFKC", text)
    text = text.replace("­", "")
    text = re.sub(r"(\w)-\s*\n\s*(\w)", r"\1\2", text)  # "pre-\nmonsoon" -> "premonsoon"
    text = text.translate(_DASHES).translate(_QUOTES)
    text = re.sub(r"\s+", " ", text).strip().lower()
    return text


def squash(text: str) -> str:
    """Normalise, then drop every character that is not a letter or digit.

    Used as a second, more tolerant comparison so that column breaks and PDF spacing
    quirks ("w ill", "spray-\\ning") do not cause false negatives. Quotes still have to be
    long enough (see MIN_QUOTE_CHARS) that a squashed match is meaningful.
    """
    return re.sub(r"[^0-9a-z]+", "", normalise(text))


MIN_QUOTE_CHARS = 25


def quote_in_text(quote: str, page_texts: Iterable[str]) -> bool:
    """True if `quote` is found in any of the given text variants of one page."""
    if len(quote.strip()) < MIN_QUOTE_CHARS:
        return False
    nq, sq = normalise(quote), squash(quote)
    for text in page_texts:
        if nq in normalise(text) or (len(sq) >= MIN_QUOTE_CHARS and sq in squash(text)):
            return True
    return False


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def pdf_page_variants(pdf_bytes: bytes) -> list[list[str]]:
    """Per page, two extractions: plain reading order and gutter-aware two-column order."""
    import io

    import pdfplumber

    pages: list[list[str]] = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            variants = [page.extract_text() or ""]
            words = page.extract_words()
            width, height = page.width, page.height
            gutter, best = width / 2, None
            for i in range(100):
                x = width * (0.40 + 0.002 * i)
                crossing = sum(1 for w in words if w["x0"] < x < w["x1"])
                if best is None or crossing < best:
                    best, gutter = crossing, x
            left = page.crop((0, 0, gutter, height)).extract_text() or ""
            right = page.crop((gutter, 0, width, height)).extract_text() or ""
            variants.append(left + "\n" + right)
            pages.append(variants)
    return pages


def html_page_variants(html: bytes) -> list[list[str]]:
    """A web page is treated as a single 'page 1'."""
    from html import unescape

    text = html.decode("utf-8", errors="replace")
    text = re.sub(r"(?is)<(script|style).*?</\1>", " ", text)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    return [[unescape(text)]]
