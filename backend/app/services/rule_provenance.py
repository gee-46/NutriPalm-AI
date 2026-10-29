"""
rule_provenance.py

The gate between "the engine can compute a number" and "the number may be shown to a farmer as a recommendation".

crop_rules.py holds per-crop targets that its own docstring calls "V1 default, configurable engineering assumptions, not a
peer-reviewed agronomic model". A fertilizer dose derived from them is arithmetic on assumptions, not advice. So no
recommendation is released for a crop unless a *verified rule record* for it is active in the rule pack
(data/verified_rules.json, or the file named by RULE_PACK_PATH).

A record is ACTIVATED only if validate_record() finds nothing wrong. It must be

  * complete      every field below present and non-empty
  * approved      status == "approved" with a named reviewer (name + role) and a review date that is not in the future
  * traceable     source: id, title, publisher, edition/version, year, locator (page/table/section), a verbatim quote,
                  optionally a url; plus the crop stage and region the numbers apply to, and the assumptions made
  * unit-correct  targets in kg/ha (N, P, K) and % (organic carbon); the P/K *basis* (elemental vs oxide) is stated
  * consistent    the stated units, bases and numbers are exactly what the engine will use (crop_rules.py), the numbers
                  are finite, positive and physically plausible, pH min < max, and the reviewer has confirmed the label
                  grades of the three fertilizer products the engine uses (urea, DAP, MOP)
  * unambiguous   exactly one record per crop (duplicates disable the crop rather than picking one)

Two kinds of record exist (field `rule_kind`):

  sufficiency_target   (default) soil-test sufficiency targets in kg/ha; the engine adds the gap to the soil-test value.
                       No primary source we could read states crop targets in this form (docs/AGRONOMIST_REVIEW_CHECKLIST.md D2).
  published_schedule   a dose schedule exactly as a publication states it: grams of N / P2O5 / K2O per palm per year by palm
                       age. The engine multiplies by the plot's palm count and converts to products; it does not use the
                       soil-test numbers to change the dose (`soil_test_adjustment` must say "none").

Record shape (see docs/AGRONOMIST_REVIEW_CHECKLIST.md for the review procedure), sufficiency_target:

    {
      "crop": "coconut", "rule_version": "2026-01", "status": "approved",
      "applicable_stage": "mature bearing palms", "region": "Karnataka coastal",
      "units": {"nutrient_targets": "kg/ha", "organic_carbon": "%"},
      "soil_test_basis": {"phosphorus": "elemental", "potassium": "elemental"},
      "targets": {"n_target_kg_ha": 170, "p_target_kg_ha": 32, "k_target_kg_ha": 280,
                  "ph_min": 5.2, "ph_max": 8.0, "organic_carbon_min_percent": 0.5},
      "assumptions": ["Targets are soil-test sufficiency values for ... "],
      "source": {"id": "...", "title": "...", "publisher": "...", "edition": "...", "year": 2020,
                 "locator": "Table 3, p. 14", "quote": "verbatim text supporting the numbers", "url": "https://..."},
      "reviewed_by": {"name": "...", "role": "agronomist"}, "reviewed_on": "2026-01-31",
      "product_grades_verified": {"urea": "<where the grade was checked>", "dap": "...", "mop": "..."},
      "covers_yield_and_economics": false
    }

published_schedule:

    {
      "rule_kind": "published_schedule", "crop": "oil_palm", "rule_version": "2026-01", "status": "approved",
      "applicable_stage": "...", "region": "...", "applicable_states": null,          # or ["Andhra Pradesh", ...]
      "units": {"dose": "g/palm/year"}, "nutrient_basis": {"phosphorus": "oxide", "potassium": "oxide"},
      "age_basis": "how 'year N of the palm' is counted",
      "schedule": [{"age_year_from": 1, "age_year_to": 1, "n_g": 400, "p_g": 200, "k_g": 400}, ...,
                   {"age_year_from": 3, "age_year_to": null, "n_g": 1200, "p_g": 600, "k_g": 1200}],
      "soil_test_adjustment": "none", "timing_note": "<optional: splits/timing quoted from the source>", "assumptions": ["..."], "source": {...}, "reviewed_by": {...}, "reviewed_on": "...",
      "product_grades_verified": {...}, "covers_yield_and_economics": false
    }

The shipped pack is EMPTY: nothing in this repository has been checked against a primary source by an agronomist.
Until records are added, the API answers `insufficient_data` and explains why.

    python -m app.services.rule_provenance check path/to/records.json     # validate without activating anything
"""
from __future__ import annotations

