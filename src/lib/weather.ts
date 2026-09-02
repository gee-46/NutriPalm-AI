/**
 * weather.ts
 *
 * Real, client-side weather integration using Open-Meteo's free forecast API
 * (https://open-meteo.com/en/docs) for a plot's latitude/longitude.
 *
 * Open-Meteo requires NO API key, allows non-commercial and commercial use
 * within fair-use limits, and returns real global weather models (ECMWF, GFS,
 * ICON).
 *
 * NEVER fabricates weather data. If the network call fails or coordinates are
 * missing, this throws a typed WeatherServiceError so calling components
 * can render an explicit "weather unavailable" state instead of guessing.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WeatherConditions {
  temperatureC: number;
  apparentTemperatureC: number | null;
  humidityPercent: number | null;
  windSpeedKmh: number | null;
  precipitationMm: number | null;
  conditionCode: number;
  conditionText: string;
  isDay: boolean;
  observationTime: string; // ISO timestamp from provider
}

export interface WeatherForecastDay {
  date: string; // YYYY-MM-DD
  minTempC: number;
  maxTempC: number;
  precipitationProbabilityPercent: number | null;
  conditionCode: number;
  conditionText: string;
}

export interface WeatherResult {
  latitude: number;
  longitude: number;
  current: WeatherConditions;
  forecast: WeatherForecastDay[];
  source: "Open-Meteo";
  fetchedAt: string; // ISO timestamp
}

export class WeatherServiceError extends Error {
  public readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "WeatherServiceError";
    this.cause = cause;
  }
}

// ---------------------------------------------------------------------------
// WMO weather code -> human text (per Open-Meteo docs)
// ---------------------------------------------------------------------------

const WMO_CODES: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Heavy freezing rain",
  71: "Slight snowfall",
  73: "Moderate snowfall",
  75: "Heavy snowfall",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

function describeCode(code: number): string {
  return WMO_CODES[code] ?? "Unknown conditions";
}

// ---------------------------------------------------------------------------
// In-memory cache — avoids re-fetching for the same rounded coordinates
// within the TTL window (prevents hammering the API while a user browses
// FarmPlotScreen / DigitalTwinScreen for the same plot).
// ---------------------------------------------------------------------------

interface CacheEntry {
  result: WeatherResult;
  expiresAt: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const _cache = new Map<string, CacheEntry>();

function cacheKey(lat: number, lng: number): string {
  // Round to ~1km precision — plenty for weather purposes and keeps the
  // cache hit rate high for a single plot's repeated centroid.
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

// ---------------------------------------------------------------------------
// Fetch with timeout (browser fetch has no built-in timeout)
// ---------------------------------------------------------------------------

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch real current conditions + a short forecast for a coordinate.
 * Throws WeatherServiceError on any failure — callers must handle this and
 * show an explicit unavailable state. NEVER returns fabricated data.
 */
export async function fetchWeather(
  lat: number,
  lng: number,
  opts: { forecastDays?: number; timeoutMs?: number; forceRefresh?: boolean } = {}
): Promise<WeatherResult> {
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    Number.isNaN(lat) ||
    Number.isNaN(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    throw new WeatherServiceError("Missing or invalid plot coordinates.");
  }

  const key = cacheKey(lat, lng);
  if (!opts.forceRefresh) {
    const cached = _cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }
  }

  const forecastDays = Math.min(Math.max(opts.forecastDays ?? 5, 1), 14);
  const timeoutMs = opts.timeoutMs ?? 8000;

  const params = new URLSearchParams({
    latitude: lat.toFixed(5),
    longitude: lng.toFixed(5),
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    forecast_days: String(forecastDays),
    timezone: "auto",
  });

  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;

  let response: Response;
  try {
    response = await fetchWithTimeout(url, timeoutMs);
  } catch (err) {
    const isAbort = err instanceof DOMException && err.name === "AbortError";
    throw new WeatherServiceError(
      isAbort ? "Weather request timed out." : "Could not reach the weather service.",
      err
    );
  }

  if (response.status === 429) {
    throw new WeatherServiceError("Weather service rate limit reached. Try again shortly.");
  }
  if (!response.ok) {
    throw new WeatherServiceError(`Weather service returned HTTP ${response.status}.`);
  }

  let data: any;
  try {
    data = await response.json();
  } catch (err) {
    throw new WeatherServiceError("Weather service returned an unreadable response.", err);
  }

  if (!data?.current || typeof data.current.temperature_2m !== "number") {
    throw new WeatherServiceError("Weather service response was missing current conditions.");
  }

  const current: WeatherConditions = {
    temperatureC: data.current.temperature_2m,
    apparentTemperatureC:
      typeof data.current.apparent_temperature === "number" ? data.current.apparent_temperature : null,
    humidityPercent:
      typeof data.current.relative_humidity_2m === "number" ? data.current.relative_humidity_2m : null,
    windSpeedKmh: typeof data.current.wind_speed_10m === "number" ? data.current.wind_speed_10m : null,
    precipitationMm: typeof data.current.precipitation === "number" ? data.current.precipitation : null,
    conditionCode: typeof data.current.weather_code === "number" ? data.current.weather_code : -1,
    conditionText: describeCode(data.current.weather_code),
    isDay: data.current.is_day === 1,
    observationTime: data.current.time ?? new Date().toISOString(),
  };

  const forecast: WeatherForecastDay[] = [];
  const daily = data.daily;
  if (daily?.time && Array.isArray(daily.time)) {
    for (let i = 0; i < daily.time.length; i++) {
      forecast.push({
        date: daily.time[i],
        minTempC: daily.temperature_2m_min?.[i] ?? NaN,
        maxTempC: daily.temperature_2m_max?.[i] ?? NaN,
        precipitationProbabilityPercent: daily.precipitation_probability_max?.[i] ?? null,
        conditionCode: daily.weather_code?.[i] ?? -1,
        conditionText: describeCode(daily.weather_code?.[i]),
      });
    }
  }

  const result: WeatherResult = {
    latitude: lat,
    longitude: lng,
    current,
    forecast,
    source: "Open-Meteo",
    fetchedAt: new Date().toISOString(),
  };

  _cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}

/** Clear the in-memory weather cache (mainly useful for tests). */
export function clearWeatherCache(): void {
  _cache.clear();
}
