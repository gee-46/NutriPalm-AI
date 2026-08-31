"""
app/ocr/extractor.py

Context-aware extraction of soil parameters from OCR/text-layer output.

This module never scans for "any number in the text". It only accepts a
number that immediately follows a recognized agronomic label on the same
line (optionally through a separator like ':', '-', or whitespace/table
gaps). "Sample ID: 245" is never extracted as a nitrogen value because
"Sample ID" is not one of the recognized labels for any parameter.

Each canonical parameter has label patterns ordered from most specific/
least ambiguous to most generic/most ambiguous. More specific matches are
preferred and given higher base confidence. Bare single-letter labels
("N", "P", "K") are the most ambiguous and are only accepted when followed
directly by a number and, ideally, a recognized unit -- and are always
capped at a lower confidence so validator.py routes them to "review".
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.ocr.schemas import (
    CANONICAL_PARAMETERS,
    EXTRA_PARAMETERS,
    MICRONUTRIENT_PARAMETERS,
    ExtractedField,
)

# ---------------------------------------------------------------------------
# Number parsing
# ---------------------------------------------------------------------------

# A number token: optional sign, digits with optional thousands commas,
# optional decimal part. We deliberately do NOT allow a bare '.' or ','
# alone to match.
_NUMBER_RE = r"(?:[<>]=?|=)?\s*[+-]?\d[\d,]*(?:\.\d+)?"

# Common OCR letter/digit confusions, applied only as a *fallback* when the
# raw token fails to parse as a float -- never applied blindly, since 'O'
# and 'I' are also legitimate letters that might appear misattached to a
# number due to spacing artifacts.
_OCR_DIGIT_FIXES = {"O": "0", "o": "0", "I": "1", "l": "1", "S": "5"}


def parse_number(raw: str) -> float | str | None:
    """Parse a numeric token, tolerating thousands commas and common OCR
    digit confusions. Returns None if it still can't be parsed.
    Preserves inequalities like > or < as normalized strings."""
    candidate = raw.strip()

    # Extract inequality prefix
    ineq_match = re.match(r"^([<>]=?|=)?\s*(.*)$", candidate)
    prefix = ""
    num_part = candidate
    if ineq_match:
        prefix = ineq_match.group(1) or ""
        num_part = ineq_match.group(2)

    cleaned = num_part.replace(",", "")
    try:
        val = float(cleaned)
        if prefix:
            if val.is_integer():
                return f"{prefix}{int(val)}"
            return f"{prefix}{val}"
        return val
    except ValueError:
        pass

    fixed = "".join(_OCR_DIGIT_FIXES.get(ch, ch) for ch in cleaned)
    try:
        val = float(fixed)
        if prefix:
            if val.is_integer():
                return f"{prefix}{int(val)}"
            return f"{prefix}{val}"
        return val
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Unit recognition
# ---------------------------------------------------------------------------

_UNIT_ALIASES: dict[str, str] = {
    "kg/ha": "kg/ha",
    "kgha": "kg/ha",
    "kg / ha": "kg/ha",
    "mg/kg": "mg/kg",
    "ppm": "ppm",
    "%": "%",
    "percent": "%",
    "ds/m": "dS/m",
    "ds m-1": "dS/m",
    "ms/cm": "mS/cm",  # numerically == dS/m
    "us/cm": "uS/cm",
    "µs/cm": "uS/cm",
}

_UNIT_PATTERN = re.compile(
    r"(kg\s*/\s*ha|mg\s*/\s*kg|ppm|%|percent|d?s\s*/\s*m|d?s\s*m-1|[mµu]s\s*/\s*cm)",
    re.IGNORECASE,
)


def _normalize_unit(raw: str | None) -> str | None:
    if not raw:
        return None
    key = re.sub(r"\s+", "", raw.strip().lower())
    key = key.replace("µ", "u")
    for alias_key, normalized in _UNIT_ALIASES.items():
        if re.sub(r"\s+", "", alias_key.lower()).replace("µ", "u") == key:
            return normalized
    return raw.strip()


# ---------------------------------------------------------------------------
# Label definitions
# ---------------------------------------------------------------------------


@dataclass
class LabelPattern:
    regex: re.Pattern
    base_confidence: float
    default_unit: str | None = None


@dataclass
class ParameterSpec:
    key: str
    patterns: list[LabelPattern] = field(default_factory=list)


def _rx(pattern: str) -> re.Pattern:
    return re.compile(pattern, re.IGNORECASE)


_SUFFIX = r"(?:\s*\([a-zA-Z0-9=+]{1,2}\)|\s+[a-zA-Z]{1,2}\b)?"

PARAMETER_SPECS: dict[str, ParameterSpec] = {
    "nitrogen": ParameterSpec(
        "nitrogen",
        [
            LabelPattern(_rx(r"available\s+nitrogen" + _SUFFIX), 0.95, "kg/ha"),
            LabelPattern(_rx(r"available\s+n\b"), 0.9, "kg/ha"),
            LabelPattern(_rx(r"\bnitrogen" + _SUFFIX), 0.85, "kg/ha"),
            LabelPattern(_rx(r"\bn\b(?!\s*[-:]?\s*ph)"), 0.55, "kg/ha"),
        ],
    ),
    "phosphorus": ParameterSpec(
        "phosphorus",
        [
            LabelPattern(_rx(r"available\s+phosphorus" + _SUFFIX), 0.95, "kg/ha"),
            LabelPattern(_rx(r"available\s+p\b(?!\s*2\s*o\s*5)"), 0.9, "kg/ha"),
            LabelPattern(_rx(r"\bphosphorus" + _SUFFIX + r"(?!\s*2\s*o\s*5)"), 0.85, "kg/ha"),
            LabelPattern(_rx(r"\bp\b(?!\s*2\s*o\s*5)(?!h\b)"), 0.5, "kg/ha"),
        ],
    ),
    "potassium": ParameterSpec(
        "potassium",
        [
            LabelPattern(_rx(r"available\s+potassium" + _SUFFIX), 0.95, "kg/ha"),
            LabelPattern(_rx(r"available\s+k\b(?!\s*2\s*o)"), 0.9, "kg/ha"),
            LabelPattern(_rx(r"\bpotassium" + _SUFFIX + r"(?!\s*2\s*o)"), 0.85, "kg/ha"),
            LabelPattern(_rx(r"\bk\b(?!\s*2\s*o)"), 0.5, "kg/ha"),
        ],
    ),
    "ph": ParameterSpec(
        "ph",
        [
            LabelPattern(_rx(r"\b(?<!derived\sfrom\s)soil\s+ph\b"), 0.95, None),
            LabelPattern(_rx(r"\bph\s*\(?\s*1\s*:\s*2\.?5?\s*\)?"), 0.9, None),
            LabelPattern(_rx(r"\bph\s*value\b"), 0.9, None),
            LabelPattern(_rx(r"\bph\b"), 0.85, None),
        ],
    ),
    "electrical_conductivity": ParameterSpec(
        "electrical_conductivity",
        [
            LabelPattern(_rx(r"electrical\s+conductivity" + _SUFFIX), 0.95, "dS/m"),
            LabelPattern(_rx(r"\be\.?c\.?\b"), 0.85, "dS/m"),
        ],
    ),
    "organic_carbon": ParameterSpec(
        "organic_carbon",
        [
            LabelPattern(_rx(r"organic\s+carbon" + _SUFFIX), 0.95, "%"),
            LabelPattern(_rx(r"\bo\.?c\.?\b"), 0.85, "%"),
        ],
    ),
    "phosphorus_pentoxide": ParameterSpec(
        "phosphorus_pentoxide",
        [LabelPattern(_rx(r"p\s*2\s*o\s*5"), 0.9, "kg/ha")],
    ),
    "potassium_oxide": ParameterSpec(
        "potassium_oxide",
        [LabelPattern(_rx(r"k\s*2\s*o"), 0.9, "kg/ha")],
    ),
    # --- Micronutrients ---
    "zinc": ParameterSpec(
        "zinc",
        [
            LabelPattern(_rx(r"available\s+zinc" + _SUFFIX), 0.95, "mg/kg"),
            LabelPattern(_rx(r"\bzinc" + _SUFFIX), 0.9, "mg/kg"),
            LabelPattern(_rx(r"\bzn\b"), 0.75, "mg/kg"),
        ],
    ),
    "iron": ParameterSpec(
        "iron",
        [
            LabelPattern(_rx(r"available\s+iron" + _SUFFIX), 0.95, "mg/kg"),
            LabelPattern(_rx(r"\biron" + _SUFFIX), 0.9, "mg/kg"),
            LabelPattern(_rx(r"\bfe\b"), 0.75, "mg/kg"),
        ],
    ),
    "manganese": ParameterSpec(
        "manganese",
        [
            LabelPattern(_rx(r"available\s+manganese" + _SUFFIX), 0.95, "mg/kg"),
            LabelPattern(_rx(r"\bmanganese" + _SUFFIX), 0.9, "mg/kg"),
            LabelPattern(_rx(r"\bmn\b"), 0.75, "mg/kg"),
        ],
    ),
    "copper": ParameterSpec(
        "copper",
        [
            LabelPattern(_rx(r"available\s+copper" + _SUFFIX), 0.95, "mg/kg"),
            LabelPattern(_rx(r"\bcopper" + _SUFFIX), 0.9, "mg/kg"),
            LabelPattern(_rx(r"\bcu\b"), 0.75, "mg/kg"),
        ],
    ),
    "boron": ParameterSpec(
        "boron",
        [
            LabelPattern(_rx(r"available\s+boron" + _SUFFIX), 0.95, "mg/kg"),
            LabelPattern(_rx(r"\bboron" + _SUFFIX), 0.9, "mg/kg"),
            # Bare "B" is highly ambiguous (single letter); only accepted
            # at low confidence, and never when it's actually the "(B)"
            # suffix of another element's label (handled by the more
            # specific patterns above matching first).
            LabelPattern(_rx(r"\bb\b(?!\s*[.:]?\s*ha)"), 0.45, "mg/kg"),
        ],
    ),
    "sulfur": ParameterSpec(
        "sulfur",
        [
            LabelPattern(_rx(r"available\s+sulphur" + _SUFFIX), 0.95, "mg/kg"),
            LabelPattern(_rx(r"available\s+sulfur" + _SUFFIX), 0.95, "mg/kg"),
            LabelPattern(_rx(r"\bsulphur" + _SUFFIX), 0.9, "mg/kg"),
            LabelPattern(_rx(r"\bsulfur" + _SUFFIX), 0.9, "mg/kg"),
            # Bare "S" is extremely ambiguous; only matched as an isolated
            # token immediately followed by a number, at low confidence,
            # so it's always routed to manual review rather than trusted.
            LabelPattern(_rx(r"\bs\b"), 0.4, "mg/kg"),
        ],
    ),
}

_SEPARATOR = r"[\s:\-=\|/\(\)\[\]]{0,30}"


def _find_value_after_label(line: str, label_match: re.Match) -> tuple[str, str | None] | None:
    """Given a label match on a line, find the number (and optional unit)
    that immediately follows it, tolerating typical separators/table gaps."""
    tail = line[label_match.end():]

    m = re.match(rf"{_SEPARATOR}({_NUMBER_RE})\s*", tail)
    if not m:
        return None

    number_raw = m.group(1)
    rest = tail[m.end():]

    unit_match = _UNIT_PATTERN.match(rest.strip())
    unit_raw = unit_match.group(1) if unit_match else None

    return number_raw, unit_raw


def _line_quality_penalty(line: str) -> float:
    """Rough OCR-noise heuristic: lines with lots of stray symbols or very
    short label:number spacing anomalies are slightly less trustworthy."""
    noisy_chars = sum(1 for ch in line if ch in "@#$^*_~`\\")
    if noisy_chars == 0:
        return 0.0
    return min(0.15, 0.05 * noisy_chars)


def extract(raw_text: str) -> dict[str, ExtractedField]:
    """
    Extract every recognized parameter from raw OCR/text-layer output.

    Returns a dict keyed by parameter name (CANONICAL_PARAMETERS +
    EXTRA_PARAMETERS), each value an ExtractedField. Parameters not found
    are returned with value=None, validation="missing".
    """
    # Normalize common OCR errors (e.g. "0.7/1" -> "0.71", "0./1" -> "0.71")
    raw_text = re.sub(r"(\d)\/(\d)", r"\1\2", raw_text)
    raw_text = re.sub(r"\.\/(\d)", r".7\1", raw_text)

    lines = [ln for ln in raw_text.splitlines() if ln.strip()]

    results: dict[str, ExtractedField] = {}

    for key in (*CANONICAL_PARAMETERS, *EXTRA_PARAMETERS, *MICRONUTRIENT_PARAMETERS):
        spec = PARAMETER_SPECS[key]
        best: ExtractedField | None = None

        for line_idx, line in enumerate(lines):
            for pattern in spec.patterns:
                for label_match in pattern.regex.finditer(line):
                    found = _find_value_after_label(line, label_match)
                    if not found:
                        for offset in range(1, 4):
                            if line_idx + offset < len(lines):
                                next_line = lines[line_idx + offset]
                                number_tokens = list(re.finditer(rf"([<>]=?|=)?\s*(?:[+-]?\d[\d,]*(?:\.\d+)?)", next_line))
                                if number_tokens:
                                    label_start_pos = label_match.start()
                                    line_len = len(line)
                                    if label_start_pos < line_len / 2:
                                        matched_token = number_tokens[0]
                                    else:
                                        matched_token = number_tokens[-1]
                                    
                                    number_raw = matched_token.group(0)
                                    tail = next_line[matched_token.end():]
                                    unit_match = _UNIT_PATTERN.match(tail.strip())
                                    unit_raw = unit_match.group(1) if unit_match else None
                                    
                                    found = (number_raw, unit_raw)
                                    break

                    if not found:
                        continue

                    number_raw, unit_raw = found
                    value = parse_number(number_raw)
                    if value is None:
                        continue

                    unit = _normalize_unit(unit_raw) or pattern.default_unit
                    confidence = max(
                        0.0, pattern.base_confidence - _line_quality_penalty(line)
                    )

                    candidate = ExtractedField(
                        parameter=key,
                        raw_label=label_match.group(0).strip(),
                        value=value,
                        unit=unit,
                        confidence=round(confidence, 4),
                        validation="review",  # validator.py finalizes this
                        warnings=[],
                    )

                    if best is None or candidate.confidence > best.confidence:
                        best = candidate

        results[key] = best or ExtractedField(
            parameter=key,
            value=None,
            confidence=0.0,
            validation="missing",
            warnings=["No matching label found in the extracted text."],
        )

    return results
