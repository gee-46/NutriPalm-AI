import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

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
  
  // Optional beyond-contract fields
  ndvi: number | null;
  disease_name: string | null;
  disease_probability: number | null;
  disease_explanation: string | null;
  recommended_action: string | null;
  advisory_reason: string | null;
  temperature_c?: number | null;
  humidity_pct?: number | null;
  rainfall_mm?: number | null;
  foliar_health_score?: number | null;
  is_synthetic?: boolean;
  data_completeness?: DataCompleteness | null;
}

export interface DataCompleteness {
  ndvi: boolean;
  weather: boolean;
  soil: boolean;
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
          // .eq('is_synthetic', false) // Temporarily disabled for testing synthetic data
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
  const [prediction, setPrediction] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!plotId || plotId.startsWith('plot-')) return;

    async function fetchPrediction() {
      setIsLoading(true);
      try {
        const response = await fetch(`http://localhost:8000/api/plots/${plotId}/twin/prediction`);
        if (response.ok) {
          const data = await response.json();
          if (isMounted) setPrediction(data);
        }
      } catch (err) {
        console.error("Failed to fetch prediction:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    fetchPrediction();
    return () => { isMounted = false; };
  }, [plotId]);

  return { prediction, isLoading };
}

/**
 * Fetches ordered time-series rows for charting (7, 30, or 90 days).
 * Returns rows newest-first so the chart can slice as needed.
 */
export function useDigitalTwinHistory(plotId: string, days: 7 | 30 | 90) {
  const [history, setHistory] = useState<DigitalTwinRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    if (!plotId || plotId.startsWith('plot-')) {
      setHistory([]);
      setIsLoading(false);
      return;
    }

    async function fetchHistory() {
      setIsLoading(true);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      try {
        const { data, error } = await supabase
          .from('digital_twins')
          .select('analysis_date, ndvi, crop_health_score, water_stress_score, temperature_c')
          .eq('plot_id', plotId)
          .gte('analysis_date', cutoff.toISOString())
          .order('analysis_date', { ascending: true });

        if (!error && data && isMounted) {
          setHistory(data as DigitalTwinRow[]);
        }
      } catch (err) {
        console.error("Exception fetching digital twin history:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchHistory();
    return () => { isMounted = false; };
  }, [plotId, days]);

  return { history, isLoading };
}
