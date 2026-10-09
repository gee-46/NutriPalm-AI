import { useCallback, useEffect, useRef, useState } from "react";
import { polygonCentroid } from "../data/plots";
import type { Plot } from "../data/plots";
import { fetchWeather, type WeatherResult } from "../lib/weather";

export interface PlotWeatherState {
  weather: WeatherResult | null;
  loading: boolean;
  /** Raw provider error text; null when nothing failed. Callers show their own translated message. */
  error: string | null;
  centroid: { lat: number; lng: number } | null;
  refresh: () => void;
}

/**
 * Weather only (no NDVI call) for a plot's boundary centroid, via the existing Open-Meteo client.
 * Nothing is fabricated: without a mapped boundary there is simply no weather.
 */
export function usePlotWeather(plot: Plot | undefined): PlotWeatherState {
  const [weather, setWeather] = useState<WeatherResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const reqId = useRef(0);

  const centroid = polygonCentroid(plot?.geoJSON);
  const lat = centroid?.lat;
  const lng = centroid?.lng;

  useEffect(() => {
    const id = ++reqId.current;
    setWeather(null);
    setError(null);
    if (lat === undefined || lng === undefined) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchWeather(lat, lng, { forceRefresh: tick > 0 })
      .then((w) => {
        if (reqId.current === id) setWeather(w);
      })
      .catch((e) => {
        if (reqId.current === id) setError(e instanceof Error ? e.message : "Weather unavailable.");
      })
      .finally(() => {
        if (reqId.current === id) setLoading(false);
      });
  }, [plot?.id, lat, lng, tick]);

  const refresh = useCallback(() => setTick((n) => n + 1), []);
  return { weather, loading, error, centroid: centroid ?? null, refresh };
}
