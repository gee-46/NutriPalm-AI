import uuid
import os
from datetime import datetime, timedelta
import pytz
from dotenv import load_dotenv

# Load environment variables from the project root
load_dotenv(os.path.join(os.path.dirname(__file__), '../../.env'))

from app.database import get_supabase_client

# =============================================================================
# SATELLITE INTEGRATION POINT (Phase 2)
# =============================================================================
# This script currently generates SYNTHETIC data to simulate 90 days of
# satellite telemetry for UI development and prototype demos.
#
# To replace with REAL satellite data, implement a new service at:
#   backend/app/services/satellite_ingestion_service.py
#
# That service should:
#   1. Accept a plot_id and its GPS boundary polygon
#   2. Call Google Earth Engine API (or Sentinel Hub) to pull NDVI imagery
#      for the given boundary over the past N days
#   3. Process the GeoTIFF response to extract mean NDVI for the plot area
#   4. Upsert the result into digital_twins using the same schema below
#   5. Be triggered by a cron job every 5 days (Sentinel-2 revisit frequency)
#
# Required columns (already in the digital_twins table):
#   - plot_id (uuid)
#   - analysis_date (timestamptz)
#   - ndvi (numeric)              ← from satellite
#   - crop_health_score (numeric) ← derived from NDVI + agronomic model
#   - water_stress_score (numeric) ← from NDVI + rainfall + soil data fusion
#   - temperature_c (numeric)     ← from ERA5 / OpenMeteo weather API
#   - humidity_pct (numeric)      ← from ERA5 / OpenMeteo weather API
#   - is_synthetic (boolean)      ← set False for real satellite data
# =============================================================================

def generate_synthetic_data(plot_id: str, days: int = 90):
    """
    Generates 90 days of plausible NDVI/weather/soil values with a known trend
    and flags them as is_synthetic = True.
    """
    client = get_supabase_client()
    ist_tz = pytz.timezone("Asia/Kolkata")
    now_ist = datetime.utcnow().replace(tzinfo=pytz.utc).astimezone(ist_tz)
    
    records = []
    base_ndvi = 0.60
    
    for i in range(days):
        target_date = now_ist - timedelta(days=i)
        # Synthetic upward trend for testing
        trend_ndvi = base_ndvi + (0.20 * (days - i) / days)
        
        # Synthetic health trend: starts lower, improves over time (older days = lower)
        trend_health = 55 + (35 * (days - i) / days)  # 55% -> 90%
        trend_moisture = 20 + (30 * (days - i) / days)  # 20% -> 50%

        record = {
            "plot_id": plot_id,
            "analysis_date": target_date.strftime("%Y-%m-%dT00:00:00Z"),
            "ndvi": round(trend_ndvi, 2),
            "crop_health_score": round(trend_health, 1),
            "water_stress_score": round(trend_moisture, 1),
            "temperature_c": 30.0 + (i % 5),
            "humidity_pct": 60.0 + (i % 10),
            "rainfall_mm": 0.0 if i % 7 != 0 else 15.0,
            "data_completeness": {"ndvi": True, "weather": True, "soil": False},
            "is_synthetic": True
        }
        records.append(record)
        
    # Upsert all
    for chunk in [records[i:i+50] for i in range(0, len(records), 50)]:
        client.table("digital_twins").upsert(chunk, on_conflict="plot_id,analysis_date").execute()
    
    print(f"Generated {days} synthetic snapshots for plot {plot_id}")

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        generate_synthetic_data(sys.argv[1])
    else:
        print("Usage: python generate_synthetic_snapshots.py <plot_id>")
