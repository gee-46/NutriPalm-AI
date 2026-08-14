"""
routers/recommendations.py

POST /api/recommendations           - generate + persist a recommendation
GET  /api/recommendations           - list the caller's own recommendations
GET  /api/recommendations/{id}      - fetch one of the caller's own recommendations

Every endpoint requires a verified Supabase auth token (see
app/dependencies.py). owner_id is NEVER taken from client input - it always
comes from the verified token, and repositories additionally enforce
ownership server-side, so changing an id in the URL cannot expose another
user's data.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import AuthenticatedUser, get_current_user
from app.exceptions import (
    NotAuthorized,
    PlotNotFound,
    RecommendationNotFound,
    RepositoryNotConfigured,
    SoilReportNotFound,
    UnsupportedCrop,
    ValidationFailed,
)
from app.repositories.plot_repository import PlotRepository, get_plot_repository
from app.repositories.recommendation_repository import (
    RecommendationRepository,
    get_recommendation_repository,
)
from app.repositories.soil_report_repository import (
    SoilReportRepository,
    get_soil_report_repository,
)
from app.schemas.api import (
    RecommendationRecordOut,
    RecommendationRequest,
    RecommendationResponse,
    row_to_record,
    to_response,
)
from app.services import recommendation_service

logger = logging.getLogger("nutripalm.recommendations")

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])


@router.post("", response_model=RecommendationResponse, status_code=status.HTTP_201_CREATED)
def create_recommendation(
    request: RecommendationRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    plot_repo: PlotRepository = Depends(get_plot_repository),
    soil_repo: SoilReportRepository = Depends(get_soil_report_repository),
    rec_repo: RecommendationRepository = Depends(get_recommendation_repository),
) -> RecommendationResponse:
    try:
        plot = plot_repo.get_plot(request.plot_id)
    except PlotNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except RepositoryNotConfigured as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Plot data source is not yet configured "
                "(BLOCKED BY TEAMMATE CONTRACT - see integration_contract.md)."
            ),
        ) from exc

    if plot.owner_id != current_user.user_id:
        # Same "not found" style response as an actually-missing plot, to
        # avoid leaking whether a given plot_id exists to non-owners.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plot not found.")

    try:
        soil = soil_repo.get_soil_report(request.soil_report_id)
    except SoilReportNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except RepositoryNotConfigured as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Soil report data source is not yet configured "
                "(BLOCKED BY TEAMMATE CONTRACT - see integration_contract.md)."
            ),
        ) from exc

    if soil.owner_id != current_user.user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Soil report not found.")

    try:
        result = recommendation_service.build_recommendation(
            plot,
            soil,
            crop_price_per_ton_inr=request.crop_price_per_ton_inr,
            fertilizer_price_overrides=request.fertilizer_price_overrides,
        )
    except UnsupportedCrop as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except ValidationFailed as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    try:
        saved_row = rec_repo.save(result)
    except RepositoryNotConfigured as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Recommendation database is not configured.",
        ) from exc

    logger.info(
        "recommendation.created",
        extra={"owner_id": current_user.user_id, "plot_id": plot.plot_id},
    )

    return to_response(
        result,
        recommendation_id=saved_row.get("id"),
        status=saved_row.get("status", "generated"),
        created_at=saved_row.get("created_at"),
    )


@router.get("", response_model=list[RecommendationRecordOut])
def list_recommendations(
    current_user: AuthenticatedUser = Depends(get_current_user),
    rec_repo: RecommendationRepository = Depends(get_recommendation_repository),
) -> list[RecommendationRecordOut]:
    try:
        rows = rec_repo.list_for_owner(current_user.user_id)
    except RepositoryNotConfigured as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Recommendation database is not configured.",
        ) from exc
    return [row_to_record(row) for row in rows]


@router.get("/{recommendation_id}", response_model=RecommendationRecordOut)
def get_recommendation(
    recommendation_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
    rec_repo: RecommendationRepository = Depends(get_recommendation_repository),
) -> RecommendationRecordOut:
    try:
        row = rec_repo.get_for_owner(recommendation_id, current_user.user_id)
    except (RecommendationNotFound, NotAuthorized) as exc:
        # Both map to 404, deliberately, so ownership can't be probed by
        # distinguishing "not found" from "forbidden".
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except RepositoryNotConfigured as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Recommendation database is not configured.",
        ) from exc
    return row_to_record(row)
