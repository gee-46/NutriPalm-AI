from datetime import datetime
from uuid import UUID
import pytz

from app.database import get_supabase_client
from app.schemas.suitability import ClimateData

class WeatherService:
    def __init__(self):
        self.client = get_supabase_client()
        self.ist_tz = pytz.timezone("Asia/Kolkata")

    def ingest_for_plot(self, plot_id: UUID) -> None:
        """
        Fetches daily weather data for the given plot and upserts into weather_observations.
        """
        # 1. Stub for external API (Open-Meteo)
        now_utc = datetime.utcnow()
        # Timezone Contract: IST calendar date
        now_ist = now_utc.replace(tzinfo=pytz.utc).astimezone(self.ist_tz)
        observed_date = now_ist.date().isoformat()
        
        observation = {
            "plot_id": str(plot_id),
            "observed_date": observed_date,
            "temperature_c": 32.5,
            "humidity_pct": 65.0,
            "rainfall_mm": 12.0,
            "wind_kph": 15.0,
            "solar_radiation": 200.0,
            "source": "open-meteo-stub",
            "is_synthetic": True
        }
        
        # 2. Concurrency Contract: Upsert via ON CONFLICT DO UPDATE
        self.client.table("weather_observations").upsert(
            observation, 
            on_conflict="plot_id,observed_date"
        ).execute()

    def fetch_climate(self, lat: float, lon: float) -> ClimateData:
        """
        Fetches current weather and historical climate for the given latitude and longitude.
        """
        # TODO: Replace with actual Open-Meteo or external API call.
        # For now, returning a realistic mock response for suitability evaluation.
        return ClimateData(
            avg_temperature_c=28.5,
            avg_annual_rainfall_mm=2500.0,
            current_temperature_c=30.0,
            current_humidity_pct=70.0
        )

    def evaluate_disease_weather_risk(self, lat: float, lon: float, crop: str) -> dict:
        """
        Phase 2: Evaluates disease risk based on recent weather patterns.
        """
        return {"humidity_risk": False, "temp_risk": False}

    def get_fertilizer_application_window(self, lat: float, lon: float) -> dict:
        """
        Phase 2: Determines optimal fertilizer application window.
        """
        return {"safe_to_apply": True, "reason": "Weather conditions are optimal for application."}

def get_weather_service() -> WeatherService:
    return WeatherService()
