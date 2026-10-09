import { useMemo } from "react";
import { usePlots, type Plot } from "../data/plots";

/** Plots that are real, saved rows (not sample/seed data). */
export function useSavedPlots(): Plot[] {
  const { plots } = usePlots();
  return useMemo(() => plots.filter((p) => !p.isDemo && !p.id.startsWith("plot-")), [plots]);
}
