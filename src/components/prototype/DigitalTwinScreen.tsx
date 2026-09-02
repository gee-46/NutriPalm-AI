import { useTranslation } from "../../translation/useTranslation";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, Activity, Thermometer, Droplets, FlaskConical, ChevronRight, Bot, Cpu, RefreshCw, Download, X, Calendar } from "lucide-react";
import { usePlots } from "../../data/plots";
import { boundaryToSvgPath } from "../../lib/svgPath";
import { AnimatedCounter } from "./FarmPlotScreen";
import { useDigitalTwinSnapshots, useTwinPrediction, useDigitalTwinHistory } from "../../data/digitalTwins";
import { useEnvironmentalData } from "../../hooks/useEnvironmentalData";



interface TelemetryBadge {
  id: string;
  label: string;
  value: string;
  interpretation: string;
  x: number;
  y: number;
}

interface DigitalTwinScreenProps {
  onNavigate?: (screen: string) => void;
  showToast?: (message: string, type?: "success" | "info" | "warning") => void;
}

export const DigitalTwinScreen: React.FC<DigitalTwinScreenProps> = ({
  onNavigate,
  showToast
}) => {
  const { t } = useTranslation();
  const [activePlotId, setActivePlotId] = useState("");
  const [simMode, setSimMode] = useState<"Past" | "Current" | "Prediction">("Current");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isExportLoading, setIsExportLoading] = useState(false);
  const [activeChartTab, setActiveChartTab] = useState<"NDVI" | "Health" | "Moisture" | "Temp">("NDVI");
  const [activeTimeframe, setActiveTimeframe] = useState<"7d" | "30d" | "90d">("30d");
  const [hoveredBadge, setHoveredBadge] = useState<string | null>(null);

  // Living updates states
  const [lastSyncMinutes, setLastSyncMinutes] = useState(2);
  const [isChangingPlot, setIsChangingPlot] = useState(false);

  const triggerToast = (msg: string, type: "success" | "info" | "warning" = "success") => {
    if (showToast) {
      showToast(msg, type);
    } else {
      alert(`${type.toUpperCase()}: ${msg}`);
    }
  };

  // 1. Auto-updating sync timer
  useEffect(() => {
    const timerInterval = setInterval(() => {
      setLastSyncMinutes(prev => prev + 1);
    }, 60000); // every minute

    return () => {
      clearInterval(timerInterval);
    };
  }, []);

  const handleSync = () => {
    setIsSyncing(true);
    envData.refresh();
    setTimeout(() => {
      setIsSyncing(false);
      setLastSyncMinutes(0);
      triggerToast("Digital Twin virtual model synchronized.", "success");
    }, 1000);
  };

  const handlePlotSwitch = (id: string) => {
    setIsChangingPlot(true);
    setActivePlotId(id);
    setTimeout(() => {
      setIsChangingPlot(false);
      triggerToast(`Calibrated twin workspace to Plot ${id.toUpperCase()}`, "info");
    }, 500);
  };

  const handleSimModeSwitch = (mode: "Past" | "Current" | "Prediction") => {
    setIsChangingPlot(true);
    setSimMode(mode);
    setTimeout(() => {
      setIsChangingPlot(false);
      triggerToast(`Simulating ${mode.toUpperCase()} timeline telemetry...`, "info");
    }, 450);
  };

  // ── Shared store ─────────────────────────────────────────────────────────
  const { plots } = usePlots();

  // Select the first real Supabase plot once the authenticated plots load.
  // Never leave the Digital Twin bound to an empty/placeholder plot id.
  useEffect(() => {
    if (plots.length > 0 && !plots.some((plot) => plot.id === activePlotId)) {
      setActivePlotId(plots[0].id);
    }
  }, [plots, activePlotId]);

  const activePlot = plots.find((p) => p.id === activePlotId) || plots[0];

  const { snapshots, isLoading: isTwinsLoading } =
    useDigitalTwinSnapshots(activePlotId);
  const { prediction, isLoading: isPredictionLoading } = useTwinPrediction(activePlotId);
  const historyDays = activeTimeframe === "7d" ? 7 : activeTimeframe === "30d" ? 30 : 90;
  const { history: twinHistory } = useDigitalTwinHistory(activePlotId, historyDays as 7 | 30 | 90);
  
  const activeSnapshot = snapshots[simMode];
  const envData = useEnvironmentalData(activePlot);

  if (plots.length === 0 || !activePlot) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center p-12 text-center min-h-[60vh] bg-white rounded-3xl border border-gray-200/50 shadow-sm"
      >
        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-100">
          <Cpu className="w-10 h-10 text-gray-300" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          {t('digitaltwinscreen.no_plots_title') || "No Digital Twin Available"}
        </h2>
        <p className="text-gray-500 max-w-md">
          {t('digitaltwinscreen.no_plots_message') || "Please add a farm plot to your account to view its digital twin telemetry, historical data, and AI-driven analysis."}
        </p>
      </motion.div>
    );
  }

  // Derived properties based on simulation mode with fallbacks for plots lacking telemetry
  const isPrediction = simMode === "Prediction";
  const activeNDVI = isPrediction ? (prediction?.predicted_ndvi ?? 0) : (activeSnapshot?.ndvi ?? (activePlot?.ndviTimeline ? activePlot.ndviTimeline[simMode] : 0));
  const activeSoilHealth = activeSnapshot?.crop_health_score ?? (activePlot?.soilHealth ? activePlot.soilHealth[simMode] : 0);
  const activeYield = activeSnapshot?.yield_prediction
    ? `${activeSnapshot.yield_prediction} Tons`
    : (activePlot?.yieldEst ? activePlot.yieldEst[simMode] : "N/A");
  const activeDiseasePct = activeSnapshot?.disease_probability ?? (activePlot?.diseasePct ? activePlot.diseasePct[simMode] : 0);
  const activeDiseaseRisk = activeSnapshot?.risk_level ?? (activePlot?.diseaseRisk ? activePlot.diseaseRisk[simMode] : "Data Pending");
  
  const activeConfidence = activeSnapshot?.confidence_score ?? activePlot?.confidence ?? 0;
  const activeWhyDisease = activeSnapshot?.disease_explanation ?? activePlot?.whyDisease;
  const activeRecommendedAction = activeSnapshot?.recommended_action ?? activePlot?.recommendedAction;
  const activeAdvisoryReason = activeSnapshot?.advisory_reason ?? activePlot?.advisoryReason;

  // Real weather readings from Open-Meteo
  const realTemp = envData.weather ? envData.weather.current.temperatureC : null;
  const realHumidity = envData.weather ? envData.weather.current.humidityPercent : null;
  const realWind = envData.weather ? envData.weather.current.windSpeedKmh : null;
  const realFoliar = activeSnapshot?.crop_health_score ?? 98;

  // Dynamic average for the main Twin Health donut (soil health + canopy NDVI)
  const healthComponents = [activeSoilHealth, activeNDVI * 100].filter(v => v > 0);
  const overallTwinHealth = healthComponents.length > 0
    ? Math.round(healthComponents.reduce((a, b) => a + b, 0) / healthComponents.length)
    : 0;

  const telemetryBadges: TelemetryBadge[] = [
    {
      id: "temp",
      label: "Temperature",
      value: realTemp != null ? `${Math.round(realTemp)}°C` : "N/A",
      interpretation: realTemp != null ? "Open-Meteo live surface temperature." : "Live weather feed offline.",
      x: 25,
      y: 35
    },
    {
      id: "humidity",
      label: "Humidity",
      value: realHumidity != null ? `${Math.round(realHumidity)}%` : "N/A",
      interpretation: realHumidity != null ? "Relative atmospheric humidity (Open-Meteo)." : "Live weather feed offline.",
      x: 75,
      y: 40
    },
    {
      id: "moisture",
      label: "Moisture",
      value: "Not Connected",
      interpretation: "No physical IoT soil moisture probe connected.",
      x: 15,
      y: 65
    },
    {
      id: "ndvi",
      label: "Canopy NDVI",
      value: envData.ndvi?.available && envData.ndvi.mean_ndvi != null
        ? envData.ndvi.mean_ndvi.toFixed(2)
        : activeNDVI
        ? activeNDVI.toFixed(2)
        : "N/A",
      interpretation: envData.ndvi?.available
        ? `Sentinel-2 NDVI (${envData.ndvi.status ?? "Live"}).`
        : "Satellite imagery pending configuration.",
      x: 80,
      y: 60
    },
    {
      id: "health",
      label: "Foliar Health",
      value: `${realFoliar}%`,
      interpretation: "Index against biophysical canopy model.",
      x: 50,
      y: 20
    },
    {
      id: "wind",
      label: "Wind Velocity",
      value: realWind != null ? `${Math.round(realWind)} km/h` : "N/A",
      interpretation: realWind != null ? "Surface wind velocity from Open-Meteo." : "Live weather feed offline.",
      x: 45,
      y: 75
    }
  ];

  const telemetryCards = [
    {
      label: "Soil Moisture (IoT)",
      value: "Not Connected",
      trend: "neutral",
      trendText: "No IoT probe",
      icon: <Droplets className="w-5 h-5 text-gray-400" />,
      status: "Unavailable",
      sparkline: [0, 0, 0, 0, 0, 0, 0]
    },
    {
      label: "Temperature (Open-Meteo)",
      value: realTemp != null ? `${Math.round(realTemp)}°C` : "Unavailable",
      trend: realTemp != null ? "stable" : "neutral",
      trendText: realTemp != null ? "Live feed" : "No coordinates",
      icon: <Thermometer className="w-5 h-5 text-amber-500" />,
      status: realTemp != null ? "Live" : "Offline",
      sparkline: [realTemp ?? 0, realTemp ?? 0, realTemp ?? 0, realTemp ?? 0, realTemp ?? 0, realTemp ?? 0, realTemp ?? 0]
    },
    {
      label: "Humidity (Open-Meteo)",
      value: realHumidity != null ? `${Math.round(realHumidity)}%` : "Unavailable",
      trend: realHumidity != null ? "stable" : "neutral",
      trendText: realHumidity != null ? "Live feed" : "No coordinates",
      icon: <Activity className="w-5 h-5 text-emerald-500" />,
      status: realHumidity != null ? "Live" : "Offline",
      sparkline: [realHumidity ?? 0, realHumidity ?? 0, realHumidity ?? 0, realHumidity ?? 0, realHumidity ?? 0, realHumidity ?? 0, realHumidity ?? 0]
    }
  ];

  // Soil Nutrient horizontal values
  const soilNutrients = [
    { label: t('digitaltwinscreen.ph_score'), val: "6.2", pct: 85, color: "bg-emerald-500", text: t('digitaltwinscreen.optimal_slightly_acidic') },
    { label: t('digitaltwinscreen.nitrogen_n'), val: "72 ppm", pct: 72, color: "bg-emerald-500", text: t('digitaltwinscreen.optimal_concentration') },
    { label: t('digitaltwinscreen.phosphorus_p'), val: "48 ppm", pct: 48, color: "bg-amber-500", text: t('digitaltwinscreen.deficient__recommended_boost') },
    { label: t('digitaltwinscreen.potassium_k'), val: "85 ppm", pct: 85, color: "bg-emerald-500", text: t('digitaltwinscreen.optimal_content') },
    { label: t('digitaltwinscreen.organic_carbon'), val: "1.4%", pct: 78, color: "bg-emerald-500", text: t('digitaltwinscreen.excellent_microbial_base') },
    { label: t('digitaltwinscreen.ec_electrical_conductivity'), val: "0.28 dS/m", pct: 52, color: "bg-emerald-500", text: t('digitaltwinscreen.optimal_salinity') }
  ];

  // Build a real SVG path from the history array for the chart
  const buildPathFromHistory = (getValue: (row: any) => number | null, scale: number, baseline: number) => {
    const rows = twinHistory.filter(r => getValue(r) != null);
    if (rows.length < 2) return null;
    const step = 360 / (rows.length - 1);
    const points = rows.map((row, i) => {
      const v = getValue(row) ?? 0;
      return `${20 + i * step} ${baseline - v * scale}`;
    });
    return `M ${points.join(" L ")}`;
  };

  const getChartData = () => {
    if (activeChartTab === "NDVI") {
      const path = buildPathFromHistory(r => r.ndvi, 100, 155);
      const val = twinHistory.length > 0 ? (twinHistory[twinHistory.length - 1].ndvi ?? activeNDVI).toFixed(2) : activeNDVI.toFixed(2);
      return { path: path ?? `M 20 ${140 - activeNDVI * 100} L 380 ${100 - activeNDVI * 100}`, val };
    }
    if (activeChartTab === "Health") {
      const path = buildPathFromHistory(r => r.crop_health_score, 1.5, 165);
      const last = twinHistory.length > 0 ? (twinHistory[twinHistory.length - 1].crop_health_score ?? activeSoilHealth) : activeSoilHealth;
      return { path: path ?? `M 20 ${180 - activeSoilHealth * 1.5} L 380 ${150 - activeSoilHealth * 1.5}`, val: `${Math.round(last)}%` };
    }
        if (activeChartTab === "Moisture") {
      const path = buildPathFromHistory(r => r.water_stress_score, 2.5, 170);
      if (path && twinHistory.length > 0) {
        const last = twinHistory[twinHistory.length - 1].water_stress_score ?? 0;
        return { path, val: `${Math.round(last)}%` };
      }
      return { path: "M 20 170 L 380 170", val: "Not Connected" };
    }
    // Temp
    const path = buildPathFromHistory(r => r.temperature_c, 2.5, 160);
    return { path: path ?? "M 20 120 L 380 120", val: realTemp != null ? `${Math.round(realTemp)}°C` : "Unavailable" };
  };

  const chartData = getChartData();

  const handleExportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsExportLoading(true);
    setTimeout(() => {
      setIsExportLoading(false);
      setIsExportOpen(false);
      triggerToast("Diagnostics report exported successfully.", "success");
    }, 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-6 text-left"
    >

      {/* ================= PAGE HEADER ================= */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200/50 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight leading-none flex items-center gap-2">
            <Cpu className="w-8 h-8 text-primary" />
            <div className="flex flex-wrap gap-2 pt-1 md:pt-0">
              {plots.map((plot) => (
                <button
                  key={plot.id}
                  onClick={() => {
                    setIsChangingPlot(true);
                    setTimeout(() => {
                      setActivePlotId(plot.id);
                      setIsChangingPlot(false);
                    }, 450);
                  }}
                  className={`px-4 py-2.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer flex items-center gap-2 ${activePlotId === plot.id
                    ? "bg-primary text-white shadow-md shadow-primary/20 scale-105"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-primary/50 hover:bg-emerald-50/30"
                    }`}
                >
                  <span className={`w-2 h-2 rounded-full ${plot.statusDotColor}`} />
                  {plot.name}
                </button>
              ))}
            </div>            {t('digitaltwinscreen.digital_twin_intelligence')}
          </h1>
          <p className="text-sm font-semibold text-gray-500 mt-2">
            {t('digitaltwinscreen.virtual_biophysical_score_calibrated_acr')}
          </p>
        </div>

        {/* Top-Right Action Bars */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col items-end text-xs font-mono font-bold text-gray-400">
            <span className="flex items-center gap-1 text-primary">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-md shadow-emerald-500/50" />
              {t('digitaltwinscreen.ai_engine_status_online')}
            </span>
            <span className="text-[10px] text-gray-450 mt-1">{t('digitaltwinscreen.last_synced')} {lastSyncMinutes} {t('digitaltwinscreen.mins_ago')}</span>
          </div>

          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="inline-flex items-center justify-center p-2.5 bg-white border border-gray-250 text-gray-700 font-extrabold rounded-xl shadow-xs hover:bg-gray-50 active:scale-95 transition-all cursor-pointer"
            title="Refresh twin data"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${isSyncing ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={() => onNavigate && onNavigate("Recommendations")}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-[#235F26] text-white font-extrabold rounded-xl shadow-md shadow-primary/10 hover:shadow-primary/20 active:scale-95 transition-all text-xs cursor-pointer border-0"
          >
            <FlaskConical className="w-4 h-4" />
            {t('digitaltwinscreen.generate_ai_recommendation')}
          </button>

          <button
            onClick={() => setIsExportOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-250 text-gray-700 font-extrabold rounded-xl shadow-xs hover:bg-gray-50 active:scale-95 transition-all text-xs cursor-pointer"
          >
            <Download className="w-4 h-4 text-gray-500" />
            {t('digitaltwinscreen.export_report')}
          </button>
        </div>
      </div>

      {/* ================= 2. TIME SIMULATION CONTROL & 5. MINI FARM SWITCHER ================= */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-gray-150 p-4 rounded-3xl shadow-xs">

        {/* Plot Selector Blocks */}
        <div className="space-y-1.5 w-full md:w-auto">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{t('digitaltwinscreen.active_crop_twin_mappers_1')}</p>
          <div className="flex flex-wrap gap-2.5">
            {plots.map((item) => {
              const isSelected = activePlotId === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handlePlotSwitch(item.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border flex items-center gap-1.5 ${isSelected
                    ? "bg-slate-950 text-white border-slate-950 shadow-md"
                    : "bg-white text-gray-650 border-gray-250 hover:bg-gray-50"
                    }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${item.statusDotColor}`} />
                  {item.name || `Plot ${item.id.replace("plot-", "").toUpperCase()}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time simulation segmented tab control */}
        <div className="space-y-1.5 w-full md:w-auto text-left md:text-right shrink-0">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{t('digitaltwinscreen.digital_twin_timeline_mode_1')}</p>
          <div className="inline-flex bg-gray-50 border border-gray-200 rounded-2xl p-0.5">
            {(["Past", "Current", "Prediction"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => handleSimModeSwitch(mode)}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${simMode === mode
                  ? "bg-primary text-white shadow-xs"
                  : "text-gray-500 hover:text-gray-900"
                  }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* ================= Phase 3: Active Plot Status Indicators ================= */}
      {activePlot && (
        <div className="flex flex-wrap items-center gap-2 text-[9px] font-black uppercase tracking-wider">
          <span className="text-gray-400">{t('digitaltwinscreen.plot_status_1')}</span>
          {activePlot.boundaryMapped ? (
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100">
              ✓ {t('digitaltwinscreen.boundary_mapped_1')}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 border border-gray-200">
              {t('digitaltwinscreen.boundary_pending_1')}
            </span>
          )}
          {activePlot.soilReportAttached ? (
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100">
              ✓ {t('digitaltwinscreen.soil_report_attached_1')}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 border border-gray-200">
              {t('digitaltwinscreen.awaiting_soil_report_1')}
            </span>
          )}
          {activePlot.area && (
            <span className="px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 border border-slate-200">
              📐 {activePlot.area.toFixed(2)} ac
            </span>
          )}
          {activePlot.elevation !== undefined && activePlot.elevation > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 border border-slate-200">
              ⛰️ {activePlot.elevation}m MSL
            </span>
          )}
          {activePlot.village && (
            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
              📍 {activePlot.village}{activePlot.district ? `, ${activePlot.district}` : ""}
            </span>
          )}
        </div>
      )}

      {/* ================= LAYOUT GRID ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start relative">

        {/* Shimmer loading overlay when switching plot/modes or fetching twins */}
        <AnimatePresence>
          {(isChangingPlot || isTwinsLoading) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-white/70 backdrop-blur-xs z-30 pointer-events-auto rounded-3xl flex items-center justify-center"
            >
              <div className="bg-white border border-gray-150 p-5 rounded-2xl shadow-xl flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-primary animate-spin" />
                <span className="text-xs font-black text-gray-800">
                  {isTwinsLoading || isPredictionLoading ? "Syncing with Supabase AI Engine..." : "Calibrating biophysical simulation model..."}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ================= LEFT COLUMN ================= */}
        <div className="lg:col-span-7 space-y-6">

          {/* 1. DIGITAL CROP MODEL */}
          <div className="bg-slate-950 rounded-[32px] border border-slate-900 p-6 shadow-xl relative min-h-[460px] flex flex-col justify-between overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:30px_30px]" />
            <div className="absolute -top-12 -left-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex justify-between items-start z-10 relative">
              <div className="flex gap-4">
                {activePlot.boundaryMapped && activePlot.geoJSON && (
                  <div className="w-12 h-12 bg-slate-900/50 border border-slate-800 rounded-lg overflow-hidden shrink-0 flex items-center justify-center p-1">
                    <svg viewBox="0 0 100 100" className="w-full h-full opacity-80">
                      <path
                        d={boundaryToSvgPath(activePlot.geoJSON, { width: 100, height: 100 }, 10)}
                        fill="rgba(16, 185, 129, 0.2)"
                        stroke="#10b981"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                )}
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-emerald-400 font-mono tracking-widest uppercase flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    {t('digitaltwinscreen.biophysical_twin_layer_1')} ({activePlot.name})
                  </span>
                  <h3 className="text-white font-extrabold text-lg">{t('digitaltwinscreen.vegetation_canopy_chamber')}</h3>
                </div>
              </div>
              <div className="text-right font-mono">
                <span className="text-[9px] text-slate-500 block uppercase">{t('digitaltwinscreen.ndvi_reflectance_1')}</span>
                <span className="text-white font-black text-sm">{chartData.val}</span>
              </div>
            </div>

            <div className="my-10 flex justify-center items-center relative h-64">
              <motion.div
                animate={{ top: ["10%", "90%", "10%"] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "linear" }}
                className="absolute left-10 right-10 h-[1.5px] bg-emerald-400/20 shadow-lg shadow-emerald-400/50 z-10 pointer-events-none"
              />

              <svg className="w-full h-full max-w-xs relative z-10" viewBox="0 0 200 200">
                <line x1="10" y1="50" x2="190" y2="50" stroke="rgba(16, 185, 129, 0.05)" strokeDasharray="3 3" />
                <line x1="10" y1="140" x2="190" y2="140" stroke="rgba(16, 185, 129, 0.05)" strokeDasharray="3 3" />

                <g style={{ transformOrigin: "100px 150px" }}>
                  <path d="M 100 150 C 95 165 80 170 78 185 M 100 150 C 105 165 120 170 122 185" stroke="#7c2d12" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                  <rect x="96" y="105" width="8" height="45" fill="#5c3a21" rx="1.5" />
                  <path d="M 100 105 C 60 90 35 90 20 115" fill="none" stroke="#2e7d32" strokeWidth="3" strokeLinecap="round" />
                  <path d="M 100 105 C 140 90 165 90 180 115" fill="none" stroke="#2e7d32" strokeWidth="3" strokeLinecap="round" />
                  <path d="M 100 105 C 80 75 70 50 85 30" fill="none" stroke="#2e7d32" strokeWidth="2" strokeLinecap="round" />
                  <path d="M 100 105 C 120 75 130 50 115 30" fill="none" stroke="#2e7d32" strokeWidth="2" strokeLinecap="round" />
                  <path d="M 100 105 C 95 65 95 45 100 25" fill="none" stroke="#66bb6a" strokeWidth="2.5" strokeLinecap="round" />
                </g>

                <polygon points="50,40 150,40 100,160" fill="rgba(16, 185, 129, 0.02)" stroke="rgba(16, 185, 129, 0.04)" strokeWidth="1" />
              </svg>

              {telemetryBadges.map((badge) => (
                <div
                  key={badge.id}
                  style={{ top: `${badge.y}%`, left: `${badge.x}%` }}
                  className="absolute z-20"
                >
                  <button
                    onMouseEnter={() => setHoveredBadge(badge.id)}
                    onMouseLeave={() => setHoveredBadge(null)}
                    onClick={() => triggerToast(`${badge.label}: ${badge.value} (${badge.interpretation})`, "info")}
                    className="w-3.5 h-3.5 rounded-full bg-emerald-400 hover:bg-white border-2 border-slate-950 flex items-center justify-center cursor-pointer shadow-md shadow-emerald-500/20 active:scale-95 transition-all animate-pulse"
                  />

                  <AnimatePresence>
                    {hoveredBadge === badge.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 5 }}
                        animate={{ opacity: 1, scale: 1, y: -10 }}
                        exit={{ opacity: 0, scale: 0.9, y: 5 }}
                        className="absolute bottom-6 left-1/2 -translate-x-1/2 w-44 bg-slate-900/95 backdrop-blur-md p-3 rounded-2xl border border-slate-800 shadow-2xl z-30 pointer-events-none text-left"
                      >
                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">{badge.label}</p>
                        <p className="text-sm font-black text-white mt-1 leading-none">{badge.value}</p>
                        <p className="text-[9px] text-slate-400 leading-normal mt-1">{badge.interpretation}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2 bg-slate-900/75 border border-slate-800 rounded-2xl p-4 text-xs font-mono text-slate-400">
              <div>
                <span className="block text-[8px] text-slate-500 uppercase">Crop Vigor</span>
                <span className="text-white font-bold">Foliar Chlorophyll: 78%</span>
              </div>
              <div>
                <span className="block text-[8px] text-slate-500 uppercase">Water Transport</span>
                <span className="text-white font-bold">Root Tension: Optimal</span>
              </div>
              <div>
                <span className="block text-[8px] text-slate-500 uppercase">Growth Stage</span>
                <span className="text-white font-bold">{activePlot.stage}</span>
              </div>
            </div>
            
            {/* Data Completeness Gap Indicators */}
            {activeSnapshot?.data_completeness && (
              <div className="mt-2 flex gap-2">
                {!activeSnapshot.data_completeness.ndvi && (
                  <span className="text-[9px] px-2 py-0.5 bg-red-500/20 text-red-400 rounded-md border border-red-500/30">Missing NDVI</span>
                )}
                {!activeSnapshot.data_completeness.weather && (
                  <span className="text-[9px] px-2 py-0.5 bg-red-500/20 text-red-400 rounded-md border border-red-500/30">Missing Weather</span>
                )}
                {!activeSnapshot.data_completeness.soil && (
                  <span className="text-[9px] px-2 py-0.5 bg-red-500/20 text-red-400 rounded-md border border-red-500/30">Missing Soil</span>
                )}
              </div>
            )}

          </div>

          {/* 3. ENVIRONMENTAL TELEMETRY */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {telemetryCards.map((card) => (
              <div
                key={card.label}
                className="bg-white rounded-2xl p-4 border border-gray-150 shadow-xs hover:shadow-md hover:border-primary/20 transition-all flex flex-col justify-between min-h-[140px]"
              >
                <div className="flex justify-between items-start">
                  <div className="p-2 bg-gray-50 border border-gray-150 rounded-xl">
                    {card.icon}
                  </div>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${card.status === "Optimal" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                    }`}>
                    {card.status}
                  </span>
                </div>

                <div className="mt-4 text-left">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">{card.label}</span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-base font-black text-gray-900">{card.value}</span>
                    <span className="text-[9px] font-bold text-gray-450">{card.trendText}</span>
                  </div>
                </div>

                <div className="h-6 w-full mt-3">
                  <svg className="w-full h-full" viewBox="0 0 100 24">
                    <path
                      d={`M 0 ${24 - (card.sparkline[0] % 10) * 2} L 16.6 ${24 - (card.sparkline[1] % 10) * 2} L 33.3 ${24 - (card.sparkline[2] % 10) * 2} L 50 ${24 - (card.sparkline[3] % 10) * 2} L 66.6 ${24 - (card.sparkline[4] % 10) * 2} L 83.3 ${24 - (card.sparkline[5] % 10) * 2} L 100 ${24 - (card.sparkline[6] % 10) * 2}`}
                      fill="none"
                      stroke={card.status === "Optimal" ? "#10b981" : "#f59e0b"}
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>
            ))}
          </div>

          {/* 5. CROP GROWTH TIMELINE */}
          <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left space-y-6">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest flex items-center gap-1.5">
                <Calendar className="w-4.5 h-4.5 text-primary" /> Crop Growth Timeline
              </h4>
              <div className="text-[10px] font-bold text-gray-500 space-x-3">
                <span>Days since planting: <strong>{activePlot.age * 365}</strong></span>
                <span>Expected Harvest: <strong>Oct 2026</strong></span>
              </div>
            </div>

            <div className="flex justify-between items-center relative pt-2">
              <div className="absolute left-[30px] right-[30px] top-[14px] h-0.5 bg-gray-100 -z-10" />
              <div className="absolute left-[30px] top-[14px] h-0.5 bg-primary -z-10 w-[74%]" />

              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full border-2 bg-emerald-50 border-primary text-primary flex items-center justify-center font-bold text-xs">✓</div>
                <span className="text-[10px] font-bold text-gray-400 mt-2">Seedling</span>
              </div>

              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full border-2 bg-emerald-50 border-primary text-primary flex items-center justify-center font-bold text-xs">✓</div>
                <span className="text-[10px] font-bold text-gray-400 mt-2">Vegetative</span>
              </div>

              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full border-2 bg-emerald-50 border-primary text-primary flex items-center justify-center font-bold text-xs">✓</div>
                <span className="text-[10px] font-bold text-gray-400 mt-2">Flowering</span>
              </div>

              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full border-2 bg-primary border-primary text-white flex items-center justify-center font-bold text-xs shadow-md shadow-primary/20 scale-110">4</div>
                <span className="text-[10px] font-black text-primary mt-2">Fruit Dev</span>
                <span className="text-[8px] font-mono text-emerald-650 font-bold mt-0.5">82% Completed</span>
              </div>

              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full border-2 bg-white border-gray-200 text-gray-300 flex items-center justify-center font-bold text-xs">5</div>
                <span className="text-[10px] font-bold text-gray-300 mt-2">Harvest</span>
              </div>
            </div>
          </div>

          {/* 7. NDVI & HEALTH TREND */}
          <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest flex items-center gap-1.5">
                  <TrendingUp className="w-4.5 h-4.5 text-primary" /> Biophysical Reflectance Trends
                </h4>
                <p className="text-[10px] text-gray-450 mt-1">Satellite indexes tracked over time.</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center bg-gray-50 border border-gray-150 rounded-xl p-0.5">
                  {(["NDVI", "Health", "Moisture", "Temp"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveChartTab(tab)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${activeChartTab === tab ? "bg-white text-primary shadow-xs" : "text-gray-500 hover:text-gray-950"
                        }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="flex items-center bg-gray-50 border border-gray-150 rounded-xl p-0.5">
                  {(["7d", "30d", "90d"] as const).map((time) => (
                    <button
                      key={time}
                      onClick={() => setActiveTimeframe(time)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${activeTimeframe === time ? "bg-white text-primary shadow-xs" : "text-gray-500 hover:text-gray-950"
                        }`}
                    >
                      {time.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="h-56 border border-gray-100 rounded-2xl relative p-4 flex flex-col justify-between overflow-hidden">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.015)_1px,transparent_1px)] bg-[size:40px_40px]" />

              <div className="flex justify-between text-[9px] font-mono text-gray-400 relative z-10">
                <span>0.90 Index</span>
                <span>Optimal Bounds</span>
              </div>

              <div className="relative flex-grow flex items-center justify-center my-2">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 400 180">
                  <line x1="0" y1="45" x2="400" y2="45" stroke="#f3f4f6" strokeWidth="1" strokeDasharray="4 4" />
                  <line x1="0" y1="90" x2="400" y2="90" stroke="#f3f4f6" strokeWidth="1" strokeDasharray="4 4" />
                  <line x1="0" y1="135" x2="400" y2="135" stroke="#f3f4f6" strokeWidth="1" strokeDasharray="4 4" />

                  <motion.path
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.8 }}
                    d={chartData.path}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              <div className="flex justify-between text-[9px] font-mono text-gray-400 border-t border-gray-100 pt-2 relative z-10">
                <span>Start Phase</span>
                <span>Target Mean</span>
                <span>Active Reading ({chartData.val})</span>
              </div>
            </div>
          </div>

        </div>

        {/* ================= RIGHT COLUMN ================= */}
        <div className="lg:col-span-5 space-y-6">

          {/* 2. DIGITAL TWIN HEALTH SCORE */}
          <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left space-y-5">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">{t('digitaltwinscreen.twin_health_indices_1')}</span>

            <div className="flex items-center gap-6">
              <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="56" cy="56" r="48" stroke="#F1F5F0" strokeWidth="8" fill="transparent" />
                  <circle cx="56" cy="56" r="48" stroke="#2E7D32" strokeWidth="8" fill="transparent"
                    strokeDasharray={2 * Math.PI * 48}
                    strokeDashoffset={2 * Math.PI * 48 * (1 - (overallTwinHealth / 100))}
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="block text-2xl font-black text-gray-950">{overallTwinHealth}%</span>
                  <span className="text-[9px] font-black text-emerald-650 uppercase">
                    {overallTwinHealth > 75 ? t('digitaltwinscreen.healthy') : overallTwinHealth > 40 ? t('digitaltwinscreen.moderate') : t('digitaltwinscreen.critical')}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <h4 className="font-extrabold text-sm text-gray-900 leading-tight">{t('digitaltwinscreen.overall_twin_health')}</h4>
                <p className="text-[10px] text-gray-400 leading-normal mt-1">
                  {t('digitaltwinscreen.virtual_biophysical_score_calibrated_acr')}
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-gray-100">
              <div className="space-y-1 text-xs font-semibold">
                <div className="flex justify-between font-bold">
                  <span>{t('digitaltwinscreen.soil_quality')}</span>
                  <span className="text-primary"><AnimatedCounter value={activeSoilHealth} />%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-700 ease-in-out" style={{ width: `${activeSoilHealth}%` }} />
                </div>
              </div>
              <div className="space-y-1 text-xs font-semibold">
                <div className="flex justify-between font-bold">
                  <span>{t('digitaltwinscreen.crop_health')}</span>
                  <span className="text-primary"><AnimatedCounter value={Math.round(activeNDVI * 100)} />%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-700 ease-in-out" style={{ width: `${activeNDVI * 100}%` }} />
                </div>
              </div>
              <div className="space-y-1 text-xs font-semibold">
                <div className="flex justify-between font-bold">
                  <span>{t('digitaltwinscreen.water_status')}</span>
                  <span className="text-gray-400 font-medium">Not Connected (IoT)</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gray-200" style={{ width: `0%` }} />
                </div>
              </div>

            </div>
          </div>

          {/* 3. DIGITAL TWIN CONFIDENCE (AI Validation card) */}
          <div className="bg-white rounded-3xl border border-gray-150 p-5 shadow-xs text-left space-y-3.5">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">
              Twin Validation Metrics
            </h4>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-gray-50 border border-gray-150 p-2.5 rounded-xl space-y-0.5">
                <span className="block text-[8px] font-bold text-gray-400 uppercase">AI Confidence</span>
                <span className="text-xs font-black text-primary">{activeConfidence}%</span>
              </div>
              <div className="bg-gray-50 border border-gray-150 p-2.5 rounded-xl space-y-0.5">
                <span className="block text-[8px] font-bold text-gray-400 uppercase">Model Accuracy</span>
                <span className="text-xs font-black text-primary">98%</span>
              </div>
              <div className="bg-gray-50 border border-gray-150 p-2.5 rounded-xl space-y-0.5">
                <span className="block text-[8px] font-bold text-gray-400 uppercase">Reliability</span>
                <span className="text-xs font-black text-indigo-650 bg-indigo-50 border border-indigo-100 px-1 rounded-md">HIGH</span>
              </div>
            </div>
            <p className="text-[9.5px] text-gray-450 leading-relaxed">
              Predictions are generated using historical soil conditions, weather patterns, crop growth models, and simulated telemetry.
            </p>
          </div>

          {/* 3b. ENVIRONMENTAL CONTEXT (live weather + on-demand Sentinel-2 NDVI) */}
          <div className="bg-white rounded-3xl border border-gray-150 p-5 shadow-xs text-left space-y-3.5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Live Environmental Context
              </h4>
              {envData.centroid && (
                <span className="text-[8px] font-mono text-gray-400">
                  {envData.centroid.lat.toFixed(4)}, {envData.centroid.lng.toFixed(4)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-gray-50 border border-gray-150 p-2.5 rounded-xl space-y-0.5">
                <span className="block text-[8px] font-bold text-gray-400 uppercase">Plot Area</span>
                <span className="text-xs font-black text-primary">{activePlot.area?.toFixed(2) ?? "—"} ac</span>
              </div>
              <div className="bg-gray-50 border border-gray-150 p-2.5 rounded-xl space-y-0.5">
                <span className="block text-[8px] font-bold text-gray-400 uppercase">Current Weather</span>
                <span className="text-xs font-black text-primary">
                  {envData.weather
                    ? `${Math.round(envData.weather.current.temperatureC)}°C · ${envData.weather.current.conditionText}`
                    : envData.weatherLoading
                    ? "Loading…"
                    : envData.weatherError
                    ? "Unavailable"
                    : "No coordinates"}
                </span>
              </div>
              <div className="bg-gray-50 border border-gray-150 p-2.5 rounded-xl space-y-0.5">
                <span className="block text-[8px] font-bold text-gray-400 uppercase">Sentinel-2 NDVI</span>
                <span className="text-xs font-black text-primary">
                  {envData.ndvi?.available
                    ? envData.ndvi.mean_ndvi?.toFixed(2)
                    : envData.ndviLoading
                    ? "Loading…"
                    : "Config required"}
                </span>
              </div>
              <div className="bg-gray-50 border border-gray-150 p-2.5 rounded-xl space-y-0.5">
                <span className="block text-[8px] font-bold text-gray-400 uppercase">Satellite Source</span>
                <span className="text-[10px] font-black text-gray-700">
                  {envData.ndvi?.source ?? "Sentinel-2 (via backend)"}
                </span>
              </div>
            </div>
            <p className="text-[9.5px] text-gray-450 leading-relaxed">
              This panel calls live services on demand: weather from Open-Meteo for this
              plot's boundary centroid, and Sentinel-2 NDVI from the backend geospatial
              service when Sentinel Hub credentials are configured. It's separate from the
              historical Past/Current/Prediction telemetry above, which is backfilled by the
              satellite ingestion pipeline.
            </p>
          </div>

          {/* 6. AI PREDICTION PANEL (WITH EXPLANATION) */}
          <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left relative overflow-hidden space-y-5">
            <span className="absolute top-6 right-6">
              <Bot className="w-5 h-5 text-indigo-500 animate-bounce" />
            </span>
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">
              AI Forecast Models
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 border border-gray-150 p-3 rounded-2xl space-y-1 text-left">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Expected Yield</span>
                <p className="text-lg font-black text-gray-950">{activeYield}</p>
                <span className="text-[8px] font-bold text-emerald-650 bg-emerald-50 border border-emerald-100/50 px-2 py-0.5 rounded-full">{activeConfidence}% Conf.</span>
              </div>

              <div className="bg-gray-50 border border-gray-150 p-3 rounded-2xl space-y-1 text-left">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Harvest Ready</span>
                <p className="text-lg font-black text-gray-950">72%</p>
                <div className="w-full h-1 bg-gray-250 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-primary" style={{ width: "72%" }} />
                </div>
              </div>
            </div>

            {/* AI Explanation / Why */}
            <div className="space-y-3.5 text-xs text-gray-700 font-semibold pt-2 border-t border-gray-100">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Disease Probability</span>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-black"><AnimatedCounter value={activeDiseasePct} />% ({activeDiseaseRisk})</span>
                  <div className="relative w-7 h-7">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15" fill="none" className="stroke-gray-100" strokeWidth="4" />
                      <circle
                        cx="18" cy="18" r="15" fill="none"
                        className={activeDiseasePct > 60 ? "stroke-rose-500" : activeDiseasePct > 30 ? "stroke-amber-500" : "stroke-emerald-500"}
                        strokeWidth="4"
                        strokeDasharray="94.2"
                        strokeDashoffset={94.2 - (94.2 * activeDiseasePct) / 100}
                        strokeLinecap="round"
                        style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)" }}
                      />
                    </svg>
                  </div>
                </div>
              </div>

              {!activeWhyDisease ? (
                <div className="bg-gray-50 border border-gray-150 p-3 rounded-2xl text-[10px] text-gray-450 font-semibold">
                  Insufficient telemetry data to generate disease probability.
                </div>
              ) : (
                <div className="bg-emerald-50/40 border border-emerald-100/50 p-3 rounded-2xl text-[10px] text-emerald-850 font-semibold space-y-1">
                  <p className="font-extrabold uppercase text-[9px] tracking-wider text-primary">Model Explanation (Why?):</p>
                  <ul className="list-disc pl-3.5 space-y-1 leading-normal">
                    <li>{activeWhyDisease}</li>
                    <li>Stable ambient humidity index (64%)</li>
                    <li>NDVI greenness ratio meets chlorophyll expectations</li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* 4. SOIL HEALTH ANALYSIS */}
          <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left space-y-5">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">
              {t('digitaltwinscreen.soil_chemical_matrix')}
            </h4>

            <div className="space-y-3 text-xs">
              {soilNutrients.map((nut) => (
                <div key={nut.label} className="space-y-1.5">
                  <div className="flex justify-between font-bold text-gray-700">
                    <span>{nut.label}</span>
                    <span className="text-gray-900">{nut.val}</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${nut.color}`} style={{ width: `${nut.pct}%` }} />
                  </div>
                  <p className="text-[9px] text-gray-450 leading-none">{nut.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 9. AI RECOMMENDATION */}
          <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left space-y-5">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h4 className="text-xs font-black text-indigo-950 uppercase tracking-widest flex items-center gap-1.5">
                <FlaskConical className="w-4.5 h-4.5 text-primary" /> {t('digitaltwinscreen.ai_agronomy_advisory')}
              </h4>
              <span className="text-[9px] font-black text-indigo-750 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                {activeConfidence ?? "—"}% {t('digitaltwinscreen.confidence_1')}
              </span>
            </div>

            <div className="space-y-3 text-xs text-gray-700 font-semibold">
              {!activeRecommendedAction ? (
                <div className="space-y-1.5 bg-gray-50 border border-gray-150 p-3 rounded-2xl">
                  <p className="text-gray-900 font-black leading-snug">{t('digitaltwinscreen.no_ai_analysis_yet')}</p>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5 bg-gray-50 border border-gray-150 p-3 rounded-2xl">
                    <p className="text-[9px] text-gray-400 uppercase tracking-wider">{t('digitaltwinscreen.recommended_action')}</p>
                    <p className="text-gray-900 font-black leading-snug">
                      {activeRecommendedAction}
                    </p>
                  </div>
                  <p className="text-[10px] text-gray-450 leading-relaxed">
                    {activeAdvisoryReason}
                  </p>
                </>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => onNavigate && onNavigate("Recommendations")}
                className="flex-1 bg-primary hover:bg-[#235F26] text-white font-extrabold py-2.5 rounded-xl transition-all shadow-xs text-xs flex items-center justify-center gap-1.5 border-0 cursor-pointer"
              >
                {t('digitaltwinscreen.view_advisory')}
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => triggerToast("Compiling PDF fertilizer advisory report...", "info")}
                className="px-3.5 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-250 rounded-xl text-xs font-bold text-gray-800 cursor-pointer"
              >
                {t('digitaltwinscreen.download_pdf')}
              </button>
            </div>
          </div>

          {/* 4. SENSOR HEALTH PANEL */}
          <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left space-y-4">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">
              {t('digitaltwinscreen.sensor_operational_status')}
            </h4>

            <div className="grid grid-cols-1 gap-3.5 text-xs font-semibold text-gray-700">
              <div className="flex justify-between items-center">
                <span>{t('digitaltwinscreen.sensors_connected')}</span>
                <span className="inline-flex items-center gap-1.5 text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-gray-300" /> 0 Connected (No IoT hardware)
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>{t('digitaltwinscreen.weather_feed')}</span>
                {envData.weather ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-650">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live (Open-Meteo)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-gray-400">
                    <span className="w-2 h-2 rounded-full bg-gray-300" /> {envData.weatherLoading ? "Connecting..." : "Unavailable / No Coordinates"}
                  </span>
                )}
              </div>
              <div className="flex justify-between items-center">
                <span>{t('digitaltwinscreen.satellite_feed')}</span>
                {envData.ndvi?.available ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-650">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Active (Sentinel-2)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-amber-650">
                    <span className="w-2 h-2 rounded-full bg-amber-400" /> Config Required
                  </span>
                )}
              </div>
              <div className="flex justify-between items-center">
                <span>{t('digitaltwinscreen.drone_sync')}</span>
                <span className="inline-flex items-center gap-1.5 text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-gray-300" /> Not Connected
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>{t('digitaltwinscreen.ai_engine')}</span>
                <span className="inline-flex items-center gap-1.5 text-emerald-650">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> {t('digitaltwinscreen.running')}
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* ================= 9. EXPORT REPORT MODAL ================= */}
      <AnimatePresence>
        {isExportOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black pointer-events-auto"
              onClick={() => setIsExportOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-[32px] border-2 border-gray-200 shadow-2xl p-6 md:p-8 max-w-md w-full relative z-10 text-left"
            >
              <button
                onClick={() => setIsExportOpen(false)}
                className="absolute top-6 right-6 p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors border-0 cursor-pointer bg-transparent"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-lg font-black text-gray-900 mb-2">{t('digitaltwinscreen.export_twin_diagnostics')}</h3>
              <p className="text-xs text-gray-500 mb-6 leading-relaxed">
                {t('digitaltwinscreen.compile_virtual_crop_models')}
              </p>

              {isExportLoading ? (
                <div className="text-center py-8 space-y-4">
                  <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto" />
                  <p className="text-xs font-bold text-gray-600">{t('digitaltwinscreen.compiling_database_payloads_')}</p>
                </div>
              ) : (
                <form onSubmit={handleExportSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">{t('digitaltwinscreen.select_report_format')}</label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="border border-gray-250 p-3 rounded-xl flex items-center gap-2 cursor-pointer hover:bg-gray-50">
                        <input type="radio" name="format" defaultChecked />
                        <span className="text-xs font-bold text-gray-800">{t('digitaltwinscreen.export_pdf')}</span>
                      </label>
                      <label className="border border-gray-250 p-3 rounded-xl flex items-center gap-2 cursor-pointer hover:bg-gray-50">
                        <input type="radio" name="format" />
                        <span className="text-xs font-bold text-gray-800">{t('digitaltwinscreen.export_csv')}</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">{t('digitaltwinscreen.analytical_scope')}</label>
                    <div className="space-y-2.5">
                      <label className="flex items-center gap-2.5 text-xs font-semibold text-gray-700 cursor-pointer">
                        <input type="checkbox" defaultChecked />
                        <span>{t('digitaltwinscreen.generate_executive_summary')}</span>
                      </label>
                      <label className="flex items-center gap-2.5 text-xs font-semibold text-gray-700 cursor-pointer">
                        <input type="checkbox" defaultChecked />
                        <span>{t('digitaltwinscreen.generate_agronomy_recommendation_report')}</span>
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-primary hover:bg-[#235F26] text-white font-extrabold py-3.5 rounded-xl shadow-md transition-all text-xs border-0 cursor-pointer mt-4"
                  >
                    {t('digitaltwinscreen.compile__download')}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
};
