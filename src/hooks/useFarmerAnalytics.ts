import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";

/**
 * Analytics for the signed-in user, computed only from rows in their account.
 * Anything with no underlying data is `null` (never a default number), so the
 * UI can say "no data" instead of implying a measurement.
 */

export interface ProfileData {
  id: string;
  full_name: string | null;
  email: string | null;
  phone_number?: string | null;
  district?: string | null;
  state?: string | null;
  village?: string | null;
  preferred_language?: string | null;
}

export interface SoilReportData {
  id: string;
  plot_id: string;
  nitrogen_kg_ha: number;
  phosphorus_kg_ha: number;
  potassium_kg_ha: number;
  organic_carbon_percent: number;
  ph: number;
  electrical_conductivity: number | null;
  created_at: string;
}

export interface TwinRow {
  plot_id: string;
  analysis_date: string;
  crop_health_score: number | null;
  water_stress_score: number | null;
  ndvi: number | null;
  yield_prediction: number | null;
  risk_level: string | null;
  growth_stage: string | null;
}

export interface PlotData {
  id: string;
  name: string;
  crop: string | null;
  area: number | null;
  status: string | null;
  boundary_mapped: boolean | null;
  created_at: string;
}

export interface SoilAverages {
  N: number;
  P: number;
  K: number;
  OC: number;
  pH: number;
}

export interface AnalyticsData {
  plotCount: number;
  acres: number;
  plotsWithSoilReport: number;
  plotsWithTwin: number;
  recommendationCount: number;
  cropDistribution: Array<{ name: string; acres: number; pct: number }>;
  avgCropHealth: number | null;
  avgWaterStress: number | null;
  latestNdvi: number | null;
  latestYieldPrediction: number | null;
  latestRisk: string | null;
  growthStage: string | null;
  soil: SoilAverages | null;
  latestTwinDate: string | null;
  latestSoilDate: string | null;
}

const mean = (values: number[]): number | null =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

const round = (v: number | null, digits = 0): number | null =>
  v === null ? null : Number(v.toFixed(digits));

