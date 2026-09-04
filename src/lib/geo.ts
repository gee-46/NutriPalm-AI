/**
 * geo.ts — Geo utility functions.
 * No external npm packages beyond @turf/area and @turf/centroid (Phase 2).
 * All fetch calls use public free APIs — no API keys needed.
 */

import type { GeoJSONPolygon } from "../data/plots";

// Re-export for convenience so other modules can import from one place
export type { GeoJSONPolygon };

// ---------------------------------------------------------------------------
// Unit conversions
// ---------------------------------------------------------------------------

export function squareMetresToAcres(m2: number): number {
  return m2 / 4046.8564;
}

export function squareMetresToHectares(m2: number): number {
  return m2 / 10000;
}

export function acresToHectares(acres: number): number {
  return acres * 0.404686;
}

export function hectaresToAcres(ha: number): number {
  return ha * 2.47105;
}

// ---------------------------------------------------------------------------
// Geodesic distance & perimeter calculations (Haversine formula)
// ---------------------------------------------------------------------------

/**
 * Calculates the great-circle distance between two [lat, lng] points in meters using Haversine formula.
 */
export function computeDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371008.8; // Earth's mean radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Computes the total perimeter in meters for a GeoJSON Polygon ring.
 */
export function computePolygonPerimeterMeters(geoJSON: GeoJSONPolygon): number {
  if (!geoJSON.coordinates || geoJSON.coordinates.length === 0) return 0;
  const ring = geoJSON.coordinates[0];
  if (!ring || ring.length < 2) return 0;

  let totalMeters = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[i + 1];
    totalMeters += computeDistanceMeters(lat1, lng1, lat2, lng2);
  }
  return totalMeters;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * Computes the geographic bounding box (min/max latitude and longitude) of a GeoJSON polygon.
 */
export function computeBoundingBox(geoJSON: GeoJSONPolygon): BoundingBox | null {
  if (!geoJSON.coordinates || geoJSON.coordinates.length === 0) return null;
  const ring = geoJSON.coordinates[0];
  if (!ring || ring.length === 0) return null;

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  if (minLng === Infinity || minLat === Infinity) return null;

  return { minLat, maxLat, minLng, maxLng };
}


// ---------------------------------------------------------------------------
// Polygon area via @turf/area (dynamically imported so Phase 1 doesn't break
// when the package isn't installed yet)
// ---------------------------------------------------------------------------

