import React from "react";
import { motion } from "framer-motion";
import { BarChart3, Sprout, ChevronDown, AlertTriangle } from "lucide-react";
import { useTranslation } from "../../translation/useTranslation";
import { useFarmerAnalytics } from "../../hooks/useFarmerAnalytics";
import type { TwinRow } from "../../hooks/useFarmerAnalytics";
import { SoilNutrientAnalyticsCard } from "../analytics/SoilNutrientAnalyticsCard";

interface AnalyticsScreenProps {
  onNavigate?: (screen: string) => void;
}

const fmtDate = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d.toLocaleDateString();
};

const Kpi: React.FC<{ label: string; value: string; note?: string }> = ({ label, value, note }) => (
  <div className="bg-white rounded-2xl p-5 border border-gray-150 shadow-xs text-left">
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
    <p className="text-2xl font-black text-gray-900 mt-2">{value}</p>
    {note && <p className="text-[10px] font-semibold text-gray-400 mt-1">{note}</p>}
  </div>
);

/** Line chart of real Digital Twin rows. Only drawn with at least two data points. */
const HistoryChart: React.FC<{
  rows: TwinRow[];
  pick: (r: TwinRow) => number | null;
  label: string;
  unit: string;
  max: number;
}> = ({ rows, pick, label, unit, max }) => {
  const { t } = useTranslation();
  const points = rows
    .map((r) => ({ t: new Date(r.analysis_date).getTime(), v: pick(r) }))
    .filter((p): p is { t: number; v: number } => p.v !== null && !isNaN(p.t));

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-150 shadow-xs text-left">
      <p className="text-xs font-black text-gray-900 uppercase tracking-widest">{label}</p>
      {points.length < 2 ? (
        <p className="text-xs font-semibold text-gray-500 mt-3">
          {t("p2.ui.not_enough_stored_history_yet_nasscj")}{points.length} {t("p2.ui.data_point_1z2cwx")}{points.length === 1 ? "" : "s"}).
        </p>
      ) : (
        (() => {
          const W = 400, H = 140, PAD = 18;
          const t0 = points[0].t, t1 = points[points.length - 1].t;
          const x = (t: number) => PAD + ((t - t0) / (t1 - t0 || 1)) * (W - PAD * 2);
          const y = (v: number) => H - PAD - (Math.min(Math.max(v, 0), max) / max) * (H - PAD * 2);
          const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
          const last = points[points.length - 1];
          return (
            <>
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full mt-3" role="img" aria-label={`${label} over time`}>
                <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#E5E7EB" />
                <path d={path} fill="none" stroke="#2E7D32" strokeWidth="2" />
                {points.map((p) => (
                  <circle key={p.t} cx={x(p.t)} cy={y(p.v)} r="3" fill="#2E7D32" />
                ))}
              </svg>
              <p className="text-[10px] font-semibold text-gray-500 mt-1">
                {new Date(t0).toLocaleDateString()} → {new Date(t1).toLocaleDateString()} {t("p2.ui.latest_1baou1j")} {last.v}
                {unit}
              </p>
            </>
          );
        })()
      )}
    </div>
  );
};

