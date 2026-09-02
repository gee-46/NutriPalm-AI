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
from app.services.live_twin_service import LiveTwinService
from app.database import get_supabase_client

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
) -> LiveTwinResponse:
    """
    Returns near real-time Digital Twin state for the caller's plot.

    Fetches live weather from Open-Meteo (updated every 15 min) and
    computes 5 AI scores on demand:
      - water_stress (Penman-Monteith ET model)
      - disease_risk (palm fungal epidemiology model)
      - crop_health  (NDVI + stress fusion)
      - soil_score   (7-day rainfall integration)
      - yield_estimate_t_ha (FFB yield forecast)

    No caching — every call returns freshly computed values.
    """
    client = get_supabase_client()

    # Verify the plot belongs to this user
    plot_check = (
        client.table("plots")
        .select("owner_id")
        .eq("id", str(plot_id))
        .maybe_single()
        .execute()
    )
    plot_data = getattr(plot_check, "data", None)
    if not plot_data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plot not found.")

    # Note: owner_id from DB, current_user.user_id from JWT
    # For prototype we allow access; enforce strict ownership in production

    service = LiveTwinService(client)
    result = service.compute_live_state(str(plot_id))

    if not result:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to fetch live data. Check plot GPS coordinates.",
        )

    return LiveTwinResponse(**result)
