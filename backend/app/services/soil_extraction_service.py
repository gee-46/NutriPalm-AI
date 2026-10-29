"""
soil_extraction_service.py

Everything between "the pipeline produced fields" and "a verified soil report
exists":

    ingest_upload()      hash -> reuse stored extraction | run pipeline -> store -> auto-finalize
    resolve_confirmation()  pure rules: which fields may be accepted, which need a correction
    finalize()           create the soil report, then close the extraction

Rules (these are the data-integrity guarantees of the workflow):

* A failed read is never stored and never becomes a soil report.
* A soil report is created only from values that were (a) read clearly and
  validated, or (b) explicitly confirmed by the owner, or (c) typed in by the
  owner as a correction. (c) keeps the original reading in the correction log.
* A value can be confirmed "as read" only if it is an exact number in the
  parameter's own unit. A bound (">5"), an unrecognised unit or an unusable
  number can only be corrected, never confirmed -- there is no silent conversion.
* The same document uploaded again for the same plot returns the stored
  extraction; OCR is not repeated.
"""
from __future__ import annotations

import logging
import threading
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable, Iterator

from app.exceptions import (
    ExtractionAlreadyResolved,
    ExtractionConflict,
    ExtractionNotConfirmable,
)
from app.ocr import validator
from app.ocr.pipeline import REQUIRED_FOR_PERSISTENCE, run_pipeline
from app.ocr.schemas import (
    MICRONUTRIENT_PARAMETERS,
    OcrExtractionResult,
    all_fields,
)
from app.repositories.soil_extraction_repository import ExtractionRepository
from app.repositories.soil_report_repository import SoilReportWriter

logger = logging.getLogger("nutripalm.soil_extraction")

OPTIONAL_PARAMETERS = ("electrical_conductivity", *MICRONUTRIENT_PARAMETERS)
CONFIRMABLE_PARAMETERS = (*REQUIRED_FOR_PERSISTENCE, *OPTIONAL_PARAMETERS)

# Hard physical bounds shared with the OCR validator (single source of truth).
_RANGES = validator.RANGES
_TARGET_UNIT = validator.TARGET_UNIT
_EQUIVALENT_UNITS = validator._UNIT_EQUIVALENTS

_SAFE_FILENAME_MAX = 255


# --------------------------------------------------------------------------
# De-duplicating concurrent uploads of the same document
# --------------------------------------------------------------------------
_locks_guard = threading.Lock()
_locks: dict[tuple[str, str, str], tuple[threading.Lock, int]] = {}


@contextmanager
def _single_flight(key: tuple[str, str, str]) -> Iterator[None]:
    """
    Serialise work on one (owner, plot, document-hash) so two simultaneous
    uploads of the same file run OCR once; the second finds the stored row.
    Process-local; across workers the unique index in the database decides.
    """
    with _locks_guard:
        lock, refs = _locks.get(key, (threading.Lock(), 0))
        _locks[key] = (lock, refs + 1)
    try:
        with lock:
            yield
    finally:
        with _locks_guard:
            lock, refs = _locks[key]
            if refs <= 1:
                del _locks[key]
            else:
                _locks[key] = (lock, refs - 1)


# --------------------------------------------------------------------------
# Confirmation rules
# --------------------------------------------------------------------------
@dataclass
class ResolvedConfirmation:
    # parameter -> {"value": float, "unit": str|None, "validation": str}
    values: dict[str, dict]
    corrections: list[dict]
    verification_status: str  # auto_validated | user_confirmed | user_corrected
    not_saved: list[str] = field(default_factory=list)


def _unit_matches(parameter: str, unit: str | None) -> bool:
    target = _TARGET_UNIT.get(parameter)
    if target is None:
        return unit in (None, "")
    return unit == target or unit in _EQUIVALENT_UNITS.get(target, set())


def _hard_range_problem(parameter: str, value: float) -> str | None:
    r = _RANGES[parameter]
    if not (r.hard_min <= value <= r.hard_max):
        return (
            f"{value:g} is outside the physically possible range "
            f"[{r.hard_min:g}, {r.hard_max:g}] for this parameter."
        )
    return None


