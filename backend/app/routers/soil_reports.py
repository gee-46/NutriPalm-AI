"""
routers/soil_reports.py

Soil-report workflow (all routes require a verified Supabase JWT and plot ownership):

POST /api/soil-reports/upload
    PDF/JPG/PNG -> validation -> OCR/text extraction -> parsing -> validation.
    * clear, validated read      -> status "completed": a verified soil report is created
    * anything uncertain/missing -> status "needs_review": the extraction is stored, NO soil
                                    report exists yet
    * unreadable                 -> status "failed": nothing is stored
    The same document uploaded again for the same plot returns the stored extraction
    (`reused: true`) without repeating OCR.

GET  /api/soil-reports/extractions            pending/complete extractions for a plot
GET  /api/soil-reports/extractions/{id}       one extraction (as read, with provenance)
POST /api/soil-reports/extractions/{id}/confirm
    The owner confirms values as read and/or types corrections. The soil report is created
    only if every required parameter ends up with a trustworthy value; the original reading
    and each correction are kept in the extraction's audit trail.

Soil reports are written ONLY here (service role). The database refuses browser writes that
claim verification (migration 013).
"""
from __future__ import annotations

import logging
import os
import re
import threading

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.concurrency import run_in_threadpool

from app.config import get_settings
from app.dependencies import AuthenticatedUser
from app.dependencies import get_current_user
from app.rate_limit import limit_heavy
from app.exceptions import (
    ExtractionAlreadyResolved,
    ExtractionNotConfirmable,
    ExtractionNotFound,
    PlotNotFound,
    RepositoryNotConfigured,
)
from app.ocr.schemas import (
    MICRONUTRIENT_PARAMETERS,
    ExtractedField,
    OcrExtractionResult,
)
from app.repositories.plot_repository import PlotRepository, get_plot_repository
from app.repositories.soil_extraction_repository import (
    ExtractionRepository,
    get_extraction_repository,
)
from app.repositories.soil_report_repository import (
    SoilReportWriter,
    get_soil_report_writer,
)
from app.schemas.api import ConfirmExtractionRequest, SoilReportUploadResponse
from app.services import soil_extraction_service as svc

logger = logging.getLogger("nutripalm.soil_reports")

router = APIRouter(prefix="/api/soil-reports", tags=["soil-reports"])

ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/jpg",
}
MAX_UPLOAD_BYTES = get_settings().max_upload_mb * 1024 * 1024
_READ_CHUNK_BYTES = 1024 * 1024

# Leading bytes each allowed type must actually start with. The client-supplied
# Content-Type header is untrusted, so the real content is checked as well.
_MAGIC_BY_CONTENT_TYPE = {
    "application/pdf": (b"%PDF-",),
    "image/png": (b"\x89PNG\r\n\x1a\n",),
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/jpg": (b"\xff\xd8\xff",),
}

# Bound OCR CPU use: extra requests wait briefly, then are told to retry.
_ocr_slots = threading.BoundedSemaphore(max(1, get_settings().ocr_max_concurrent))

_REQUIRED = ("nitrogen", "phosphorus", "potassium", "ph", "organic_carbon")


def _safe_filename(name: str | None) -> str:
    """Metadata only -- uploads are processed in memory and never written to disk."""
    base = re.split(r"[\\/]", name or "upload")[-1]
    base = re.sub(r"[\x00-\x1f\x7f]", "", base).strip()
    return base[:255] or "upload"


async def _read_limited(file: UploadFile) -> bytes:
    """Read the upload in chunks, aborting as soon as the size limit is hit."""
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(_READ_CHUNK_BYTES)
        if not chunk:
            break
        total += len(chunk)
        if total > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit.",
            )
        chunks.append(chunk)
    return b"".join(chunks)


def _require_owned_plot(plot_repo: PlotRepository, plot_id: str, user: AuthenticatedUser):
    try:
        plot = plot_repo.get_plot(plot_id)
    except PlotNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Plot not found.") from exc
    except RepositoryNotConfigured as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Plot data source is not yet configured."
        ) from exc
    if plot.owner_id != user.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Plot not found.")
    return plot


def _missing_field(parameter: str) -> ExtractedField:
    return ExtractedField(parameter=parameter, value=None, validation="missing")


def _build_response(
    *,
    plot_id: str,
    status_: str,
    extraction: dict | None = None,
    result: OcrExtractionResult | None = None,
    soil_report: dict | None = None,
    reused: bool = False,
    extra_warnings: list[str] | None = None,
    not_saved: list[str] | None = None,
) -> SoilReportUploadResponse:
    """One response shape for fresh reads, stored extractions and confirmations."""
    if extraction is not None:
        stored = {k: ExtractedField(**v) for k, v in extraction["fields"].items()}
    elif result is not None:
        from app.ocr.schemas import all_fields

        stored = all_fields(result.soil_parameters)
    else:
        stored = {}

    def get(key: str) -> ExtractedField:
        return stored.get(key) or _missing_field(key)

    review_required = [k for k in _REQUIRED if get(k).validation != "valid"]
    warnings = list(extra_warnings or [])
    if extraction is not None:
        warnings = list(extraction.get("warnings") or []) + warnings
    elif result is not None:
        warnings = list(result.errors) + warnings

    soil_report_id = (soil_report or {}).get("id") or (extraction or {}).get("soil_report_id")
    verification = (soil_report or {}).get("verification_status") or (extraction or {}).get(
        "verification_status"
    )

    return SoilReportUploadResponse(
        success=status_ != "failed",
        status=status_,  # type: ignore[arg-type]
        persisted=soil_report_id is not None and status_ == "completed",
        reused=reused,
        extraction_id=(extraction or {}).get("id"),
        soil_report_id=soil_report_id,
        verification_status=verification,
        plot_id=plot_id,
        raw_text=(result.raw_text if result is not None else ""),
        nitrogen=get("nitrogen"),
        phosphorus=get("phosphorus"),
        potassium=get("potassium"),
        ph=get("ph"),
        electrical_conductivity=get("electrical_conductivity"),
        organic_carbon=get("organic_carbon"),
        extras=[v for k, v in stored.items() if k in ("phosphorus_pentoxide", "potassium_oxide")],
        micronutrients=[get(k) for k in MICRONUTRIENT_PARAMETERS],
        review_required=[] if status_ == "completed" else review_required,
        not_saved=not_saved or [],
        corrections=list((extraction or {}).get("corrections") or []),
        pipeline_version=(extraction or {}).get("pipeline_version") or (result.pipeline_version if result else None),
        page_count=(extraction or {}).get("page_count") or (result.page_count if result else 0),
        warnings=warnings,
    )


