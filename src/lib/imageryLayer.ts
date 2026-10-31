import L from "leaflet";
import { escapeHtml, type MapImageryConfig } from "./mapConfig";
import { watchTileHealth, type TileHealth } from "./tileHealth";

/**
 * Add THE configured imagery layer to a Leaflet map: tiles from mapConfig, the provider's attribution (always visible),
 * and tile-health watching. There is deliberately no second layer and no fallback; `onHealth(true)` means "show an error with a
 * Retry", and `health.retry()` reloads the same layer.
 */
export function addConfiguredImagery(
  map: L.Map,
  config: MapImageryConfig,
  onHealth: (failing: boolean) => void
): { layer: L.TileLayer; health: TileHealth } {
  const layer = L.tileLayer(config.tileUrl, {
    maxZoom: config.maxZoom,
    // Providers have no imagery beyond their native zoom in many places: stop requesting there and scale up what we have.
    maxNativeZoom: config.maxNativeZoom,
    attribution: escapeHtml(config.attribution),
    crossOrigin: false,
  });
  layer.addTo(map);

  // Attribution is part of the provider's terms: keep it on screen, readable, and link only to Leaflet itself.
  if (map.attributionControl) {
    map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener noreferrer">Leaflet</a>');
  }

  const health = watchTileHealth(layer as unknown as Parameters<typeof watchTileHealth>[0], onHealth);
  return { layer, health };
}
