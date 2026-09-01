from fastapi import APIRouter, Depends
from uuid import UUID

from app.schemas.twin_snapshot import PredictionOutput
from app.services.twin_prediction_service import get_twin_prediction_service, TwinPredictionService
# Normally auth is here, for v1 prototype we'll keep it simple

router = APIRouter(prefix="/api/plots", tags=["Digital Twins"])

@router.get("/{plot_id}/twin/prediction", response_model=PredictionOutput)
def get_prediction(
    plot_id: UUID,
    prediction_service: TwinPredictionService = Depends(get_twin_prediction_service)
):
    return prediction_service.predict_for_plot(plot_id)
