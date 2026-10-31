import { useCallback, useEffect, useState } from "react";
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
  extraction_id?: string | null;
  micronutrients?: Record<string, { value: number | string | null; unit?: string | null; validation?: string }> | null;
}

export interface LatestSoilReportState {
  report: SoilReportRow | null;
  loading: boolean;
  /** True when the query FAILED. This is not the same as "there is no report": the caller must say so and offer a retry. */
  error: boolean;
  /** Re-read the latest verified report (e.g. after an upload finished elsewhere in the app). */
  refetch: () => void;
}

const COLUMNS =
  "id, plot_id, nitrogen_kg_ha, phosphorus_kg_ha, potassium_kg_ha, organic_carbon_percent, ph, electrical_conductivity, created_at, verification_status, extraction_id";

/**
 * Latest VERIFIED soil report for a saved plot, or null. Never invents values; unverified rows are ignored.
 * `refreshKey` lets the app tell this hook that something upstream changed (a report was just verified) without a reload.
 */
export function useLatestSoilReport(plotId: string | undefined, enabled = true, refreshKey: number | string = 0): LatestSoilReportState {
  const [state, setState] = useState<Omit<LatestSoilReportState, "refetch">>({ report: null, loading: false, error: false });
  const [manual, setManual] = useState(0);
  const refetch = useCallback(() => setManual((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    if (!plotId || !enabled) {
      setState({ report: null, loading: false, error: false });
      return;
    }
    // A different plot must never show the previous plot's report while the new one loads.
    setState({ report: null, loading: true, error: false });
    supabase
      .from("soil_reports")
      .select(COLUMNS)
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
  }, [plotId, enabled, refreshKey, manual]);

  return { ...state, refetch };
}
