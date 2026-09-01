"""
ingest_real_data.py

Runner script to trigger real satellite + weather data ingestion for a given plot.

Usage (from inside backend/ with venv activated):
  python -m scripts.ingest_real_data <plot_id>

Example:
  python -m scripts.ingest_real_data 27f54449-599a-4e95-a6f6-b5da9af7d434
"""
import os
import sys
import logging
from dotenv import load_dotenv

# Load .env from project root (parent of backend/)
load_dotenv(os.path.join(os.path.dirname(__file__), '../../.env'))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)

from app.services.satellite_ingestion_service import SatelliteIngestionService


def main():
    if len(sys.argv) < 2:
        print("Usage: python -m scripts.ingest_real_data <plot_id>")
        print("Example: python -m scripts.ingest_real_data 27f54449-599a-4e95-a6f6-b5da9af7d434")
        sys.exit(1)

    plot_id = sys.argv[1]
    days = int(sys.argv[2]) if len(sys.argv) > 2 else 90

    print(f"\n{'='*60}")
    print(f"  NutriPalm AI — Real Satellite Ingestion")
    print(f"  Plot ID : {plot_id}")
    print(f"  History : {days} days")
    print(f"{'='*60}\n")

    service = SatelliteIngestionService()
    count = service.ingest_for_plot(plot_id, days=days)

    if count > 0:
        print(f"\n[SUCCESS] {count} real data records ingested.")
        print("   Refresh the Digital Twin page to see real weather trends.")
    else:
        print("\n[FAILED] Ingestion failed. Check logs above for details.")
        print("   Most likely cause: plot has no latitude/longitude set.")
        print("   Fix: Open app -> Farm Plots -> Edit -> Enter coordinates.")


if __name__ == "__main__":
    main()