import json
import logging
import math
import sys
from dataclasses import dataclass
from datetime import date, datetime
from functools import lru_cache
from pathlib import Path

from app.services import crop_rules, fertilizer_catalog

logger = logging.getLogger("nutripalm.rule_provenance")

DEFAULT_PACK_PATH = Path(__file__).with_name("data") / "verified_rules.json"

ENGINE_VERSION = "rec-2.2"

KIND_SUFFICIENCY = "sufficiency_target"
KIND_SCHEDULE = "published_schedule"
_KINDS = (KIND_SUFFICIENCY, KIND_SCHEDULE)

_TARGET_KEYS = (
    "n_target_kg_ha",
    "p_target_kg_ha",
    "k_target_kg_ha",
    "ph_min",
    "ph_max",
    "organic_carbon_min_percent",
)
_SOURCE_TEXT_KEYS = ("id", "title", "publisher", "edition", "locator", "quote")
_MIN_QUOTE_CHARS = 20
_EXPECTED_UNITS = {"nutrient_targets": "kg/ha", "organic_carbon": "%"}
_BASES = {b.value for b in fertilizer_catalog.NutrientBasis}
# Physical-plausibility ceilings for soil-available nutrients (same bounds the OCR validator treats as impossible).
_MAX_PLAUSIBLE = {"n_target_kg_ha": 2000.0, "p_target_kg_ha": 500.0, "k_target_kg_ha": 1500.0}
_SCHEDULE_UNITS = {"dose": "g/palm/year"}
_BAND_KEYS = {"age_year_from", "age_year_to", "n_g", "p_g", "k_g"}
# Per palm per year, grams of N / P2O5-or-P / K2O-or-K. Generous ceilings that only catch typos (e.g. kg entered as g x 1000).
_MAX_PLAUSIBLE_G = {"n_g": 5000.0, "p_g": 3000.0, "k_g": 8000.0}


@dataclass(frozen=True)
class VerifiedRule:
    crop: str
    rule_version: str
    source: dict
    reviewed_by: str
    reviewed_on: str
    covers_yield_and_economics: bool
    applicable_stage: str = ""
    region: str = ""
    soil_test_basis: dict | None = None
    assumptions: tuple[str, ...] = ()
    kind: str = KIND_SUFFICIENCY
    # published_schedule only:
    schedule: tuple[dict, ...] = ()
    nutrient_basis: dict | None = None
    age_basis: str = ""
    applicable_states: tuple[str, ...] | None = None
    timing_note: str = ""  # text quoted from the source about splits / timing / placement, shown with its citation

    def citation(self) -> dict:
        return {
            "rule_kind": self.kind,
            "crop": self.crop,
            "rule_version": self.rule_version,
            "source": self.source,
            "reviewed_by": self.reviewed_by,
            "reviewed_on": self.reviewed_on,
            "applicable_stage": self.applicable_stage,
            "region": self.region,
            "soil_test_basis": self.soil_test_basis or {},
            **(
                {
                    "nutrient_basis": self.nutrient_basis or {},
                    "age_basis": self.age_basis,
                    "applicable_states": list(self.applicable_states) if self.applicable_states is not None else None,
                }
                if self.kind == KIND_SCHEDULE
                else {}
            ),
        }


def _nonempty_str(value) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _finite_positive(value) -> bool:
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and math.isfinite(value)
        and value > 0
    )


def _parse_date(value) -> date | None:
    if not _nonempty_str(value):
        return None
    try:
        return datetime.strptime(value.strip(), "%Y-%m-%d").date()
    except ValueError:
        return None


