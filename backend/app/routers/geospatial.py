"""
routers/geospatial.py

GET /api/geospatial/ndvi/{plot_id}
    Sentinel-2 NDVI for the caller's own plot boundary.

GET /api/geospatial/bhunaksha/{plot_id}
    Karnataka Bhu-Naksha/cadastral parcel lookup for the caller's own plot
    (currently always reports unavailable -- see app/services/cadastral_service.py).

Every endpoint requires a verified Supabase auth token and only ever
operates on plots owned by the caller. `available: false` is a normal
response, not an error -- it means the external provider isn't configured
or has no data, and the frontend renders that state explicitly.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import AuthenticatedUser, get_current_user
from app.exceptions import GeospatialServiceUnavailable, PlotNotFound, RepositoryNotConfigured
from app.repositories.plot_geometry_repository import (
    PlotGeometryRepository,
    get_plot_geometry_repository,
)
from app.schemas.geospatial import CadastralResponse, NdviResponse
from app.services import sentinel_service
from app.services.cadastral_service import CadastralProvider, get_cadastral_provider

logger = logging.getLogger("nutripalm.geospatial")

router = APIRouter(prefix="/api/geospatial", tags=["geospatial"])


def _load_owned_geometry(
    plot_id: str,
    current_user: AuthenticatedUser,
    geometry_repo: PlotGeometryRepository,
):
    try:
        geometry = geometry_repo.get_geometry(plot_id)
    except PlotNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plot not found.") from exc
    except RepositoryNotConfigured as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Plot data source is not yet configured.",
        ) from exc

    if geometry.owner_id != current_user.user_id:
        # Never reveal existence of another user's plot.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plot not found.")

    return geometry


@router.get("/ndvi/{plot_id}", response_model=NdviResponse)
def get_ndvi(
    plot_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
    geometry_repo: PlotGeometryRepository = Depends(get_plot_geometry_repository),
) -> NdviResponse:
    geometry = _load_owned_geometry(plot_id, current_user, geometry_repo)

    if not geometry.boundary:
        return NdviResponse(
            plot_id=plot_id,
            available=False,
            source="Sentinel-2",
            reason="This plot does not have a mapped boundary polygon yet.",
        )

    try:
        result = sentinel_service.get_ndvi_for_geometry(geometry.boundary)
    except GeospatialServiceUnavailable as exc:
        return NdviResponse(
            plot_id=plot_id,
            available=False,
            source="Sentinel-2",
            reason=str(exc),
        )

    return NdviResponse(
        plot_id=plot_id,
        available=True,
        mean_ndvi=result.mean_ndvi,
        min_ndvi=result.min_ndvi,
        max_ndvi=result.max_ndvi,
        acquisition_date=result.acquisition_date,
        cloud_cover_percent=result.cloud_cover_percent,
        status=sentinel_service.classify_ndvi(result.mean_ndvi),
        source=result.source,
    )


@router.get("/bhunaksha/{plot_id}", response_model=CadastralResponse)
def get_cadastral(
    plot_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
    geometry_repo: PlotGeometryRepository = Depends(get_plot_geometry_repository),
    cadastral_provider: CadastralProvider = Depends(get_cadastral_provider),
) -> CadastralResponse:
    geometry = _load_owned_geometry(plot_id, current_user, geometry_repo)

    if not geometry.boundary:
        return CadastralResponse(
            plot_id=plot_id,
            available=False,
            reason="This plot does not have a mapped boundary polygon yet.",
        )

    try:
        result = cadastral_provider.get_parcel_for_geometry(geometry.boundary)
    except GeospatialServiceUnavailable as exc:
        return CadastralResponse(plot_id=plot_id, available=False, reason=str(exc))

    return CadastralResponse(
        plot_id=plot_id,
        available=True,
        parcel_reference=result.parcel_reference,
        geometry=result.geometry,
        source=result.source,
    )
