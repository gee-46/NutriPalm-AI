"""
sentinel_service.py

Real-time Sentinel-2 NDVI calculation via Sentinel Hub's Statistical API.

NDVI = (NIR - RED) / (NIR + RED)
For Sentinel-2 L2A: RED = B04, NIR = B08.

This service NEVER fabricates NDVI values. If Sentinel Hub credentials are
not configured, or the request fails, it raises GeospatialServiceUnavailable
with a human-readable reason -- callers must surface that as an explicit
"unavailable / configuration required" state, not a random number.

Configuration (see backend/.env.example):
    SENTINEL_HUB_CLIENT_ID
    SENTINEL_HUB_CLIENT_SECRET
    SENTINEL_HUB_BASE_URL   (defaults to https://services.sentinel-hub.com)
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Any

import httpx

from app.config import Settings, get_settings
from app.exceptions import GeospatialServiceUnavailable

logger = logging.getLogger("nutripalm.sentinel")

_TOKEN_CACHE: dict[str, Any] = {"token": None, "expires_at": 0.0}
_TOKEN_LOCK = Lock()

# NDVI evalscript: computes per-pixel NDVI from Sentinel-2 bands B04 (red)
# and B08 (NIR), masked to valid (non-cloudy per SCL) pixels.
_NDVI_EVALSCRIPT = """
//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "SCL", "dataMask"] }],
    output: [{ id: "ndvi", bands: 1 }, { id: "dataMask", bands: 1 }],
  };
}
function evaluatePixel(sample) {
  let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04 + 1e-6);
  // SCL 8,9,10 = cloud (medium/high prob, cirrus); 3 = cloud shadow
  let cloudy = [3, 8, 9, 10].includes(sample.SCL);
  let mask = (cloudy || sample.dataMask === 0) ? 0 : 1;
  return { ndvi: [ndvi], dataMask: [mask] };
}
"""


@dataclass(frozen=True)
class NdviResult:
    mean_ndvi: float
    min_ndvi: float
    max_ndvi: float
    acquisition_date: str  # ISO date, end of the queried interval
    cloud_cover_percent: float | None
    sample_count: int
    source: str = "Sentinel-2 (Sentinel Hub Statistical API)"


def _get_access_token(settings: Settings) -> str:
    """Fetch (and cache) an OAuth2 client-credentials token for Sentinel Hub."""
    now = time.time()
    if _TOKEN_CACHE["token"] and now < _TOKEN_CACHE["expires_at"]:
        return _TOKEN_CACHE["token"]

    with _TOKEN_LOCK:
        now = time.time()
        if _TOKEN_CACHE["token"] and now < _TOKEN_CACHE["expires_at"]:
            return _TOKEN_CACHE["token"]

        token_url = f"{settings.sentinel_hub_base_url.rstrip('/')}/oauth/token"
        try:
            response = httpx.post(
                token_url,
                data={
                    "grant_type": "client_credentials",
                    "client_id": settings.sentinel_hub_client_id,
                    "client_secret": settings.sentinel_hub_client_secret,
                },
                timeout=10.0,
            )
            response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise GeospatialServiceUnavailable(
                "Could not authenticate with Sentinel Hub."
            ) from exc

        access_token = payload.get("access_token")
        expires_in = payload.get("expires_in", 3000)
        if not access_token:
            raise GeospatialServiceUnavailable(
                "Sentinel Hub did not return an access token."
            )

        _TOKEN_CACHE["token"] = access_token
        # Refresh a little early to avoid edge-of-expiry failures.
        _TOKEN_CACHE["expires_at"] = now + max(int(expires_in) - 60, 30)

        return access_token


def is_configured(settings: Settings | None = None) -> bool:
    settings = settings or get_settings()
    return bool(settings.sentinel_hub_client_id and settings.sentinel_hub_client_secret)


def get_ndvi_for_geometry(
    geojson_polygon: dict[str, Any],
    *,
    lookback_days: int = 30,
    settings: Settings | None = None,
) -> NdviResult:
    """
    Query the Sentinel Hub Statistical API for mean/min/max NDVI over a
    plot's polygon for the most recent `lookback_days` window.

    Raises GeospatialServiceUnavailable if credentials are missing or the
    request fails for any reason (network, auth, quota, bad geometry).
    """
    settings = settings or get_settings()

    if not is_configured(settings):
        raise GeospatialServiceUnavailable(
            "Sentinel-2 NDVI is not configured. Set SENTINEL_HUB_CLIENT_ID "
            "and SENTINEL_HUB_CLIENT_SECRET (see backend/.env.example)."
        )

    if geojson_polygon.get("type") != "Polygon" or not geojson_polygon.get("coordinates"):
        raise GeospatialServiceUnavailable(
            "Plot does not have a mapped boundary polygon yet."
        )

    token = _get_access_token(settings)

    now = datetime.now(timezone.utc)
    start = now - timedelta(days=lookback_days)

    request_body = {
        "input": {
            "bounds": {
                "geometry": geojson_polygon,
                "properties": {"crs": "http://www.opengis.net/def/crs/OGC/1.3/CRS84"},
            },
            "data": [
                {
                    "type": "sentinel-2-l2a",
                    "dataFilter": {"maxCloudCoverage": 60},
                }
            ],
        },
        "aggregation": {
            "timeRange": {
                "from": start.strftime("%Y-%m-%dT00:00:00Z"),
                "to": now.strftime("%Y-%m-%dT23:59:59Z"),
            },
            "aggregationInterval": {"of": "P30D"},
            "evalscript": _NDVI_EVALSCRIPT,
            "resx": 10,
            "resy": 10,
        },
        "calculations": {"default": {}},
    }

    stats_url = f"{settings.sentinel_hub_base_url.rstrip('/')}/api/v1/statistics"

    try:
        response = httpx.post(
            stats_url,
            json=request_body,
            headers={"Authorization": f"Bearer {token}"},
            timeout=30.0,
        )
        response.raise_for_status()
        payload = response.json()
    except httpx.TimeoutException as exc:
        raise GeospatialServiceUnavailable("Sentinel Hub request timed out.") from exc
    except httpx.HTTPStatusError as exc:
        raise GeospatialServiceUnavailable(
            f"Sentinel Hub returned HTTP {exc.response.status_code}."
        ) from exc
    except (httpx.HTTPError, ValueError) as exc:
        raise GeospatialServiceUnavailable(
            "Could not reach the Sentinel Hub statistics service."
        ) from exc

    data_intervals = payload.get("data", [])
    if not data_intervals:
        raise GeospatialServiceUnavailable(
            "No cloud-free Sentinel-2 imagery was available for this plot "
            "in the requested time window."
        )

    # Use the most recent interval with actual sample data.
    for interval in reversed(data_intervals):
        outputs = interval.get("outputs", {})
        ndvi_stats = outputs.get("ndvi", {}).get("bands", {}).get("B0", {}).get("stats")
        if not ndvi_stats or ndvi_stats.get("sampleCount", 0) <= ndvi_stats.get("noDataCount", 0):
            continue

        interval_range = interval.get("interval", {})
        acquisition_date = interval_range.get("to", now.isoformat())[:10]

        return NdviResult(
            mean_ndvi=round(float(ndvi_stats["mean"]), 4),
            min_ndvi=round(float(ndvi_stats["min"]), 4),
            max_ndvi=round(float(ndvi_stats["max"]), 4),
            acquisition_date=acquisition_date,
            cloud_cover_percent=None,
            sample_count=int(ndvi_stats.get("sampleCount", 0)),
        )

    raise GeospatialServiceUnavailable(
        "Sentinel-2 imagery for this plot was entirely cloud-obscured in "
        "the requested time window."
    )


def classify_ndvi(mean_ndvi: float) -> str:
    """Simple, documented NDVI health banding for display purposes."""
    if mean_ndvi >= 0.5:
        return "Healthy"
    if mean_ndvi >= 0.3:
        return "Moderate"
    return "Stressed"