def _is_number(value) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _common_problems(record: dict, today: date, allow_test_fixture: bool) -> list[str]:
    """Approval, traceability and product-grade checks shared by every rule kind."""
    problems: list[str] = []

    if record.get("test_fixture") and not allow_test_fixture:
        problems.append("record is marked test_fixture and test fixtures are only accepted when ENVIRONMENT=development")

    # ---- approval
    if record.get("status") != "approved":
        problems.append(f"status is '{record.get('status')}', not 'approved'")
    if not _nonempty_str(record.get("rule_version")):
        problems.append("rule_version is missing")
    for key in ("applicable_stage", "region"):
        if not _nonempty_str(record.get(key)):
            problems.append(f"{key} is missing (which crop stage / region do the numbers apply to?)")
    reviewer = record.get("reviewed_by")
    if not (isinstance(reviewer, dict) and _nonempty_str(reviewer.get("name")) and _nonempty_str(reviewer.get("role"))):
        problems.append("reviewed_by must be {name, role}")
    reviewed_on = _parse_date(record.get("reviewed_on"))
    if reviewed_on is None:
        problems.append("reviewed_on must be a YYYY-MM-DD date")
    elif reviewed_on > today:
        problems.append("reviewed_on is in the future")

    # ---- source
    source = record.get("source")
    if not isinstance(source, dict):
        problems.append("source is missing")
    else:
        for key in _SOURCE_TEXT_KEYS:
            if not _nonempty_str(source.get(key)):
                problems.append(f"source.{key} is missing")
        if _nonempty_str(source.get("quote")) and len(source["quote"].strip()) < _MIN_QUOTE_CHARS:
            problems.append(f"source.quote is shorter than {_MIN_QUOTE_CHARS} characters (quote the passage that states the numbers)")
        year = source.get("year")
        if not (isinstance(year, int) and not isinstance(year, bool) and 1900 <= year <= today.year):
            problems.append(f"source.year must be an integer between 1900 and {today.year}")
        if source.get("url") is not None and not (isinstance(source["url"], str) and source["url"].startswith(("http://", "https://"))):
            problems.append("source.url, if given, must be an http(s) URL")

    # ---- assumptions
    assumptions = record.get("assumptions")
    if not (isinstance(assumptions, list) and assumptions and all(_nonempty_str(a) for a in assumptions)):
        problems.append("assumptions must be a non-empty list of statements")

    # ---- fertilizer products the engine will use
    grades = record.get("product_grades_verified")
    needed = fertilizer_catalog.primary_product_codes()
    if not (isinstance(grades, dict) and all(_nonempty_str(grades.get(code)) for code in needed)):
        problems.append(
            f"product_grades_verified must say where the label grade was checked for each of: {', '.join(needed)}"
        )

    if not isinstance(record.get("covers_yield_and_economics", False), bool):
        problems.append("covers_yield_and_economics must be true or false")
    return problems


def _sufficiency_problems(record: dict, req: crop_rules.CropRequirement) -> list[str]:
    problems: list[str] = []
    # ---- units and basis (must match what the engine computes with)
    units = record.get("units")
    if units != _EXPECTED_UNITS:
        problems.append(f"units must be exactly {_EXPECTED_UNITS}; the engine does not convert (got {units})")
    basis = record.get("soil_test_basis")
    if not (isinstance(basis, dict) and set(basis) == {"phosphorus", "potassium"} and all(v in _BASES for v in basis.values())):
        problems.append("soil_test_basis must be {phosphorus, potassium} each 'elemental' or 'oxide'")
    else:
        if basis["phosphorus"] != req.p_basis.value or basis["potassium"] != req.k_basis.value:
            problems.append(
                f"soil_test_basis {basis} differs from the basis the engine uses for {req.crop} "
                f"(phosphorus={req.p_basis.value}, potassium={req.k_basis.value}); a P/K basis mismatch changes doses by 1.2-2.3x"
            )

    # ---- numbers
    targets = record.get("targets")
    if not isinstance(targets, dict):
        problems.append("targets is missing")
    else:
        for key in _TARGET_KEYS:
            if key not in targets:
                problems.append(f"targets.{key} is missing")
            elif not _finite_positive(targets[key]):
                problems.append(f"targets.{key} must be a finite number greater than 0")
            elif float(targets[key]) != float(getattr(req, key)):
                problems.append(f"targets.{key} ({targets[key]}) differs from crop_rules.py ({getattr(req, key)}); the engine would use a different number than the one cited")
        for key, ceiling in _MAX_PLAUSIBLE.items():
            if _finite_positive(targets.get(key)) and targets[key] > ceiling:
                problems.append(f"targets.{key} exceeds the physical plausibility limit {ceiling:g}")
        lo, hi = targets.get("ph_min"), targets.get("ph_max")
        if _finite_positive(lo) and _finite_positive(hi) and not (lo < hi <= 14):
            problems.append("pH range must satisfy 0 < ph_min < ph_max <= 14")
        oc = targets.get("organic_carbon_min_percent")
        if _finite_positive(oc) and oc > 10:
            problems.append("organic_carbon_min_percent is implausibly high (> 10 %)")
    return problems


