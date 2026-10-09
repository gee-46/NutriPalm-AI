import React, { useEffect, useMemo, useState } from "react";
import { Bug, FileText, FlaskConical, Map as MapIcon, Sprout } from "lucide-react";
import { useTranslation } from "../../translation/useTranslation";
import type { Plot } from "../../data/plots";
import { useBackendCapabilities } from "../../hooks/useBackendCapabilities";
import { useLatestSoilReport } from "../../hooks/useLatestSoilReport";
import { listRecommendations, type RecommendationRecord } from "../../lib/apiClient";
import { DashboardWeatherCard } from "./DashboardWeatherCard";
import { EmptyState, ErrorBanner, PlotSelect } from "../phase2/shared";

interface DashboardScreenProps {
  stats: {
    totalFarmers: number;
    totalFarms: number;
    mappedPlots: number;
    totalAcreage: number;
    activeTwins: number;
    recommendations: number;
    soilHealthScore: number;
  };
  plots: Plot[];
  currentUser: { email?: string | null; user_metadata?: Record<string, unknown> } | null;
  userProfile: { full_name?: string | null } | null;
  onNavigate: (screen: string) => void;
  /** Open the nutrient/fertilizer page focused on a plot. */
  onOpenRecommendation?: (plotId: string) => void;
}

const Card: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <section className="space-y-3 rounded-3xl border border-gray-200 bg-white p-5 text-left shadow-xs">
    <div className="flex items-center gap-2">
      <span className="text-primary" aria-hidden="true">{icon}</span>
      <h3 className="text-base font-extrabold text-gray-900">{title}</h3>
    </div>
    {children}
  </section>
);

const LinkButton: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className="min-h-11 cursor-pointer rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-800 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
  >
    {children}
  </button>
);

