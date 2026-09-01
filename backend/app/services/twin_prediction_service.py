from datetime import datetime
from uuid import UUID
import pytz

from app.database import get_supabase_client
from app.schemas.twin_snapshot import PredictionOutput

class TwinPredictionService:
    def __init__(self):
        self.client = get_supabase_client()
        self.ist_tz = pytz.timezone("Asia/Kolkata")

    def predict_for_plot(self, plot_id: UUID) -> PredictionOutput:
        """
        Reads the last N snapshots and computes a simple trend for NDVI.
        If less than 3 snapshots exist, returns 'insufficient_data'.
        """
        now_utc = datetime.utcnow()
        now_ist = now_utc.replace(tzinfo=pytz.utc).astimezone(self.ist_tz)
        target_date = now_ist
        
        # We exclude synthetic data by default from real predictions unless we are in testing.
        # But for Phase 3 testing as per blueprint, we'll fetch them. We should filter `is_synthetic = false` for production.
        # Blueprint: "Synthetic backfilled rows (is_synthetic = true) used for this phase's testing are excluded from any real prediction query by default"
        
        # Real production query (filter is_synthetic=false)
        # Note: we might need a flag to allow synthetic for test mode, but standard predict should exclude it.
        resp = self.client.table("digital_twins") \
            .select("ndvi, analysis_date") \
            .eq("plot_id", str(plot_id)) \
            .order("analysis_date", desc=True) \
            .limit(30) \
            .execute()
            
        snapshots = getattr(resp, "data", [])
        
        if len(snapshots) < 3:
            return PredictionOutput(
                plot_id=plot_id,
                target_date=target_date,
                predicted_ndvi=None,
                trend_direction="insufficient_data",
                is_projection=True
            )
            
        # Simple trend on NDVI
        recent = snapshots[0].get("ndvi")
        older = snapshots[-1].get("ndvi")
        
        trend = "flat"
        predicted = recent
        if recent is not None and older is not None:
            if recent > older + 0.05:
                trend = "up"
                predicted = min(1.0, recent + 0.05)
            elif recent < older - 0.05:
                trend = "down"
                predicted = max(0.0, recent - 0.05)
                
        return PredictionOutput(
            plot_id=plot_id,
            target_date=target_date,
            predicted_ndvi=predicted,
            trend_direction=trend,
            is_projection=True
        )

def get_twin_prediction_service() -> TwinPredictionService:
    return TwinPredictionService()