def resolve_confirmation(
    extracted: dict[str, dict],
    corrections: dict[str, dict] | None = None,
    confirmed: list[str] | None = None,
    *,
    now: datetime | None = None,
) -> ResolvedConfirmation:
    """
    Decide the final value of every parameter, or raise ExtractionNotConfirmable.

    ``extracted``  stored field dicts keyed by parameter (as produced by the pipeline)
    ``corrections`` {parameter: {"value": float, "unit": str|None, "reason": str|None}}
    ``confirmed``  parameters the owner checked and accepts exactly as read
    """
    corrections = corrections or {}
    confirmed_set = set(confirmed or [])
    stamp = (now or datetime.now(timezone.utc)).isoformat()
    problems: dict[str, str] = {}
    values: dict[str, dict] = {}
    log: list[dict] = []
    not_saved: list[str] = []
    any_confirmed_review = False

    unknown = [k for k in (*corrections, *confirmed_set) if k not in CONFIRMABLE_PARAMETERS]
    for k in unknown:
        problems[k] = "Unknown parameter."

    for key in CONFIRMABLE_PARAMETERS:
        required = key in REQUIRED_FOR_PERSISTENCE
        field_ = extracted.get(key) or {}
        original = field_.get("value")
        validation = field_.get("validation", "missing")
        unit_read = field_.get("unit")
        corr = corrections.get(key)

        if corr is not None:
            value = corr.get("value")
            unit = corr.get("unit")
            target = _TARGET_UNIT.get(key)
            if not isinstance(value, (int, float)) or isinstance(value, bool) or value != value or value in (float("inf"), float("-inf")):
                problems[key] = "The corrected value must be a finite number."
                continue
            if target is not None and unit is None:
                problems[key] = f"State the unit of the corrected value ({target})."
                continue
            if not _unit_matches(key, unit):
                problems[key] = (
                    f"Corrected values must be entered in {target or 'the parameter’s own scale'}; "
                    f"'{unit}' is not accepted (no automatic conversion is done)."
                )
                continue
            bad = _hard_range_problem(key, float(value))
            if bad:
                problems[key] = bad
                continue
            values[key] = {"value": float(value), "unit": target, "validation": "user_corrected"}
            log.append(
                {
                    "parameter": key,
                    "original_value": original,
                    "original_text": field_.get("extracted_text"),
                    "original_unit": unit_read,
                    "corrected_value": float(value),
                    "unit": target,
                    "reason": (corr.get("reason") or None),
                    "at": stamp,
                }
            )
            continue

        # No correction supplied.
        if original is None:
            if required:
                problems[key] = "Not found in the report. Enter the value from your report."
            continue

        if validation == "unusable":
            if required:
                problems[key] = "The value read is not possible for this parameter. Enter the correct value."
            else:
                not_saved.append(key)
            continue

        if isinstance(original, str):
            # a bound such as ">5" is not a measurement and cannot be accepted as read
            if required:
                problems[key] = f"Reported as '{original}', not an exact number. Enter the value to use."
            else:
                not_saved.append(key)
            continue

        stated_wrong_unit = (
            field_.get("unit_source") == "stated" and not _unit_matches(key, unit_read)
        )
        if stated_wrong_unit:
            if required:
                problems[key] = (
                    f"The report states the unit '{unit_read}', expected "
                    f"{_TARGET_UNIT.get(key)}. Convert it yourself and enter the corrected value."
                )
            else:
                not_saved.append(key)
            continue

        bad = _hard_range_problem(key, float(original))
        if bad:
            if required:
                problems[key] = bad
            else:
                not_saved.append(key)
            continue

        if validation == "valid":
            values[key] = {"value": float(original), "unit": _TARGET_UNIT.get(key), "validation": "valid"}
        elif validation == "review":
            if key in confirmed_set:
                any_confirmed_review = True
                values[key] = {
                    "value": float(original),
                    "unit": _TARGET_UNIT.get(key),
                    "validation": "user_confirmed",
                }
            elif required:
                problems[key] = "Check this value against your report and confirm it, or correct it."
            else:
                not_saved.append(key)
        else:  # 'missing' with a value cannot happen; treat as not usable
            if required:
                problems[key] = "Value could not be validated."

    if problems:
        raise ExtractionNotConfirmable(problems)

    if log:
        status = "user_corrected"
    elif any_confirmed_review:
        status = "user_confirmed"
    else:
        status = "auto_validated"
    return ResolvedConfirmation(values, log, status, not_saved)


# --------------------------------------------------------------------------
# Storage shapes
# --------------------------------------------------------------------------
def fields_for_storage(result: OcrExtractionResult) -> dict[str, dict]:
    return {k: f.model_dump() for k, f in all_fields(result.soil_parameters).items()}


def _micronutrients_for_storage(values: dict[str, dict]) -> dict | None:
    stored = {
        k: {"value": v["value"], "unit": v["unit"], "validation": v["validation"]}
        for k, v in values.items()
        if k in MICRONUTRIENT_PARAMETERS
    }
    return stored or None


def _validation_summary(extracted: dict[str, dict], values: dict[str, dict]) -> dict:
    return {
        key: {
            "validation": values[key]["validation"] if key in values else extracted.get(key, {}).get("validation", "missing"),
            "confidence": extracted.get(key, {}).get("confidence", 0.0),
            "warnings": extracted.get(key, {}).get("warnings", []),
        }
        for key in (*REQUIRED_FOR_PERSISTENCE, "electrical_conductivity")
    }