const deficientNames = (r: RecommendationRecord | undefined, nameOf: (n: string, d: string) => string): string[] =>
  Array.isArray(r?.deficiencies)
    ? r!.deficiencies
        .filter((f: { status?: string }) => f.status === "deficient")
        .map((f: { nutrient: string; display_name: string }) => nameOf(f.nutrient, f.display_name))
    : [];

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  stats,
  plots,
  currentUser,
  userProfile,
  onNavigate,
  onOpenRecommendation,
}) => {
  const { t, locale } = useTranslation();
  const caps = useBackendCapabilities();

  const savedPlots = useMemo(() => plots.filter((p) => !p.isDemo && !p.id.startsWith("plot-")), [plots]);
  const [plotId, setPlotId] = useState("");
  useEffect(() => {
    if (!plotId || !savedPlots.some((p) => p.id === plotId)) setPlotId(savedPlots[0]?.id ?? "");
  }, [savedPlots, plotId]);
  const plot = savedPlots.find((p) => p.id === plotId);

  const { report, loading: reportLoading } = useLatestSoilReport(plotId || undefined);

  const [recs, setRecs] = useState<RecommendationRecord[]>([]);
  const [recError, setRecError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!currentUser) return;
    listRecommendations()
      .then((r) => !cancelled && (setRecs(r), setRecError(null)))
      .catch((e) => !cancelled && (setRecs([]), setRecError(e instanceof Error ? e.message : t("p2.common.error_generic"))));
    return () => {
      cancelled = true;
    };
  }, [currentUser, t]);

  const hour = new Date().getHours();
  const greeting =
    hour >= 5 && hour < 12 ? t("p2.dash.good_morning") : hour < 17 && hour >= 12 ? t("p2.dash.good_afternoon") : hour >= 17 && hour < 21 ? t("p2.dash.good_evening") : t("p2.dash.good_night");

  const displayName =
    userProfile?.full_name ||
    (currentUser?.user_metadata?.full_name as string | undefined) ||
    (currentUser?.user_metadata?.name as string | undefined) ||
    "";

  const nutrientName = (n: string, d: string) => {
    const k = ({ nitrogen: "n", phosphorus: "p", potassium: "k", n: "n", p: "p", k: "k" } as Record<string, string>)[n?.toLowerCase()];
    return k ? t(`p2.nutrient.${k}`) : d || n;
  };

  const plotRecs = recs.filter((r) => r.plot_id === plotId).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const latestRec = plotRecs[0];
  const latestLow = deficientNames(latestRec, nutrientName);
  const topRecs = [...recs].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 3);
  const nameOfPlot = (id: string) => plots.find((p) => p.id === id)?.name ?? "";
  const crops = Array.from(new Set(plots.map((p) => p.crop).filter(Boolean)));
  const fmtNum = (n: number, d = 1) => n.toLocaleString(locale, { maximumFractionDigits: d });

  const quick: Array<{ label: string; icon: React.ReactNode; go: () => void }> = [
    { label: t("p2.dash.q_farms"), icon: <MapIcon className="h-6 w-6" />, go: () => onNavigate("Farm Plots") },
    { label: t("p2.dash.q_soil"), icon: <FileText className="h-6 w-6" />, go: () => onNavigate("Soil Reports") },
    { label: t("p2.dash.q_disease"), icon: <Bug className="h-6 w-6" />, go: () => onNavigate("Disease Intelligence") },
    { label: t("p2.dash.q_grow"), icon: <Sprout className="h-6 w-6" />, go: () => onNavigate("Crop Suitability") },
    { label: t("p2.dash.q_recs"), icon: <FlaskConical className="h-6 w-6" />, go: () => onNavigate("Recommendations") },
  ];

  return (
    <div className="space-y-8 text-left">
      {/* Welcome */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-3xl">
            {greeting}
            {displayName ? `, ${displayName}` : ""}
          </h1>
          <p className="mt-1.5 text-base font-medium text-gray-600">{t("p2.dash.welcome_sub")}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {savedPlots.length > 0 && <PlotSelect plots={savedPlots} value={plotId} onChange={setPlotId} id="dash-plot" />}
        </div>
      </header>

      {recError && <ErrorBanner message={t("p2.dash.load_error", { message: recError })} />}

      {/* Farm overview — counts come straight from the account's rows */}
      <section aria-label={t("p2.dash.overview")} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [t("p2.dash.farmers"), String(stats.totalFarmers)],
          [t("p2.dash.plots"), String(stats.totalFarms)],
          [t("p2.dash.mapped"), t("p2.dash.mapped_of", { mapped: stats.mappedPlots, total: stats.totalFarms })],
          [t("p2.dash.acreage"), fmtNum(stats.totalAcreage, 2)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
            <p className="text-sm font-semibold text-gray-600">{label}</p>
            <p className="mt-1 text-2xl font-black text-gray-900">{value}</p>
          </div>
        ))}
        <div className="col-span-2 rounded-2xl border border-gray-200 bg-white p-4 shadow-xs lg:col-span-4">
          <p className="text-sm font-semibold text-gray-600">{t("p2.dash.crops")}</p>
          <p className="mt-1 text-base font-bold text-gray-900">{crops.length ? crops.join(", ") : t("p2.common.not_available")}</p>
        </div>
      </section>

      {savedPlots.length === 0 ? (
        <EmptyState title={t("p2.dash.empty_title")} body={t("p2.dash.empty_body")} action={{ label: t("p2.common.add_plot"), onClick: () => onNavigate("Farm Plots") }} />
      ) : (
        <>
          {/* Farm health for the selected plot */}
          <section aria-label={t("p2.dash.health")} className="space-y-3">
            <h2 className="text-xl font-extrabold text-gray-900">{t("p2.dash.health")} <span className="text-base font-semibold text-gray-500">· {plot?.name}</span></h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Card title={t("p2.dash.soil")} icon={<FileText className="h-5 w-5" />}>
                <p className="text-sm font-medium text-gray-700">
                  {reportLoading ? t("p2.common.loading") : report ? t("p2.dash.soil_ok", { date: new Date(report.created_at).toLocaleDateString(locale) }) : t("p2.dash.soil_none")}
                </p>
                {report && (
                  <p className="text-sm font-semibold text-gray-900">
                    pH {fmtNum(report.ph, 2)} · N {fmtNum(report.nitrogen_kg_ha)} · P {fmtNum(report.phosphorus_kg_ha)} · K {fmtNum(report.potassium_kg_ha)} kg/ha
                  </p>
                )}
                <LinkButton onClick={() => onNavigate("Soil Reports")}>{t("p2.common.go_soil")}</LinkButton>
              </Card>

              <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-xs">
                <DashboardWeatherCard plot={plot} onOpen={() => onNavigate("Weather")} />
              </section>

              <Card title={t("p2.dash.disease")} icon={<Bug className="h-5 w-5" />}>
                <p className="text-sm font-medium text-gray-700">
                  {caps.disease === "checking" ? t("p2.dash.disease_checking") : caps.disease === "available" ? t("p2.dash.disease_none") : t("p2.dash.disease_unavailable")}
                </p>
                <LinkButton onClick={() => onNavigate("Disease Intelligence")}>{t("p2.dash.q_disease")}</LinkButton>
              </Card>

              <Card title={t("p2.dash.nutrients")} icon={<FlaskConical className="h-5 w-5" />}>
                <p className="text-sm font-medium text-gray-700">
                  {!latestRec ? t("p2.dash.nutrients_none") : latestLow.length ? t("p2.dash.nutrients_low", { list: latestLow.join(", ") }) : t("p2.dash.nutrients_ok")}
                </p>
                <LinkButton onClick={() => (plotId && onOpenRecommendation ? onOpenRecommendation(plotId) : onNavigate("Recommendations"))}>{t("p2.dash.next_open")}</LinkButton>
              </Card>
            </div>
          </section>

          {/* Next steps from real saved advice */}
          <section aria-label={t("p2.dash.next_title")} className="space-y-3">
            <h2 className="text-xl font-extrabold text-gray-900">{t("p2.dash.next_title")}</h2>
            {topRecs.length === 0 ? (
              <p className="rounded-2xl border border-gray-200 bg-white p-4 text-sm font-medium text-gray-700">{t("p2.dash.next_none")}</p>
            ) : (
              <ul className="space-y-3">
                {topRecs.map((r) => {
                  const low = deficientNames(r, nutrientName);
                  return (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
                      <div>
                        <p className="text-sm font-extrabold text-gray-900">{t("p2.dash.next_item", { plot: nameOfPlot(r.plot_id), crop: String(r.crop).replace(/_/g, " ") })}</p>
                        <p className="text-sm font-medium text-gray-700">{low.length ? t("p2.dash.next_deficient", { list: low.join(", ") }) : t("p2.dash.next_fine")}</p>
                        <p className="text-sm font-medium text-gray-500">{new Date(r.created_at).toLocaleDateString(locale)}</p>
                      </div>
                      <LinkButton onClick={() => (onOpenRecommendation ? onOpenRecommendation(r.plot_id) : onNavigate("Recommendations"))}>{t("p2.dash.next_open")}</LinkButton>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      {/* Quick actions */}
      <section aria-label={t("p2.dash.quick")} className="space-y-3">
        <h2 className="text-xl font-extrabold text-gray-900">{t("p2.dash.quick")}</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {quick.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={q.go}
              className="flex min-h-24 cursor-pointer flex-col items-start justify-between gap-2 rounded-2xl border border-gray-200 bg-white p-4 text-left text-sm font-extrabold text-gray-900 shadow-xs hover:border-primary/50 hover:bg-emerald-50/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span className="text-primary" aria-hidden="true">{q.icon}</span>
              {q.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
