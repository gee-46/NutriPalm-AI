"""
satellite_ingestion_service.py

Fetches REAL environmental data from public APIs and upserts into digital_twins.

Data Sources:
  - Weather (temp, humidity, rainfall): Open-Meteo API (FREE, no API key needed)
  - NDVI (vegetation index):            Sentinel Hub API (FREE account needed)
                                        Sign up at: https://www.sentinel-hub.com/
                                        Docs: https://docs.sentinel-hub.com/api/latest/

Environment Variables Required (add to .env):
  SENTINEL_HUB_CLIENT_ID      (from Sentinel Hub OAuth app)
  SENTINEL_HUB_CLIENT_SECRET  (from Sentinel Hub OAuth app)

  If missing, NDVI ingestion is skipped gracefully and only real weather is ingested.

Usage:
  cd backend
  python -m scripts.ingest_real_data <plot_id>
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, date
from typing import Optional
import pytz
import requests

from app.database import get_supabase_client

log = logging.getLogger(__name__)

IST = pytz.timezone("Asia/Kolkata")
OPEN_METEO_URL = "https://archive-api.open-meteo.com/v1/archive"
SENTINEL_HUB_TOKEN_URL = "https://services.sentinel-hub.com/auth/realms/main/protocol/openid-connect/token"
SENTINEL_HUB_PROCESS_URL = "https://services.sentinel-hub.com/api/v1/process"


# ---------------------------------------------------------------------------
# Weather: Open-Meteo (100% free, no API key required)
# ---------------------------------------------------------------------------

def fetch_weather_history(lat: float, lon: float, days: int = 90) -> list[dict]:
    """
    Fetches daily temperature, humidity, and precipitation from Open-Meteo
    ERA5 reanalysis archive. Works for any coordinates worldwide with no key.
    """
    end_date = date.today() - timedelta(days=2)  # archive lags ~2 days
    start_date = end_date - timedelta(days=days)

    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "daily": [
            "temperature_2m_mean",
            "relative_humidity_2m_mean",
            "precipitation_sum",
        ],
        "timezone": "Asia/Kolkata",
    }

    try:
        resp = requests.get(OPEN_METEO_URL, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json().get("daily", {})
    except Exception as e:
        log.error("Open-Meteo request failed: %s", e)
        return []

    records = []
    dates = data.get("time", [])
    temps = data.get("temperature_2m_mean", [])
    humids = data.get("relative_humidity_2m_mean", [])
    rains = data.get("precipitation_sum", [])

    for i, d in enumerate(dates):
        records.append({
            "date": d,
            "temperature_c": temps[i] if i < len(temps) else None,
            "humidity_pct": humids[i] if i < len(humids) else None,
            "rainfall_mm": rains[i] if i < len(rains) else None,
        })

    log.info("Open-Meteo returned %d weather records for (%.4f, %.4f)", len(records), lat, lon)
    return records


# ---------------------------------------------------------------------------
# NDVI: Sentinel Hub (free account at sentinel-hub.com)
# ---------------------------------------------------------------------------

def _get_sentinel_token(client_id: str, client_secret: str) -> Optional[str]:
    """Gets a short-lived OAuth2 bearer token from Sentinel Hub."""
    try:
        resp = requests.post(
            SENTINEL_HUB_TOKEN_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": client_id,
                "client_secret": client_secret,
            },
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json().get("access_token")
    except Exception as e:
        log.error("Sentinel Hub auth failed: %s", e)
        return None


def fetch_ndvi_for_date(lat: float, lon: float, target_date: str, token: str) -> Optional[float]:
    """
    Fetches mean NDVI for a 1km² bounding box around the plot centroid
    using Sentinel-2 L2A imagery. Returns None if cloudy or no data.
    """
    delta = 0.005  # ~500m buffer each direction
    bbox = [lon - delta, lat - delta, lon + delta, lat + delta]

    evalscript = """
    //VERSION=3
    function setup() {
      return { input: ["B04", "B08", "CLM"], output: { bands: 1, sampleType: "FLOAT32" } };
    }
    function evaluatePixel(sample) {
      if (sample.CLM == 1) return [-9999];
      var ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04 + 0.0001);
      return [ndvi];
    }
    """

    d = datetime.fromisoformat(target_date)
    time_range = {
        "from": (d - timedelta(days=5)).strftime("%Y-%m-%dT00:00:00Z"),
        "to": (d + timedelta(days=1)).strftime("%Y-%m-%dT23:59:59Z"),
    }

    payload = {
        "input": {
            "bounds": {
                "bbox": bbox,
                "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/4326"},
            },
            "data": [{
                "type": "sentinel-2-l2a",
                "dataFilter": {
                    "timeRange": time_range,
                    "maxCloudCoverage": 30,
                    "mosaickingOrder": "leastCC",
                },
            }],
        },
        "output": {
            "width": 10,
            "height": 10,
            "responses": [{"identifier": "default", "format": {"type": "image/tiff"}}],
        },
        "evalscript": evalscript,
    }

    try:
        resp = requests.post(
            SENTINEL_HUB_PROCESS_URL,
            json=payload,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            timeout=60,
        )
        if resp.status_code == 204:
            return None  # No imagery for this date window
        resp.raise_for_status()

        try:
            import numpy as np
            arr = np.frombuffer(resp.content, dtype=np.float32)
            valid = arr[(arr > -1.0) & (arr <= 1.0)]
            if len(valid) == 0:
                return None
            return float(round(float(valid.mean()), 4))
        except ImportError:
            log.warning("numpy not installed. Run: pip install numpy")
            return None

    except Exception as e:
        log.error("Sentinel Hub NDVI fetch failed for %s: %s", target_date, e)
        return None


# ---------------------------------------------------------------------------
# Main Service
# ---------------------------------------------------------------------------

class SatelliteIngestionService:
    """
    Orchestrates real data ingestion from Open-Meteo (weather) and
    Sentinel Hub (NDVI) into the digital_twins table.
    """

    def __init__(self):
        self.client = get_supabase_client()
        import os
        self.sentinel_client_id = os.environ.get("SENTINEL_HUB_CLIENT_ID", "")
        self.sentinel_client_secret = os.environ.get("SENTINEL_HUB_CLIENT_SECRET", "")

    def _get_plot_coords(self, plot_id: str) -> Optional[tuple[float, float]]:
        resp = (
            self.client.table("plots")
            .select("latitude,longitude,name")
            .eq("id", plot_id)
            .maybe_single()
            .execute()
        )
        data = getattr(resp, "data", None)
        if not data:
            log.error("Plot %s not found.", plot_id)
            return None
        lat, lon = data.get("latitude"), data.get("longitude")
        if lat is None or lon is None:
            log.error(
                "Plot '%s' has no coordinates. Open the app → Farm Plots → Edit Plot "
                "and enter the latitude/longitude for this plot.",
                data.get("name", plot_id),
            )
            return None
        return float(lat), float(lon)

    def ingest_for_plot(self, plot_id: str, days: int = 90) -> int:
        """
        Fetches real weather + NDVI for the past `days` days.
        Returns number of records upserted.
        """
        coords = self._get_plot_coords(plot_id)
        if not coords:
            return 0
        lat, lon = coords

        log.info("Ingesting real satellite data for plot %s at (%.4f, %.4f)", plot_id, lat, lon)

        # Step 1: Real weather from Open-Meteo
        weather_records = fetch_weather_history(lat, lon, days)
        if not weather_records:
            log.error("Open-Meteo returned no data. Check coordinates or internet connection.")
            return 0

        # Step 2: Authenticate with Sentinel Hub if credentials are available
        sentinel_token = None
        use_sentinel = bool(self.sentinel_client_id and self.sentinel_client_secret)
        if use_sentinel:
            log.info("Authenticating with Sentinel Hub for NDVI...")
            sentinel_token = _get_sentinel_token(self.sentinel_client_id, self.sentinel_client_secret)
            if not sentinel_token:
                log.warning("Sentinel Hub auth failed. Weather-only ingestion will proceed.")
                use_sentinel = False
        else:
            log.info(
                "No Sentinel Hub credentials in .env. "
                "Add SENTINEL_HUB_CLIENT_ID and SENTINEL_HUB_CLIENT_SECRET to enable real NDVI."
            )

        # Step 3: Build records
        records = []
        ndvi_every_n = 5  # Sentinel-2 revisits every ~5 days

        for i, w in enumerate(weather_records):
            record = {
                "plot_id": plot_id,
                "analysis_date": f"{w['date']}T00:00:00Z",
                "temperature_c": w["temperature_c"],
                "humidity_pct": w["humidity_pct"],
                "rainfall_mm": w["rainfall_mm"],
                "is_synthetic": False,
                "data_completeness": {"ndvi": False, "weather": True, "soil": False},
            }

            if use_sentinel and sentinel_token and i % ndvi_every_n == 0:
                ndvi = fetch_ndvi_for_date(lat, lon, w["date"], sentinel_token)
                if ndvi is not None:
                    record["ndvi"] = ndvi
                    record["crop_health_score"] = round(ndvi * 100, 1)
                    record["data_completeness"]["ndvi"] = True
                    log.info("  [NDVI] %s → %.4f", w["date"], ndvi)

            records.append(record)

        # Step 4: Upsert in chunks
        upserted = 0
        for chunk in [records[j:j+50] for j in range(0, len(records), 50)]:
            self.client.table("digital_twins").upsert(
                chunk, on_conflict="plot_id,analysis_date"
            ).execute()
            upserted += len(chunk)

        log.info("Done. %d records upserted for plot %s.", upserted, plot_id)
        return upserted


def get_satellite_ingestion_service() -> SatelliteIngestionService:
    return SatelliteIngestionService()