export async function computePolygonAreaAcres(
  geoJSON: GeoJSONPolygon
): Promise<number> {
  try {
    const { area } = await import("@turf/area");
    const m2 = area({ type: "Feature", geometry: geoJSON, properties: {} });
    return squareMetresToAcres(m2);
  } catch {
    // fallback if @turf/area not yet installed
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Polygon centroid
// ---------------------------------------------------------------------------

export async function computeCentroid(
  geoJSON: GeoJSONPolygon
): Promise<{ lat: number; lng: number } | null> {
  try {
    const { centroid } = await import("@turf/centroid");
    const c = centroid({ type: "Feature", geometry: geoJSON, properties: {} });
    const [lng, lat] = c.geometry.coordinates;
    return { lat, lng };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Nominatim reverse geocoding (OpenStreetMap — free, no API key)
// Rate limit: 1 req/s per OSM policy; fine for interactive wizard use.
// ---------------------------------------------------------------------------

export interface ReverseGeocodeResult {
  village: string;
  /** Taluk/tehsil — maps to Nominatim's `county` key (closest Indian admin subdivision) */
  taluk: string;
  district: string;
  state: string;
  country: string;
  display: string;
}

export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<ReverseGeocodeResult> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`;
  const response = await fetch(url, {
    headers: { "Accept-Language": "en" },
  });
  if (!response.ok) throw new Error(`Nominatim HTTP ${response.status}`);
  const data = await response.json();
  const addr = data.address ?? {};
  return {
    // Village: walk down from most to least specific
    village:
      addr.village ||
      addr.suburb ||
      addr.town ||
      addr.hamlet ||
      addr.neighbourhood ||
      "",
    // Taluk/tehsil: Nominatim returns Indian sub-district level as `county`
    // (state_district is the district-equivalent; county is one level below that)
    taluk: addr.county || "",
    // District: prefer state_district which Nominatim returns for Indian districts
    district: addr.state_district || addr.district || "",
    state: addr.state || "",
    country: addr.country || "",
    display: data.display_name || "",
  };
}

// ---------------------------------------------------------------------------
// Open-Elevation API (free, no key)
// Docs: https://open-elevation.com
// ---------------------------------------------------------------------------

export async function getElevation(lat: number, lng: number): Promise<number> {
  const url = `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Open-Elevation HTTP ${response.status}`);
  const data = await response.json();
  const result = data.results?.[0];
  if (typeof result?.elevation !== "number") throw new Error("No elevation data");
  return Math.round(result.elevation);
}

// ---------------------------------------------------------------------------
// Polygon validation
// ---------------------------------------------------------------------------

export interface PolygonValidation {
  valid: boolean;
  reason?: string;
}

/**
 * Basic polygon checks — before calling @turf/kinks we do a lightweight
 * size-check first (avoids the extra turf package).
 */
export async function validatePolygon(
  geoJSON: GeoJSONPolygon,
  areaAcres: number
): Promise<PolygonValidation> {
  if (!geoJSON.coordinates || geoJSON.coordinates[0].length < 4) {
    return { valid: false, reason: "Polygon must have at least 3 vertices." };
  }
  if (areaAcres < 0.1) {
    return {
      valid: false,
      reason: `Polygon is too small (${areaAcres.toFixed(3)} ac). Minimum is 0.1 acres.`,
    };
  }
  if (areaAcres > 10000) {
    return {
      valid: false,
      reason: `Polygon area (${areaAcres.toFixed(0)} ac) exceeds maximum of 10,000 acres.`,
    };
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// GeoJSON file parser — for "Import GIS Data" button
// ---------------------------------------------------------------------------

export interface GeoJSONParseResult {
  geoJSON: GeoJSONPolygon;
  name?: string;
}

export function parseGeoJSONFile(text: string): GeoJSONParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("File is not valid JSON.");
  }

  const obj = parsed as Record<string, unknown>;

  // Handle FeatureCollection
  if (obj.type === "FeatureCollection") {
    const features = obj.features as Array<Record<string, unknown>>;
    const first = features?.find(
      (f) =>
        (f.geometry as Record<string, unknown>)?.type === "Polygon" ||
        (f.geometry as Record<string, unknown>)?.type === "MultiPolygon"
    );
    if (!first) throw new Error("No Polygon feature found in GeoJSON file.");
    const geom = first.geometry as Record<string, unknown>;
    if (geom.type === "MultiPolygon") {
      // Take first ring of first polygon
      const coords = (geom.coordinates as number[][][][])[0];
      return {
        geoJSON: { type: "Polygon", coordinates: coords } as GeoJSONPolygon,
        name: (first.properties as Record<string, unknown>)?.name as string | undefined,
      };
    }
    return {
      geoJSON: { type: "Polygon", coordinates: (geom.coordinates as number[][][]) } as GeoJSONPolygon,
      name: (first.properties as Record<string, unknown>)?.name as string | undefined,
    };
  }

  // Handle single Feature
  if (obj.type === "Feature") {
    const geom = obj.geometry as Record<string, unknown>;
    if (geom?.type !== "Polygon" && geom?.type !== "MultiPolygon") {
      throw new Error("GeoJSON feature geometry must be Polygon or MultiPolygon.");
    }
    if (geom.type === "MultiPolygon") {
      const coords = (geom.coordinates as number[][][][])[0];
      return {
        geoJSON: { type: "Polygon", coordinates: coords } as GeoJSONPolygon,
        name: (obj.properties as Record<string, unknown>)?.name as string | undefined,
      };
    }
    return {
      geoJSON: { type: "Polygon", coordinates: geom.coordinates as number[][][] } as GeoJSONPolygon,
    };
  }

  // Handle raw Polygon
  if (obj.type === "Polygon") {
    return { geoJSON: { type: "Polygon", coordinates: obj.coordinates as number[][][] } as GeoJSONPolygon };
  }

  throw new Error("Unsupported GeoJSON format. Must be Polygon, Feature, or FeatureCollection.");
}

// ---------------------------------------------------------------------------
// Coordinate string parsing & GeoJSON polygon builder
// ---------------------------------------------------------------------------

export function parseCoordinateString(coordStr: string): [number, number] | null {
  if (!coordStr) return null;
  // e.g. "17.3881 N, 78.4892 E" or "17.3881° N, 78.4948° E" or "17.3881, 78.4892"
  const clean = coordStr.replace(/[°NSEW]/gi, " ").trim();
  const parts = clean.split(/[,\s]+/).map((p) => parseFloat(p.trim())).filter((n) => !isNaN(n));
  if (parts.length >= 2) {
    let lat = parts[0];
    let lng = parts[1];
    if (/S/i.test(coordStr)) lat = -Math.abs(lat);
    if (/W/i.test(coordStr)) lng = -Math.abs(lng);
    return [lng, lat]; // GeoJSON format [lng, lat]
  }
  return null;
}

export function plotCoordinatesToGeoJSON(coords: string[]): GeoJSONPolygon | null {
  if (!coords || coords.length < 3) return null;
  const points = coords
    .map(parseCoordinateString)
    .filter((p): p is [number, number] => p !== null);

  if (points.length >= 3) {
    const ring = [...points];
    // Ensure polygon ring is closed
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      ring.push([first[0], first[1]]);
    }
    return {
      type: "Polygon",
      coordinates: [ring],
    };
  }
  return null;
}

