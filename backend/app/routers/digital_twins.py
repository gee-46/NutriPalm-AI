from __future__ import annotations

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import AuthenticatedUser, get_current_user
from app.exceptions import PlotNotFound, RepositoryNotConfigured
from app.repositories.plot_geometry_repository import (
    PlotGeometryRepository,
    get_plot_geometry_repository,
)
from app.schemas.twin_snapshot import PredictionOutput, LiveTwinResponse
from app.services.twin_prediction_service import (
    TwinPredictionService,
    get_twin_prediction_service,
)
from app.services.live_twin_service import (
    LiveTwinService,
    get_live_twin_service_dependency,
)

router = APIRouter(prefix="/api/plots", tags=["Digital Twins"])



@router.get("/{plot_id}/twin/prediction", response_model=PredictionOutput)
def get_prediction(
    plot_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    geometry_repo: PlotGeometryRepository = Depends(get_plot_geometry_repository),
    prediction_service: TwinPredictionService = Depends(get_twin_prediction_service),
) -> PredictionOutput:
    """
    Returns NDVI trend prediction for the caller's owned plot.
    Requires verified Supabase JWT authentication.
    """
    try:
        geometry = geometry_repo.get_geometry(str(plot_id))
    except PlotNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Plot not found."
        ) from exc
    except RepositoryNotConfigured as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Plot data source is not yet configured.",
        ) from exc

    if geometry.owner_id != current_user.user_id:
        # Never reveal existence of another user's plot
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Plot not found."
        )

    return prediction_service.predict_for_plot(plot_id)


@router.get("/{plot_id}/twin/live", response_model=LiveTwinResponse)
def get_live_twin(
    plot_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
    geometry_repo: PlotGeometryRepository = Depends(get_plot_geometry_repository),
    service: LiveTwinService = Depends(get_live_twin_service_dependency),
) -> LiveTwinResponse:
    """
    Returns near real-time Digital Twin state for the caller's plot.

    Fetches live weather from Open-Meteo (updated every 15 min) for the plot's
    own stored coordinates and computes the scores on demand. If weather or
    coordinates are unavailable the endpoint answers 503 instead of
    substituting made-up values.
    """
    try:
        geometry = geometry_repo.get_geometry(str(plot_id))
    except PlotNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Plot not found."
        ) from exc
    except RepositoryNotConfigured as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Plot data source is not yet configured.",
        ) from exc

    if geometry.owner_id != current_user.user_id:
        # Never reveal existence of another user's plot.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Plot not found."
        )

    result = service.compute_live_state(str(plot_id))

    if not result:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Live data is unavailable: the plot has no saved coordinates "
                "or the weather provider did not return complete data."
            ),
        )

    return LiveTwinResponse(**result)
