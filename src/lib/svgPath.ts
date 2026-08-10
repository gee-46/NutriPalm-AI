import { type GeoJSONPolygon } from "./geo";

/**
 * Linearly maps a geographic polygon into an SVG viewBox.
 * Centers the polygon and preserves aspect ratio.
 */
export function boundaryToSvgPath(
  geoJSON: GeoJSONPolygon | undefined,
  viewBox: { width: number; height: number } = { width: 500, height: 220 },
  padding = 20
): string {
  if (!geoJSON || !geoJSON.coordinates || geoJSON.coordinates.length === 0) {
    return "";
  }

  const coords = geoJSON.coordinates[0];
  if (!coords || coords.length === 0) return "";

  // 1. Find bounding box
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  const lngRange = maxLng - minLng || 1;
  const latRange = maxLat - minLat || 1;

  // 2. Compute scale and map points
  const innerWidth = viewBox.width - padding * 2;
  const innerHeight = viewBox.height - padding * 2;

  // Preserve aspect ratio
  const scaleX = innerWidth / lngRange;
  const scaleY = innerHeight / latRange;
  const scale = Math.min(scaleX, scaleY);

  const xOffset = (viewBox.width - (lngRange * scale)) / 2;
  const yOffset = (viewBox.height - (latRange * scale)) / 2;

  let path = "";
  for (let i = 0; i < coords.length; i++) {
    const [lng, lat] = coords[i];
    
    const x = xOffset + (lng - minLng) * scale;
    // Latitude increases bottom to top, but SVG Y increases top to bottom (flip Y)
    const y = yOffset + (maxLat - lat) * scale;
    
    if (i === 0) {
      path += `M ${x.toFixed(2)} ${y.toFixed(2)}`;
    } else {
      path += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
  }
  path += " Z";

  return path;
}

/**
 * Maps a specific coordinate (like a centroid) into the same SVG viewBox.
 */
export function coordinateToSvgPoint(
  geoJSON: GeoJSONPolygon | undefined,
  lat?: number,
  lng?: number,
  viewBox = { width: 500, height: 220 },
  padding = 20
): { x: number; y: number } {
  if (!geoJSON || !geoJSON.coordinates || geoJSON.coordinates.length === 0) {
    return { x: viewBox.width / 2, y: viewBox.height / 2 };
  }

  const coords = geoJSON.coordinates[0];
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const [clng, clat] of coords) {
    if (clng < minLng) minLng = clng;
    if (clng > maxLng) maxLng = clng;
    if (clat < minLat) minLat = clat;
    if (clat > maxLat) maxLat = clat;
  }

  const lngRange = maxLng - minLng || 1;
  const latRange = maxLat - minLat || 1;

  const innerWidth = viewBox.width - padding * 2;
  const innerHeight = viewBox.height - padding * 2;

  const scaleX = innerWidth / lngRange;
  const scaleY = innerHeight / latRange;
  const scale = Math.min(scaleX, scaleY);

  const xOffset = (viewBox.width - (lngRange * scale)) / 2;
  const yOffset = (viewBox.height - (latRange * scale)) / 2;

  const targetLng = lng !== undefined ? lng : minLng + lngRange / 2;
  const targetLat = lat !== undefined ? lat : minLat + latRange / 2;

  const x = xOffset + (targetLng - minLng) * scale;
  const y = yOffset + (maxLat - targetLat) * scale;

  return { x, y };
}

/**
 * Generates a proportional rectangle for plots created without a boundary.
 */
export function generatePlaceholderSvgPath(areaAcres: number): string {
  // A simple rectangle in the center
  const size = Math.max(30, Math.min(120, Math.sqrt(areaAcres) * 20));
  const cx = 250;
  const cy = 110;
  const x0 = cx - size / 2;
  const y0 = cy - size / 3;
  const w = size;
  const h = size / 1.5;
  
  // slightly randomized center just so they don't stack perfectly if same area
  const rx = x0 + (Math.random() * 20 - 10);
  const ry = y0 + (Math.random() * 20 - 10);

  return `M ${rx.toFixed(2)} ${ry.toFixed(2)} L ${(rx + w).toFixed(2)} ${ry.toFixed(2)} L ${(rx + w).toFixed(2)} ${(ry + h).toFixed(2)} L ${rx.toFixed(2)} ${(ry + h).toFixed(2)} Z`;
}
