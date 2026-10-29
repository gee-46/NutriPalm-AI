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
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routers import digital_twins, geospatial, recommendations, soil_reports

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="NutriPalm AI - Recommendation Engine",
    description=(
        "Soil-report OCR and verification, evidence-gated fertilizer "
        "recommendations, and the Digital Twin data services."
    ),
    version="1.0.0",
)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list(),
    allow_credentials=True,
    # Only what the app uses. The bearer token travels in Authorization, not cookies.
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(recommendations.router)
app.include_router(soil_reports.router)
app.include_router(geospatial.router)
app.include_router(digital_twins.router)



@app.get("/health", tags=["health"])
def health_check() -> dict:
    """Liveness: the process is up. Says nothing about dependencies (see /health/ready)."""
    return {"status": "ok"}


@app.get("/health/ready", tags=["health"])
def readiness_check() -> JSONResponse:
    """
    Readiness: can this instance do its job?

    Required dependencies (database config, token verification, OCR binaries) decide the
    status code (503 when any is missing). Optional integrations are reported but never
    fail readiness. No secret values are returned -- only whether each is configured.
    """
    from app.ocr.engine import _find_tesseract_cmd
    from app.ocr.preprocess import _find_poppler_path
    import shutil

    cfg = get_settings()
    poppler_ok = bool(_find_poppler_path() or shutil.which("pdftoppm"))
    required = {
        "database_configured": bool(cfg.supabase_url and cfg.supabase_service_role_key),
        "token_verification_configured": bool(
            cfg.supabase_jwt_secret or cfg.supabase_jwks_url or cfg.supabase_url
        ),
        "ocr_tesseract_available": bool(_find_tesseract_cmd()),
        "ocr_poppler_available": poppler_ok,
    }
    optional = {
        "sentinel_hub_configured": bool(cfg.sentinel_hub_client_id and cfg.sentinel_hub_client_secret),
    }
    ready = all(required.values())
    return JSONResponse(
        status_code=200 if ready else 503,
        content={
            "status": "ready" if ready else "degraded",
            "environment": cfg.environment,
            "required": required,
            "optional": optional,
        },
    )
