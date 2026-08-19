import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, Activity, Thermometer, Droplets, FlaskConical, Wind, CheckCircle2, ChevronRight, Bot, Cpu, RefreshCw, Download, X, Calendar } from "lucide-react";
import { usePlots, type Plot } from "../../data/plots";
import { boundaryToSvgPath } from "../../lib/svgPath";
import { AnimatedCounter } from "./FarmPlotScreen";
import { useDigitalTwinSnapshots } from "../../data/digitalTwins";

// PlotData type is now the shared Plot type from src/data/plots.ts
type PlotData = Plot;

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
  const [activePlotId, setActivePlotId] = useState("plot-1");
  const [simMode, setSimMode] = useState<"Past" | "Current" | "Prediction">("Current");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isExportLoading, setIsExportLoading] = useState(false);
  const [activeChartTab, setActiveChartTab] = useState<"NDVI" | "Health" | "Moisture" | "Temp">("NDVI");
  const [activeTimeframe, setActiveTimeframe] = useState<"7d" | "30d" | "90d">("30d");
  const [hoveredBadge, setHoveredBadge] = useState<string | null>(null);
  
  // Living updates states
  const [lastSyncMinutes, setLastSyncMinutes] = useState(2);
  const [fluctuateMoisture, setFluctuateMoisture] = useState(0);
  const [fluctuateTemp, setFluctuateTemp] = useState(0);
  const [isChangingPlot, setIsChangingPlot] = useState(false);

  const triggerToast = (msg: string, type: "success" | "info" | "warning" = "success") => {
    if (showToast) {
      showToast(msg, type);
    } else {
      alert(`${type.toUpperCase()}: ${msg}`);
    }
  };

  // 1. Auto-updating sync timer & telemetry fluctuation
  useEffect(() => {
    const timerInterval = setInterval(() => {
      setLastSyncMinutes(prev => prev + 1);
    }, 60000); // every minute

    const telemetryInterval = setInterval(() => {
      setFluctuateMoisture(Math.random() * 1.2 - 0.6);
      setFluctuateTemp(Math.random() * 0.4 - 0.2);
    }, 4000); // fluctuate every 4 seconds

    return () => {
      clearInterval(timerInterval);
      clearInterval(telemetryInterval);
    };
  }, []);

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setLastSyncMinutes(0);
      triggerToast("Digital Twin virtual model synchronized with localized sensor grid.", "success");
    }, 1200);
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

  const activePlot = plots.find((p) => p.id === activePlotId) || plots[0];

  const { snapshots, isLoading: isTwinsLoading } = useDigitalTwinSnapshots(activePlotId);
  const activeSnapshot = snapshots[simMode];

  // Derived properties based on simulation mode with fallbacks for plots lacking telemetry
  const activeNDVI = activeSnapshot?.ndvi ?? (activePlot?.ndviTimeline ? activePlot.ndviTimeline[simMode] : 0);
  const activeMoisture = activeSnapshot?.water_stress_score 
    ? Math.round(activeSnapshot.water_stress_score + fluctuateMoisture) 
    : (activePlot?.moistureTimeline ? Math.round(activePlot.moistureTimeline[simMode] + fluctuateMoisture) : 0);
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

  // Dynamic average for the main Twin Health donut
  const healthComponents = [activeSoilHealth, activeNDVI * 100, activeMoisture].filter(v => v > 0);
  const overallTwinHealth = healthComponents.length > 0 
    ? Math.round(healthComponents.reduce((a, b) => a + b, 0) / healthComponents.length)
    : 0;

  const telemetryBadges: TelemetryBadge[] = [
    { id: "temp", label: "Temperature", value: `${(31.4 + fluctuateTemp).toFixed(1)}°C`, interpretation: "Vegetative cellular respiration optimal.", x: 25, y: 35 },
    { id: "humidity", label: "Humidity", value: "64%", interpretation: "Transpiration rate within calibrated threshold.", x: 75, y: 40 },
    { id: "moisture", label: "Moisture", value: `${activeMoisture}%`, interpretation: "Volumetric Water Content simulated.", x: 15, y: 65 },
    { id: "ndvi", label: "Canopy NDVI", value: activeNDVI.toFixed(2), interpretation: "High foliar density and chlorophyll absorption.", x: 80, y: 60 },
    { id: "health", label: "Foliar Health", value: activePlot.status, interpretation: "98% index against historical canopy twin.", x: 50, y: 20 },
    { id: "wind", label: "Wind Velocity", value: "11 km/h", interpretation: "Low risk of fungal spore migration.", x: 45, y: 75 }
  ];

  const telemetryCards = [
    {
      label: "Soil Moisture",
      value: `${activeMoisture}% VWC`,
      trend: "stable",
      trendText: "Stable",
      icon: <Droplets className="w-5 h-5 text-blue-500" />,
      status: activeMoisture >= 35 ? "Optimal" : "Attention",
      sparkline: [40, 41, 40.5, 42, activeMoisture, activeMoisture - 1, activeMoisture]
    },
    {
      label: "Temperature",
      value: `${(31.4 + fluctuateTemp).toFixed(1)}°C`,
      trend: "up",
      trendText: "+0.8°C",
      icon: <Thermometer className="w-5 h-5 text-amber-500" />,
      status: "Optimal",
      sparkline: [29.5, 30.1, 30.5, 31.0, 31.2, 31.1, 31.4]
    },
    {
      label: "Humidity",
      value: "64.2%",
      trend: "down",
      trendText: "-2.4%",
      icon: <Activity className="w-5 h-5 text-emerald-500" />,
      status: "Optimal",
      sparkline: [67, 66.5, 65.2, 64.8, 64.0, 64.5, 64.2]
    }
  ];

  // Soil Nutrient horizontal values
  const soilNutrients = [
    { label: "pH Score", val: "6.2", pct: 85, color: "bg-emerald-500", text: "Optimal (Slightly Acidic)" },
    { label: "Nitrogen (N)", val: "72 ppm", pct: 72, color: "bg-emerald-500", text: "Optimal Concentration" },
    { label: "Phosphorus (P)", val: "48 ppm", pct: 48, color: "bg-amber-500", text: "Deficient - Recommended Boost" },
    { label: "Potassium (K)", val: "85 ppm", pct: 85, color: "bg-emerald-500", text: "Optimal Content" },
    { label: "Organic Carbon", val: "1.4%", pct: 78, color: "bg-emerald-500", text: "Excellent Microbial Base" },
    { label: "EC (Electrical Conductivity)", val: "0.28 dS/m", pct: 52, color: "bg-emerald-500", text: "Optimal Salinity" }
  ];

  // Custom Chart path generators based on selection
  const getChartData = () => {
    if (activeChartTab === "NDVI") {
      return { path: `M 20 ${140 - activeNDVI * 100} L 100 ${120 - activeNDVI * 90} L 200 ${130 - activeNDVI * 95} L 300 ${110 - activeNDVI * 105} L 380 ${100 - activeNDVI * 100}`, val: activeNDVI ? activeNDVI.toFixed(2) : "0.00" };
    }
    if (activeChartTab === "Health") {
      return { path: `M 20 ${180 - activeSoilHealth * 1.5} L 100 ${170 - activeSoilHealth * 1.5} L 200 ${165 - activeSoilHealth * 1.5} L 300 ${172 - activeSoilHealth * 1.5} L 380 ${150 - activeSoilHealth * 1.5}`, val: `${activeSoilHealth}%` };
    }
    if (activeChartTab === "Moisture") {
      return { path: `M 20 ${180 - activeMoisture * 2.5} L 100 ${170 - activeMoisture * 2.5} L 200 ${175 - activeMoisture * 2.5} L 300 ${160 - activeMoisture * 2.5} L 380 ${165 - activeMoisture * 2.5}`, val: `${activeMoisture}%` };
    }
    // Temp
    return { path: "M 20 80 L 100 95 L 200 90 L 300 85 L 380 75", val: `${(31.4 + fluctuateTemp).toFixed(1)}°C` };
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
                  className={`px-4 py-2.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer flex items-center gap-2 ${
                    activePlotId === plot.id
                      ? "bg-primary text-white shadow-md shadow-primary/20 scale-105"
                      : "bg-white text-gray-600 border border-gray-200 hover:border-primary/50 hover:bg-emerald-50/30"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${plot.statusDotColor}`} />
                  {plot.name}
                </button>
              ))}
            </div>            Digital Twin Intelligence
          </h1>
          <p className="text-sm font-semibold text-gray-500 mt-2">
            Real-time AI-powered virtual representation of farm conditions, crop health, environmental telemetry, and predictive insights.
          </p>
        </div>

        {/* Top-Right Action Bars */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col items-end text-xs font-mono font-bold text-gray-400">
            <span className="flex items-center gap-1 text-primary">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-md shadow-emerald-500/50" />
              AI Engine Status: Online
            </span>
            <span className="text-[10px] text-gray-450 mt-1">Last Synced: {lastSyncMinutes} mins ago</span>
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
            Generate AI Recommendation
          </button>

          <button
            onClick={() => setIsExportOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-250 text-gray-700 font-extrabold rounded-xl shadow-xs hover:bg-gray-50 active:scale-95 transition-all text-xs cursor-pointer"
          >
            <Download className="w-4 h-4 text-gray-500" />
            Export Report
          </button>
        </div>
      </div>

      {/* ================= 2. TIME SIMULATION CONTROL & 5. MINI FARM SWITCHER ================= */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-gray-150 p-4 rounded-3xl shadow-xs">
        
        {/* Plot Selector Blocks */}
        <div className="space-y-1.5 w-full md:w-auto">
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Active Crop Twin Mappers</p>
          <div className="flex flex-wrap gap-2.5">
            {plots.map((item) => {
              const isSelected = activePlotId === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handlePlotSwitch(item.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border flex items-center gap-1.5 ${
                    isSelected 
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
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Digital Twin Timeline Mode</p>
          <div className="inline-flex bg-gray-50 border border-gray-200 rounded-2xl p-0.5">
            {(["Past", "Current", "Prediction"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => handleSimModeSwitch(mode)}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  simMode === mode 
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
          <span className="text-gray-400">Plot Status:</span>
          {activePlot.boundaryMapped ? (
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100">
              ✓ Boundary Mapped
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 border border-gray-200">
              Boundary Pending
            </span>
          )}
          {activePlot.soilReportAttached ? (
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100">
              ✓ Soil Report Attached
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 border border-gray-200">
              Awaiting Soil Report
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
                  {isTwinsLoading ? "Syncing with Supabase AI Engine..." : "Calibrating biophysical simulation model..."}
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
                    Biophysical Twin Layer ({activePlot.name})
                  </span>
                  <h3 className="text-white font-extrabold text-lg">Vegetation Canopy Chamber</h3>
                </div>
              </div>
              <div className="text-right font-mono">
                <span className="text-[9px] text-slate-500 block uppercase">NDVI Reflectance</span>
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
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                    card.status === "Optimal" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
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
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                        activeChartTab === tab ? "bg-white text-primary shadow-xs" : "text-gray-500 hover:text-gray-950"
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
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                        activeTimeframe === time ? "bg-white text-primary shadow-xs" : "text-gray-500 hover:text-gray-950"
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
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Twin Health Indices</span>
            
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
                    {overallTwinHealth > 75 ? "Healthy" : overallTwinHealth > 40 ? "Moderate" : "Critical"}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <h4 className="font-extrabold text-sm text-gray-900 leading-tight">Overall Twin Health</h4>
                <p className="text-[10px] text-gray-400 leading-normal mt-1">
                  Virtual biophysical score calibrated across moisture, chlorophyll indices, and diagnostic arrays.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-gray-100">
              <div className="space-y-1 text-xs font-semibold">
                <div className="flex justify-between font-bold">
                  <span>Soil Quality</span>
                  <span className="text-primary"><AnimatedCounter value={activeSoilHealth} />%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-700 ease-in-out" style={{ width: `${activeSoilHealth}%` }} />
                </div>
              </div>
              <div className="space-y-1 text-xs font-semibold">
                <div className="flex justify-between font-bold">
                  <span>Crop Health</span>
                  <span className="text-primary"><AnimatedCounter value={Math.round(activeNDVI * 100)} />%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-700 ease-in-out" style={{ width: `${activeNDVI * 100}%` }} />
                </div>
              </div>
              <div className="space-y-1 text-xs font-semibold">
                <div className="flex justify-between font-bold">
                  <span>Water Status</span>
                  <span className="text-primary"><AnimatedCounter value={activeMoisture} />%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-700 ease-in-out" style={{ width: `${activeMoisture}%` }} />
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
              Soil Chemical Matrix
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
                <FlaskConical className="w-4.5 h-4.5 text-primary" /> AI Agronomy Advisory
              </h4>
              <span className="text-[9px] font-black text-indigo-750 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                {activeConfidence ?? "—"}% Confidence
              </span>
            </div>

            <div className="space-y-3 text-xs text-gray-700 font-semibold">
              {!activeRecommendedAction ? (
                <div className="space-y-1.5 bg-gray-50 border border-gray-150 p-3 rounded-2xl">
                  <p className="text-gray-900 font-black leading-snug">No AI analysis yet — attach a soil report to generate a recommendation.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5 bg-gray-50 border border-gray-150 p-3 rounded-2xl">
                    <p className="text-[9px] text-gray-400 uppercase tracking-wider">Recommended Action</p>
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
                View Advisory
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => triggerToast("Compiling PDF fertilizer advisory report...", "info")}
                className="px-3.5 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-250 rounded-xl text-xs font-bold text-gray-800 cursor-pointer"
              >
                Download PDF
              </button>
            </div>
          </div>

          {/* 4. SENSOR HEALTH PANEL */}
          <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left space-y-4">
            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">
              Sensor Operational Status
            </h4>
            
            <div className="grid grid-cols-1 gap-3.5 text-xs font-semibold text-gray-700">
              <div className="flex justify-between items-center">
                <span>Sensors Connected</span>
                <span className="inline-flex items-center gap-1.5 text-emerald-650"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> 18 / 18</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Weather Feed</span>
                <span className="inline-flex items-center gap-1.5 text-emerald-650"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Connected</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Satellite Feed</span>
                <span className="inline-flex items-center gap-1.5 text-emerald-650"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Active (Sentinel-2)</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Drone Sync</span>
                <span className="inline-flex items-center gap-1.5 text-indigo-650"><span className="w-2 h-2 rounded-full bg-indigo-500" /> Standby</span>
              </div>
              <div className="flex justify-between items-center">
                <span>AI Engine</span>
                <span className="inline-flex items-center gap-1.5 text-emerald-650"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Running</span>
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

              <h3 className="text-lg font-black text-gray-900 mb-2">Export Twin Diagnostics</h3>
              <p className="text-xs text-gray-500 mb-6 leading-relaxed">
                Compile virtual crop models and spatial sensor telemetry into shareable reports.
              </p>

              {isExportLoading ? (
                <div className="text-center py-8 space-y-4">
                  <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto" />
                  <p className="text-xs font-bold text-gray-600">Compiling database payloads & plots maps...</p>
                </div>
              ) : (
                <form onSubmit={handleExportSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Select Report Format</label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="border border-gray-250 p-3 rounded-xl flex items-center gap-2 cursor-pointer hover:bg-gray-50">
                        <input type="radio" name="format" defaultChecked />
                        <span className="text-xs font-bold text-gray-800">Export PDF</span>
                      </label>
                      <label className="border border-gray-250 p-3 rounded-xl flex items-center gap-2 cursor-pointer hover:bg-gray-50">
                        <input type="radio" name="format" />
                        <span className="text-xs font-bold text-gray-800">Export CSV</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Analytical Scope</label>
                    <div className="space-y-2.5">
                      <label className="flex items-center gap-2.5 text-xs font-semibold text-gray-700 cursor-pointer">
                        <input type="checkbox" defaultChecked />
                        <span>Generate Executive Summary</span>
                      </label>
                      <label className="flex items-center gap-2.5 text-xs font-semibold text-gray-700 cursor-pointer">
                        <input type="checkbox" defaultChecked />
                        <span>Generate Agronomy Recommendation Report</span>
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-primary hover:bg-[#235F26] text-white font-extrabold py-3.5 rounded-xl shadow-md transition-all text-xs border-0 cursor-pointer mt-4"
                  >
                    Compile & Download
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
