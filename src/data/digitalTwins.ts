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
