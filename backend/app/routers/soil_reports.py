"""
routers/soil_reports.py

POST /api/soil-reports/upload
    Accepts a soil-test lab report (PDF or image), runs OCR + structured
    extraction + validation, and -- only if every required field was
    extracted with high confidence, in range, and in the expected unit --
    persists a new row to `soil_reports`.

    If extraction is incomplete/low-confidence, the endpoint still returns
    HTTP 200 with `persisted: false` and the full per-field result (value,
    unit, confidence, validation, warnings) so the frontend can show the
    farmer exactly what was read and let them confirm/correct it, rather
    than silently guessing or blocking on an error page.

This is the boundary described in backend/docs/integration_contract.md as
"Team Member 3 (Soil Report Upload / OCR)". It writes to the same
`soil_reports` table that app/repositories/soil_report_repository.py
(read-side, used by the Recommendation Engine) already consumes -- no
schema or contract changes required.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.concurrency import run_in_threadpool

from app.dependencies import AuthenticatedUser, get_current_user
from app.exceptions import PlotNotFound, RepositoryNotConfigured
from app.ocr.pipeline import run_pipeline
from app.repositories.plot_repository import PlotRepository, get_plot_repository
from app.repositories.soil_report_repository import (
    SoilReportWriter,
    get_soil_report_writer,
)
from app.schemas.api import SoilReportUploadResponse

logger = logging.getLogger("nutripalm.soil_reports")

router = APIRouter(prefix="/api/soil-reports", tags=["soil-reports"])

ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/jpg",
}
MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB


@router.post(
    "/upload",
    response_model=SoilReportUploadResponse,
    status_code=status.HTTP_200_OK,
)
async def upload_soil_report(
    plot_id: str = Form(...),
    file: UploadFile = File(...),
    current_user: AuthenticatedUser = Depends(get_current_user),
    plot_repo: PlotRepository = Depends(get_plot_repository),
    soil_writer: SoilReportWriter = Depends(get_soil_report_writer),
) -> SoilReportUploadResponse:

    # ---------------------------------------------------------
    # Verify the plot exists and belongs to the caller before doing any
    # expensive OCR work.
    # ---------------------------------------------------------
    try:
        plot = plot_repo.get_plot(plot_id)
    except PlotNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plot not found.",
        ) from exc
    except RepositoryNotConfigured as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Plot data source is not yet configured "
                "(BLOCKED BY TEAMMATE CONTRACT - see "
                "integration_contract.md)."
            ),
        ) from exc

    if plot.owner_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plot not found.",
        )

    # ---------------------------------------------------------
    # Basic upload validation.
    # ---------------------------------------------------------
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"Unsupported file type '{file.content_type}'. "
                "Upload a PDF, JPG, or PNG soil-test report."
            ),
        )

    content = await file.read()

    if not content:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Uploaded file is empty.",
        )

    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit.",
        )

    # ---------------------------------------------------------
    # Run OCR + extraction + validation. This is CPU-bound (Tesseract /
    # pdf2image), so run it off the event loop.
    # ---------------------------------------------------------
    result = await run_in_threadpool(run_pipeline, file.filename or "upload", content)

    if not result.success:
        return SoilReportUploadResponse(
            success=False,
            persisted=False,
            plot_id=plot_id,
            raw_text=result.raw_text,
            nitrogen=result.soil_parameters.nitrogen,
            phosphorus=result.soil_parameters.phosphorus,
            potassium=result.soil_parameters.potassium,
            ph=result.soil_parameters.ph,
            electrical_conductivity=result.soil_parameters.electrical_conductivity,
            organic_carbon=result.soil_parameters.organic_carbon,
            extras=result.soil_parameters.extras,
            micronutrients=result.soil_parameters.micronutrients,
            warnings=result.errors,
        )

    soil_report_id: str | None = None
    persisted = False

    if result.ready_for_persistence:
        params = result.soil_parameters
        try:
            row = await run_in_threadpool(
                soil_writer.create_soil_report,
                plot_id=plot_id,
                owner_id=current_user.user_id,
                nitrogen_kg_ha=params.nitrogen.value,
                phosphorus_kg_ha=params.phosphorus.value,
                potassium_kg_ha=params.potassium.value,
                organic_carbon_percent=params.organic_carbon.value,
                ph=params.ph.value,
                electrical_conductivity=(
                    params.electrical_conductivity.value
                    if params.electrical_conductivity.validation == "valid"
                    else None
                ),
            )
            soil_report_id = row.get("id")
            persisted = True
            logger.info(
                "soil_report.created",
                extra={"owner_id": current_user.user_id, "plot_id": plot_id},
            )
        except RepositoryNotConfigured as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Soil report database is not configured.",
            ) from exc

    return SoilReportUploadResponse(
        success=True,
        persisted=persisted,
        soil_report_id=soil_report_id,
        plot_id=plot_id,
        raw_text=result.raw_text,
        nitrogen=result.soil_parameters.nitrogen,
        phosphorus=result.soil_parameters.phosphorus,
        potassium=result.soil_parameters.potassium,
        ph=result.soil_parameters.ph,
        electrical_conductivity=result.soil_parameters.electrical_conductivity,
        organic_carbon=result.soil_parameters.organic_carbon,
        extras=result.soil_parameters.extras,
        micronutrients=result.soil_parameters.micronutrients,
        warnings=(
            result.errors
            if persisted
            else result.errors
            + (
                []
                if persisted
                else [
                    "One or more required fields could not be confidently "
                    "extracted. Review the values below before saving."
                ]
            )
        ),
    )
