from datetime import datetime, date
from typing import Optional
from uuid import UUID
import pytz

from app.database import get_supabase_client
from app.schemas.twin_snapshot import DataCompleteness

class TwinSnapshotService:
    def __init__(self):
        self.client = get_supabase_client()
        self.ist_tz = pytz.timezone("Asia/Kolkata")

    def aggregate_for_plot(self, plot_id: UUID, target_date: Optional[date] = None) -> None:
        """
        Reads the latest available NDVI, weather, and field data for a plot
        and upserts a fused snapshot into `digital_twins`.
        """
        if not target_date:
            now_utc = datetime.utcnow()
            now_ist = now_utc.replace(tzinfo=pytz.utc).astimezone(self.ist_tz)
            target_date = now_ist.date()

        target_date_iso = target_date.isoformat()

        # Fetch latest NDVI
        ndvi_resp = self.client.table("ndvi_readings") \
            .select("ndvi_mean") \
            .eq("plot_id", str(plot_id)) \
            .lte("captured_date", target_date_iso) \
            .order("captured_date", desc=True) \
            .limit(1) \
            .execute()
        ndvi_data = getattr(ndvi_resp, "data", [])
        ndvi_val = ndvi_data[0].get("ndvi_mean") if ndvi_data else None

        # Fetch latest Weather
        weather_resp = self.client.table("weather_observations") \
            .select("temperature_c, humidity_pct, rainfall_mm") \
            .eq("plot_id", str(plot_id)) \
            .eq("observed_date", target_date_iso) \
            .maybe_single() \
            .execute()
        weather_data = getattr(weather_resp, "data", {}) or {}

        # Fetch latest Soil Report (Cross-module read via service_role bypassing RLS)
        soil_resp = self.client.table("soil_reports") \
            .select("id") \
            .eq("plot_id", str(plot_id)) \
            .lte("created_at", target_date_iso + "T23:59:59Z") \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()
        soil_data = getattr(soil_resp, "data", [])
        
        # Derive completeness
        completeness = DataCompleteness(
            ndvi=bool(ndvi_val),
            weather=bool(weather_data),
            soil=bool(soil_data)
        )

        snapshot = {
            "plot_id": str(plot_id),
            "analysis_date": target_date_iso + "T00:00:00Z", # Required timestamp
            "ndvi": ndvi_val,
            "temperature_c": weather_data.get("temperature_c"),
            "humidity_pct": weather_data.get("humidity_pct"),
            "rainfall_mm": weather_data.get("rainfall_mm"),
            "data_completeness": completeness,
            "is_synthetic": True # For Phase 1 & 2 testing
        }

        # Concurrency Contract: Upsert via ON CONFLICT DO UPDATE
        self.client.table("digital_twins").upsert(
            snapshot, 
            on_conflict="plot_id,analysis_date"
        ).execute()

def get_twin_snapshot_service() -> TwinSnapshotService:
    return TwinSnapshotService()
