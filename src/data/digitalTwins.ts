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