def _run_ingest(**kwargs):
    """Runs in the threadpool: bounded concurrency, then the whole pipeline."""
    settings = get_settings()
    if not _ocr_slots.acquire(timeout=settings.ocr_queue_wait_seconds):
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Report processing is busy. Please try again in a moment.",
            headers={"Retry-After": "15"},
        )
    try:
        return svc.ingest_upload(**kwargs)
    finally:
        _ocr_slots.release()


@router.post("/upload", response_model=SoilReportUploadResponse, status_code=status.HTTP_200_OK)
async def upload_soil_report(
    plot_id: str = Form(...),
    file: UploadFile = File(...),
    current_user: AuthenticatedUser = Depends(limit_heavy),
    plot_repo: PlotRepository = Depends(get_plot_repository),
    soil_writer: SoilReportWriter = Depends(get_soil_report_writer),
    extraction_repo: ExtractionRepository = Depends(get_extraction_repository),
) -> SoilReportUploadResponse:
    _require_owned_plot(plot_repo, plot_id, current_user)

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            f"Unsupported file type '{file.content_type}'. Upload a PDF, JPG, or PNG soil-test report.",
        )

    content = await _read_limited(file)
    if not content:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Uploaded file is empty.")
    if not content.startswith(_MAGIC_BY_CONTENT_TYPE[file.content_type]):
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            "File content does not match its declared type.",
        )

    try:
        outcome = await run_in_threadpool(
            _run_ingest,
            owner_id=current_user.user_id,
            plot_id=plot_id,
            filename=_safe_filename(file.filename),
            content_type=file.content_type,
            content=content,
            repo=extraction_repo,
            writer=soil_writer,
        )
    except RepositoryNotConfigured as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc

    if outcome.status == "failed":
        return _build_response(plot_id=plot_id, status_="failed", result=outcome.result)
    return _build_response(
        plot_id=plot_id,
        status_=outcome.status,
        extraction=outcome.extraction,
        result=outcome.result,
        soil_report=outcome.soil_report,
        reused=outcome.reused,
        extra_warnings=outcome.errors,
    )


@router.get("/extractions", response_model=list[SoilReportUploadResponse])
async def list_extractions(
    plot_id: str = Query(...),
    limit: int = Query(10, ge=1, le=50),
    current_user: AuthenticatedUser = Depends(get_current_user),
    plot_repo: PlotRepository = Depends(get_plot_repository),
    extraction_repo: ExtractionRepository = Depends(get_extraction_repository),
) -> list[SoilReportUploadResponse]:
    _require_owned_plot(plot_repo, plot_id, current_user)
    try:
        rows = await run_in_threadpool(
            extraction_repo.list_for_plot, current_user.user_id, plot_id, limit
        )
    except RepositoryNotConfigured as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    return [_build_response(plot_id=plot_id, status_=r["status"], extraction=r) for r in rows]


def _load_owned(extraction_repo: ExtractionRepository, extraction_id: str, user: AuthenticatedUser) -> dict:
    try:
        return extraction_repo.get_for_owner(extraction_id, user.user_id)
    except ExtractionNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Extraction not found.") from exc
    except RepositoryNotConfigured as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc


@router.get("/extractions/{extraction_id}", response_model=SoilReportUploadResponse)
async def get_extraction(
    extraction_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
    extraction_repo: ExtractionRepository = Depends(get_extraction_repository),
) -> SoilReportUploadResponse:
    row = await run_in_threadpool(_load_owned, extraction_repo, extraction_id, current_user)
    return _build_response(plot_id=row["plot_id"], status_=row["status"], extraction=row)


@router.post("/extractions/{extraction_id}/confirm", response_model=SoilReportUploadResponse)
async def confirm_extraction(
    extraction_id: str,
    body: ConfirmExtractionRequest,
    current_user: AuthenticatedUser = Depends(limit_heavy),
    extraction_repo: ExtractionRepository = Depends(get_extraction_repository),
    soil_writer: SoilReportWriter = Depends(get_soil_report_writer),
) -> SoilReportUploadResponse:
    row = await run_in_threadpool(_load_owned, extraction_repo, extraction_id, current_user)

    try:
        closed, soil_row, resolution = await run_in_threadpool(
            svc.finalize,
            row,
            current_user.user_id,
            repo=extraction_repo,
            writer=soil_writer,
            corrections={k: v.model_dump() for k, v in body.corrections.items()},
            confirmed=body.confirmed,
        )
    except ExtractionNotConfirmable as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "extraction_not_confirmable", "problems": exc.problems},
        ) from exc
    except ExtractionAlreadyResolved as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, "This report was already confirmed.") from exc
    except RepositoryNotConfigured as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc

    return _build_response(
        plot_id=closed["plot_id"],
        status_="completed",
        extraction=closed,
        soil_report=soil_row,
        not_saved=resolution.not_saved,
    )
