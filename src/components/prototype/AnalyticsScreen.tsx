import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  TrendingUp, BarChart3, Calendar, Droplets, LayoutGrid, Cpu, 
  Download, Activity, Bot, Sprout
} from "lucide-react";
import { useTranslation } from "../../translation/useTranslation";
import { useFarmerAnalytics } from "../../hooks/useFarmerAnalytics";

// Animated counter hook representation for visual elegance
const AnimatedCounter: React.FC<{ value: number; suffix?: string; decimals?: number }> = ({ 
  value, 
  suffix = "", 
  decimals = 0 
}) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let animationFrameId: number;
    const duration = 800;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      setCount(easeProgress * value);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        setCount(value);
      }
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [value]);

  return (
    <span>
      {decimals > 0 ? count.toFixed(decimals) : Math.round(count)}
      {suffix}
    </span>
  );
};

// SVG Sparkline component
const Sparkline: React.FC<{ points: number[]; color: string; index: number }> = ({ points, color, index }) => {
  const width = 100;
  const height = 16;
  if (points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min === 0 ? 1 : max - min;
  
  const coords = points.map((val, idx) => {
    const x = (idx / (points.length - 1)) * width;
    const y = height - 2 - ((val - min) / range) * (height - 4);
    return { x, y };
  });

  let path = `M ${coords[0].x} ${coords[0].y}`;
  let areaPath = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const cp1x = coords[i].x + (coords[i+1].x - coords[i].x) / 3;
    const cp1y = coords[i].y;
    const cp2x = coords[i].x + 2 * (coords[i+1].x - coords[i].x) / 3;
    const cp2y = coords[i+1].y;
    const nextPath = ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${coords[i+1].x} ${coords[i+1].y}`;
    path += nextPath;
    areaPath += nextPath;
  }
  areaPath += ` L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg className="w-full h-full" viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={`kpiGrad-${index}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#kpiGrad-${index})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

interface AnalyticsScreenProps {
  onNavigate?: (screen: string) => void;
}

export const AnalyticsScreen: React.FC<AnalyticsScreenProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const { 
    isLoading, 
    profile, 
    plots, 
    selectedPlotId, 
    setSelectedPlotId, 
    analyticsData 
  } = useFarmerAnalytics();

  const totalAcres = plots.reduce((sum, p) => sum + p.area, 0);

  const [dateFilter, setDateFilter] = useState("Last 30 Days");
  const [hoveredPieIndex, setHoveredPieIndex] = useState<number | null>(null);
  const [hoveredSubZone, setHoveredSubZone] = useState<number | null>(null);
  const [hoveredPlotIndex, setHoveredPlotIndex] = useState<number | null>(null);

  // 12-Month Soil Recovery Simulated History (For display)
  const soilMonths = ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];
  const getSoilTimeline = (nutrient: "N" | "P" | "K" | "OC" | "pH") => {
    const baseVal = analyticsData.soilNutrients[nutrient];
    // Add slightly noisy curve relative to base value
    const factors = [0.88, 0.92, 0.95, 0.94, 0.98, 1.02, 1.0, 1.04, 1.05, 1.08, 1.06, 1.1];
    return factors.map(f => Number((baseVal * f).toFixed(1)));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Fallback Empty State
  if (plots.length === 0) {
    return (
      <motion.div 
        className="max-w-md mx-auto my-12 bg-white/95 border border-slate-200/80 rounded-2xl p-8 shadow-xs text-center space-y-6"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-primary mx-auto">
          <Sprout className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">
            {t("analytics.no_plots_registered")}
          </h2>
          <p className="text-xs text-slate-500 font-semibold leading-relaxed">
            Configure your registered farm plots using high-precision GIS boundary coordinate mapping. Once mapped, your living Digital Twin analytics console will synchronize here.
          </p>
        </div>
        <button
          onClick={() => onNavigate?.("Farm Plots")}
          className="w-full bg-primary hover:bg-[#235F26] text-white rounded-xl py-2.5 text-xs font-semibold shadow-xs transition-all active:scale-98 border-0 cursor-pointer"
        >
          {t("analytics.map_first_plot")}
        </button>
      </motion.div>
    );
  }

  // ---------------------------------------------------------------------------
  // KPI Card Config
  // ---------------------------------------------------------------------------
  const kpis = [
    {
      label: t("analytics.monitored_land_area"),
      val: analyticsData.acres,
      suffix: ` ${t("analytics.acres")}`,
      decimals: selectedPlotId === "ALL" ? 1 : 1,
      color: "#10b981",
      icon: <LayoutGrid className="w-5 h-5" />,
      spark: [30, 32, 35, 38, 39, 39.5]
    },
    {
      label: t("analytics.crop_health_index"),
      val: analyticsData.avgCropHealth,
      suffix: "%",
      decimals: 0,
      color: "#10b981",
      icon: <Activity className="w-5 h-5" />,
      spark: [78, 80, 81, 83, 82, Math.round(analyticsData.avgCropHealth)]
    },
    {
      label: t("analytics.canopy_water_stress"),
      val: analyticsData.canopyStress,
      suffix: "",
      decimals: 0,
      color: analyticsData.canopyStress === "Optimal" ? "#10b981" : "#f59e0b",
      icon: <Droplets className="w-5 h-5" />,
      spark: [60, 62, 65, 68, 67, Math.round(analyticsData.waterDeficit)]
    },
    {
      label: t("analytics.estimated_yield_delta"),
      val: analyticsData.yieldDelta,
      suffix: "%",
      decimals: 1,
      color: "#10b981",
      icon: <TrendingUp className="w-5 h-5" />,
      spark: [10, 12, 14, 15, 17, analyticsData.yieldDelta]
    },
    {
      label: t("analytics.soil_diagnostic_status"),
      val: analyticsData.soilStatus,
      suffix: "",
      decimals: 0,
      color: "#10b981",
      icon: <Bot className="w-5 h-5" />,
      spark: [80, 82, 85, 88, 90, 92]
    },
    {
      label: t("analytics.digital_twin_telemetry"),
      val: analyticsData.telemetryStatus,
      suffix: "",
      decimals: 0,
      color: "#10b981",
      icon: <Cpu className="w-5 h-5" />,
      spark: [90, 92, 94, 96, 98, 100]
    }
  ];

  // Doughnut Slice Calculations
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPercent = 0;
  const pieSlices = analyticsData.cropDistribution.map((slice, i) => {
    const strokeDasharray = `${(slice.pct / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
    accumulatedPercent += slice.pct;
    
    // Colorful array for legend mapping
    const colors = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899"];
    return {
      ...slice,
      color: colors[i % colors.length],
      dashArray: strokeDasharray,
      dashOffset: strokeDashoffset.toString()
    };
  });

  // Dynamic Soil Nutrient Radar/Bar target comparison
  const targets = { N: 150, P: 25, K: 180, OC: 2.0, pH: 6.5 };
  const getNutrientStatus = (key: "N" | "P" | "K" | "OC" | "pH", current: number) => {
    const target = targets[key];
    const pct = current / target;
    if (pct >= 0.85) return { label: t("analytics.optimal"), color: "text-emerald-700 bg-emerald-50 border-emerald-100", barColor: "bg-emerald-500" };
    if (pct >= 0.65) return { label: t("analytics.warning"), color: "text-amber-600 bg-amber-50 border-amber-100", barColor: "bg-amber-500" };
    return { label: t("analytics.critical"), color: "text-rose-650 bg-rose-50 border-rose-100", barColor: "bg-rose-500" };
  };

  // Sub-Zone Grid data for Single Plot canopy visualization
  const getSubZones = () => {
    const selectedPlot = plots.find(p => p.id === selectedPlotId);
    if (!selectedPlot) return [];
    
    // Generate deterministic sub-zones based on plot variables
    const zoneNames = ["North-West", "North-East", "Central Canopy", "South-West", "South-East", "Fringe Zone"];
    const baseNDVI = selectedPlot.digital_twins?.[0]?.crop_health_score ? selectedPlot.digital_twins[0].crop_health_score / 100 : 0.78;
    
    return zoneNames.map((name, i) => {
      const variation = [0.08, -0.05, 0.12, -0.1, 0.04, -0.07][i];
      const ndvi = Number(Math.max(0.3, Math.min(0.98, baseNDVI + variation)).toFixed(2));
      let health = "Optimal Vigor";
      let colorClass = "bg-emerald-500";
      if (ndvi < 0.55) {
        health = "Critical Deficit";
        colorClass = "bg-rose-500";
      } else if (ndvi < 0.72) {
        health = "Mild Water Stress";
        colorClass = "bg-amber-400";
      }
      return { name, ndvi, health, colorClass };
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-6 text-left"
    >
      {/* ================= HEADER ================= */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-none flex items-center gap-2.5">
            <BarChart3 className="w-8 h-8 text-primary" />
            {t("analytics.title")}
          </h1>
          <p className="text-sm font-semibold text-slate-500 mt-2">
            {t("analytics.live_crop_telemetry")} <span className="text-slate-800 font-bold">{profile.full_name || "Farmer"}</span> • {profile.village ? `${profile.village}, ` : ""}{profile.district || "Karnataka"}
          </p>
        </div>

        {/* Dynamic Selector Dropdown */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            value={selectedPlotId}
            onChange={(e) => setSelectedPlotId(e.target.value)}
            className="bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent cursor-pointer transition-all h-9"
          >
            <option value="ALL">
              {t("analytics.all_plots")} ({plots.length} {t("analytics.plots")} • {totalAcres.toFixed(1)} {t("analytics.acres")})
            </option>
            {plots.map((plot) => (
              <option key={plot.id} value={plot.id}>
                {plot.name} ({plot.crop} • {plot.area} {plot.area_unit})
              </option>
            ))}
          </select>

          {/* Core Controls */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg">
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">{t("analytics.operational_core")}</span>
            </div>

            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-white border border-slate-200/80 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent cursor-pointer transition-all h-9"
            >
              <option value="Last 30 Days">{t("analytics.date_30_days")}</option>
              <option value="This Season">{t("analytics.date_season")}</option>
              <option value="Last 12 Months">{t("analytics.date_12_months")}</option>
            </select>

            <button
              onClick={() => alert("Downloading CSV Agricultural Records...")}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-3.5 py-1.5 text-xs font-semibold shadow-xs transition-all cursor-pointer h-9 border-0 flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              {t("analytics.export_csv")}
            </button>
          </div>
        </div>
      </div>

      {/* ================= SECTION 1: TOP METRIC KPI CARDS ================= */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {kpis.map((kpi, idx) => {
          const isString = typeof kpi.val === "string";
          return (
            <div 
              key={idx}
              className="bg-white/95 border border-slate-200/80 p-4.5 rounded-2xl shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between min-h-[140px]"
            >
              <div className="flex justify-between items-start">
                <span className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 shadow-xs flex items-center justify-center">
                  {kpi.icon}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>

              <div className="mt-4 text-left">
                <span className="text-[9px] font-bold text-slate-450 uppercase tracking-wider block">{kpi.label}</span>
                <span className="text-xl font-extrabold text-slate-900 tracking-tight block mt-1">
                  {isString ? (
                    kpi.val
                  ) : (
                    <AnimatedCounter value={kpi.val as number} suffix={kpi.suffix} decimals={kpi.decimals} />
                  )}
                </span>
              </div>

              {/* Sparkline curve */}
              <div className="w-full h-4 mt-3">
                <Sparkline points={kpi.spark} color={kpi.color} index={idx} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ================= SECTION 2: MIDDLE SECTION - AGRONOMIC VISUALIZATIONS ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        
        {/* Left Column: Soil Nutrient Balance */}
        <div className="bg-white/95 border border-slate-200/80 p-5 rounded-2xl shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between h-full">
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm mb-4 flex items-center gap-1.5">
              <Bot className="w-4.5 h-4.5 text-primary" />
              {t("analytics.soil_nutrient_balance")}
            </h3>

            {/* Custom Bar Comparison Profile */}
            <div className="space-y-4 py-2">
              {(["N", "P", "K", "OC", "pH"] as const).map((nutrient) => {
                const current = analyticsData.soilNutrients[nutrient];
                const target = targets[nutrient];
                const pct = Math.min(1.2, current / target); // Cap visual bar at 120%
                const status = getNutrientStatus(nutrient, current);

                return (
                  <div key={nutrient} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-slate-800 flex items-center gap-2">
                        <span className="w-5 font-mono text-[10px] text-slate-400">{nutrient}</span>
                        {nutrient === "N" ? "Nitrogen" :
                         nutrient === "P" ? "Phosphorus" :
                         nutrient === "K" ? "Potassium" :
                         nutrient === "OC" ? "Organic Carbon" : "pH Index"}
                      </span>
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-slate-500">
                          {current}{nutrient === "OC" ? "%" : nutrient === "pH" ? "" : " kg/ha"}
                        </span>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded-md border font-black uppercase ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                    </div>

                    <div className="relative w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${status.barColor} transition-all duration-500 rounded-full`}
                        style={{ width: `${pct * 100}%` }}
                      />
                      {/* Target threshold indicator line */}
                      <div 
                        className="absolute top-0 bottom-0 w-0.5 bg-slate-400 border-l border-white"
                        style={{ left: `${(target / target) * 80}%` }}
                        title={`Target threshold: ${target}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 bg-slate-50 border border-slate-200/80 p-3.5 rounded-xl text-[10px] text-slate-500 font-semibold flex items-center justify-between">
            <span>Agronomic Target Levels</span>
            <span className="text-primary font-bold">Optimal levels indicated in emerald green</span>
          </div>
        </div>

        {/* Right Column: Crop Distribution OR Biophysical Stress Dual-Gauge */}
        <div className="bg-white/95 border border-slate-200/80 p-5 rounded-2xl shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between h-full">
          {selectedPlotId === "ALL" ? (
            // Aggregate mode: Doughnut Chart
            <div className="flex flex-col justify-between h-full">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm mb-4 flex items-center gap-1.5">
                  <Activity className="w-4.5 h-4.5 text-primary" />
                  {t("analytics.crop_distribution")}
                </h3>

                <div className="w-full min-h-[220px] relative flex items-center justify-center bg-slate-50/50 border border-slate-100 rounded-xl p-3 select-none flex-grow">
                  <svg className="w-44 h-44 transform -rotate-90" viewBox="0 0 220 220">
                    <circle cx="110" cy="110" r="75" fill="transparent" stroke="#e2e8f0" strokeWidth="18" />
                    {pieSlices.map((slice, i) => {
                      const isHovered = hoveredPieIndex === i;
                      return (
                        <circle
                          key={i}
                          cx="110"
                          cy="110"
                          r="75"
                          fill="transparent"
                          stroke={slice.color}
                          strokeWidth={isHovered ? 24 : 18}
                          strokeDasharray={slice.dashArray}
                          strokeDashoffset={slice.dashOffset}
                          className="transition-all duration-200 cursor-pointer"
                          style={{
                            filter: isHovered ? `drop-shadow(0 0 6px ${slice.color}80)` : "none"
                          }}
                          onMouseEnter={() => setHoveredPieIndex(i)}
                          onMouseLeave={() => setHoveredPieIndex(null)}
                        />
                      );
                    })}
                  </svg>

                  <div className="absolute text-center flex flex-col items-center justify-center pointer-events-none">
                    {hoveredPieIndex !== null ? (
                      <>
                        <span 
                          className="text-xs font-black uppercase tracking-wider block"
                          style={{ color: pieSlices[hoveredPieIndex].color }}
                        >
                          {pieSlices[hoveredPieIndex].name}
                        </span>
                        <span className="text-base font-black text-slate-900 block mt-1">
                          {pieSlices[hoveredPieIndex].acres.toFixed(1)} {t("analytics.acres")}
                        </span>
                        <span className="text-[10px] font-bold text-slate-450 block">
                          ({pieSlices[hoveredPieIndex].pct}%)
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-xs font-mono text-slate-450 block uppercase font-bold tracking-wider">
                          TOTAL AREA
                        </span>
                        <span className="text-lg font-black text-slate-900 block mt-1">
                          {totalAcres.toFixed(1)} {t("analytics.acres")}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Legends */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                {pieSlices.map((s, i) => (
                  <div 
                    key={i} 
                    className={`bg-slate-50 border p-2.5 rounded-xl text-slate-700 flex items-center gap-2.5 cursor-pointer transition-all duration-200 ${
                      hoveredPieIndex === i 
                        ? "border-emerald-500 scale-102 bg-emerald-50/10 shadow-xs" 
                        : "border-slate-200/60"
                    }`}
                    onMouseEnter={() => setHoveredPieIndex(i)}
                    onMouseLeave={() => setHoveredPieIndex(null)}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <div className="flex flex-col text-left">
                      <span className="text-slate-900 font-extrabold leading-tight text-xs">{s.name}</span>
                      <span className="text-[10px] text-slate-500 font-semibold mt-0.5">{s.acres.toFixed(1)} Ac ({s.pct}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // Single Plot Mode: Biophysical Stress Dual-Gauge
            <div className="flex flex-col justify-between h-full">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm mb-4 flex items-center gap-1.5">
                  <Activity className="w-4.5 h-4.5 text-primary" />
                  {t("analytics.biophysical_stress")}
                </h3>

                <div className="w-full min-h-[220px] relative flex items-center justify-center bg-slate-50/50 border border-slate-100 rounded-xl p-4 flex-grow select-none">
                  {/* Apple-style Concentric Rings */}
                  <svg className="w-44 h-44 transform -rotate-90" viewBox="0 0 100 100">
                    {/* Ring 1 background */}
                    <circle cx="50" cy="50" r="40" fill="transparent" stroke="#E2E8F0" strokeWidth="6" />
                    {/* Ring 1 Canopy Health */}
                    <circle 
                      cx="50" 
                      cy="50" 
                      r="40" 
                      fill="transparent" 
                      stroke="#10b981" 
                      strokeWidth="6"
                      strokeDasharray={2 * Math.PI * 40}
                      strokeDashoffset={2 * Math.PI * 40 * (1 - analyticsData.avgCropHealth / 100)}
                      strokeLinecap="round"
                    />

                    {/* Ring 2 background */}
                    <circle cx="50" cy="50" r="30" fill="transparent" stroke="#E2E8F0" strokeWidth="6" />
                    {/* Ring 2 Hydration */}
                    <circle 
                      cx="50" 
                      cy="50" 
                      r="30" 
                      fill="transparent" 
                      stroke="#0ea5e9" 
                      strokeWidth="6"
                      strokeDasharray={2 * Math.PI * 30}
                      strokeDashoffset={2 * Math.PI * 30 * (1 - analyticsData.waterDeficit / 100)}
                      strokeLinecap="round"
                    />
                  </svg>

                  {/* Centered Readout */}
                  <div className="absolute text-center">
                    <span className="text-[9px] font-mono text-slate-400 uppercase font-black tracking-widest block">Canopy Twin Stage</span>
                    <span className="text-sm font-extrabold text-slate-900 block mt-0.5">{analyticsData.growthStage}</span>
                    <span className="text-[10px] font-bold text-slate-500 block mt-1">{t("analytics.optimal")} Status</span>
                  </div>
                </div>
              </div>

              {/* Legends & Readouts */}
              <div className="grid grid-cols-2 gap-3 mt-4 text-xs font-bold text-left">
                <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl space-y-1">
                  <span className="text-emerald-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    {t("analytics.crop_health_index")}
                  </span>
                  <span className="text-lg font-black text-slate-900 mt-1 block">
                    {Math.round(analyticsData.avgCropHealth)}%
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl space-y-1">
                  <span className="text-sky-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-sky-500" />
                    {t("analytics.hydration_index")}
                  </span>
                  <span className="text-lg font-black text-slate-900 mt-1 block">
                    {Math.round(analyticsData.waterDeficit)}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ================= SECTION 3: BOTTOM SECTION - FARM HEALTH MATRIX / SUB-ZONES ================= */}
      <div className="bg-white/95 border border-slate-200/80 p-5 rounded-2xl shadow-xs hover:shadow-md transition-all duration-200 text-left">
        {selectedPlotId === "ALL" ? (
          // Aggregate Mode: Plot Health Grid Matrix
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                  <LayoutGrid className="w-4.5 h-4.5 text-primary" />
                  {t("analytics.plot_health_matrix")}
                </h3>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                  Health status overview of all registered plots
                </p>
              </div>
              <div className="flex items-center gap-3 text-[9px] font-bold text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500" /> 80%+ Optimal</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-400" /> 60-79% Warning</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-rose-500" /> &lt;60% Critical</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {plots.map((plot, i) => {
                const twin = plot.digital_twins?.[0];
                const score = twin ? Number(twin.crop_health_score) : 75;
                const isHovered = hoveredPlotIndex === i;

                let cardBg = "border-rose-100 bg-rose-50/10 hover:bg-rose-50/20";
                let badgeColor = "text-rose-600 bg-rose-50 border-rose-100";
                let statusLabel = t("analytics.critical");

                if (score >= 80) {
                  cardBg = "border-emerald-100 bg-emerald-50/5 hover:bg-emerald-50/10";
                  badgeColor = "text-emerald-700 bg-emerald-50 border-emerald-100";
                  statusLabel = t("analytics.optimal");
                } else if (score >= 60) {
                  cardBg = "border-amber-100 bg-amber-50/5 hover:bg-amber-50/10";
                  badgeColor = "text-amber-600 bg-amber-50 border-amber-100";
                  statusLabel = t("analytics.warning");
                }

                return (
                  <div
                    key={plot.id}
                    className={`border rounded-2xl p-4 text-left transition-all duration-300 transform hover:scale-102 flex flex-col justify-between min-h-[120px] cursor-pointer relative overflow-hidden ${cardBg}`}
                    onMouseEnter={() => setHoveredPlotIndex(i)}
                    onMouseLeave={() => setHoveredPlotIndex(null)}
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black text-slate-400 font-mono tracking-wider">{plot.id}</span>
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${badgeColor}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <h4 className="font-extrabold text-slate-900 text-xs mt-2 leading-snug truncate pr-6">{plot.name}</h4>
                    </div>

                    <div className="flex justify-between items-center text-[10px] font-semibold text-slate-500 border-t border-slate-100 pt-2 mt-2">
                      <span>{plot.crop}</span>
                      <span className="font-black text-slate-900">{score}%</span>
                    </div>

                    {/* Pop-out overlay on hover */}
                    <AnimatePresence>
                      {isHovered && (
                        <motion.div
                          className="absolute inset-0 bg-slate-950/95 backdrop-blur-xs p-3.5 flex flex-col justify-between text-white font-mono text-[9px]"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          <div>
                            <span className="text-emerald-400 font-black text-[10px] block border-b border-white/10 pb-1">{plot.name}</span>
                            <div className="mt-2 space-y-1 font-semibold">
                              <div>Acreage: {plot.area} ac</div>
                              <div>Soil: {plot.soil}</div>
                            </div>
                          </div>
                          <span className="text-[8px] text-slate-400 italic">Click plot details to open twin</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          // Single Plot Mode: Sub-Zone Canopy Health Matrix
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                  <LayoutGrid className="w-4.5 h-4.5 text-primary" />
                  {t("analytics.sub_zone_canopy")}
                </h3>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                  Simulated high-resolution Sentinel-2 NDVI vegetative vigor indexes
                </p>
              </div>
              <div className="flex items-center gap-3 text-[9px] font-bold text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500" /> &gt;0.72 Vigor</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-400" /> 0.55-0.71 Alert</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-rose-500" /> &lt;0.55 Critical</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {getSubZones().map((zone, i) => {
                const isHovered = hoveredSubZone === i;
                return (
                  <div
                    key={i}
                    className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center cursor-pointer transition-all duration-200 transform hover:scale-102 flex flex-col justify-between min-h-[110px] relative overflow-hidden"
                    onMouseEnter={() => setHoveredSubZone(i)}
                    onMouseLeave={() => setHoveredSubZone(null)}
                  >
                    <div>
                      <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-wider">{zone.name}</span>
                      <span className="block text-xl font-mono font-black text-slate-900 mt-2">
                        {zone.ndvi}
                      </span>
                    </div>

                    <div className="mt-2.5 flex items-center justify-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${zone.colorClass}`} />
                      <span className="text-[9px] font-bold text-slate-500">{zone.health.replace(" Vigor", "").replace(" Deficit", "").replace(" Stress", "")}</span>
                    </div>

                    {/* Sub-zone detailed overlay on hover */}
                    <AnimatePresence>
                      {isHovered && (
                        <motion.div 
                          className="absolute inset-0 bg-slate-950/95 backdrop-blur-xs p-3 flex flex-col justify-between text-white font-mono text-[9px] text-left"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          <div>
                            <span className="text-emerald-400 font-black block border-b border-white/10 pb-0.5">{zone.name}</span>
                            <div className="mt-2 space-y-1">
                              <div>Vigor Score: {zone.ndvi}</div>
                              <div>Status: {zone.health}</div>
                            </div>
                          </div>
                          <span className="text-[7.5px] text-slate-450">Last tested: 2 days ago</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ================= 12-MONTH CHEMISTRY RECOVERY LINE CHART ================= */}
      <div className="bg-white/95 border border-slate-200/80 p-5 rounded-2xl shadow-xs hover:shadow-md transition-all duration-200 text-left space-y-4">
        <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
          <Calendar className="w-4.5 h-4.5 text-primary" />
          12-Month Soil Chemistry Recovery Trend
        </h3>

        <div className="h-44 relative bg-slate-50/50 border border-slate-100 rounded-xl p-2 select-none">
          <svg className="w-full h-full" viewBox="0 0 300 120">
            {/* Grid helper lines */}
            <line x1="10" y1="30" x2="290" y2="30" stroke="#e2e8f0" strokeDasharray="3 3" />
            <line x1="10" y1="65" x2="290" y2="65" stroke="#e2e8f0" strokeDasharray="3 3" />
            <line x1="10" y1="100" x2="290" y2="100" stroke="#e2e8f0" strokeDasharray="3 3" />

            {/* Smooth bezier paths for N, P, K */}
            <path 
              d={`M 10 ${100 - getSoilTimeline("N")[0] / 3.5} L ${soilMonths.map((_, i) => `${10 + i * 25} ${100 - getSoilTimeline("N")[i] / 3.5}`).join(" L ")}`} 
              fill="none" 
              stroke="#f59e0b" 
              strokeWidth="2.5" 
              strokeLinecap="round"
            />
            <path 
              d={`M 10 ${100 - getSoilTimeline("P")[0] * 1.2} L ${soilMonths.map((_, i) => `${10 + i * 25} ${100 - getSoilTimeline("P")[i] * 1.2}`).join(" L ")}`} 
              fill="none" 
              stroke="#10b981" 
              strokeWidth="2.5" 
              strokeLinecap="round"
            />
            <path 
              d={`M 10 ${100 - getSoilTimeline("K")[0] / 3.8} L ${soilMonths.map((_, i) => `${10 + i * 25} ${100 - getSoilTimeline("K")[i] / 3.8}`).join(" L ")}`} 
              fill="none" 
              stroke="#3b82f6" 
              strokeWidth="2.5" 
              strokeLinecap="round"
            />

            {/* Labels */}
            {soilMonths.map((m, i) => (
              <text key={i} x={10 + i * 25} y="115" fill="#94a3b8" fontSize="8" textAnchor="middle" className="font-mono font-bold">
                {m}
              </text>
            ))}
          </svg>
        </div>

        <div className="flex flex-wrap gap-2 text-[9px] font-bold">
          <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">Nitrogen (N)</span>
          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 font-bold">Phosphorus (P)</span>
          <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">Potassium (K)</span>
        </div>
      </div>
    </motion.div>
  );
};
