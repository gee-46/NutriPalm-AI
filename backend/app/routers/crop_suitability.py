from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List

from app.database import get_supabase_client
from app.schemas.suitability import (
    LocationData,
    SoilData,
    WaterData,
    FarmConditions,
    CropRequirement,
)
from app.services.weather_service import WeatherService, get_weather_service
from app.services.suitability_engine import calculate_suitability
from app.services.suitability_explainer import SuitabilityExplainer

router = APIRouter(
    prefix="/api/crop-suitability",
    tags=["crop-suitability"],
)

class SuitabilityRequest(BaseModel):
    location: LocationData
    soil: SoilData
    water: WaterData
    farm: FarmConditions

class EvaluatedCropOut(BaseModel):
    crop_name: str
    category: str
    raw_score: int
    explanation: str

class SuitabilityResponse(BaseModel):
    top_crops: List[EvaluatedCropOut]

@router.post(
    "",
    response_model=SuitabilityResponse,
    status_code=status.HTTP_200_OK,
)
async def evaluate_crop_suitability(
    request: SuitabilityRequest,
    weather_service: WeatherService = Depends(get_weather_service),
) -> SuitabilityResponse:
    # 1. Payload validation is automatically handled by FastAPI + Pydantic

    # 2. Call WeatherService to get climate data
    try:
        climate_data = weather_service.fetch_climate(
            request.location.latitude,
            request.location.longitude
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Weather service unavailable: {str(e)}"
        )

    # 3. Query the DB (Supabase) for crops
    client = get_supabase_client()
    try:
        res = client.table("crop_requirements").select("*").execute()
        if not res.data:
            # Not a critical error if no crops exist, just return empty
            return SuitabilityResponse(top_crops=[])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database query failed: {str(e)}"
        )
    
    crops = [CropRequirement(**row) for row in res.data]

    # 4. Loop through the fetched crops and run Deterministic Engine on each
    evaluated = []
    for crop in crops:
        result_json = calculate_suitability(
            crop=crop,
            soil=request.soil,
            climate=climate_data,
            water=request.water,
            location=request.location,
            farm=request.farm
        )
        evaluated.append(result_json)

    # 5. Rank crops by raw_score descending and slice top 3
    evaluated.sort(key=lambda x: x["raw_score"], reverse=True)
    top_3 = evaluated[:3]

    # 6. Pass Top 3 to LLM Explanation Layer
    explainer = SuitabilityExplainer()
    final_results = []
    for result in top_3:
        try:
            explanation = await explainer.generate_explanation(result)
        except Exception as e:
            # Fallback if LLM times out or errors
            explanation = explainer._fallback_formatter(result)
            
        final_results.append(
            EvaluatedCropOut(
                crop_name=result["crop_name"],
                category=result["category"],
                raw_score=result["raw_score"],
                explanation=explanation
            )
        )

    # 7. Return final structured report
    return SuitabilityResponse(top_crops=final_results)
