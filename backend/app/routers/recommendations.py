"""
routers/recommendations.py

POST /api/recommendations
    Generate + persist a recommendation.

GET /api/recommendations
    List the caller's own recommendations.

GET /api/recommendations/{id}
    Fetch one of the caller's own recommendations.

Every endpoint requires a verified Supabase auth token.
owner_id is never taken from client input.
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
from app.repositories.plot_repository import (
    PlotRepository,
    get_plot_repository,
)
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

router = APIRouter(
    prefix="/api/recommendations",
    tags=["recommendations"],
)


@router.post(
    "",
    response_model=RecommendationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_recommendation(
    request: RecommendationRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    plot_repo: PlotRepository = Depends(get_plot_repository),
    soil_repo: SoilReportRepository = Depends(get_soil_report_repository),
    rec_repo: RecommendationRepository = Depends(
        get_recommendation_repository
    ),
) -> RecommendationResponse:
    # ---------------------------------------------------------
    # Fetch plot
    # ---------------------------------------------------------
    try:
        plot = plot_repo.get_plot(request.plot_id)
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

    # ---------------------------------------------------------
    # Verify plot ownership
    # ---------------------------------------------------------
    if plot.owner_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plot not found.",
        )

    # ---------------------------------------------------------
    # Fetch soil report
    # ---------------------------------------------------------
    try:
        soil = soil_repo.get_soil_report(
            request.soil_report_id
        )
    except SoilReportNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Soil report not found.",
        ) from exc
    except RepositoryNotConfigured as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Soil report data source is not yet configured "
                "(BLOCKED BY TEAMMATE CONTRACT - see "
                "integration_contract.md)."
            ),
        ) from exc

    # ---------------------------------------------------------
    # Verify soil report ownership
    # ---------------------------------------------------------
    if soil.owner_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Soil report not found.",
        )

    # ---------------------------------------------------------
    # Verify soil report belongs to selected plot
    # ---------------------------------------------------------
    if soil.plot_id != plot.plot_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Soil report not found.",
        )

    # ---------------------------------------------------------
    # Build recommendation
    # ---------------------------------------------------------
    try:
        result = recommendation_service.build_recommendation(
            plot,
            soil,
            crop_price_per_ton_inr=request.crop_price_per_ton_inr,
            fertilizer_price_overrides=(
                request.fertilizer_price_overrides
            ),
        )
    except UnsupportedCrop as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except ValidationFailed as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    # ---------------------------------------------------------
    # Persist recommendation
    # ---------------------------------------------------------
    try:
        saved_row = rec_repo.save(result)
    except RepositoryNotConfigured as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Recommendation database is not configured.",
        ) from exc

    logger.info(
        "recommendation.created",
        extra={
            "owner_id": current_user.user_id,
            "plot_id": plot.plot_id,
        },
    )

    return to_response(
        result,
        recommendation_id=saved_row.get("id"),
        status=saved_row.get("status", "generated"),
        created_at=saved_row.get("created_at"),
    )


@router.get(
    "",
    response_model=list[RecommendationRecordOut],
)
def list_recommendations(
    current_user: AuthenticatedUser = Depends(get_current_user),
    rec_repo: RecommendationRepository = Depends(
        get_recommendation_repository
    ),
) -> list[RecommendationRecordOut]:
    try:
        rows = rec_repo.list_for_owner(
            current_user.user_id
        )
    except RepositoryNotConfigured as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Recommendation database is not configured.",
        ) from exc

    return [
        row_to_record(row)
        for row in rows
    ]


@router.get(
    "/{recommendation_id}",
    response_model=RecommendationRecordOut,
)
def get_recommendation(
    recommendation_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
    rec_repo: RecommendationRepository = Depends(
        get_recommendation_repository
    ),
) -> RecommendationRecordOut:
    try:
        row = rec_repo.get_for_owner(
            recommendation_id,
            current_user.user_id,
        )
    except (RecommendationNotFound, NotAuthorized) as exc:
        # Deliberately use one fixed response for both cases so a caller
        # cannot determine whether another user's recommendation exists.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recommendation not found.",
        ) from exc
    except RepositoryNotConfigured as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Recommendation database is not configured.",
        ) from exc

    return row_to_record(row)
