import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/** A persisted soil_reports row, as read through RLS (only the caller's own rows are visible). */
export interface SoilReportRow {
  id: string;
  plot_id: string;
  nitrogen_kg_ha: number;
  phosphorus_kg_ha: number;
  potassium_kg_ha: number;
  organic_carbon_percent: number;
  ph: number;
  electrical_conductivity: number | null;
  created_at: string;
  verification_status: "auto_validated" | "user_confirmed" | "user_corrected" | null;
}

export interface LatestSoilReportState {
  report: SoilReportRow | null;
  loading: boolean;
  error: boolean;
}

/** Latest VERIFIED soil report for a saved plot, or null. Never invents values; unverified rows are ignored. */
export function useLatestSoilReport(plotId: string | undefined, enabled = true): LatestSoilReportState {
  const [state, setState] = useState<LatestSoilReportState>({ report: null, loading: false, error: false });

  useEffect(() => {
    let cancelled = false;
    if (!plotId || !enabled) {
      setState({ report: null, loading: false, error: false });
      return;
    }
    setState({ report: null, loading: true, error: false });
    supabase
      .from("soil_reports")
      .select("id, plot_id, nitrogen_kg_ha, phosphorus_kg_ha, potassium_kg_ha, organic_carbon_percent, ph, electrical_conductivity, created_at, verification_status")
      .eq("plot_id", plotId)
      .not("verification_status", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }: { data: SoilReportRow | null; error: unknown }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load soil report:", error);
          setState({ report: null, loading: false, error: true });
        } else {
          setState({ report: data, loading: false, error: false });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [plotId, enabled]);

  return state;
}
