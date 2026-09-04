import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { getPlotTwinPrediction, type TwinPredictionResponsePayload } from "../lib/apiClient";

export interface DataCompleteness {
  ndvi: boolean;
  weather: boolean;
  soil: boolean;
}

export interface DigitalTwinRow {
  id: string;
  plot_id: string;
  crop_health_score: number | null;
  water_stress_score: number | null;
  nutrient_health_score: number | null;
  growth_stage: string | null;
  yield_prediction: number | null;
  risk_level: string | null;
  model_version: string | null;
  confidence_score: number | null;
  analysis_date: string;
  created_at: string;
  
  // Extended fields
  ndvi: number | null;
  temperature_c?: number | null;
  humidity_pct?: number | null;
  rainfall_mm?: number | null;
  foliar_health_score?: number | null;
  disease_name: string | null;
  disease_probability: number | null;
  disease_explanation: string | null;
  recommended_action: string | null;
  advisory_reason: string | null;
  data_completeness?: DataCompleteness | null;
  is_synthetic?: boolean;
}

export function useDigitalTwinSnapshots(plotId: string) {
  const [snapshots, setSnapshots] = useState<{
    Past: DigitalTwinRow | null;
    Current: DigitalTwinRow | null;
    Prediction: DigitalTwinRow | null;
  }>({ Past: null, Current: null, Prediction: null });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    // Seed plots bypass DB fetching and stay null (UI will fall back to seed data)
    if (!plotId || plotId.startsWith('plot-')) {
      if (isMounted) {
         setSnapshots({ Past: null, Current: null, Prediction: null });
         setIsLoading(false);
      }
      return;
    }

    async function fetchTwins() {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('digital_twins')
          .select('*')
          .eq('plot_id', plotId)
          .order('analysis_date', { ascending: false });

        if (error) {
          console.error("Error fetching digital twins:", error);
          if (isMounted) setIsLoading(false);
          return;
        }

        if (isMounted && data) {
          const now = new Date();
          let Past = null;
          let Current = null;
          let Prediction = null;

          // data is ordered newest to oldest
          for (const row of data as DigitalTwinRow[]) {
            const rowDate = new Date(row.analysis_date);
            if (rowDate > now) {
              // Future -> Prediction (take the nearest future one if multiple exist)
              if (!Prediction) Prediction = row; 
            } else {
              // Past or Current
              if (!Current) {
                Current = row;
              } else if (!Past) {
                Past = row;
                break; // We have all 3
              }
            }
          }
          
          setSnapshots({ Past, Current, Prediction });
        }
      } catch (err) {
        console.error("Exception fetching digital twins:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchTwins();

    return () => { isMounted = false; };
  }, [plotId]);

  return { snapshots, isLoading };
}

export function useTwinPrediction(plotId: string) {
  const [prediction, setPrediction] = useState<TwinPredictionResponsePayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!plotId || plotId.startsWith("plot-")) {
      if (isMounted) {
        setPrediction(null);
        setIsLoading(false);
      }
      return;
    }

    async function fetchPrediction() {
      setIsLoading(true);
      try {
        const result = await getPlotTwinPrediction(plotId);
        if (isMounted) setPrediction(result);
      } catch (err) {
        console.error("Failed to fetch twin prediction from API:", err);
        if (isMounted) setPrediction(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchPrediction();
    return () => {
      isMounted = false;
    };
  }, [plotId]);

  return { prediction, isLoading };
}


export function useDigitalTwinHistory(plotId: string, days: 7 | 30 | 90 = 30) {
  const [history, setHistory] = useState<DigitalTwinRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    if (!plotId || plotId.startsWith("plot-")) {
      if (isMounted) {
        setHistory([]);
        setIsLoading(false);
      }
      return;
    }

    async function fetchHistory() {
      setIsLoading(true);
      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const { data, error } = await supabase
          .from("digital_twins")
          .select("*")
          .eq("plot_id", plotId)
          .gte("analysis_date", cutoffDate.toISOString())
          .order("analysis_date", { ascending: true });

        if (error) {
          console.error("Error fetching digital twin history:", error);
          if (isMounted) setIsLoading(false);
          return;
        }

        if (isMounted && data) {
          setHistory(data as DigitalTwinRow[]);
        }
      } catch (err) {
        console.error("Exception fetching digital twin history:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchHistory();
    return () => {
      isMounted = false;
    };
  }, [plotId, days]);

  return { history, isLoading };
}

