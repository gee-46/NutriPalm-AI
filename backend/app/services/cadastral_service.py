"""
cadastral_service.py

Karnataka Bhu-Naksha / Bhoomi cadastral parcel integration.

INVESTIGATION RESULT (do not remove this note without re-verifying):
Karnataka's Bhu-Naksha/Bhoomi land-records system (landrecords.karnataka.gov.in,
bhunaksha.karnataka.gov.in / the NIC Bhu-Naksha platform) exposes a
district -> taluk -> hobli -> village -> survey-number web *portal* for
citizens to view/download individual parcel maps as PDFs. As of this
integration there is no publicly documented, authorized REST/JSON API for
programmatic parcel lookup by coordinates, and no bulk/geometry download
endpoint intended for third-party application use. Scraping the portal's
internal endpoints or bypassing its session/captcha flow would violate the
"do not scrape private endpoints / do not bypass authentication or access
controls" requirement for this integration, so that path was not taken.

Because of this, the feature ships DISABLED by design:
- No requests are ever made to any Bhu-Naksha/Bhoomi endpoint.
- No cadastral geometry is fabricated.
- The service interface below is real and ready to be implemented the
  moment an authorized channel exists (e.g. a signed data-sharing
  agreement/MoU with the Karnataka Revenue Department or NIC providing an
  official API, bulk GeoJSON/Shapefile export, or a licensed data vendor
  reselling the same records with redistribution rights).

To enable this feature in the future:
1. Obtain authorized API/data access (official API credentials, or a
   licensed dataset with redistribution rights).
2. Set the environment variables below.
3. Implement `get_parcel_for_geometry()` to call that authorized source.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

from app.exceptions import GeospatialServiceUnavailable

# Placeholder configuration for a *future* authorized integration. These are
# intentionally not read anywhere yet -- they exist so the operator knows
# what would need to be supplied.
# KARNATAKA_CADASTRAL_API_BASE_URL
# KARNATAKA_CADASTRAL_API_KEY


@dataclass(frozen=True)
class ParcelResult:
    parcel_reference: str
    geometry: dict[str, Any]
    source: str = "Karnataka Bhu-Naksha / Bhoomi"


class CadastralProvider(Protocol):
    def get_parcel_for_geometry(self, geojson_polygon: dict[str, Any]) -> ParcelResult:
        ...


class DisabledCadastralProvider:
    """
    Default provider: no authorized Karnataka Bhu-Naksha/cadastral API is
    available, so this always raises GeospatialServiceUnavailable with a
    clear explanation rather than fabricating parcel data.
    """

    def get_parcel_for_geometry(self, geojson_polygon: dict[str, Any]) -> ParcelResult:
        raise GeospatialServiceUnavailable(
            "Karnataka Bhu-Naksha/cadastral integration requires official, "
            "authorized API access (e.g. a data-sharing agreement with the "
            "Karnataka Revenue Department/NIC) that is not configured for "
            "this deployment. No public programmatic API is currently "
            "documented for Bhu-Naksha/Bhoomi."
        )


def get_cadastral_provider() -> CadastralProvider:
    return DisabledCadastralProvider()
