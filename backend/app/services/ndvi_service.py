from datetime import datetime
from uuid import UUID
import pytz

from app.database import get_supabase_client

class NdviService:
    def __init__(self):
        self.client = get_supabase_client()
        self.ist_tz = pytz.timezone("Asia/Kolkata")

    def ingest_for_plot(self, plot_id: UUID) -> None:
        """
        Fetches NDVI data for the given plot and upserts into ndvi_readings.
        If the plot lacks geometry, logs an ingestion_gap instead of skipping.
        """
        # 1. Fetch plot geometry
        plot_resp = self.client.table("plots").select("id, boundary_geom").eq("id", str(plot_id)).maybe_single().execute()
        plot_data = getattr(plot_resp, "data", None)
        
        if not plot_data or not plot_data.get("boundary_geom"):
            # Missing geometry contract: log ingestion_gap
            now_ist = datetime.now(self.ist_tz)
            self.client.table("field_observations").insert({
                "plot_id": str(plot_id),
                "observed_at": now_ist.isoformat(),
                "observation_type": "ingestion_gap",
                "payload": {"reason": "missing_geometry", "service": "ndvi_service"}
            }).execute()
            return
            
        # 2. Stub for external API (Copernicus/Sentinel Hub)
        # Using a dummy reading for Phase 1
        now_utc = datetime.utcnow()
        # Explicit conversion to IST calendar date
        now_ist = now_utc.replace(tzinfo=pytz.utc).astimezone(self.ist_tz)
        captured_date = now_ist.date().isoformat()
        
        reading = {
            "plot_id": str(plot_id),
            "captured_date": captured_date,
            "ndvi_mean": 0.82,
            "ndvi_min": 0.70,
            "ndvi_max": 0.90,
            "cloud_cover_pct": 5.0,
            "source": "sentinel-2-stub",
            "is_synthetic": True
        }
        
        # 3. Upsert into ndvi_readings (Concurrency handled via unique constraint)
        self.client.table("ndvi_readings").upsert(
            reading, 
            on_conflict="plot_id,captured_date"
        ).execute()

def get_ndvi_service() -> NdviService:
    return NdviService()
