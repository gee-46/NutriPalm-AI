import React, { useMemo, useRef, useState } from "react";
import { Sprout } from "lucide-react";
import { useSavedPlots } from "../../hooks/useSavedPlots";
import { useTranslation } from "../../translation/useTranslation";
import { useBackendCapabilities } from "../../hooks/useBackendCapabilities";
import { useLatestSoilReport } from "../../hooks/useLatestSoilReport";
import { usePlotWeather } from "../../hooks/usePlotWeather";
import { assessCropSuitability, ModuleUnavailableError } from "../../lib/phase2/capabilities";
import type { CropSuitabilityAssessment, SuitabilityCategory } from "../../lib/phase2/contracts";
import { RecommendationCard } from "../phase2/RecommendationCard";
import {
  EmptyState,
  ErrorBanner,
  FactRow,
  PageHeader,
  PlotSelect,
  Spinner,
  UnavailableState,
  type BadgeKind,
} from "../phase2/shared";

const CATEGORY_BADGE: Record<SuitabilityCategory, BadgeKind> = {
  suitable: "suitable",
  partial: "partial",
  unsuitable: "unsuitable",
  insufficient_information: "insufficient_info",
};

interface Props {
  onNavigate?: (screen: string) => void;
}

export const CropSuitabilityScreen: React.FC<Props> = ({ onNavigate }) => {
  const { t, locale } = useTranslation();
  const plots = useSavedPlots();
  const caps = useBackendCapabilities();
  const [plotId, setPlotId] = useState("");
  const plot = useMemo(() => plots.find((p) => p.id === plotId), [plots, plotId]);
  const { report, loading: reportLoading } = useLatestSoilReport(plotId || undefined);
  const wx = usePlotWeather(plot);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CropSuitabilityAssessment | null>(null);
  const inFlight = useRef(false);

  const available = caps.cropSuitability === "available";
  const fmt = (n: number, d = 1) => n.toLocaleString(locale, { maximumFractionDigits: d });
  const na = t("p2.common.not_available");

  const choosePlot = (id: string) => {
    setPlotId(id);
    setResult(null);
    setError(null);
  };

  const maxRainChance = useMemo(() => {
    const vals = (wx.weather?.forecast ?? []).slice(0, 5).map((d) => d.precipitationProbabilityPercent).filter((v): v is number => v !== null);
    return vals.length ? Math.max(...vals) : null;
  }, [wx.weather]);

  const missing: string[] = [];
  if (plot) {
    if (!report && !reportLoading) missing.push(t("p2.suit.missing_soil"));
    if (!wx.centroid) missing.push(t("p2.suit.missing_boundary"));
    if (!plot.irrigation || !plot.irrigation.trim()) missing.push(t("p2.suit.missing_irrigation"));
    missing.push(t("p2.suit.missing_texture"), t("p2.suit.missing_drainage"), t("p2.suit.missing_water"));
  }

  const run = async () => {
    if (inFlight.current) return;
    setError(null);
    if (!plotId) return setError(t("p2.suit.err_plot"));
    inFlight.current = true;
    setBusy(true);
    setResult(null);
    try {
      setResult(await assessCropSuitability({ plot_id: plotId, soil_report_id: report?.id }));
    } catch (err) {
      if (err instanceof ModuleUnavailableError) setError(t("p2.suit.unavailable_title"));
      else setError(t("p2.suit.error", { message: err instanceof Error ? err.message : t("p2.common.error_generic") }));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const location = plot
    ? [plot.village, plot.taluk, plot.district, plot.state].filter(Boolean).join(", ") ||
      (wx.centroid ? `${wx.centroid.lat.toFixed(4)}, ${wx.centroid.lng.toFixed(4)}` : na)
    : na;

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleString(locale);
  };

  return (
    <div className="space-y-6 text-left">
      <PageHeader icon={<Sprout className="h-8 w-8" />} title={t("p2.suit.title")} subtitle={t("p2.suit.subtitle")} />

      {plots.length === 0 ? (
        <EmptyState
          title={t("p2.common.no_plots_title")}
          body={t("p2.common.no_plots_body")}
          action={onNavigate ? { label: t("p2.common.add_plot"), onClick: () => onNavigate("Farm Plots") } : undefined}
        />
      ) : (
        <>
          <PlotSelect plots={plots} value={plotId} onChange={choosePlot} id="suit-plot" />

          {plot && (
            <div className="grid gap-5 lg:grid-cols-2">
              <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-xs sm:p-6">
                <h2 className="mb-2 text-base font-extrabold text-gray-900">{t("p2.suit.inputs_title")}</h2>
                <dl>
                  <FactRow label={t("p2.suit.location")} value={location} />
                  <FactRow label={t("p2.suit.boundary")} value={wx.centroid ? t("p2.suit.boundary_yes") : t("p2.suit.boundary_no")} />
                  <FactRow label={t("p2.suit.soil_report")} value={reportLoading ? t("p2.common.loading") : report ? fmtDate(report.created_at) : na} />
                  {report && (
                    <>
                      <FactRow label={t("p2.nutrient.ph")} value={fmt(report.ph, 2)} />
                      <FactRow label={`${t("p2.nutrient.ec")} (dS/m)`} value={report.electrical_conductivity !== null ? fmt(report.electrical_conductivity, 2) : na} />
                      <FactRow label={`${t("p2.nutrient.n")} (kg/ha)`} value={fmt(report.nitrogen_kg_ha)} />
                      <FactRow label={`${t("p2.nutrient.p")} (kg/ha)`} value={fmt(report.phosphorus_kg_ha)} />
                      <FactRow label={`${t("p2.nutrient.k")} (kg/ha)`} value={fmt(report.potassium_kg_ha)} />
                      <FactRow label={`${t("p2.nutrient.oc")} (%)`} value={fmt(report.organic_carbon_percent, 2)} />
                    </>
                  )}
                  <FactRow label={t("p2.suit.irrigation")} value={plot.irrigation?.trim() || na} />
                  <FactRow label={t("p2.suit.weather_now")} value={wx.loading ? t("p2.common.loading") : wx.weather ? `${fmt(wx.weather.current.temperatureC, 0)}°C` : na} />
                  <FactRow label={t("p2.suit.rain_chance")} value={maxRainChance !== null ? `${fmt(maxRainChance, 0)}%` : na} />
                </dl>
              </section>

              <section className="rounded-3xl border border-amber-200 bg-amber-50/60 p-5 sm:p-6">
                <h2 className="mb-2 text-base font-extrabold text-gray-900">{t("p2.suit.missing_title")}</h2>
                <ul className="list-disc space-y-1.5 pl-5 text-sm font-medium leading-relaxed text-gray-800">
                  {missing.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
                {!report && !reportLoading && onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate("Soil Reports")}
                    className="mt-4 min-h-11 cursor-pointer rounded-xl border-0 bg-primary px-4 py-2 text-sm font-extrabold text-white hover:bg-[#235F26] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    {t("p2.common.go_soil")}
                  </button>
                )}
              </section>
            </div>
          )}

          {caps.cropSuitability === "checking" && <Spinner label={t("p2.suit.checking_service")} />}
          {caps.cropSuitability === "unavailable" && (
            <UnavailableState title={t("p2.suit.unavailable_title")} body={t("p2.suit.unavailable_body")} detail={t("p2.suit.unavailable_detail")} />
          )}

          {error && <ErrorBanner message={error} />}

          <button
            type="button"
            onClick={run}
            disabled={!available || busy || !plotId}
            className="min-h-11 cursor-pointer rounded-xl border-0 bg-primary px-5 py-2.5 text-sm font-extrabold text-white hover:bg-[#235F26] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? t("p2.suit.running") : t("p2.suit.run")}
          </button>

          {result && (
            <section aria-live="polite" className="space-y-4">
              <h2 className="text-xl font-extrabold text-gray-900">{t("p2.suit.results_title")}</h2>
              {result.ranked.length === 0 ? (
                <p className="text-sm font-medium text-gray-600">{t("p2.suit.no_results")}</p>
              ) : (
                result.ranked.map((c, i) => (
                  <RecommendationCard
                    key={`${c.crop}-${i}`}
                    kind="suitability"
                    title={`${t("p2.suit.rank", { n: i + 1 })} · ${c.crop}`}
                    badge={CATEGORY_BADGE[c.category]}
                    why={c.reasons}
                    howMuch={[
                      ...(c.score !== null ? [{ label: t("p2.suit.score"), value: String(c.score) }] : []),
                      ...(c.water_requirement ? [{ label: t("p2.suit.water"), value: c.water_requirement }] : []),
                    ]}
                    evidence={c.evidence}
                    limitations={c.limitations}
                    missing={result.missing_inputs}
                    date={t("p2.suit.assessed_at", { date: fmtDate(result.assessed_at) })}
                  />
                ))
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
};
