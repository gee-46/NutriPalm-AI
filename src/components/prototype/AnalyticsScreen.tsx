import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  TrendingUp, BarChart3, Calendar, Droplets, LayoutGrid, Cpu, 
  Download, Activity, Bot, Sprout, Sparkles, CheckCircle2,
  ChevronDown
} from "lucide-react";
import { useTranslation } from "../../translation/useTranslation";
import { useFarmerAnalytics } from "../../hooks/useFarmerAnalytics";

// Animated counter component for smooth metric count-ups
const AnimatedCounter: React.FC<{ value: number; suffix?: string; decimals?: number }> = ({ 
  value, 
  suffix = "", 
  decimals = 0 
}) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let animationFrameId: number;
    const duration = 1000;
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

// SVG Sparkline component with smooth Bézier curve and gradient area
const Sparkline: React.FC<{ points: number[]; color: string; index: number }> = ({ points, color, index }) => {
  const width = 120;
  const height = 24;
  if (points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min === 0 ? 1 : max - min;
  
  const coords = points.map((val, idx) => {
    const x = 4 + (idx / (points.length - 1)) * (width - 8);
    const y = height - 4 - ((val - min) / range) * (height - 8);
    return { x, y };
  });

  let path = `M ${coords[0].x} ${coords[0].y}`;
  let areaPath = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const cp1x = coords[i].x + (coords[i+1].x - coords[i].x) / 2.5;
    const cp1y = coords[i].y;
    const cp2x = coords[i].x + 2 * (coords[i+1].x - coords[i].x) / 1.5;
    const cp2y = coords[i].y;
    const nextPath = ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${coords[i+1].x} ${coords[i+1].y}`;
    path += nextPath;
    areaPath += nextPath;
  }
  areaPath += ` L ${coords[coords.length - 1].x} ${height} L ${coords[0].x} ${height} Z`;

  return (
    <svg className="w-full h-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`kpiGrad-${index}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#kpiGrad-${index})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

  const [dateFilter, setDateFilter] = useState("Last 30 Days");
  const [hoveredPieIndex, setHoveredPieIndex] = useState<number | null>(null);
  const [hoveredSubZone, setHoveredSubZone] = useState<number | null>(null);
  const [hoveredPlotIndex, setHoveredPlotIndex] = useState<number | null>(null);

  // Radar Interactive States
  const [hoveredRadarAxis, setHoveredRadarAxis] = useState<number | null>(null);
  const [radarTooltipPos, setRadarTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Scrub Interactive States
  const timelineSvgRef = useRef<SVGSVGElement | null>(null);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const [scrubPos, setScrubPos] = useState<number | null>(null);

  const totalAcres = plots.reduce((sum, p) => sum + p.area, 0);

  // 12-Month Multi-series timeline data
  const soilMonths = ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];
  const timelineData = {
    months: soilMonths,
    baselineYield: [22, 23, 21, 24, 25, 27, 26, 28, 29, 31, 30, 32],
    projectedYield: [22, 24, 25, 29, 31, 34, 33, 36, 38, 41, 40, 43],
    soilHealth: [70, 71, 73, 75, 78, 80, 81, 83, 85, 87, 86, 89]
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[450px]">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Fallback Empty State
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
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">
            {t("analytics.no_plots_registered")}
          </h2>
          <p className="text-xs text-gray-500 font-semibold leading-relaxed">
            Configure your registered farm plots using high-precision GIS boundary coordinate mapping. Once mapped, your living Digital Twin analytics console will synchronize here.
          </p>
        </div>
        <button
          onClick={() => onNavigate?.("Farm Plots")}
          className="w-full bg-primary hover:bg-[#235F26] text-white rounded-xl py-3 text-xs font-bold shadow-xs transition-all active:scale-98 border-0 cursor-pointer"
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
      decimals: 1,
      color: "#2E7D32",
      icon: <LayoutGrid className="w-5 h-5" />,
      iconBg: "bg-primary/10 text-primary",
      badge: `${plots.length} Plots`,
      spark: [30, 32, 35, 38, 39, 39.5]
    },
    {
      label: t("analytics.crop_health_index"),
      val: analyticsData.avgCropHealth,
      suffix: "%",
      decimals: 0,
      color: "#2E7D32",
      icon: <Activity className="w-5 h-5" />,
      iconBg: "bg-emerald-50 text-emerald-700",
      badge: "Optimal",
      spark: [78, 80, 81, 83, 82, Math.round(analyticsData.avgCropHealth)]
    },
    {
      label: t("analytics.canopy_water_stress"),
      val: analyticsData.canopyStress,
      suffix: "",
      decimals: 0,
      color: analyticsData.canopyStress === "Optimal" ? "#2E7D32" : "#F59E0B",
      icon: <Droplets className="w-5 h-5" />,
      iconBg: "bg-sky-50 text-sky-600",
      badge: `${Math.round(analyticsData.waterDeficit)}% VWC`,
      spark: [60, 62, 65, 68, 67, Math.round(analyticsData.waterDeficit)]
    },
    {
      label: t("analytics.estimated_yield_delta"),
      val: analyticsData.yieldDelta,
      suffix: "%",
      decimals: 1,
      color: "#2E7D32",
      icon: <TrendingUp className="w-5 h-5" />,
      iconBg: "bg-emerald-50 text-[#2E7D32]",
      badge: "+2.4 Qtl/Ac",
      spark: [10, 12, 14, 15, 17, analyticsData.yieldDelta]
    },
    {
      label: t("analytics.soil_diagnostic_status"),
      val: analyticsData.soilStatus,
      suffix: "",
      decimals: 0,
      color: "#2E7D32",
      icon: <Bot className="w-5 h-5" />,
      iconBg: "bg-indigo-50 text-indigo-700",
      badge: "Synced",
      spark: [80, 82, 85, 88, 90, 92]
    },
    {
      label: t("analytics.digital_twin_telemetry"),
      val: analyticsData.telemetryStatus,
      suffix: "",
      decimals: 0,
      color: "#2E7D32",
      icon: <Cpu className="w-5 h-5" />,
      iconBg: "bg-secondary/10 text-primary",
      badge: "99.8% Online",
      spark: [90, 92, 94, 96, 98, 100]
    }
  ];

  // Doughnut Slice Calculations
  const donutRadius = 65;
  const donutCircumference = 2 * Math.PI * donutRadius;
  let accumulatedPercent = 0;
  const pieSlices = analyticsData.cropDistribution.map((slice, i) => {
    const strokeDasharray = `${(slice.pct / 100) * donutCircumference} ${donutCircumference}`;
    const strokeDashoffset = -((accumulatedPercent / 100) * donutCircumference);
    accumulatedPercent += slice.pct;
    
    const colors = ["#2E7D32", "#0284C7", "#F59E0B", "#7C3AED", "#EC4899"];
    return {
      ...slice,
      color: colors[i % colors.length],
      dashArray: strokeDasharray,
      dashOffset: strokeDashoffset.toString()
    };
  });

  const dominantCrop = analyticsData.cropDistribution.length > 0 
    ? [...analyticsData.cropDistribution].sort((a,b) => b.acres - a.acres)[0].name
    : "None";

  // ---------------------------------------------------------------------------
  // 5-Axis Radar Chart Coordinates
  // ---------------------------------------------------------------------------
  const radarAxes = [
    { key: "N", label: "Nitrogen", fullName: "Available Nitrogen (N)", target: 150, unit: " kg/ha", desc: "Vegetative vigor & chlorophyll formation" },
    { key: "P", label: "Phosphorus", fullName: "Phosphorus (P₂O₅)", target: 25, unit: " kg/ha", desc: "Root elongation & early crop establishment" },
    { key: "K", label: "Potassium", fullName: "Potassium (K₂O)", target: 180, unit: " kg/ha", desc: "Enzyme activation & fruit bunch swelling" },
    { key: "OC", label: "Organic C", fullName: "Organic Carbon (OC)", target: 2.0, unit: "%", desc: "Microbial humus & cation-exchange capacity" },
    { key: "pH", label: "Soil pH", fullName: "Soil pH Reaction", target: 6.5, unit: " pH", desc: "Nutrient bioavailability buffer zone" }
  ] as const;

  const radarCx = 160;
  const radarCy = 135;
  const radarMaxRadius = 92;

  const getRadarCoordinates = (useTargets: boolean) => {
    return radarAxes.map((axis, i) => {
      const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const val = analyticsData.soilNutrients[axis.key];
      const target = axis.target;
      
      const ratio = useTargets ? 1.0 : Math.min(1.2, val / target);
      const r = radarMaxRadius * 0.8 * ratio;
      const x = radarCx + r * Math.cos(angle);
      const y = radarCy + r * Math.sin(angle);
      return { x, y, val };
    });
  };

  const targetCoords = getRadarCoordinates(true);
  const actualCoords = getRadarCoordinates(false);

  const targetPointsStr = targetCoords.map(c => `${c.x},${c.y}`).join(" ");
  const actualPointsStr = actualCoords.map(c => `${c.x},${c.y}`).join(" ");

  const handleRadarHover = (idx: number, e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgEl = e.currentTarget.closest("svg");
    if (!svgEl) return;
    const svgRect = svgEl.getBoundingClientRect();
    
    setHoveredRadarAxis(idx);
    setRadarTooltipPos({
      x: rect.left - svgRect.left + rect.width / 2,
      y: rect.top - svgRect.top - 10
    });
  };

  // ---------------------------------------------------------------------------
  // Timeline Scrub Calculations
  // ---------------------------------------------------------------------------
  const handleTimelineMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!timelineSvgRef.current) return;
    const rect = timelineSvgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    const startX = 45;
    const endX = 555;
    const width = endX - startX;
    
    let index = Math.round(((x - startX) / width) * 11);
    index = Math.max(0, Math.min(11, index));
    
    const calculatedX = startX + index * (width / 11);
    setScrubIndex(index);
    setScrubPos(calculatedX);
  };

  const getSubZones = () => {
    const selectedPlot = plots.find(p => p.id === selectedPlotId);
    if (!selectedPlot) return [];
    
    const zoneNames = ["North-West", "North-East", "Central Canopy", "South-West", "South-East", "Fringe Zone"];
    const baseNDVI = selectedPlot.digital_twins?.[0]?.crop_health_score ? selectedPlot.digital_twins[0].crop_health_score / 100 : 0.78;
    
    return zoneNames.map((name, i) => {
      const variation = [0.08, -0.05, 0.12, -0.1, 0.04, -0.07][i];
      const ndvi = Number(Math.max(0.3, Math.min(0.98, baseNDVI + variation)).toFixed(2));
      let health = "Optimal Vigor";
      let colorClass = "bg-emerald-500";
      let badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-100";
      if (ndvi < 0.55) {
        health = "Critical Deficit";
        colorClass = "bg-rose-500";
        badgeStyle = "bg-rose-50 text-rose-600 border-rose-100";
      } else if (ndvi < 0.72) {
        health = "Mild Stress";
        colorClass = "bg-amber-500";
        badgeStyle = "bg-amber-50 text-amber-600 border-amber-100";
      }
      return { name, ndvi, health, colorClass, badgeStyle };
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-6 text-left font-sans"
    >
      {/* ================= 1. PREMIUM HEADER & TOOLBAR ================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200/60 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight leading-none flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-primary" />
            NutriPalm <span className="text-primary font-black">AI Farm Analytics</span>
          </h1>
          <p className="text-sm font-semibold text-gray-500 mt-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary" />
            {t("analytics.live_crop_telemetry")} <span className="text-gray-900 font-bold">{profile.full_name || "Farmer"}</span> • {profile.village ? `${profile.village}, ` : ""}{profile.district || "Karnataka"}
          </p>
        </div>

        {/* Global Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Active Filter Pill */}
          {selectedPlotId !== "ALL" && (
            <div className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Plot: {plots.find(p => p.id === selectedPlotId)?.name}
              <button 
                onClick={() => setSelectedPlotId("ALL")}
                className="ml-1 text-emerald-600 hover:text-emerald-900 bg-transparent border-0 cursor-pointer font-black text-sm"
                title="Clear Plot Filter"
              >
                ×
              </button>
            </div>
          )}

          {/* Plot Dropdown */}
          <div className="relative">
            <select
              value={selectedPlotId}
              onChange={(e) => setSelectedPlotId(e.target.value)}
              className="appearance-none bg-white border border-gray-250 text-xs font-bold text-gray-750 rounded-xl pl-3.5 pr-8 py-2.5 shadow-xs hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer transition-all h-10"
            >
              <option value="ALL">
                {t("analytics.all_plots")} ({plots.length} Plots • {totalAcres.toFixed(1)} ac)
              </option>
              {plots.map((plot) => (
                <option key={plot.id} value={plot.id}>
                  {plot.name} ({plot.crop} • {plot.area} {plot.area_unit})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Date Range Selector */}
          <div className="relative">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="appearance-none bg-white border border-gray-250 text-xs font-bold text-gray-750 rounded-xl pl-3.5 pr-8 py-2.5 shadow-xs hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer transition-all h-10"
            >
              <option value="Last 30 Days">{t("analytics.date_30_days")}</option>
              <option value="This Season">{t("analytics.date_season")}</option>
              <option value="Last 12 Months">{t("analytics.date_12_months")}</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Export Action */}
          <button
            onClick={() => alert("Downloading Agricultural Telemetry Dataset (CSV)...")}
            className="bg-primary hover:bg-[#235F26] text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all border-0 shadow-xs cursor-pointer shrink-0 h-10"
          >
            <Download className="w-4 h-4" />
            {t("analytics.export_csv")}
          </button>
        </div>
      </div>

      {/* ================= 2. STATUS STRIP BANNER ================= */}
      <div className="bg-emerald-50/40 border border-emerald-500/10 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-semibold text-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-extrabold text-gray-900">
            {selectedPlotId === "ALL" ? "Comprehensive Field Aggregations" : `Active Focus: ${plots.find(p => p.id === selectedPlotId)?.name}`}
          </span>
          <span className="text-[10px] text-primary bg-primary/10 border border-primary/10 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
            {selectedPlotId === "ALL" ? `${plots.length} Linked Plots` : plots.find(p => p.id === selectedPlotId)?.crop}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-gray-500 font-medium text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Telemetry Stream Live
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            GIS Multi-Polygons Locked
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Diagnostic Soil Models Active
          </span>
          <span className="text-gray-450 font-medium">
            Last Sync: 1 min ago
          </span>
        </div>
      </div>

      {/* ================= 3. TOP METRIC KPI CARDS (6 GRID) ================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((kpi, idx) => {
          const isString = typeof kpi.val === "string";
          return (
            <div 
              key={idx}
              className="bg-white rounded-2xl p-5 border border-gray-150 shadow-xs hover:shadow-md hover:border-primary/20 transition-all duration-300 group flex flex-col justify-between min-h-[145px]"
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div className={`p-2.5 rounded-xl ${kpi.iconBg} group-hover:scale-110 transition-transform duration-300`}>
                    {kpi.icon}
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100/70 px-2 py-0.5 rounded-full">
                    {kpi.badge}
                  </span>
                </div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{kpi.label}</p>
                <p className="text-2xl font-black text-gray-900 mt-1 tracking-tight leading-tight">
                  {isString ? (
                    kpi.val
                  ) : (
                    <AnimatedCounter value={kpi.val as number} suffix={kpi.suffix} decimals={kpi.decimals} />
                  )}
                </p>
              </div>

              {/* Sparkline Progress Area */}
              <div className="w-full h-5 mt-2">
                <Sparkline points={kpi.spark} color={kpi.color} index={idx} />
              </div>
            </div>
          );
        })}
      </div>

      {/* ================= 4. MIDDLE SECTION: DUAL-COLUMN VISUALIZATIONS ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        
        {/* Left Column: 5-Axis Soil Chemistry Radar */}
        <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between h-full relative">
          <div>
            <div className="flex justify-between items-start border-b border-gray-100 pb-3 mb-4">
              <div>
                <h3 className="font-extrabold text-gray-900 text-sm flex items-center gap-2">
                  <Bot className="w-4.5 h-4.5 text-primary" />
                  {t("analytics.soil_nutrient_balance")}
                </h3>
                <p className="text-[11px] font-semibold text-gray-400 mt-0.5">
                  Multi-parameter polar radar comparing current field chemistry to agronomic targets
                </p>
              </div>
              <span className="text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/10 shrink-0">
                5-Axis Matrix
              </span>
            </div>

            {/* Radar SVG Visual */}
            <div className="relative w-full flex items-center justify-center py-2 select-none min-h-[270px]">
              <svg className="w-80 h-72 overflow-visible" viewBox="0 0 320 270">
                {/* Concentric Grid Polygons */}
                {[0.25, 0.5, 0.75, 1.0].map((scale, gridIdx) => {
                  const r = radarMaxRadius * 0.8 * scale;
                  const pts = radarAxes.map((_, i) => {
                    const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                    return `${radarCx + r * Math.cos(angle)},${radarCy + r * Math.sin(angle)}`;
                  }).join(" ");
                  return (
                    <polygon 
                      key={gridIdx} 
                      points={pts} 
                      fill="none" 
                      stroke="#E2E8F0" 
                      strokeWidth="1.2" 
                      strokeDasharray={scale < 1.0 ? "2 2" : "none"}
                    />
                  );
                })}

                {/* Radar Spokes */}
                {radarAxes.map((_, i) => {
                  const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                  const x = radarCx + radarMaxRadius * Math.cos(angle);
                  const y = radarCy + radarMaxRadius * Math.sin(angle);
                  return (
                    <line 
                      key={i} 
                      x1={radarCx} 
                      y1={radarCy} 
                      x2={x} 
                      y2={y} 
                      stroke="#E2E8F0" 
                      strokeWidth="1.2" 
                    />
                  );
                })}

                {/* Target Baseline Dotted Line */}
                <polygon 
                  points={targetPointsStr} 
                  fill="none" 
                  stroke="#94A3B8" 
                  strokeDasharray="4 3" 
                  strokeWidth="1.5" 
                />

                {/* Actual Soil Chemistry Polygon */}
                <polygon 
                  points={actualPointsStr} 
                  fill="rgba(46, 125, 50, 0.22)" 
                  stroke="#2E7D32" 
                  strokeWidth="2.5" 
                />

                {/* Interactive Anchor Points */}
                {actualCoords.map((coord, i) => {
                  const axis = radarAxes[i];
                  const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                  const labelX = radarCx + (radarMaxRadius + 22) * Math.cos(angle);
                  const labelY = radarCy + (radarMaxRadius + 14) * Math.sin(angle);
                  const isHovered = hoveredRadarAxis === i;

                  return (
                    <g key={i}>
                      {/* Node Circle */}
                      <circle 
                        cx={coord.x} 
                        cy={coord.y} 
                        r={isHovered ? "6" : "4.5"} 
                        fill="#2E7D32" 
                        stroke="#ffffff" 
                        strokeWidth="2" 
                        className="transition-all duration-200"
                      />
                      
                      {/* Invisible Larger Hover Area */}
                      <circle 
                        cx={coord.x} 
                        cy={coord.y} 
                        r="18" 
                        fill="transparent" 
                        className="cursor-pointer"
                        onMouseEnter={(e) => handleRadarHover(i, e)}
                        onMouseLeave={() => setHoveredRadarAxis(null)}
                      />

                      {/* Axis Label */}
                      <text 
                        x={labelX} 
                        y={labelY} 
                        fill={isHovered ? "#2E7D32" : "#475569"} 
                        fontSize="10" 
                        fontWeight="bold" 
                        textAnchor="middle" 
                        className="select-none transition-colors"
                      >
                        {axis.label}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Interactive Tooltip Card */}
              <AnimatePresence>
                {hoveredRadarAxis !== null && radarTooltipPos && (
                  <motion.div
                    className="absolute bg-slate-900 text-white rounded-2xl p-3.5 shadow-xl z-30 text-xs w-52 space-y-2 pointer-events-none text-left"
                    style={{
                      left: `${radarTooltipPos.x}px`,
                      top: `${radarTooltipPos.y - 75}px`,
                      transform: "translateX(-50%)"
                    }}
                    initial={{ opacity: 0, scale: 0.92, y: 6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: 6 }}
                  >
                    <div className="border-b border-white/10 pb-1.5">
                      <span className="font-bold text-emerald-400 block text-xs">
                        {radarAxes[hoveredRadarAxis].fullName}
                      </span>
                      <span className="text-[9px] text-slate-400 block mt-0.5 leading-tight">
                        {radarAxes[hoveredRadarAxis].desc}
                      </span>
                    </div>
                    <div className="space-y-1 text-slate-200 text-[10px] leading-tight">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Current Value:</span>
                        <span className="text-white font-bold">
                          {analyticsData.soilNutrients[radarAxes[hoveredRadarAxis].key]}
                          {radarAxes[hoveredRadarAxis].unit}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Optimal Benchmark:</span>
                        <span className="text-slate-300 font-bold">
                          {radarAxes[hoveredRadarAxis].target}
                          {radarAxes[hoveredRadarAxis].unit}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-white/10 pt-1 font-bold">
                        <span className="text-slate-400">Target Fulfillment:</span>
                        <span className="text-emerald-400">
                          {Math.round((analyticsData.soilNutrients[radarAxes[hoveredRadarAxis].key] / radarAxes[hoveredRadarAxis].target) * 100)}%
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Bottom Breakdown Mini-Pills */}
            <div className="grid grid-cols-5 gap-2 mt-2">
              {radarAxes.map((axis) => {
                const val = analyticsData.soilNutrients[axis.key];
                const pct = Math.round((val / axis.target) * 100);
                const isOptimal = pct >= 85;
                const isWarning = pct >= 65 && pct < 85;
                return (
                  <div 
                    key={axis.key} 
                    className={`p-2 rounded-xl text-center border transition-all ${
                      isOptimal ? "bg-emerald-50/70 border-emerald-200 text-emerald-800" :
                      isWarning ? "bg-amber-50/70 border-amber-200 text-amber-800" :
                      "bg-rose-50/70 border-rose-200 text-rose-800"
                    }`}
                  >
                    <span className="block text-[8px] font-bold uppercase tracking-wider text-gray-500">{axis.key}</span>
                    <span className="block text-xs font-black mt-0.5">{val}</span>
                    <span className="block text-[8px] font-bold mt-0.5">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Synced Crop Donut OR Biophysical Concentric Rings */}
        <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col justify-between h-full">
          {selectedPlotId === "ALL" ? (
            <div className="flex flex-col justify-between h-full">
              <div>
                <div className="flex justify-between items-start border-b border-gray-100 pb-3 mb-4">
                  <div>
                    <h3 className="font-extrabold text-gray-900 text-sm flex items-center gap-2">
                      <Activity className="w-4.5 h-4.5 text-primary" />
                      {t("analytics.crop_distribution")}
                    </h3>
                    <p className="text-[11px] font-semibold text-gray-400 mt-0.5">
                      Acreage distribution across mapped agricultural commodities
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100/70 shrink-0">
                    {totalAcres.toFixed(1)} Total Acres
                  </span>
                </div>

                {/* Donut SVG */}
                <div className="w-full min-h-[220px] relative flex items-center justify-center bg-gray-50/60 border border-gray-150 rounded-2xl p-4 select-none flex-grow">
                  <svg className="w-48 h-48 transform -rotate-90" viewBox="0 0 170 170">
                    <circle cx="85" cy="85" r={donutRadius} fill="transparent" stroke="#E2E8F0" strokeWidth="15" />
                    {pieSlices.map((slice, i) => {
                      const isHovered = hoveredPieIndex === i;
                      const isDimmed = hoveredPieIndex !== null && hoveredPieIndex !== i;
                      return (
                        <circle
                          key={i}
                          cx="85"
                          cy="85"
                          r={donutRadius}
                          fill="transparent"
                          stroke={slice.color}
                          strokeWidth={isHovered ? 20 : 15}
                          strokeDasharray={slice.dashArray}
                          strokeDashoffset={slice.dashOffset}
                          className="transition-all duration-300 cursor-pointer"
                          style={{
                            opacity: isDimmed ? 0.35 : 1,
                            filter: isHovered ? `drop-shadow(0 0 6px ${slice.color}80)` : "none"
                          }}
                          onMouseEnter={() => setHoveredPieIndex(i)}
                          onMouseLeave={() => setHoveredPieIndex(null)}
                        />
                      );
                    })}
                  </svg>

                  {/* Centered Hub Text */}
                  <div className="absolute text-center flex flex-col items-center justify-center pointer-events-none w-28">
                    {hoveredPieIndex !== null ? (
                      <>
                        <span 
                          className="text-[10px] font-black uppercase tracking-wider truncate max-w-full block"
                          style={{ color: pieSlices[hoveredPieIndex].color }}
                        >
                          {pieSlices[hoveredPieIndex].name}
                        </span>
                        <span className="text-base font-black text-gray-900 block mt-0.5">
                          {pieSlices[hoveredPieIndex].acres.toFixed(1)} Ac
                        </span>
                        <span className="text-[9px] font-bold text-gray-400 block">
                          ({pieSlices[hoveredPieIndex].pct}%)
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-[9px] font-bold text-gray-400 block uppercase tracking-wider">
                          Dominant Crop
                        </span>
                        <span className="text-xs font-black text-gray-900 block truncate max-w-full mt-0.5">
                          {dominantCrop}
                        </span>
                        <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 mt-1">
                          {totalAcres.toFixed(1)} Acres
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Synchronized Legend Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-4">
                {pieSlices.map((s, i) => (
                  <div 
                    key={i} 
                    className={`bg-gray-50/70 border p-2.5 rounded-xl text-gray-700 flex items-center gap-2.5 cursor-pointer transition-all duration-200 ${
                      hoveredPieIndex === i 
                        ? "border-primary bg-primary/5 scale-102 shadow-xs" 
                        : "border-gray-200/70 hover:border-gray-300"
                    }`}
                    onMouseEnter={() => setHoveredPieIndex(i)}
                    onMouseLeave={() => setHoveredPieIndex(null)}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <div className="flex flex-col text-left truncate">
                      <span className="text-gray-900 font-extrabold leading-tight text-xs truncate">{s.name}</span>
                      <span className="text-[10px] text-gray-500 font-semibold mt-0.5">{s.acres.toFixed(1)} Ac ({s.pct}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // Single Plot Mode: Apple Watch-style Biophysical Stress Concentric Gauges
            <div className="flex flex-col justify-between h-full">
              <div>
                <div className="flex justify-between items-start border-b border-gray-100 pb-3 mb-4">
                  <div>
                    <h3 className="font-extrabold text-gray-900 text-sm flex items-center gap-2">
                      <Activity className="w-4.5 h-4.5 text-primary" />
                      {t("analytics.biophysical_stress")}
                    </h3>
                    <p className="text-[11px] font-semibold text-gray-400 mt-0.5">
                      Concentric biophysical gauge tracking chlorophyll vigor and root moisture
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100/70 shrink-0">
                    Dual Gauge
                  </span>
                </div>

                <div className="w-full min-h-[220px] relative flex items-center justify-center bg-gray-50/60 border border-gray-150 rounded-2xl p-4 flex-grow select-none">
                  <svg className="w-48 h-48 transform -rotate-90" viewBox="0 0 120 120">
                    {/* Ring 1 background */}
                    <circle cx="60" cy="60" r="46" fill="transparent" stroke="#E2E8F0" strokeWidth="7" />
                    {/* Ring 1 Canopy Health */}
                    <circle 
                      cx="60" 
                      cy="60" 
                      r="46" 
                      fill="transparent" 
                      stroke="#2E7D32" 
                      strokeWidth="7"
                      strokeDasharray={2 * Math.PI * 46}
                      strokeDashoffset={2 * Math.PI * 46 * (1 - analyticsData.avgCropHealth / 100)}
                      strokeLinecap="round"
                    />

                    {/* Ring 2 background */}
                    <circle cx="60" cy="60" r="34" fill="transparent" stroke="#E2E8F0" strokeWidth="7" />
                    {/* Ring 2 Hydration */}
                    <circle 
                      cx="60" 
                      cy="60" 
                      r="34" 
                      fill="transparent" 
                      stroke="#0284C7" 
                      strokeWidth="7"
                      strokeDasharray={2 * Math.PI * 34}
                      strokeDashoffset={2 * Math.PI * 34 * (1 - analyticsData.waterDeficit / 100)}
                      strokeLinecap="round"
                    />
                  </svg>

                  {/* Centered Readout */}
                  <div className="absolute text-center w-28">
                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest block">Twin Stage</span>
                    <span className="text-xs font-black text-gray-900 block truncate mt-0.5">{analyticsData.growthStage}</span>
                    <span className="text-[9px] font-bold text-primary block mt-1">Optimal Status</span>
                  </div>
                </div>
              </div>

              {/* Legends & Readouts */}
              <div className="grid grid-cols-2 gap-3 mt-4 text-xs font-bold text-left">
                <div className="bg-emerald-50/60 border border-emerald-150 p-3.5 rounded-2xl space-y-1">
                  <span className="text-emerald-800 flex items-center gap-1.5 font-bold text-xs">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    {t("analytics.crop_health_index")}
                  </span>
                  <span className="text-xl font-black text-gray-900 mt-1 block">
                    {Math.round(analyticsData.avgCropHealth)}%
                  </span>
                </div>
                <div className="bg-sky-50/60 border border-sky-150 p-3.5 rounded-2xl space-y-1">
                  <span className="text-sky-800 flex items-center gap-1.5 font-bold text-xs">
                    <span className="w-2 h-2 rounded-full bg-sky-500" />
                    {t("analytics.hydration_index")}
                  </span>
                  <span className="text-xl font-black text-gray-900 mt-1 block">
                    {Math.round(analyticsData.waterDeficit)}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ================= 5. DUAL-AXIS 12-MONTH YIELD & SOIL RECOVERY TIMELINE ================= */}
      <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs hover:shadow-md transition-all duration-300 text-left space-y-4 relative">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-100 pb-3">
          <div>
            <h3 className="font-extrabold text-gray-900 text-sm flex items-center gap-2">
              <Calendar className="w-4.5 h-4.5 text-primary" />
              12-Month Yield Trajectory & Soil Recovery Forecast
            </h3>
            <p className="text-[11px] font-semibold text-gray-400 mt-0.5">
              Historical performance vs. AI-optimized slow-release NPK interventions. Hover/scrub to inspect.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold">
            <span className="text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary" /> AI Projected Yield
            </span>
            <span className="text-gray-600 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-gray-400" /> Baseline Yield
            </span>
            <span className="text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> Soil Health Index
            </span>
          </div>
        </div>

        {/* Timeline SVG Chart */}
        <div className="relative select-none pt-2">
          <svg 
            ref={timelineSvgRef}
            className="w-full h-56 cursor-crosshair overflow-visible" 
            viewBox="0 0 600 200"
            onMouseMove={handleTimelineMouseMove}
            onMouseLeave={() => { setScrubIndex(null); setScrubPos(null); }}
          >
            <defs>
              <linearGradient id="optYieldGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2E7D32" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#2E7D32" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="baseYieldGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#94A3B8" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#94A3B8" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid lines */}
            {[20, 60, 100, 140, 175].map((y, idx) => (
              <line key={idx} x1="45" y1={y} x2="555" y2={y} stroke="#F1F5F9" strokeWidth="1.2" />
            ))}

            {/* Calculations & Paths */}
            {(() => {
              const startX = 45;
              const endX = 555;
              const width = endX - startX;

              const getYFromYield = (val: number) => 175 - ((val - 15) / 35) * 155;
              const getYFromSoil = (val: number) => 175 - ((val - 60) / 40) * 155;
              const getX = (idx: number) => startX + idx * (width / 11);

              const optCoords = timelineData.projectedYield.map((val, idx) => ({ x: getX(idx), y: getYFromYield(val) }));
              const baseCoords = timelineData.baselineYield.map((val, idx) => ({ x: getX(idx), y: getYFromYield(val) }));
              const soilCoords = timelineData.soilHealth.map((val, idx) => ({ x: getX(idx), y: getYFromSoil(val) }));

              const getAreaPath = (coords: typeof optCoords) => {
                const path = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
                return `${path} L ${coords[coords.length - 1].x} 175 L ${coords[0].x} 175 Z`;
              };

              const getLinePath = (coords: typeof optCoords) => {
                return coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
              };

              return (
                <g>
                  {/* Shaded Area Fills */}
                  <path d={getAreaPath(optCoords)} fill="url(#optYieldGrad)" />
                  <path d={getAreaPath(baseCoords)} fill="url(#baseYieldGrad)" />

                  {/* Connecting Lines */}
                  <path d={getLinePath(optCoords)} fill="none" stroke="#2E7D32" strokeWidth="2.8" strokeLinecap="round" />
                  <path d={getLinePath(baseCoords)} fill="none" stroke="#94A3B8" strokeWidth="2.0" strokeLinecap="round" strokeDasharray="4 4" />
                  <path d={getLinePath(soilCoords)} fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" />

                  {/* Intersection Anchor Dots */}
                  {scrubIndex !== null && (
                    <g>
                      <circle cx={optCoords[scrubIndex].x} cy={optCoords[scrubIndex].y} r="6" fill="#2E7D32" stroke="#ffffff" strokeWidth="2.5" />
                      <circle cx={baseCoords[scrubIndex].x} cy={baseCoords[scrubIndex].y} r="5" fill="#94A3B8" stroke="#ffffff" strokeWidth="2" />
                      <circle cx={soilCoords[scrubIndex].x} cy={soilCoords[scrubIndex].y} r="5.5" fill="#2563EB" stroke="#ffffff" strokeWidth="2.5" />
                    </g>
                  )}
                </g>
              );
            })()}

            {/* Left Y Axis Labels (Yield) */}
            <text x="36" y="24" fill="#94A3B8" fontSize="8" fontWeight="bold" textAnchor="end">50 Qtl</text>
            <text x="36" y="104" fill="#94A3B8" fontSize="8" fontWeight="bold" textAnchor="end">32 Qtl</text>
            <text x="36" y="179" fill="#94A3B8" fontSize="8" fontWeight="bold" textAnchor="end">15 Qtl</text>

            {/* Right Y Axis Labels (Soil %) */}
            <text x="564" y="24" fill="#94A3B8" fontSize="8" fontWeight="bold" textAnchor="start">100%</text>
            <text x="564" y="104" fill="#94A3B8" fontSize="8" fontWeight="bold" textAnchor="start">80%</text>
            <text x="564" y="179" fill="#94A3B8" fontSize="8" fontWeight="bold" textAnchor="start">60%</text>

            {/* Month Labels along Bottom */}
            {soilMonths.map((m, i) => (
              <text key={i} x={45 + i * (510 / 11)} y="195" fill="#64748B" fontSize="9" fontWeight="bold" textAnchor="middle">
                {m}
              </text>
            ))}

            {/* Scrub Vertical Crosshair */}
            {scrubPos !== null && (
              <line x1={scrubPos} y1="20" x2={scrubPos} y2="175" stroke="#CBD5E1" strokeWidth="1.5" strokeDasharray="3 3" />
            )}
          </svg>

          {/* Scrub Tooltip Card */}
          <AnimatePresence>
            {scrubIndex !== null && scrubPos !== null && (
              <motion.div
                className="absolute bg-slate-900 text-white rounded-2xl p-3.5 shadow-2xl z-30 text-xs w-56 space-y-1.5 pointer-events-none text-left"
                style={{
                  left: `${(scrubPos / 600) * 100}%`,
                  top: "-15px",
                  transform: "translateX(-50%)"
                }}
                initial={{ opacity: 0, scale: 0.92, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 6 }}
              >
                <div className="border-b border-white/10 pb-1.5">
                  <span className="font-bold text-white text-xs block">Month: {timelineData.months[scrubIndex]} Forecast</span>
                </div>
                <div className="space-y-1.5 text-[11px] leading-tight">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Baseline Yield:</span>
                    <span className="text-slate-300 font-bold">{timelineData.baselineYield[scrubIndex]} Qtl/Ac</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">AI-Optimized Yield:</span>
                    <span className="text-emerald-400 font-bold">{timelineData.projectedYield[scrubIndex]} Qtl/Ac</span>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-1 font-bold text-sky-400">
                    <span className="text-slate-400">Soil Health Index:</span>
                    <span>{timelineData.soilHealth[scrubIndex]}%</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ================= 6. FARM HEALTH TELEMETRY MATRIX (CROSS-FILTER HEATMAP) ================= */}
      <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs hover:shadow-md transition-all duration-300 text-left">
        {selectedPlotId === "ALL" ? (
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-100 pb-3 mb-4">
              <div>
                <h3 className="font-extrabold text-gray-900 text-sm flex items-center gap-2">
                  <LayoutGrid className="w-4.5 h-4.5 text-primary" />
                  {t("analytics.plot_health_matrix")}
                </h3>
                <p className="text-[11px] font-semibold text-gray-400 mt-0.5">
                  Interactive plot health tiles. Click any card to filter analytics across the entire dashboard.
                </p>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-bold text-gray-500">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> ≥80% Optimal</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> 60–79% Warning</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500" /> &lt;60% Critical</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {plots.map((plot, i) => {
                const twin = plot.digital_twins?.[0];
                const score = twin ? Number(twin.crop_health_score) : 75;
                const isHovered = hoveredPlotIndex === i;

                let cardBg = "border-rose-150 bg-rose-50/20 hover:bg-rose-50/30";
                let badgeColor = "text-rose-700 bg-rose-50 border-rose-200";
                let statusLabel = t("analytics.critical");

                if (score >= 80) {
                  cardBg = "border-emerald-150 bg-emerald-50/15 hover:bg-emerald-50/25";
                  badgeColor = "text-emerald-800 bg-emerald-50 border-emerald-200";
                  statusLabel = t("analytics.optimal");
                } else if (score >= 60) {
                  cardBg = "border-amber-150 bg-amber-50/15 hover:bg-amber-50/25";
                  badgeColor = "text-amber-800 bg-amber-50 border-amber-200";
                  statusLabel = t("analytics.warning");
                }

                return (
                  <div
                    key={plot.id}
                    onClick={() => setSelectedPlotId(plot.id)}
                    className={`border rounded-2xl p-4.5 text-left transition-all duration-300 transform hover:scale-102 flex flex-col justify-between min-h-[130px] cursor-pointer relative overflow-hidden ${cardBg}`}
                    onMouseEnter={() => setHoveredPlotIndex(i)}
                    onMouseLeave={() => setHoveredPlotIndex(null)}
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold text-gray-400 tracking-wider">{plot.id}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <h4 className="font-extrabold text-gray-900 text-sm mt-2 leading-snug truncate pr-4">{plot.name}</h4>
                    </div>

                    <div className="flex justify-between items-center text-xs font-semibold text-gray-500 border-t border-gray-100/70 pt-2.5 mt-3">
                      <span className="font-bold text-gray-700 text-xs">{plot.crop}</span>
                      <span className="font-black text-gray-900">{score}% Score</span>
                    </div>

                    {/* Pop-out overlay on hover */}
                    <AnimatePresence>
                      {isHovered && (
                        <motion.div
                          className="absolute inset-0 bg-slate-900/95 backdrop-blur-xs p-4 flex flex-col justify-between text-white text-[10px]"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          <div>
                            <span className="text-emerald-400 font-bold text-xs block border-b border-white/10 pb-1">{plot.name}</span>
                            <div className="mt-2 space-y-1 text-slate-300 font-medium">
                              <div>Acreage: <span className="text-white font-bold">{plot.area} ac</span></div>
                              <div>Soil: <span className="text-white font-bold">{plot.soil}</span></div>
                            </div>
                          </div>
                          <span className="text-[9px] text-emerald-400 font-bold">Click to filter dashboard →</span>
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-100 pb-3 mb-4">
              <div>
                <h3 className="font-extrabold text-gray-900 text-sm flex items-center gap-2">
                  <LayoutGrid className="w-4.5 h-4.5 text-primary" />
                  {t("analytics.sub_zone_canopy")}
                </h3>
                <p className="text-[11px] font-semibold text-gray-400 mt-0.5">
                  High-resolution Sentinel-2 NDVI vegetative vigor index grids across plot quadrants
                </p>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-bold text-gray-500">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> &gt;0.72 Vigor</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> 0.55–0.71 Alert</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500" /> &lt;0.55 Deficit</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
              {getSubZones().map((zone, i) => {
                const isHovered = hoveredSubZone === i;
                return (
                  <div
                    key={i}
                    className="bg-gray-50/70 border border-gray-200 rounded-2xl p-4 text-center cursor-pointer transition-all duration-200 transform hover:scale-102 flex flex-col justify-between min-h-[115px] relative overflow-hidden"
                    onMouseEnter={() => setHoveredSubZone(i)}
                    onMouseLeave={() => setHoveredSubZone(null)}
                  >
                    <div>
                      <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">{zone.name}</span>
                      <span className="block text-xl font-black text-gray-900 mt-2">
                        {zone.ndvi}
                      </span>
                    </div>

                    <div className="mt-2.5 flex items-center justify-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${zone.colorClass}`} />
                      <span className="text-[10px] font-bold text-gray-600">{zone.health}</span>
                    </div>

                    {/* Sub-zone detailed overlay on hover */}
                    <AnimatePresence>
                      {isHovered && (
                        <motion.div 
                          className="absolute inset-0 bg-slate-900/95 backdrop-blur-xs p-3.5 flex flex-col justify-between text-white text-[9px] text-left"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          <div>
                            <span className="text-emerald-400 font-bold block border-b border-white/10 pb-0.5 text-[10px]">{zone.name}</span>
                            <div className="mt-1.5 space-y-1 text-slate-300">
                              <div>Vigor Score: <span className="text-white font-bold">{zone.ndvi}</span></div>
                              <div>Condition: <span className="text-white font-bold">{zone.health}</span></div>
                            </div>
                          </div>
                          <span className="text-[8px] text-slate-400">Calibrated via Sentinel-2</span>
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

      {/* ================= 7. AI AGRONOMY INSIGHTS STRIP ================= */}
      <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs hover:shadow-md transition-all duration-300 text-left space-y-4">
        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> 
            AI Agronomy Diagnostic Observations
          </h4>
          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
            Real-time Telemetry
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-emerald-50/40 border border-emerald-150 p-4 rounded-2xl space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              Nutrient Equilibrium
            </div>
            <p className="text-xs text-gray-600 font-medium leading-relaxed">
              Macronutrient ratios for {selectedPlotId === "ALL" ? "all mapped fields" : plots.find(p => p.id === selectedPlotId)?.name} remain within 85% of optimal vegetative uptake thresholds.
            </p>
          </div>

          <div className="bg-sky-50/40 border border-sky-150 p-4 rounded-2xl space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-extrabold text-sky-900">
              <Droplets className="w-4 h-4 text-sky-600 shrink-0" />
              Vascular Hydration Level
            </div>
            <p className="text-xs text-gray-600 font-medium leading-relaxed">
              Soil volumetric water content is balanced at {Math.round(analyticsData.waterDeficit)}% VWC with zero immediate drought stress risks indicated.
            </p>
          </div>

          <div className="bg-indigo-50/40 border border-indigo-150 p-4 rounded-2xl space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-extrabold text-indigo-900">
              <TrendingUp className="w-4 h-4 text-indigo-600 shrink-0" />
              Yield Forecast Trajectory
            </div>
            <p className="text-xs text-gray-600 font-medium leading-relaxed">
              Digital twin models project a +{analyticsData.yieldDelta}% yield improvement under recommended micro-dosing fertilization schedules.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