export const AnalyticsScreen: React.FC<AnalyticsScreenProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const {
    isLoading,
    error,
    profile,
    plots,
    selectedPlotId,
    setSelectedPlotId,
    analyticsData: a,
    twinHistory,
    latestSoilReportForSelection,
  } = useFarmerAnalytics();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[450px]">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="max-w-xl mx-auto my-12 bg-rose-50 border border-rose-200 rounded-3xl p-6 text-sm font-semibold text-rose-800 flex gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <span>{t("p2.ui.could_not_load_your_analytics_vm9ja2")} {error}</span>
      </div>
    );
  }

  if (plots.length === 0) {
    return (
      <motion.div
        className="max-w-md mx-auto my-12 bg-white rounded-3xl p-8 border border-gray-150 shadow-xs text-center space-y-6"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mx-auto">
          <Sprout className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">{t("analytics.no_plots_registered")}</h2>
          <p className="text-xs text-gray-500 font-semibold leading-relaxed">
            {t("p2.ui.add_a_farm_plot_to_see_analytics_built_from__1p1sqca")}
          </p>
        </div>
        <button
          onClick={() => onNavigate?.("Farm Plots")}
          className="w-full bg-primary hover:bg-[#235F26] text-white rounded-xl py-3 text-xs font-bold shadow-xs transition-all border-0 cursor-pointer"
        >
          {t("analytics.map_first_plot")}
        </button>
      </motion.div>
    );
  }

  const selectedPlot = plots.find((p) => p.id === selectedPlotId);
  const soilForCard = latestSoilReportForSelection ?? null;
  const cropForCard = selectedPlot?.crop ?? undefined;

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 text-left">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200/50 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight leading-none flex items-center gap-2">
            <BarChart3 className="w-8 h-8 text-primary" />
            {t("analytics.title")}
          </h1>
          <p className="text-sm font-semibold text-gray-500 mt-2">
            {profile?.full_name ? `${profile.full_name} · ` : ""}
            {t("p2.ui.built_only_from_the_data_stored_in_your_acco_17vsr07")}
          </p>
        </div>
        <div className="relative w-full md:w-64">
          <select
            aria-label={t("p2.ui.plot_5bxxk")}
            value={selectedPlotId}
            onChange={(e) => setSelectedPlotId(e.target.value)}
            className="appearance-none w-full bg-white border border-gray-250 text-xs font-bold text-gray-800 rounded-xl pl-3.5 pr-8 py-2.5 shadow-xs h-10 cursor-pointer"
          >
            <option value="ALL">{t("p2.ui.all_plots_zb9d10")}{plots.length})</option>
            {plots.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label={t("p2.ui.mapped_area_ti8p8z")} value={`${a.acres.toFixed(2)} acres`} note={`${a.plotCount} plot${a.plotCount === 1 ? "" : "s"}`} />
        <Kpi
          label={t("p2.ui.crop_health_digital_twin_gve19o")}
          value={a.avgCropHealth !== null ? `${a.avgCropHealth}%` : t("p2.ui.no_data_1e4ltia")}
          note={a.latestTwinDate ? `Latest snapshot ${fmtDate(a.latestTwinDate)}` : `${a.plotsWithTwin} plots with snapshots`}
        />
        <Kpi
          label={t("p2.ui.soil_reports_13vmfut")}
          value={`${a.plotsWithSoilReport} / ${a.plotCount}`}
          note={a.latestSoilDate ? `Latest ${fmtDate(a.latestSoilDate)}` : t("p2.ui.no_report_uploaded_rvde50")}
        />
        <Kpi label={t("p2.ui.recommendations_saved_ukbb3u")} value={String(a.recommendationCount)} />
      </div>

      {selectedPlotId !== "ALL" && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi label={t("p2.ui.latest_ndvi_1cr1b2z")} value={a.latestNdvi !== null ? a.latestNdvi.toFixed(2) : t("p2.ui.no_data_1e4ltia")} />
          <Kpi label={t("p2.ui.water_stress_score_1t9p792")} value={a.avgWaterStress !== null ? String(a.avgWaterStress) : t("p2.ui.no_data_1e4ltia")} />
          <Kpi
            label={t("p2.ui.yield_prediction_7ay3op")}
            value={a.latestYieldPrediction !== null ? String(a.latestYieldPrediction) : t("p2.ui.no_data_1e4ltia")}
          />
          <Kpi label={t("p2.ui.risk_level_a98p5m")} value={a.latestRisk ?? t("p2.ui.no_data_1e4ltia")} note={a.growthStage ? `Stage: ${a.growthStage}` : undefined} />
        </div>
      )}

      <div className="bg-white rounded-2xl p-5 border border-gray-150 shadow-xs">
        <p className="text-xs font-black text-gray-900 uppercase tracking-widest mb-3">{t("p2.ui.crop_distribution_bav45p")}</p>
        <div className="space-y-3">
          {a.cropDistribution.map((c) => (
            <div key={c.name}>
              <div className="flex justify-between text-xs font-semibold text-gray-700 mb-1">
                <span>{c.name}</span>
                <span>
                  {c.acres.toFixed(2)} {t("p2.ui.acres_14g9m5q")} {c.pct}%
                </span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${c.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedPlotId === "ALL" ? (
        <div className="bg-white rounded-2xl p-5 border border-gray-150 shadow-xs text-sm font-semibold text-gray-600">
          {t("p2.ui.select_a_single_plot_to_see_its_digital_twin_6j7t5v")}
          {a.soil && (
            <p className="mt-3 text-xs text-gray-500">
              {t("p2.ui.average_of_each_plot_s_latest_soil_report_n_131fm0h")} {a.soil.N}, P {a.soil.P}, K {a.soil.K} kg/ha · OC {a.soil.OC}% · pH {a.soil.pH}
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <HistoryChart rows={twinHistory} pick={(r) => r.crop_health_score} label={t("p2.ui.crop_health_score_lue0wn")} unit="%" max={100} />
            <HistoryChart rows={twinHistory} pick={(r) => r.ndvi} label={t("p2.ui.ndvi_59to0")} unit="" max={1} />
          </div>

          {soilForCard ? (
            <SoilNutrientAnalyticsCard
              report={soilForCard}
              cropType={cropForCard}
              title={`Soil nutrients — ${selectedPlot?.name ?? ""}`}
              showMiniRadar={true}
            />
          ) : (
            <div className="bg-white rounded-2xl p-5 border border-gray-150 shadow-xs text-sm font-semibold text-gray-600">
              {t("p2.ui.no_soil_report_uploaded_for_this_plot_yet_12gp9br")}
              {onNavigate && (
                <button
                  onClick={() => onNavigate("Soil Reports")}
                  className="ml-3 text-primary font-bold underline border-0 bg-transparent cursor-pointer"
                >
                  {t("p2.ui.upload_one_xzjmem")}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </motion.div>
  );
};
