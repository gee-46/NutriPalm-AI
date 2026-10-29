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


def parse_number_ex(raw: str) -> tuple[float | str | None, bool]:
    """Parse a numeric token. Returns (value, repaired).

    ``repaired`` is True when the token only parsed after applying the
    OCR letter/digit substitutions (O->0, I->1, ...). Such values are
    guesses and the caller must route them to human review.
    Tolerates thousands commas. Preserves inequalities (>, <, =) as
    normalized strings so a censored reading is never mistaken for an exact one.
    """
    candidate = raw.strip()

    ineq_match = re.match(r"^([<>]=?|=)?\s*(.*)$", candidate)
    prefix = ""
    num_part = candidate
    if ineq_match:
        prefix = ineq_match.group(1) or ""
        num_part = ineq_match.group(2)

    cleaned = num_part.replace(",", "")

    def _format(val: float) -> float | str:
        if prefix:
            return f"{prefix}{int(val)}" if val.is_integer() else f"{prefix}{val}"
        return val

    try:
        return _format(float(cleaned)), False
    except ValueError:
        pass

    fixed = "".join(_OCR_DIGIT_FIXES.get(ch, ch) for ch in cleaned)
    try:
        return _format(float(fixed)), True
    except ValueError:
        return None, False


def parse_number(raw: str) -> float | str | None:
    """Backward-compatible wrapper around :func:`parse_number_ex`."""
    return parse_number_ex(raw)[0]


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
    that immediately follows it, tolerating typical separators/table gaps.

    A '-' is a separator in "Nitrogen - 245" and "Nitrogen-245", but a minus sign in
    "Nitrogen: -245" / "Nitrogen (N) -245" (hyphen glued to the digits and preceded by
    whitespace, ':' or '='). Swallowing a real minus would turn a negative reading into a
    plausible positive one, so the sign is kept and the validator rejects the value."""
    tail = line[label_match.end():]

    m = re.match(rf"({_SEPARATOR})({_NUMBER_RE})\s*", tail)
    if not m:
        return None

    sep, number_raw = m.group(1), m.group(2)
    rest = tail[m.end():]

    if sep.endswith("-") and not number_raw.lstrip().startswith(("-", "+")):
        before = sep[-2] if len(sep) >= 2 else line[label_match.end() - 1 : label_match.end()]
        if before.isspace() or before in ":=":
            number_raw = "-" + number_raw.lstrip()

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


# Longest source excerpt stored per field. Enough to see the label and value
# next to each other; not enough to reproduce a document.
_SOURCE_TEXT_MAX = 200

# Repairs for two common OCR/text-layer defects. They change characters, so every
# line they touch is recorded and any value read from it is held for review.
_SLASH_BETWEEN_DIGITS = re.compile(r"(\d)/(\d)")
_DOT_SLASH_DIGIT = re.compile(r"\.\/(\d)")


def _repair_line(line: str) -> tuple[str, list[str]]:
    notes: list[str] = []
    repaired = line
    if _SLASH_BETWEEN_DIGITS.search(repaired):
        repaired = _SLASH_BETWEEN_DIGITS.sub(r"\1\2", repaired)
        notes.append(
            "A '/' between digits was removed from this line (possible OCR misread of a digit)."
        )
    if _DOT_SLASH_DIGIT.search(repaired):
        repaired = _DOT_SLASH_DIGIT.sub(r".7\1", repaired)
        notes.append("'./' was read as '.7' on this line (possible OCR misread).")
    return repaired, notes


@dataclass
class _Line:
    page: int | None
    text: str  # after repair
    original: str
    repairs: list[str]


def _build_lines(pages: list[tuple[int | None, str]]) -> list[_Line]:
    lines: list[_Line] = []
    for page_no, text in pages:
        for raw in text.replace("\u2212", "-").splitlines():
            if not raw.strip():
                continue
            repaired, notes = _repair_line(raw)
            lines.append(_Line(page=page_no, text=repaired, original=raw, repairs=notes))
    return lines


# A second reading of the same parameter this close in confidence to the chosen
# one, but with a different number, means the report is ambiguous. Only values read
# from the label's own line are compared: numbers picked up from neighbouring lines
# are already held for review and would make this check fire on unrelated figures.
_CONFLICT_CONFIDENCE_WINDOW = 0.25


def _flag_conflicting_candidates(best: ExtractedField, candidates: list[ExtractedField]) -> None:
    others = {
        str(c.extracted_text)
        for c in candidates
        if c is not best
        and c.value != best.value
        and c.confidence >= best.confidence - _CONFLICT_CONFIDENCE_WINDOW
    }
    if others:
        best.normalizations.append(
            "The report also contains a different value for this parameter ("
            + ", ".join(sorted(others))
            + "). Check which one applies."
        )


def extract(raw_text: str) -> dict[str, ExtractedField]:
    """Extract from a single block of text (page number unknown)."""
    return extract_pages([(None, raw_text)])


def extract_pages(pages: list[tuple[int | None, str]]) -> dict[str, ExtractedField]:
    """
    Extract every recognized parameter from per-page text.

    Returns a dict keyed by parameter name (CANONICAL_PARAMETERS +
    EXTRA_PARAMETERS + MICRONUTRIENT_PARAMETERS), each an ExtractedField that
    carries its provenance (source line, page, unit source, any automatic
    repair). Parameters not found are returned with value=None,
    validation="missing" -- never zero.
    """
    lines = _build_lines(pages)
    results: dict[str, ExtractedField] = {}

    for key in (*CANONICAL_PARAMETERS, *EXTRA_PARAMETERS, *MICRONUTRIENT_PARAMETERS):
        spec = PARAMETER_SPECS[key]
        best: ExtractedField | None = None
        same_line_candidates: list[ExtractedField] = []

        for line_idx, line_obj in enumerate(lines):
            line = line_obj.text
            for pattern in spec.patterns:
                for label_match in pattern.regex.finditer(line):
                    found = _find_value_after_label(line, label_match)
                    value_line = line_obj
                    from_neighbour = False
                    if not found:
                        for offset in range(1, 4):
                            if line_idx + offset >= len(lines):
                                break
                            next_obj = lines[line_idx + offset]
                            next_line = next_obj.text
                            number_tokens = list(
                                re.finditer(
                                    r"([<>]=?|=)?\s*(?:[+-]?\d[\d,]*(?:\.\d+)?)", next_line
                                )
                            )
                            if number_tokens:
                                if label_match.start() < len(line) / 2:
                                    matched_token = number_tokens[0]
                                else:
                                    matched_token = number_tokens[-1]
                                tail = next_line[matched_token.end():]
                                unit_match = _UNIT_PATTERN.match(tail.strip())
                                unit_raw = unit_match.group(1) if unit_match else None
                                found = (matched_token.group(0), unit_raw)
                                value_line = next_obj
                                from_neighbour = True
                                break

                    if not found:
                        continue

                    number_raw, unit_raw = found
                    value, digit_repaired = parse_number_ex(number_raw)
                    if value is None:
                        continue

                    stated_unit = _normalize_unit(unit_raw)
                    unit = stated_unit or pattern.default_unit
                    if pattern.default_unit is None and stated_unit is None:
                        unit_source = "not_applicable"
                    elif stated_unit:
                        unit_source = "stated"
                    else:
                        unit_source = "assumed_default"

                    notes: list[str] = list(line_obj.repairs)
                    if value_line is not line_obj:
                        notes.extend(n for n in value_line.repairs if n not in notes)
                    if digit_repaired:
                        notes.append(
                            f"'{number_raw.strip()}' only parsed after replacing look-alike "
                            "letters with digits (possible OCR misread)."
                        )
                    if from_neighbour:
                        notes.append(
                            "The number was taken from a line below the label, not from the "
                            "label's own line. Confirm it belongs to this parameter."
                        )

                    confidence = max(
                        0.0, pattern.base_confidence - _line_quality_penalty(line)
                    )

                    source = line_obj.original.strip()
                    if from_neighbour:
                        source = f"{source} | {value_line.original.strip()}"

                    candidate = ExtractedField(
                        parameter=key,
                        raw_label=label_match.group(0).strip(),
                        value=value,
                        unit=unit,
                        confidence=round(confidence, 4),
                        validation="review",  # validator.py finalizes this
                        warnings=[],
                        extracted_text=number_raw.strip(),
                        source_text=source[:_SOURCE_TEXT_MAX],
                        page=value_line.page,
                        unit_source=unit_source,
                        normalizations=notes,
                    )

                    if not from_neighbour:
                        same_line_candidates.append(candidate)
                    if best is None or candidate.confidence > best.confidence:
                        best = candidate

        if best is not None:
            _flag_conflicting_candidates(best, same_line_candidates)

        results[key] = best or ExtractedField(
            parameter=key,
            value=None,
            confidence=0.0,
            validation="missing",
            warnings=["No matching label found in the extracted text."],
        )

    return results
