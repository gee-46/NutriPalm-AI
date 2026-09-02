/**
 * useEnvironmentalData.ts
 *
 * Combines real-time weather (client-side, Open-Meteo) and Sentinel-2 NDVI
 * (backend-proxied) for a plot's centroid/boundary. Used by FarmPlotScreen's
 * "Environmental Snapshot" and DigitalTwinScreen's environmental context
 * panel.
 *
 * Design:
 * - Weather and NDVI are fetched independently -- one being unavailable
 *   never blocks the other.
 * - Nothing here fabricates data. Every field is either a real fetched
 *   value or explicitly `null`/an "unavailable" status the UI must render
 *   honestly.
 * - Only plots with a real geometry/centroid (i.e. not raw seed/demo plots
 *   without coordinates) trigger network requests.
 */

import { useEffect, useRef, useState } from "react";
import type { Plot } from "../data/plots";
import { fetchWeather, type WeatherResult } from "../lib/weather";
import { getPlotNdvi, type NdviResponsePayload } from "../lib/apiClient";

export interface EnvironmentalDataState {
  weather: WeatherResult | null;
  weatherLoading: boolean;
  weatherError: string | null;

  ndvi: NdviResponsePayload | null;
  ndviLoading: boolean;
  ndviError: string | null;

  centroid: { lat: number; lng: number } | null;
  refresh: () => void;
}

function plotCentroid(plot: Plot | undefined): { lat: number; lng: number } | null {
  if (!plot?.geoJSON?.coordinates?.[0]?.length) return null;
  const ring = plot.geoJSON.coordinates[0];
  // Centroid (average of ring vertices) -- good enough for weather;
  // the backend uses the full polygon for NDVI.
  let sumLat = 0;
  let sumLng = 0;
  let n = 0;
  for (const [lng, lat] of ring) {
    if (typeof lat === "number" && typeof lng === "number") {
      sumLat += lat;
      sumLng += lng;
      n++;
    }
  }
  if (n === 0) return null;
  return { lat: sumLat / n, lng: sumLng / n };
}

export function useEnvironmentalData(plot: Plot | undefined): EnvironmentalDataState {
  const [weather, setWeather] = useState<WeatherResult | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  const [ndvi, setNdvi] = useState<NdviResponsePayload | null>(null);
  const [ndviLoading, setNdviLoading] = useState(false);
  const [ndviError, setNdviError] = useState<string | null>(null);

  const [refreshTick, setRefreshTick] = useState(0);
  const requestIdRef = useRef(0);

  const centroid = plotCentroid(plot);
  // Real (DB-backed) plots have UUID ids; seed/demo plots use "plot-N".
  const isRealPlot = !!plot?.id && !plot.id.startsWith("plot-");

  useEffect(() => {
    const thisRequestId = ++requestIdRef.current;

    setWeather(null);
    setWeatherError(null);
    setNdvi(null);
    setNdviError(null);

    if (!centroid) {
      setWeatherError(null); // no coordinates yet -- not an error, just nothing to show
      setNdviError(null);
      return;
    }

    // --- Weather (always attempted when we have coordinates) ---
    setWeatherLoading(true);
    fetchWeather(centroid.lat, centroid.lng)
      .then((result) => {
        if (requestIdRef.current !== thisRequestId) return;
        setWeather(result);
      })
      .catch((err) => {
        if (requestIdRef.current !== thisRequestId) return;
        setWeatherError(err instanceof Error ? err.message : "Weather unavailable.");
      })
      .finally(() => {
        if (requestIdRef.current !== thisRequestId) return;
        setWeatherLoading(false);
      });

    // --- NDVI (requires a real, saved plot id the backend can look up) ---
    if (!isRealPlot || !plot?.id) {
      setNdviError("Save this plot to load Sentinel-2 NDVI.");
      return;
    }

    setNdviLoading(true);
    getPlotNdvi(plot.id)
      .then((result) => {
        if (requestIdRef.current !== thisRequestId) return;
        setNdvi(result);
      })
      .catch((err) => {
        if (requestIdRef.current !== thisRequestId) return;
        setNdviError(err instanceof Error ? err.message : "NDVI unavailable.");
      })
      .finally(() => {
        if (requestIdRef.current !== thisRequestId) return;
        setNdviLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plot?.id, centroid?.lat, centroid?.lng, refreshTick]);

  return {
    weather,
    weatherLoading,
    weatherError,
    ndvi,
    ndviLoading,
    ndviError,
    centroid,
    refresh: () => setRefreshTick((t) => t + 1),
  };
}