// ─────────────────────────────────────────────────────────────────────────────
// Live Twin Hook — polls /api/plots/{id}/twin/live every 5 minutes
// ─────────────────────────────────────────────────────────────────────────────

export interface LiveScores {
  water_stress: number;
  disease_risk: number;
  crop_health: number;
  soil_score: number;
  yield_estimate_t_ha: number;
}

export interface LiveWeather {
  temperature_c: number | null;
  apparent_temp_c: number | null;
  humidity_pct: number | null;
  rainfall_now_mm: number | null;
  rainfall_7d_mm: number | null;
  wind_kph: number | null;
  uv_index: number | null;
  cloud_cover_pct: number | null;
  weather_fetched_at: string | null;
}

export interface LiveTwinData {
  plot_id: string;
  plot_name: string | null;
  computed_at: string;
  model_version: string;
  live_weather: LiveWeather;
  scores: LiveScores;
  soil_state: string;
  soil_interpretation: string;
  disease_name: string;
  disease_explanation: string;
  yield_risk: string;
  risk_level: "Low" | "Moderate" | "High";
  ndvi_last_known: number | null;
  daily_7d: Array<{
    date: string;
    temp_max: number | null;
    temp_min: number | null;
    humidity_mean: number | null;
    rainfall_mm: number;
    uv_index_max: number | null;
  }>;
}

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function useLiveTwin(plotId: string) {
  const [liveData, setLiveData] = useState<LiveTwinData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(
    POLL_INTERVAL_MS / 1000
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let pollTimer: ReturnType<typeof setInterval>;
    let countdownTimer: ReturnType<typeof setInterval>;

    if (!plotId || plotId.startsWith("plot-")) {
      setIsLoading(false);
      return;
    }

    async function fetchLive() {
      if (!isMounted) return;
      setIsLoading(true);
      setError(null);
      try {
        // Get current user's JWT token for auth header
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        const resp = await fetch(
          `http://localhost:8000/api/plots/${plotId}/twin/live`,
          token ? { headers: { Authorization: `Bearer ${token}` } } : {}
        );

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }

        const data: LiveTwinData = await resp.json();
        if (isMounted) {
          setLiveData(data);
          setLastUpdated(new Date());
          setSecondsUntilRefresh(POLL_INTERVAL_MS / 1000);
        }
      } catch (err) {
        console.error("Failed to fetch live twin data:", err);
        if (isMounted) setError("Live data unavailable");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    // Initial fetch
    fetchLive();

    // Poll every 5 minutes
    pollTimer = setInterval(fetchLive, POLL_INTERVAL_MS);

    // Countdown timer (ticks every second)
    countdownTimer = setInterval(() => {
      if (isMounted) {
        setSecondsUntilRefresh((prev) => (prev <= 1 ? POLL_INTERVAL_MS / 1000 : prev - 1));
      }
    }, 1000);

    return () => {
      isMounted = false;
      clearInterval(pollTimer);
      clearInterval(countdownTimer);
    };
  }, [plotId]);

  return { liveData, isLoading, lastUpdated, secondsUntilRefresh, error };
}

/** Returns appropriate badge style classes based on twin risk level. */
export function getRiskBadgeColor(riskLevel: string | null | undefined): {
  bg: string;
  text: string;
  border: string;
} {
  const risk = (riskLevel || "").toLowerCase();
  if (risk === "critical" || risk === "high") {
    return { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" };
  }
  if (risk === "moderate" || risk === "medium") {
    return { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" };
  }
  return { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" };
}

/** Formats twin score numbers with standard fallback. */
export function formatTwinScore(score: number | null | undefined, fallback = "--"): string {
  if (score === null || score === undefined || Number.isNaN(score)) return fallback;
  return `${Math.round(score)}%`;
}

