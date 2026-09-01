from datetime import datetime
from uuid import UUID
import pytz

from app.database import get_supabase_client

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

def get_weather_service() -> WeatherService:
    return WeatherService()
