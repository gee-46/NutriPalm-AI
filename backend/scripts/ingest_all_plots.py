"""
ingest_all_plots.py

Runs real satellite + weather data ingestion for ALL plots in the database
that have GPS coordinates. No need to specify individual plot IDs.

Usage (from inside backend/ with venv activated):
  python -m scripts.ingest_all_plots

Optional - limit to last N days (default 90):
  python -m scripts.ingest_all_plots 30
"""
import os
import sys
import logging
from dotenv import load_dotenv

# Load .env from project root
load_dotenv(os.path.join(os.path.dirname(__file__), '../../.env'))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)

from app.database import get_supabase_client
from app.services.satellite_ingestion_service import SatelliteIngestionService


def main():
    days = int(sys.argv[1]) if len(sys.argv) > 1 else 90
    client = get_supabase_client()

    # Fetch ALL plots that have lat/lng set
    resp = client.table("plots").select("id, name, latitude, longitude").execute()
    all_plots = getattr(resp, "data", []) or []

    plots_with_coords = [p for p in all_plots if p.get("latitude") and p.get("longitude")]
    plots_missing_coords = [p for p in all_plots if not p.get("latitude") or not p.get("longitude")]

    print(f"\n{'='*60}")
    print(f"  NutriPalm AI - Bulk Satellite Ingestion")
    print(f"  Total plots found : {len(all_plots)}")
    print(f"  With coordinates  : {len(plots_with_coords)}")
    print(f"  Missing coords    : {len(plots_missing_coords)}")
    print(f"  Days of history   : {days}")
    print(f"{'='*60}\n")

    if plots_missing_coords:
        print("[WARNING] These plots will be skipped (no GPS coordinates):")
        for p in plots_missing_coords:
            print(f"  - {p['name']} ({p['id']})")
        print()

    if not plots_with_coords:
        print("[FAILED] No plots have GPS coordinates. Nothing to ingest.")
        print("  Fix: Open app -> Farm Plots -> Edit -> Enter latitude/longitude for each plot.")
        sys.exit(1)

    service = SatelliteIngestionService()
    results = {"success": 0, "failed": 0, "total_records": 0}

    for plot in plots_with_coords:
        plot_id = plot["id"]
        name = plot["name"]
        lat = plot["latitude"]
        lon = plot["longitude"]
        print(f"[{name}] Ingesting... ({lat:.4f}, {lon:.4f})")

        count = service.ingest_for_plot(plot_id, days=days)
        if count > 0:
            results["success"] += 1
            results["total_records"] += count
            print(f"[{name}] Done - {count} records ingested.\n")
        else:
            results["failed"] += 1
            print(f"[{name}] FAILED - check logs above.\n")

    print(f"{'='*60}")
    print(f"  Bulk Ingestion Complete")
    print(f"  Plots succeeded : {results['success']}")
    print(f"  Plots failed    : {results['failed']}")
    print(f"  Total records   : {results['total_records']}")
    print(f"{'='*60}")
    print("\nRefresh the Digital Twin page to see real data for all plots.")


if __name__ == "__main__":
    main()