def _schedule_problems(record: dict) -> list[str]:
    """Checks specific to a published per-palm dose schedule."""
    problems: list[str] = []

    if record.get("units") != _SCHEDULE_UNITS:
        problems.append(f"units must be exactly {_SCHEDULE_UNITS}; the engine does not convert other units (got {record.get('units')})")

    basis = record.get("nutrient_basis")
    if not (isinstance(basis, dict) and set(basis) == {"phosphorus", "potassium"} and all(v in _BASES for v in basis.values())):
        problems.append("nutrient_basis must be {phosphorus, potassium} each 'elemental' or 'oxide' - the basis the SOURCE states its doses in")

    if not _nonempty_str(record.get("age_basis")):
        problems.append("age_basis is missing (say how 'year N of the palm' is counted)")

    if record.get("soil_test_adjustment") != "none":
        problems.append(
            "soil_test_adjustment must be \"none\": the engine does not modify a schedule from soil-test values, "
            "so a record may not imply that it does"
        )

    if "timing_note" in record and not _nonempty_str(record["timing_note"]):
        problems.append("timing_note, if present, must be non-empty text quoted from the source")

    states = record.get("applicable_states", None)
    if states is not None and not (isinstance(states, list) and states and all(_nonempty_str(x) for x in states)):
        problems.append("applicable_states must be null (the source states no restriction) or a non-empty list of state names")

    bands = record.get("schedule")
    if not (isinstance(bands, list) and bands):
        problems.append("schedule must be a non-empty list of age bands")
        return problems

    expected_from = 1
    for i, band in enumerate(bands):
        label = f"schedule[{i}]"
        if not isinstance(band, dict) or set(band) != _BAND_KEYS:
            problems.append(f"{label} must have exactly the keys {sorted(_BAND_KEYS)}")
            return problems
        lo, hi = band["age_year_from"], band["age_year_to"]
        if not (isinstance(lo, int) and not isinstance(lo, bool) and lo >= 1):
            problems.append(f"{label}.age_year_from must be an integer >= 1")
            return problems
        if lo != expected_from:
            problems.append(f"{label} starts at year {lo}, expected {expected_from} (bands must be contiguous, start at year 1, and not overlap)")
        if hi is None:
            if i != len(bands) - 1:
                problems.append(f"{label}.age_year_to is null (open-ended) but it is not the last band")
            expected_from = lo + 1
        elif not (isinstance(hi, int) and not isinstance(hi, bool) and hi >= lo):
            problems.append(f"{label}.age_year_to must be null or an integer >= age_year_from")
            return problems
        else:
            expected_from = hi + 1
        amounts = []
        for key, ceiling in _MAX_PLAUSIBLE_G.items():
            value = band[key]
            if not _is_number(value) or value < 0:
                problems.append(f"{label}.{key} must be a finite number >= 0 (zero only if the source states zero)")
            elif value > ceiling:
                problems.append(f"{label}.{key} ({value}) exceeds the plausibility limit {ceiling:g} g/palm/year")
            else:
                amounts.append(value)
        if len(amounts) == 3 and sum(amounts) <= 0:
            problems.append(f"{label} gives no nutrient at all")
    return problems


def validate_record(record: dict, *, today: date | None = None, allow_test_fixture: bool = False) -> list[str]:
    """Everything that stops this record from being activated. Empty list = activatable."""
    today = today or date.today()
    if not isinstance(record, dict):
        return ["record is not an object"]

    kind = record.get("rule_kind", KIND_SUFFICIENCY)
    if kind not in _KINDS:
        return [f"rule_kind '{kind}' is not one of {', '.join(_KINDS)}"]

    crop = record.get("crop")
    try:
        req = crop_rules.get_crop_requirement(crop or "")
    except Exception:
        problems = ["record is marked test_fixture and test fixtures are only accepted when ENVIRONMENT=development"] if (
            record.get("test_fixture") and not allow_test_fixture
        ) else []
        return problems + [f"crop '{crop}' is not in the engine's crop catalog ({', '.join(crop_rules.list_supported_crops())})"]

    problems = _common_problems(record, today, allow_test_fixture)
    problems += _sufficiency_problems(record, req) if kind == KIND_SUFFICIENCY else _schedule_problems(record)
    return problems


