"""
main.py

FastAPI application entrypoint for the NutriPalm AI recommendation backend.

Run locally with:
    uvicorn app.main:app --reload --port 8000

Swagger UI: http://localhost:8000/docs
"""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import digital_twins, geospatial, recommendations, soil_reports

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="NutriPalm AI - Recommendation Engine",
    description=(
        "AI/ML backend: nutrient analysis, severity scoring, fertilizer "
        "dosage, yield prediction, ROI, and farmer-friendly explanations."
    ),
    version="1.0.0",
)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(recommendations.router)
app.include_router(soil_reports.router)
app.include_router(geospatial.router)
app.include_router(digital_twins.router)



@app.get("/health", tags=["health"])
def health_check() -> dict:
    return {"status": "ok"}
