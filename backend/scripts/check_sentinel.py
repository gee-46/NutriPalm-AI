"""
Sentinel Hub connectivity check. Prints only safe metadata - never the client id, the secret or a token.

    cd backend
    python scripts/check_sentinel.py                      # configuration hygiene + one OAuth token request
    python scripts/check_sentinel.py --lon 75.0 --lat 13.0   # ...and, if authenticated, one NDVI request for a ~220 m square there

Exit code 0 only if an authorized request actually succeeded. NDVI is "operational" only then.
"""
import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import get_settings  # noqa: E402
from app.exceptions import GeospatialServiceUnavailable  # noqa: E402
from app.services import sentinel_service  # noqa: E402


def hygiene(label: str, value: str) -> None:
    flags = {
        "length": len(value),
        "leading/trailing whitespace": value != value.strip(),
        "contains quotes": bool(re.search(r"['\"]", value)),
        "non-ASCII": any(ord(c) > 127 for c in value),
        "UUID-shaped": bool(re.fullmatch(r"[0-9a-fA-F-]{36}", value.strip())),
    }
    print(f"  {label}: {flags}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lon", type=float)
    ap.add_argument("--lat", type=float)
    args = ap.parse_args()

    s = get_settings()
    print("Sentinel Hub configuration")
    print(f"  base url: {s.sentinel_hub_base_url}   token path: {sentinel_service.TOKEN_PATH}")
    if not sentinel_service.is_configured(s):
        print("  NOT CONFIGURED: SENTINEL_HUB_CLIENT_ID / SENTINEL_HUB_CLIENT_SECRET are empty.")
        return 1
    hygiene("client id    ", s.sentinel_hub_client_id)
    hygiene("client secret", s.sentinel_hub_client_secret)

    try:
        sentinel_service._get_access_token(s)
    except GeospatialServiceUnavailable as exc:
        print(f"  AUTH FAILED: {exc}")
        return 1
    print("  AUTH OK: an access token was issued.")

    if args.lon is None or args.lat is None:
        print("  (pass --lon/--lat to also run one NDVI request)")
        return 0
    d = 0.001
    ring = [[args.lon, args.lat], [args.lon + d, args.lat], [args.lon + d, args.lat + d], [args.lon, args.lat + d], [args.lon, args.lat]]
    try:
        r = sentinel_service.get_ndvi_for_geometry({"type": "Polygon", "coordinates": [ring]}, settings=s)
    except GeospatialServiceUnavailable as exc:
        print(f"  NDVI REQUEST FAILED: {exc}")
        return 1
    print(f"  NDVI OK: mean={r.mean_ndvi:.3f} samples={r.sample_count} date={r.acquisition_date}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
