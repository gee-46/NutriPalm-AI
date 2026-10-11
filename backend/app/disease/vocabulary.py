"""
vocabulary.py

Normalisation of crop names, crop stages, symptoms, plant parts and context answers into the
controlled vocabulary (data/vocabulary.json). Matching is deliberately literal: a phrase either
equals a vocabulary label/synonym/code or contains a synonym as whole words. There is no fuzzy or
statistical matching, so a symptom is never "guessed".
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional

from app.disease.schemas import Crop, Vocabulary, VocabItem

_WS = re.compile(r"\s+")


def clean(text: str) -> str:
    return _WS.sub(" ", text.strip().casefold())


def normalize_crop(name: str, vocab: Vocabulary) -> Optional[Crop]:
    key = clean(name)
    for crop_code, names in vocab.crops.items():
        if key == crop_code or key in {clean(n) for n in names}:
            return Crop(crop_code)
    return None


def normalize_stage(text: Optional[str], vocab: Vocabulary) -> Optional[str]:
    """Return a stage code, or None when the text is empty or not a recognised stage."""
    if not text or not text.strip():
        return None
    key = clean(text)
    for item in vocab.stages:
        if key in {item.code, clean(item.label_en), *map(clean, item.synonyms)}:
            return item.code
    return None


def _phrase_matches(phrase: str, item: VocabItem) -> bool:
    terms = {item.code, clean(item.label_en), *map(clean, item.synonyms)}
    if phrase in terms:
        return True
    return any(t and re.search(rf"(?<!\w){re.escape(t)}(?!\w)", phrase) for t in terms if " " in t or len(t) > 5)


@dataclass
class SymptomNormalisation:
    codes: list[str] = field(default_factory=list)
    unknown_codes: list[str] = field(default_factory=list)
    unrecognised_text: list[str] = field(default_factory=list)
    from_text: list[str] = field(default_factory=list)


def normalize_symptoms(codes: list[str], free_text: Optional[list[str]], vocab: Vocabulary) -> SymptomNormalisation:
    known = {s.code for s in vocab.symptoms}
    out = SymptomNormalisation()
    seen: set[str] = set()
    for code in codes:
        c = clean(code)
        if c in known:
            if c not in seen:
                seen.add(c)
                out.codes.append(c)
        else:
            out.unknown_codes.append(code)
    for raw in free_text or []:
        for phrase in re.split(r"[;,\n]+", raw):
            p = clean(phrase)
            if not p:
                continue
            hits = [s for s in vocab.symptoms if _phrase_matches(p, s)]
            if not hits:
                out.unrecognised_text.append(phrase.strip())
                continue
            for s in hits:
                if s.code not in seen:
                    seen.add(s.code)
                    out.codes.append(s.code)
                    out.from_text.append(s.code)
    return out


def normalize_parts(parts: list[str], vocab: Vocabulary) -> tuple[list[str], list[str]]:
    known = {p.code for p in vocab.parts}
    ok, bad = [], []
    for p in parts:
        c = clean(p)
        (ok if c in known else bad).append(c if c in known else p)
    return sorted(set(ok)), bad