def load_records(path: Path | str | None = None) -> list[dict]:
    pack_path = Path(path) if path else DEFAULT_PACK_PATH
    if not pack_path.exists():
        return []
    try:
        data = json.loads(pack_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        logger.exception("Rule pack %s could not be read; no rules are active", pack_path)
        return []
    records = data.get("rules", []) if isinstance(data, dict) else []
    return records if isinstance(records, list) else []


def load_pack(
    path: Path | str | None = None,
    *,
    allow_test_fixture: bool = False,
    today: date | None = None,
) -> dict[str, VerifiedRule]:
    """Activate every valid, unambiguous record. Invalid records are skipped and logged, never trusted."""
    records = load_records(path)
    by_crop: dict[str, list[dict]] = {}
    for record in records:
        key = str(record.get("crop", "")).strip().lower().replace(" ", "_") if isinstance(record, dict) else ""
        by_crop.setdefault(key, []).append(record)

    rules: dict[str, VerifiedRule] = {}
    for key, group in by_crop.items():
        if len(group) > 1:
            logger.error("Rule records for '%s' rejected: %d records for one crop (ambiguous)", key, len(group))
            continue
        record = group[0]
        problems = validate_record(record, today=today, allow_test_fixture=allow_test_fixture)
        if problems:
            logger.error("Rule record for '%s' rejected: %s", key, "; ".join(problems))
            continue
        crop = crop_rules.get_crop_requirement(record["crop"]).crop
        reviewer = record["reviewed_by"]
        kind = record.get("rule_kind", KIND_SUFFICIENCY)
        common = dict(
            crop=crop,
            rule_version=str(record["rule_version"]),
            source=dict(record["source"]),
            reviewed_by=f"{reviewer['name'].strip()}, {reviewer['role'].strip()}",
            reviewed_on=str(record["reviewed_on"]),
            covers_yield_and_economics=bool(record.get("covers_yield_and_economics", False)),
            applicable_stage=record["applicable_stage"].strip(),
            region=record["region"].strip(),
            assumptions=tuple(a.strip() for a in record["assumptions"]),
            kind=kind,
        )
        if kind == KIND_SCHEDULE:
            states = record.get("applicable_states")
            rules[crop] = VerifiedRule(
                **common,
                schedule=tuple(dict(b) for b in record["schedule"]),
                nutrient_basis=dict(record["nutrient_basis"]),
                age_basis=record["age_basis"].strip(),
                timing_note=str(record.get("timing_note", "")).strip(),
                applicable_states=tuple(x.strip() for x in states) if states is not None else None,
            )
        else:
            rules[crop] = VerifiedRule(**common, soil_test_basis=dict(record["soil_test_basis"]))
    return rules


@lru_cache
def _default_pack() -> dict[str, VerifiedRule]:
    from app.config import get_settings

    settings = get_settings()
    return load_pack(
        settings.rule_pack_path or None,
        allow_test_fixture=settings.environment == "development",
    )


def get_rule_pack() -> dict[str, VerifiedRule]:
    """FastAPI dependency: tests override it to supply a pack."""
    return _default_pack()


def verified_rule_for(pack: dict[str, VerifiedRule], crop: str | None) -> VerifiedRule | None:
    try:
        key = crop_rules.get_crop_requirement(crop or "").crop
    except Exception:
        return None
    return pack.get(key)


def _main(argv: list[str]) -> int:
    if len(argv) != 3 or argv[1] != "check":
        print("usage: python -m app.services.rule_provenance check <records.json>")
        return 2
    records = load_records(argv[2])
    if not records:
        print("no records found")
        return 1
    worst = 0
    for record in records:
        problems = validate_record(record)
        name = record.get("crop") if isinstance(record, dict) else "?"
        print(f"[{'OK ' if not problems else 'NO '}] {name}")
        for p in problems:
            print(f"      - {p}")
        worst = worst or (1 if problems else 0)
    return worst


if __name__ == "__main__":
    raise SystemExit(_main(sys.argv))