# --------------------------------------------------------------------------
# Finalize: soil report + close the extraction
# --------------------------------------------------------------------------
def finalize(
    extraction: dict,
    owner_id: str,
    *,
    repo: ExtractionRepository,
    writer: SoilReportWriter,
    corrections: dict[str, dict] | None = None,
    confirmed: list[str] | None = None,
) -> tuple[dict, dict, ResolvedConfirmation]:
    """
    Turn a `needs_review` extraction into a verified soil report.

    Returns (updated_extraction_row, soil_report_row, resolution).

    Supabase's REST API has no multi-statement transaction, so atomicity is built
    from the one write that decides the outcome: the soil report is inserted
    first; the extraction is then closed with a single UPDATE guarded by
    `status = 'needs_review'`. If that guard fails (a concurrent confirm won) or
    the update errors, the new soil report is deleted again, so no verified report
    exists without a closed extraction.
    """
    if extraction.get("status") != "needs_review":
        raise ExtractionAlreadyResolved("This report was already confirmed.")

    resolution = resolve_confirmation(extraction["fields"], corrections, confirmed)
    v = resolution.values
    row = writer.create_soil_report(
        plot_id=extraction["plot_id"],
        owner_id=owner_id,
        nitrogen_kg_ha=v["nitrogen"]["value"],
        phosphorus_kg_ha=v["phosphorus"]["value"],
        potassium_kg_ha=v["potassium"]["value"],
        organic_carbon_percent=v["organic_carbon"]["value"],
        ph=v["ph"]["value"],
        electrical_conductivity=v.get("electrical_conductivity", {}).get("value"),
        micronutrients=_micronutrients_for_storage(v),
        validation_summary=_validation_summary(extraction["fields"], v),
        extraction_id=extraction["id"],
        verification_status=resolution.verification_status,
    )
    soil_report_id = row.get("id")
    try:
        closed = repo.mark_completed(
            extraction["id"],
            owner_id,
            soil_report_id=soil_report_id,
            corrections=[*extraction.get("corrections", []), *resolution.corrections],
            verification_status=resolution.verification_status,
        )
    except Exception:
        _compensate(writer, soil_report_id, owner_id)
        raise
    if closed is None:
        _compensate(writer, soil_report_id, owner_id)
        raise ExtractionAlreadyResolved("This report was already confirmed.")

    logger.info(
        "soil_report.verified",
        extra={
            "owner_id": owner_id,
            "plot_id": extraction["plot_id"],
            "extraction_id": extraction["id"],
            "verification_status": resolution.verification_status,
            "corrections": len(resolution.corrections),
        },
    )
    return closed, row, resolution


def _compensate(writer: SoilReportWriter, soil_report_id: str | None, owner_id: str) -> None:
    if not soil_report_id:
        return
    try:
        writer.delete_soil_report(soil_report_id, owner_id)
    except Exception:  # never mask the original failure
        logger.exception("Could not remove soil report %s after a failed confirmation", soil_report_id)


# --------------------------------------------------------------------------
# Upload orchestration
# --------------------------------------------------------------------------
@dataclass
class UploadOutcome:
    status: str  # failed | needs_review | completed
    result: OcrExtractionResult | None  # present for a fresh read; None when reused
    extraction: dict | None  # stored row (None when failed)
    soil_report: dict | None
    reused: bool = False
    errors: list[str] = field(default_factory=list)


def ingest_upload(
    *,
    owner_id: str,
    plot_id: str,
    filename: str,
    content_type: str,
    content: bytes,
    repo: ExtractionRepository,
    writer: SoilReportWriter,
    pipeline: Callable[[str, bytes], OcrExtractionResult] = run_pipeline,
) -> UploadOutcome:
    from app.ocr.pipeline import sha256_hex

    digest = sha256_hex(content)
    with _single_flight((owner_id, plot_id, digest)):
        existing = repo.find_by_hash(owner_id, plot_id, digest)
        if existing is not None:
            soil_report = None
            return UploadOutcome(
                status=existing["status"],
                result=None,
                extraction=existing,
                soil_report=soil_report,
                reused=True,
            )

        result = pipeline(filename, content)
        if result.status == "failed":
            return UploadOutcome("failed", result, None, None, errors=list(result.errors))

        row = {
            "owner_id": owner_id,
            "plot_id": plot_id,
            "status": "needs_review",
            "source_filename": (filename or "upload")[:_SAFE_FILENAME_MAX],
            "source_content_type": content_type,
            "source_size_bytes": len(content),
            "source_sha256": digest,
            "pipeline_version": result.pipeline_version,
            "page_count": result.page_count,
            "fields": fields_for_storage(result),
            "warnings": list(result.errors),
            "corrections": [],
        }
        try:
            stored = repo.create(row)
        except ExtractionConflict:
            # another worker stored the same document between our lookup and insert
            existing = repo.find_by_hash(owner_id, plot_id, digest)
            if existing is None:
                raise
            return UploadOutcome(existing["status"], None, existing, None, reused=True)

        if result.status == "completed":
            try:
                closed, soil_row, _ = finalize(stored, owner_id, repo=repo, writer=writer)
                return UploadOutcome("completed", result, closed, soil_row)
            except ExtractionNotConfirmable:
                # the pipeline said "ready" but the stricter confirmation rules disagree:
                # leave it for a human rather than saving anything.
                logger.warning("Auto-finalize refused an extraction the pipeline marked ready")
            except Exception:
                logger.exception("Auto-finalize failed; extraction left awaiting review")
                return UploadOutcome(
                    "needs_review",
                    result,
                    stored,
                    None,
                    errors=["The values were read but could not be saved yet. Confirm them to retry."],
                )
        return UploadOutcome("needs_review", result, stored, None)