export function useFarmerAnalytics() {
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [plots, setPlots] = useState<PlotData[]>([]);
  const [twins, setTwins] = useState<TwinRow[]>([]);
  const [soilReports, setSoilReports] = useState<SoilReportData[]>([]);
  const [recommendationPlotIds, setRecommendationPlotIds] = useState<string[]>([]);
  const [selectedPlotId, setSelectedPlotId] = useState<string | "ALL">("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      setCurrentUser(session?.user ?? null);
      if (!session?.user) setIsLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setCurrentUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!currentUser) {
        setProfile(null);
        setPlots([]);
        setTwins([]);
        setSoilReports([]);
        setRecommendationPlotIds([]);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const [profileRes, plotsRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, email, phone_number, district, state, village, preferred_language")
            .eq("id", currentUser.id)
            .maybeSingle(),
          supabase
            .from("plots")
            .select("id, name, crop, area, status, boundary_mapped, created_at")
            .eq("owner_id", currentUser.id)
            .order("created_at", { ascending: false }),
        ]);
        if (profileRes.error) throw profileRes.error;
        if (plotsRes.error) throw plotsRes.error;

        const plotRows = (plotsRes.data ?? []) as PlotData[];
        const plotIds = plotRows.map((p) => p.id);

        let twinRows: TwinRow[] = [];
        let soilRows: SoilReportData[] = [];
        let recRows: Array<{ plot_id: string }> = [];

        if (plotIds.length > 0) {
          const [twinRes, soilRes, recRes] = await Promise.all([
            supabase
              .from("digital_twins")
              .select("plot_id, analysis_date, crop_health_score, water_stress_score, ndvi, yield_prediction, risk_level, growth_stage, is_synthetic")
              .in("plot_id", plotIds)
              .order("analysis_date", { ascending: false })
              .limit(1000),
            supabase
              .from("soil_reports")
              .select("id, plot_id, nitrogen_kg_ha, phosphorus_kg_ha, potassium_kg_ha, organic_carbon_percent, ph, electrical_conductivity, created_at")
              .eq("owner_id", currentUser.id)
              .order("created_at", { ascending: false }),
            supabase.from("recommendations").select("plot_id").eq("owner_id", currentUser.id),
          ]);
          if (twinRes.error) throw twinRes.error;
          if (soilRes.error) throw soilRes.error;
          if (recRes.error) throw recRes.error;

          // Synthetic (test) snapshots are never shown as account analytics.
          twinRows = ((twinRes.data ?? []) as Array<TwinRow & { is_synthetic?: boolean | null }>).filter(
            (r) => r.is_synthetic !== true
          );
          soilRows = (soilRes.data ?? []) as SoilReportData[];
          recRows = (recRes.data ?? []) as Array<{ plot_id: string }>;
        }

        if (!active) return;
        setProfile((profileRes.data as ProfileData | null) ?? null);
        setPlots(plotRows);
        setTwins(twinRows);
        setSoilReports(soilRows);
        setRecommendationPlotIds(recRows.map((r) => r.plot_id));
      } catch (err) {
        console.error("Analytics load failed:", err);
        if (active) {
          setPlots([]);
          setTwins([]);
          setSoilReports([]);
          setRecommendationPlotIds([]);
          setError(err instanceof Error ? err.message : "Could not load your analytics.");
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [currentUser]);

  // If the selected plot disappears (e.g. reload), fall back to the whole account.
  useEffect(() => {
    if (selectedPlotId !== "ALL" && plots.length > 0 && !plots.some((p) => p.id === selectedPlotId)) {
      setSelectedPlotId("ALL");
    }
  }, [plots, selectedPlotId]);

  const analyticsData: AnalyticsData = useMemo(() => {
    const scope = selectedPlotId === "ALL" ? plots : plots.filter((p) => p.id === selectedPlotId);
    const scopeIds = new Set(scope.map((p) => p.id));

    // rows arrive newest-first, so the first match per plot is the latest
    const latestTwinByPlot = new Map<string, TwinRow>();
    for (const row of twins) {
      if (scopeIds.has(row.plot_id) && !latestTwinByPlot.has(row.plot_id)) latestTwinByPlot.set(row.plot_id, row);
    }
    const latestSoilByPlot = new Map<string, SoilReportData>();
    for (const row of soilReports) {
      if (scopeIds.has(row.plot_id) && !latestSoilByPlot.has(row.plot_id)) latestSoilByPlot.set(row.plot_id, row);
    }

    const acres = scope.reduce((s, p) => s + (p.area ?? 0), 0);

    const cropAcres = new Map<string, number>();
    for (const p of scope) {
      const name = p.crop || "Unspecified";
      cropAcres.set(name, (cropAcres.get(name) ?? 0) + (p.area ?? 0));
    }
    const cropDistribution = [...cropAcres.entries()].map(([name, a]) => ({
      name,
      acres: a,
      pct: acres > 0 ? Math.round((a / acres) * 100) : 0,
    }));

    const twinList = [...latestTwinByPlot.values()];
    const health = twinList.map((t) => t.crop_health_score).filter((v): v is number => typeof v === "number");
    const water = twinList.map((t) => t.water_stress_score).filter((v): v is number => typeof v === "number");
    const single = scope.length === 1 ? latestTwinByPlot.get(scope[0].id) ?? null : null;

    const soilList = [...latestSoilByPlot.values()];
    const soil: SoilAverages | null = soilList.length
      ? {
          N: round(mean(soilList.map((r) => Number(r.nitrogen_kg_ha))), 0)!,
          P: round(mean(soilList.map((r) => Number(r.phosphorus_kg_ha))), 0)!,
          K: round(mean(soilList.map((r) => Number(r.potassium_kg_ha))), 0)!,
          OC: round(mean(soilList.map((r) => Number(r.organic_carbon_percent))), 2)!,
          pH: round(mean(soilList.map((r) => Number(r.ph))), 2)!,
        }
      : null;

    const newest = (dates: Array<string | undefined>) =>
      dates.filter((d): d is string => !!d).sort().slice(-1)[0] ?? null;

    return {
      plotCount: scope.length,
      acres,
      plotsWithSoilReport: latestSoilByPlot.size,
      plotsWithTwin: latestTwinByPlot.size,
      recommendationCount: recommendationPlotIds.filter((id) => scopeIds.has(id)).length,
      cropDistribution,
      avgCropHealth: round(mean(health)),
      avgWaterStress: round(mean(water)),
      latestNdvi: single?.ndvi ?? null,
      latestYieldPrediction: single?.yield_prediction ?? null,
      latestRisk: single?.risk_level ?? null,
      growthStage: single?.growth_stage ?? null,
      soil,
      latestTwinDate: newest(twinList.map((t) => t.analysis_date)),
      latestSoilDate: newest(soilList.map((r) => r.created_at)),
    };
  }, [plots, twins, soilReports, recommendationPlotIds, selectedPlotId]);

  /** Chronological Digital Twin history for the selected plot (real rows only). */
  const twinHistory: TwinRow[] = useMemo(
    () =>
      selectedPlotId === "ALL"
        ? []
        : twins.filter((t) => t.plot_id === selectedPlotId).slice().reverse(),
    [twins, selectedPlotId]
  );

  const latestSoilReportForSelection: SoilReportData | null = useMemo(() => {
    if (selectedPlotId === "ALL") return null;
    return soilReports.find((r) => r.plot_id === selectedPlotId) ?? null;
  }, [soilReports, selectedPlotId]);

  return {
    isLoading,
    error,
    profile,
    plots,
    selectedPlotId,
    setSelectedPlotId,
    analyticsData,
    twinHistory,
    latestSoilReportForSelection,
  };
}
