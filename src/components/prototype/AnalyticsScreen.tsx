import { useTranslation } from "../../translation/useTranslation";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  TrendingUp, BarChart3, PieChart, Calendar, Sparkles, 
  ArrowUpRight, Bot, Activity, Droplets, Users, LayoutGrid, Cpu, 
  Download, Share2, Printer, CheckCircle, AlertTriangle
} from "lucide-react";

// Premium Animated Counter Component
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
      const currentValue = easeProgress * value;
      setCount(currentValue);

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

// Helper for generating smooth Bezier paths for sparklines
const getSparklinePath = (points: number[], width: number, height: number) => {
  if (points.length < 2) return "";
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min === 0 ? 1 : max - min;
  
  const coords = points.map((val, idx) => {
    const x = (idx / (points.length - 1)) * width;
    const y = height - 2 - ((val - min) / range) * (height - 4);
    return { x, y };
  });

  let path = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const cp1x = coords[i].x + (coords[i+1].x - coords[i].x) / 3;
    const cp1y = coords[i].y;
    const cp2x = coords[i].x + 2 * (coords[i+1].x - coords[i].x) / 3;
    const cp2y = coords[i+1].y;
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${coords[i+1].x} ${coords[i+1].y}`;
  }
  return path;
};

// Helper for generating smooth Bezier area filled paths for sparklines
const getSparklineAreaPath = (points: number[], width: number, height: number) => {
  if (points.length < 2) return "";
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min === 0 ? 1 : max - min;
  
  const coords = points.map((val, idx) => {
    const x = (idx / (points.length - 1)) * width;
    const y = height - 2 - ((val - min) / range) * (height - 4);
    return { x, y };
  });

  let path = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const cp1x = coords[i].x + (coords[i+1].x - coords[i].x) / 3;
    const cp1y = coords[i].y;
    const cp2x = coords[i].x + 2 * (coords[i+1].x - coords[i].x) / 3;
    const cp2y = coords[i+1].y;
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${coords[i+1].x} ${coords[i+1].y}`;
  }
  path += ` L ${width} ${height} L 0 ${height} Z`;
  return path;
};

// Helper to generate deterministic heatmap data
const generateHeatmapPlots = () => {
  const farmers = ["Swaminathan Gowda", "K. Ramachandra Rao", "M. Devamma", "Rajesh Kumar", "Anil Mehta", "Siddharth Sen", "Priya Nair"];
  const crops = ["Oil Palm", "Rice", "Sugarcane", "Cocoa / Banana"];
  const villages = ["Kothagudem", "Chittoor", "Hassan", "Dakshina", "Mandya"];
  
  const plots = [];
  let seed = 12345; // Fixed seed for reproducible data
  const random = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  for (let i = 1; i <= 45; i++) {
    const score = Math.floor(random() * 50) + 50; // 50 to 100%
    const farmer = farmers[Math.floor(random() * farmers.length)];
    const crop = crops[Math.floor(random() * crops.length)];
    const village = villages[Math.floor(random() * villages.length)];
    plots.push({
      id: `PL-${i.toString().padStart(3, '0')}`,
      farmer,
      crop,
      village,
      score
    });
  }
  return plots;
};

const heatmapPlots = generateHeatmapPlots();

export const AnalyticsScreen: React.FC = () => {
    const { t } = useTranslation();
  const [lastUpdated] = useState("Just Now");
  const [cropFilter, setCropFilter] = useState("All Crops");
  const [dateFilter, setDateFilter] = useState("Last 30 Days");

  // Hover states for custom SVG graphs
  const [hoveredFarmerPoint, setHoveredFarmerPoint] = useState<number | null>(null);
  const [hoveredRecPoint, setHoveredRecPoint] = useState<number | null>(null);
  const [hoveredYieldBar, setHoveredYieldBar] = useState<number | null>(null);
  const [hoveredPieIndex, setHoveredPieIndex] = useState<number | null>(null);
  const [hoveredHeatmapIndex, setHoveredHeatmapIndex] = useState<number | null>(null);

  // 1. KPI Cards Data
  const kpiCards = [
    { label: t('farmerscreen.registered_farmers'), val: 142, trend: "+12%", color: "text-emerald-600", bg: "bg-emerald-50", icon: <Users className="w-5 h-5" />, spark: [30, 42, 58, 80, 110, 142] },
    { label: t('farmerscreen.active_farms'), val: 39, trend: "+8%", color: "text-emerald-600", bg: "bg-emerald-50", icon: <LayoutGrid className="w-5 h-5" />, spark: [12, 18, 22, 28, 35, 39] },
    { label: t('recommendationscreen.ai_crop_recommendation_engine'), val: 185, trend: "+24%", color: "text-emerald-600", bg: "bg-emerald-50", icon: <Bot className="w-5 h-5" />, spark: [40, 75, 110, 130, 160, 185] },
    { label: t('farmerscreen.average_soil_health'), val: 84, suffix: "%", trend: "+4%", color: "text-emerald-650", bg: "bg-emerald-50", icon: <Activity className="w-5 h-5" />, spark: [78, 80, 81, 83, 82, 84] },
    { label: t('recommendationscreen.yield_increase'), val: 18.2, suffix: "%", trend: "+14%", color: "text-emerald-605", bg: "bg-emerald-50", icon: <TrendingUp className="w-5 h-5" />, spark: [10, 12, 14, 15, 17, 18.2] },
    { label: t('analyticsscreen.active_iot_sensors'), val: 118, trend: t('analyticsscreen.online'), color: "text-emerald-600", bg: "bg-emerald-50", icon: <Cpu className="w-5 h-5" />, spark: [90, 102, 108, 112, 116, 118] }
  ];

  // 2. Crop Distribution Doughnut Chart Data
  const cropSlices = [
    { name: t('analyticsscreen.oil_palm'), pct: 40, color: "#10b981", acres: 15.8 },
    { name: t('analyticsscreen.rice'), pct: 25, color: "#3b82f6", acres: 9.9 },
    { name: t('analyticsscreen.sugarcane'), pct: 20, color: "#f59e0b", acres: 7.9 },
    { name: t('analyticsscreen.cocoa_banana'), pct: 15, color: "#8b5cf6", acres: 5.9 }
  ];

  const radius = 54;
  const circumference = 2 * Math.PI * radius; // ~339.292

  let accumulatedPercent = 0;
  const preparedSlices = cropSlices.map((slice) => {
    const strokeDasharray = `${(slice.pct / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
    accumulatedPercent += slice.pct;
    return {
      ...slice,
      dashArray: strokeDasharray,
      dashOffset: strokeDashoffset.toString()
    };
  });

  // 3. Farmer Registration Growth Line Data
  const farmerGrowth = [
    { month: "Jan", count: 24, x: 30, y: 160 },
    { month: "Feb", count: 42, x: 78, y: 139 },
    { month: "Mar", count: 58, x: 127, y: 120 },
    { month: "Apr", count: 76, x: 175, y: 98 },
    { month: "May", count: 98, x: 223, y: 72 },
    { month: "Jun", count: 124, x: 272, y: 41 },
    { month: "Jul", count: 142, x: 320, y: 20 }
  ];
  
  // Generates a smooth cubic Bezier curve path for the line chart
  const getSmoothPath = (points: { x: number; y: number }[]) => {
    if (points.length < 2) return "";
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const cp1x = points[i].x + (points[i+1].x - points[i].x) / 3;
      const cp1y = points[i].y;
      const cp2x = points[i].x + 2 * (points[i+1].x - points[i].x) / 3;
      const cp2y = points[i+1].y;
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${points[i+1].x} ${points[i+1].y}`;
    }
    return path;
  };
  const farmerGrowthPath = getSmoothPath(farmerGrowth);

  // 4. AI Recommendation Trends Area Data (Generated vs Accepted vs Pending vs Completed)
  const recTrends = [
    { month: "Jan", gen: 20, acc: 15, pen: 3, comp: 12, x: 20 },
    { month: "Feb", gen: 40, acc: 32, pen: 5, comp: 28, x: 70 },
    { month: "Mar", gen: 65, acc: 55, pen: 4, comp: 50, x: 120 },
    { month: "Apr", gen: 95, acc: 80, pen: 10, comp: 72, x: 170 },
    { month: "May", gen: 135, acc: 110, pen: 15, comp: 95, x: 220 },
    { month: "Jun", gen: 160, acc: 140, pen: 12, comp: 128, x: 270 },
    { month: "Jul", gen: 185, acc: 165, pen: 10, comp: 155, x: 320 }
  ];
  const recGenPath = `M ${recTrends[0].x} 140 L ${recTrends.map(p => `${p.x} ${140 - p.gen / 1.5}`).join(" L ")} L ${recTrends[recTrends.length - 1].x} 140 Z`;
  const recAccPath = `M ${recTrends[0].x} 140 L ${recTrends.map(p => `${p.x} ${140 - p.acc / 1.5}`).join(" L ")} L ${recTrends[recTrends.length - 1].x} 140 Z`;

  // 5. Soil Health Trends Multi-Line Chart (12 Months)
  const soilMonths = ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];
  const soilMetrics = {
    nitrogen: [55, 58, 62, 60, 64, 68, 65, 70, 72, 75, 73, 75],
    phosphorus: [40, 42, 45, 48, 52, 50, 53, 56, 58, 60, 62, 68],
    potassium: [30, 32, 35, 40, 42, 48, 50, 52, 55, 58, 57, 57],
    ph: [5.2, 5.3, 5.4, 5.5, 5.5, 5.6, 5.7, 5.8, 5.8, 5.8, 5.8, 5.85],
    carbon: [1.1, 1.2, 1.2, 1.3, 1.3, 1.4, 1.4, 1.45, 1.5, 1.6, 1.7, 1.82]
  };

  // 6. Monthly Yield Prediction Bar Chart (Expected vs Actual vs Improvement)
  const monthlyYield = [
    { label: "Jan", exp: 3.2, act: 3.0, imp: 0.2, x: 20 },
    { label: "Feb", exp: 3.4, act: 3.2, imp: 0.2, x: 70 },
    { label: "Mar", exp: 3.6, act: 3.5, imp: 0.3, x: 120 },
    { label: "Apr", exp: 3.8, act: 3.8, imp: 0.4, x: 170 },
    { label: "May", exp: 4.2, act: 4.1, imp: 0.5, x: 220 },
    { label: "Jun", exp: 4.5, act: 4.5, imp: 0.7, x: 270 }
  ];

  // 7. Water Usage Analytics Area Chart
  const waterUsage = [
    { label: "Mon", consumption: 1800, optimal: 1500, optimized: 1320, x: 20 },
    { label: "Tue", consumption: 1950, optimal: 1500, optimized: 1280, x: 70 },
    { label: "Wed", consumption: 2100, optimal: 1550, optimized: 1350, x: 120 },
    { label: "Thu", consumption: 1850, optimal: 1600, optimized: 1310, x: 170 },
    { label: "Fri", consumption: 1750, optimal: 1500, optimized: 1290, x: 220 },
    { label: "Sat", consumption: 1600, optimal: 1450, optimized: 1200, x: 270 },
    { label: "Sun", consumption: 1550, optimal: 1400, optimized: 1180, x: 320 }
  ];
  const waterConsPath = `M ${waterUsage[0].x} 140 L ${waterUsage.map(p => `${p.x} ${140 - p.consumption / 18}`).join(" L ")} L ${waterUsage[waterUsage.length - 1].x} 140 Z`;
  const waterOptPath = `M ${waterUsage[0].x} 140 L ${waterUsage.map(p => `${p.x} ${140 - p.optimized / 18}`).join(" L ")} L ${waterUsage[waterUsage.length - 1].x} 140 Z`;

  // 8. Horizontal Sensor online percentage
  const sensors = [
    { label: "Temperature", pct: 98, color: "bg-emerald-500" },
    { label: "Humidity", pct: 96, color: "bg-emerald-500" },
    { label: "Soil Moisture", pct: 94, color: "bg-emerald-500" },
    { label: "pH Sensor Grid", pct: 92, color: "bg-emerald-500" },
    { label: "EC Salinity", pct: 90, color: "bg-emerald-500" },
    { label: "Rain Gauge", pct: 100, color: "bg-emerald-500" },
    { label: "Wind Velocity", pct: 95, color: "bg-emerald-500" }
  ];



  // 10. AI Insights List
  const aiInsights = [
    { text: t('analyticsscreen.ai_detected_increasing_nitrogen'), score: "94% Conf", time: "10m ago", icon: <AlertTriangle className="w-4.5 h-4.5 text-amber-500" />, severity: t('analyticsscreen.warning') },
    { text: t('analyticsscreen.yield_expected_to_improve'), score: "96% Conf", time: "2h ago", icon: <TrendingUp className="w-4.5 h-4.5 text-primary" />, severity: t('analyticsscreen.optimal') },
    { text: t('analyticsscreen.monsoon_precipitation_will_decrease'), score: "89% Conf", time: "4h ago", icon: <Droplets className="w-4.5 h-4.5 text-blue-500" />, severity: t('analyticsscreen.info') },
    { text: t('analyticsscreen.no_biological_pests_or'), score: "98% Conf", time: "1d ago", icon: <CheckCircle className="w-4.5 h-4.5 text-primary" />, severity: t('analyticsscreen.optimal') },
    { text: t('analyticsscreen.average_farm_health_index'), score: "95% Conf", time: "2d ago", icon: <Sparkles className="w-4.5 h-4.5 text-primary" />, severity: t('analyticsscreen.optimal') }
  ];

  // 11. Reports List Table
  const reportsList = [
    { name: t('analyticsscreen.soil_chemistry_analysis_report'), farmer: "Swaminathan Gowda", date: "Jul 25, 2026", status: t('analyticsscreen.completed_1'), color: "bg-emerald-50 text-primary border-emerald-150" },
    { name: t('analyticsscreen.quarterly_yield_prediction_forecast'), farmer: "K. Ramachandra Rao", date: "Jul 22, 2026", status: t('analyticsscreen.completed_1'), color: "bg-emerald-50 text-primary border-emerald-150" },
    { name: t('analyticsscreen.npk_custom_fertilizer_advisor'), farmer: "M. Devamma", date: "Jul 20, 2026", status: t('analyticsscreen.processing'), color: "bg-amber-50 text-amber-600 border-amber-150 animate-pulse" },
    { name: t('analyticsscreen.water_schedule_optimization_grid'), farmer: "Rajesh Kumar", date: "Jul 18, 2026", status: t('analyticsscreen.pending_1'), color: "bg-gray-50 text-gray-500 border-gray-150" }
  ];



  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-6 text-left p-6 min-h-screen bg-gradient-to-b from-slate-50 via-emerald-50/10 to-slate-50 rounded-3xl"
    >
      {/* ================= 1. ANALYTICS OVERVIEW ================= */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-none flex items-center gap-2.5">
            <BarChart3 className="w-8 h-8 text-emerald-600" />
            
                                  {t('analyticsscreen.ai_farm_analytics')}
                                </h1>
          <p className="text-sm font-semibold text-slate-500 mt-2">
            
                                  {t('analyticsscreen.monitor_agricultural_performance_ai_reco')}
                                </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-mono font-bold text-emerald-800 leading-none">{t('analyticsscreen.core_online')}</span>
            <span className="text-[9px] font-mono text-emerald-600 border-l border-emerald-250/60 pl-2 leading-none">{t('analyticsscreen.updated')} {lastUpdated}</span>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2">
            <select
              value={cropFilter}
              onChange={(e) => setCropFilter(e.target.value)}
              className="px-3 py-2 text-xs font-extrabold text-slate-600 bg-white border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent cursor-pointer transition-all h-9"
            >
              <option value="All Crops">{t('analyticsscreen.crop_all')}</option>
              <option value="Oil Palm">{t('analyticsscreen.oil_palm')}</option>
              <option value="Rice">{t('analyticsscreen.rice')}</option>
              <option value="Sugarcane">{t('analyticsscreen.sugarcane')}</option>
              <option value="Cocoa / Banana">{t('analyticsscreen.cocoa_banana')}</option>
            </select>

            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 text-xs font-extrabold text-slate-600 bg-white border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent cursor-pointer transition-all h-9"
            >
              <option value="Last 30 Days">{t('analyticsscreen.last_30_days')}</option>
              <option value="This Season">{t('analyticsscreen.this_season')}</option>
              <option value="Last 6 Months">{t('analyticsscreen.last_6_months')}</option>
              <option value="This Year">{t('analyticsscreen.this_year')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* ================= 2. ANALYTICS KPI CARDS ================= */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpiCards.map((card, i) => {
          const isPos = !card.trend.includes("-");
          return (
            <div 
              key={i} 
              className="bg-white/95 border border-slate-200/80 p-4.5 rounded-2xl shadow-xs text-left flex flex-col justify-between min-h-[140px] hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
            >
              <div className="flex justify-between items-start">
                <span className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 shadow-xs flex items-center justify-center">
                  {card.icon}
                </span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${
                  card.trend === "Online"
                    ? "text-emerald-750 bg-emerald-100/50 border-emerald-200"
                    : isPos
                    ? "text-emerald-600 bg-emerald-50/50 border-emerald-100"
                    : "text-rose-600 bg-rose-50/50 border-rose-100"
                }`}>
                  {card.trend}
                </span>
              </div>
              
              <div className="mt-4">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">{card.label}</span>
                <span className="text-2xl font-extrabold text-slate-900 tracking-tight block mt-1">
                  <AnimatedCounter value={card.val} suffix={card.suffix} decimals={card.val % 1 !== 0 ? 1 : 0} />
                </span>
              </div>

              {/* Tiny mini-sparkline with area gradient */}
              <div className="w-full h-4 mt-3">
                <svg className="w-full h-full" viewBox="0 0 100 12">
                  <defs>
                    <linearGradient id={`sparkGrad-${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={card.trend === "Online" || isPos ? "#10b981" : "#ef4444"} stopOpacity="0.2" />
                      <stop offset="100%" stopColor={card.trend === "Online" || isPos ? "#10b981" : "#ef4444"} stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path
                    d={getSparklineAreaPath(card.spark, 100, 12)}
                    fill={`url(#sparkGrad-${i})`}
                  />
                  <path
                    d={getSparklinePath(card.spark, 100, 12)}
                    fill="none"
                    stroke={card.trend === "Online" || isPos ? "#10b981" : "#ef4444"}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          );
        })}
      </div>

      {/* ================= CHARTS SECTION ROW 1 ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        
        {/* Line Chart: Farmer registration growth */}
        <div className="bg-white/95 border border-slate-200/80 p-5 rounded-2xl shadow-xs hover:shadow-md transition-all duration-200 flex flex-col h-full">
          <h3 className="font-extrabold text-slate-800 text-sm mb-4 flex items-center gap-1.5 shrink-0">
            <Users className="w-4.5 h-4.5 text-emerald-600" />
            
                                  {t('analyticsscreen.farmer_registration_growth')}
                                </h3>
          
          <div className="w-full relative bg-slate-50/50 border border-slate-100 rounded-xl p-3 select-none flex-grow flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 350 200">
              {/* Horizontal Grid Lines */}
              <line x1="20" y1="50" x2="330" y2="50" stroke="#e2e8f0" strokeDasharray="3 3" strokeWidth="1" />
              <line x1="20" y1="100" x2="330" y2="100" stroke="#e2e8f0" strokeDasharray="3 3" strokeWidth="1" />
              <line x1="20" y1="150" x2="330" y2="150" stroke="#e2e8f0" strokeDasharray="3 3" strokeWidth="1" />

              <path d={farmerGrowthPath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
              
              {/* Points */}
              {farmerGrowth.map((pt, i) => (
                <circle
                  key={i}
                  cx={pt.x}
                  cy={pt.y}
                  r={hoveredFarmerPoint === i ? 6 : 4}
                  fill="#FFF"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  className="cursor-pointer transition-all duration-150"
                  onMouseEnter={() => setHoveredFarmerPoint(i)}
                  onMouseLeave={() => setHoveredFarmerPoint(null)}
                />
              ))}

              {/* X Axis labels */}
              {farmerGrowth.map((pt, i) => (
                <text key={i} x={pt.x} y="192" fill="#94a3b8" fontSize="8" textAnchor="middle" className="font-mono font-bold">
                  {pt.month}
                </text>
              ))}
            </svg>

            {/* Tooltip Overlay */}
            <AnimatePresence>
              {hoveredFarmerPoint !== null && (
                <motion.div 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="absolute top-2 left-2 bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-[10px] text-white font-mono shadow-md z-10"
                >
                  <span className="block font-bold text-emerald-400">{t('analyticsscreen.total_registered')}</span>
                  <span className="block mt-0.5">{farmerGrowth[hoveredFarmerPoint].month}: {farmerGrowth[hoveredFarmerPoint].count}  {t('analyticsscreen.farmers')}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Pie Chart: Crop Distribution */}
        <div className="bg-white/95 border border-slate-200/80 p-5 rounded-2xl shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between h-full">
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm mb-4 flex items-center gap-1.5">
              <PieChart className="w-4.5 h-4.5 text-emerald-600" />
              
                                        {t('analyticsscreen.crop_distribution')}
                                      </h3>
            
            <div className="w-full min-h-[220px] sm:min-h-[260px] relative flex items-center justify-center bg-slate-50/50 border border-slate-100 rounded-xl p-3 select-none flex-grow">
              <svg className="w-52 h-52 transform -rotate-90" viewBox="0 0 220 220">
                <circle cx="110" cy="110" r="75" fill="transparent" stroke="#e2e8f0" strokeWidth="18" />
                
                {preparedSlices.map((slice, i) => {
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
                      style={{ color: preparedSlices[hoveredPieIndex].color }}
                    >
                      {preparedSlices[hoveredPieIndex].name}
                    </span>
                    <span className="text-base font-black text-slate-900 block mt-1">
                      {preparedSlices[hoveredPieIndex].acres}  {t('analyticsscreen.acres')}
                                                              </span>
                    <span className="text-[10px] font-bold text-slate-550 block">
                      ({preparedSlices[hoveredPieIndex].pct}%)
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-xs font-mono text-slate-400 block uppercase font-bold tracking-wider">
                      
                                                                    {t('analyticsscreen.total_area')}
                                                                  </span>
                    <span className="text-lg font-black text-slate-900 block mt-1">
                      
                                                                    {t('analyticsscreen.39_5_acres')}
                                                                  </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            {preparedSlices.map((s, i) => (
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
                  <span className="text-[10px] text-slate-500 font-semibold mt-0.5">{s.acres}  {t('analyticsscreen.ac')}{s.pct}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ================= CHARTS SECTION ROW 2 ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Area Chart: AI Recommendation Trends (7/12 width) */}
        <div className="lg:col-span-7 bg-white/95 border border-slate-200/80 p-5 rounded-2xl shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm mb-4 flex items-center gap-1.5">
              <Bot className="w-4.5 h-4.5 text-emerald-600" />
              
                                        {t('analyticsscreen.ai_recommendation_trends')}
                                      </h3>
            
            <div className="h-44 relative bg-slate-50/50 border border-slate-100 rounded-xl p-2 select-none">
              <svg className="w-full h-full" viewBox="0 0 350 140">
                <defs>
                  <linearGradient id="areaGenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="areaAccGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path d={recGenPath} fill="url(#areaGenGrad)" />
                <path d={recAccPath} fill="url(#areaAccGrad)" stroke="#10b981" strokeWidth="2.5" />

                {recTrends.map((pt, i) => (
                  <circle
                    key={i}
                    cx={pt.x}
                    cy={140 - pt.acc / 1.5}
                    r={hoveredRecPoint === i ? 5 : 3.5}
                    fill="#FFF"
                    stroke="#10b981"
                    strokeWidth="2.5"
                    className="cursor-pointer transition-all"
                    onMouseEnter={() => setHoveredRecPoint(i)}
                    onMouseLeave={() => setHoveredRecPoint(null)}
                  />
                ))}

                {/* X labels */}
                {recTrends.map((pt, i) => (
                  <text key={i} x={pt.x} y="135" fill="#94a3b8" fontSize="8" textAnchor="middle" className="font-mono font-bold">
                    {pt.month}
                  </text>
                ))}
              </svg>

              {/* Tooltip Overlay */}
              <AnimatePresence>
                {hoveredRecPoint !== null && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute top-2 left-2 bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-[10px] text-white font-mono shadow-md z-10"
                  >
                    <span className="block font-bold text-emerald-400">{recTrends[hoveredRecPoint].month}  {t('analyticsscreen.metrics')}</span>
                    <span className="block mt-0.5">{t('analyticsscreen.generated')} {recTrends[hoveredRecPoint].gen}  {t('analyticsscreen.accepted')} {recTrends[hoveredRecPoint].acc}</span>
                    <span className="block text-[9px] text-gray-400">{t('analyticsscreen.completed')} {recTrends[hoveredRecPoint].comp}  {t('analyticsscreen.pending')} {recTrends[hoveredRecPoint].pen}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Multi-Line Chart: Soil Health Trends (5/12 width) */}
        <div className="lg:col-span-5 bg-white/95 border border-slate-200/80 p-5 rounded-2xl shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm mb-4 flex items-center gap-1.5">
              <Activity className="w-4.5 h-4.5 text-emerald-600" />
              
                                        {t('analyticsscreen.soil_health_trends_12_months')}
                                      </h3>
            
            <div className="h-44 relative bg-slate-50/50 border border-slate-100 rounded-xl p-2 select-none">
              <svg className="w-full h-full" viewBox="0 0 300 140">
                {/* Dynamic path lines (N, P, K, pH, Carbon) */}
                <path d={`M 10 ${140 - soilMetrics.nitrogen[0]} L ${soilMonths.map((_, i) => `${10 + i * 25} ${140 - soilMetrics.nitrogen[i]}`).join(" L ")}`} fill="none" stroke="#f59e0b" strokeWidth="2" />
                <path d={`M 10 ${140 - soilMetrics.phosphorus[0]} L ${soilMonths.map((_, i) => `${10 + i * 25} ${140 - soilMetrics.phosphorus[i]}`).join(" L ")}`} fill="none" stroke="#10b981" strokeWidth="2" />
                <path d={`M 10 ${140 - soilMetrics.potassium[0]} L ${soilMonths.map((_, i) => `${10 + i * 25} ${140 - soilMetrics.potassium[i]}`).join(" L ")}`} fill="none" stroke="#8b5cf6" strokeWidth="2" />

                {/* X labels */}
                {soilMonths.map((m, i) => (
                  <text key={i} x={10 + i * 25} y="135" fill="#94a3b8" fontSize="8" textAnchor="middle" className="font-mono font-bold">
                    {m}
                  </text>
                ))}
              </svg>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-[9px] font-bold mt-2">
            <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">{t('analyticsscreen.nitrogen_n')}</span>
            <span className="text-emerald-700 bg-emerald-55 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">{t('analyticsscreen.phosphorus_p')}</span>
            <span className="text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">{t('analyticsscreen.potassium_k')}</span>
          </div>
        </div>

      </div>

      {/* ================= CHARTS SECTION ROW 3 ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Bar Chart: Yield Prediction (Jan - Jun) (7/12 width) */}
        <div className="lg:col-span-7 bg-white/95 border border-slate-200/80 p-5 rounded-2xl shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm mb-4 flex items-center gap-1.5">
              <BarChart3 className="w-4.5 h-4.5 text-emerald-600" />
              
                                        {t('analyticsscreen.monthly_yield_predictions_tons_ha')}
                                      </h3>
            
            <div className="h-44 relative bg-slate-50/50 border border-slate-100 rounded-xl p-2 select-none">
              <svg className="w-full h-full" viewBox="0 0 350 140">
                {/* Expected vs Actual bars */}
                {monthlyYield.map((y, i) => {
                  return (
                    <g key={i}>
                      {/* Expected Yield Bar */}
                      <rect
                        x={y.x}
                        y={120 - y.exp * 20}
                        width="14"
                        height={y.exp * 20}
                        fill="#a7f3d0"
                        rx="2"
                        className="transition-all"
                      />
                      {/* Actual Yield Bar */}
                      <rect
                        x={y.x + 16}
                        y={120 - y.act * 20}
                        width="14"
                        height={y.act * 20}
                        fill="#10b981"
                        rx="2"
                        className="transition-all cursor-pointer"
                        onMouseEnter={() => setHoveredYieldBar(i)}
                        onMouseLeave={() => setHoveredYieldBar(null)}
                      />
                    </g>
                  );
                })}

                {/* X Labels */}
                {monthlyYield.map((y, i) => (
                  <text key={i} x={y.x + 15} y="133" fill="#94a3b8" fontSize="8" textAnchor="middle" className="font-mono font-bold">
                    {y.label}
                  </text>
                ))}
              </svg>

              {/* Tooltip Overlay */}
              <AnimatePresence>
                {hoveredYieldBar !== null && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute top-2 left-2 bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-[10px] text-white font-mono shadow-md z-10"
                  >
                    <span className="block font-bold text-emerald-400">{monthlyYield[hoveredYieldBar].label}  {t('analyticsscreen.yields')}</span>
                    <span className="block mt-0.5">{t('analyticsscreen.expected')} {monthlyYield[hoveredYieldBar].exp}  {t('analyticsscreen.t_ha')}</span>
                    <span className="block">{t('analyticsscreen.actual')} {monthlyYield[hoveredYieldBar].act}  {t('analyticsscreen.t_ha')}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Area Chart: Water Usage Analytics (5/12 width) */}
        <div className="lg:col-span-5 bg-white/95 border border-slate-200/80 p-5 rounded-2xl shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm mb-4 flex items-center gap-1.5">
              <Droplets className="w-4.5 h-4.5 text-blue-500" />
              
                                        {t('analyticsscreen.water_usage_analytics_l_acre')}
                                      </h3>
            
            <div className="h-44 relative bg-slate-50/50 border border-slate-100 rounded-xl p-2 select-none">
              <svg className="w-full h-full" viewBox="0 0 350 140">
                <path d={waterConsPath} fill="#EFF6FF" opacity="0.4" />
                <path d={waterOptPath} fill="#DBEAFE" stroke="#3b82f6" strokeWidth="2.5" />
                
                {/* Labels */}
                {waterUsage.map((w, i) => (
                  <text key={i} x={w.x} y="135" fill="#94a3b8" fontSize="8" textAnchor="middle" className="font-mono font-bold">
                    {w.label}
                  </text>
                ))}
              </svg>
            </div>
          </div>

          <div className="flex justify-between items-center text-[10px] font-bold text-slate-450 uppercase mt-2 pt-2 border-t border-slate-100">
            <span>{t('analyticsscreen.optimized_savings')}</span>
            <span className="text-blue-600 font-extrabold">{t('analyticsscreen.12_8_saved')}</span>
          </div>
        </div>

      </div>

      {/* ================= CHARTS SECTION ROW 4 ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Horizontal Sensor Online Bar Chart (5/12 width) */}
        <div className="lg:col-span-5 bg-white/95 border border-slate-200/80 p-5 rounded-2xl shadow-xs hover:shadow-md transition-all duration-200 text-left space-y-4">
          <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
            <Cpu className="w-4.5 h-4.5 text-emerald-600" />
            
                                  {t('analyticsscreen.sensor_online_reliability')}
                                </h3>
          
          <div className="space-y-3.5 text-xs text-slate-700 font-semibold">
            {sensors.map((s, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between font-bold">
                  <span>{s.label}</span>
                  <span className="text-slate-950">{s.pct}{t('analyticsscreen.online')}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${s.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Visual Heatmap Farm Health grid (7/12 width) */}
        <div className="lg:col-span-7 bg-white/95 border border-slate-200/80 p-5 rounded-2xl shadow-xs hover:shadow-md transition-all duration-200 text-left flex flex-col justify-between min-h-[360px]">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                  <LayoutGrid className="w-4.5 h-4.5 text-emerald-600" />
                  
                                                    {t('analyticsscreen.farm_health_heatmap_status')}
                                                  </h3>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                  
                                                    {t('analyticsscreen.real_time_health_status_of_45_plots')}
                                                  </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[9px] font-bold text-slate-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-500" /> 80%+</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-400" /> 60-79%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-rose-500" />  {t('analyticsscreen.lt_60')}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-9 xl:grid-cols-11 gap-2 relative">
              {heatmapPlots.map((plot, i) => {

                const isHovered = hoveredHeatmapIndex === i;
                const isDimmed = cropFilter !== "All Crops" && plot.crop !== cropFilter;
                
                let bgColor = "bg-rose-500 hover:bg-rose-600";
                if (plot.score >= 80) {
                  bgColor = "bg-emerald-500 hover:bg-emerald-600";
                } else if (plot.score >= 60) {
                  bgColor = "bg-amber-400 hover:bg-amber-500";
                }
                
                return (
                  <div
                    key={plot.id}
                    onMouseEnter={() => setHoveredHeatmapIndex(i)}
                    onMouseLeave={() => setHoveredHeatmapIndex(null)}
                    className={`relative aspect-square rounded-xl cursor-pointer ${bgColor} ${
                      isDimmed ? "opacity-20 scale-90" : "opacity-100"
                    } transition-all duration-200 transform hover:scale-115 hover:shadow-lg flex items-center justify-center text-white font-mono font-bold text-[9px] select-none hover:z-25`}
                  >
                    {plot.id.replace("PL-", "")}
                    
                    {/* Floating Tooltip */}
                    <AnimatePresence>
                      {isHovered && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9, y: 8 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, y: 8 }}
                          className="absolute bottom-full mb-3 w-48 bg-slate-900/95 backdrop-blur-md border border-slate-800 text-white rounded-xl p-3 text-[10px] space-y-1 shadow-2xl z-50 pointer-events-none text-left"
                        >
                          <div className="flex justify-between items-center border-b border-white/10 pb-1">
                            <span className="font-extrabold text-emerald-400">{plot.id}</span>
                            <span className="font-bold text-white bg-white/15 px-1.5 py-0.5 rounded">{plot.score}%</span>
                          </div>
                          <div className="space-y-1 text-gray-300 font-semibold font-mono leading-tight">
                            <div>{t('analyticsscreen.farmer')} <span className="text-white font-bold block text-[11px]">{plot.farmer}</span></div>
                            <div>{t('analyticsscreen.crop')} <span className="text-white font-bold block text-[11px]">{plot.crop}</span></div>
                            <div>{t('analyticsscreen.village')} <span className="text-white font-bold block text-[11px]">{plot.village}</span></div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dedicated bottom readout bar */}
          <div className="mt-4 bg-slate-50 border border-slate-200 p-3 rounded-2xl min-h-[60px] flex items-center justify-between text-[11px]">
            {hoveredHeatmapIndex !== null ? (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 w-full font-mono text-slate-500 leading-tight">
                <div>
                  <span className="block text-[8px] text-slate-400 font-bold uppercase">{t('analyticsscreen.plot_id')}</span>
                  <span className="font-extrabold text-slate-900">{heatmapPlots[hoveredHeatmapIndex].id}</span>
                </div>
                <div>
                  <span className="block text-[8px] text-slate-400 font-bold uppercase">{t('analyticsscreen.farmer_1')}</span>
                  <span className="font-extrabold text-slate-900 truncate block max-w-[100px]">{heatmapPlots[hoveredHeatmapIndex].farmer}</span>
                </div>
                <div>
                  <span className="block text-[8px] text-slate-400 font-bold uppercase">{t('analyticsscreen.crop_1')}</span>
                  <span className="font-extrabold text-slate-900">{heatmapPlots[hoveredHeatmapIndex].crop}</span>
                </div>
                <div>
                  <span className="block text-[8px] text-slate-400 font-bold uppercase">{t('analyticsscreen.village_1')}</span>
                  <span className="font-extrabold text-slate-900">{heatmapPlots[hoveredHeatmapIndex].village}</span>
                </div>
                <div>
                  <span className="block text-[8px] text-slate-400 font-bold uppercase">{t('analyticsscreen.health')}</span>
                  <span className={`font-black ${
                    heatmapPlots[hoveredHeatmapIndex].score >= 80 ? "text-emerald-600" :
                    heatmapPlots[hoveredHeatmapIndex].score >= 60 ? "text-amber-600" : "text-rose-650"
                  }`}>
                    {heatmapPlots[hoveredHeatmapIndex].score}%
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-slate-400 font-semibold italic text-center w-full py-1">
                {cropFilter !== "All Crops" 
                  ? `Showing plots for crop: ${cropFilter}. Hover over highlighted plots to inspect.`
                  : "Hover over any plot block to inspect live telemetry and diagnostics."}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ================= 12. AI INSIGHTS PANEL ================= */}
      <div className="bg-white/95 border border-slate-200/80 p-5 rounded-2xl shadow-xs hover:shadow-md transition-all duration-200 text-left space-y-5">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <h4 className="text-xs font-black text-indigo-950 uppercase tracking-widest flex items-center gap-1.5">
            <Bot className="w-4.5 h-4.5 text-emerald-600" />  {t('analyticsscreen.ai_agronomy_insights')}
                                </h4>
          <span className="text-[10px] font-black text-emerald-750 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
            
                                  {t('analyticsscreen.real_time_recommendations')}
                                </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {aiInsights.map((insight, idx) => (
            <div key={idx} className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl space-y-2 flex flex-col justify-between text-xs">
              <div className="flex justify-between items-start">
                <span className="p-1.5 bg-white border border-slate-200 rounded-lg">{insight.icon}</span>
                <span className={`text-[8px] font-black px-2 py-0.5 rounded-md ${
                  insight.severity === "Warning" 
                    ? "bg-amber-50 text-amber-600 border border-amber-100" 
                    : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                }`}>
                  {insight.severity}
                </span>
              </div>
              
              <p className="text-[11px] text-slate-800 font-extrabold leading-snug">{insight.text}</p>
              
              <div className="flex justify-between text-[9px] text-slate-450 font-bold uppercase pt-2 border-t border-slate-100/50">
                <span>{insight.score}</span>
                <span>{insight.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ================= 11. RECENT REPORTS TABLE ================= */}
      <div className="bg-white/95 border border-slate-200/80 overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 rounded-2xl text-left">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
              <Calendar className="w-4.5 h-4.5 text-emerald-600" />
              
                                        {t('analyticsscreen.generated_analytical_reports')}
                                      </h3>
            <p className="text-[11px] text-slate-450 mt-0.5">{t('analyticsscreen.telemetry_reports_compiled_for_cooperati')}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-[10px] font-bold text-slate-450 uppercase tracking-wider">
                <th className="py-3.5 px-6">{t('analyticsscreen.report_title')}</th>
                <th className="py-3.5 px-6">{t('analyticsscreen.landholder')}</th>
                <th className="py-3.5 px-6">{t('analyticsscreen.compiled_date')}</th>
                <th className="py-3.5 px-6">{t('analyticsscreen.status')}</th>
                <th className="py-3.5 px-6 text-right pr-6">{t('analyticsscreen.download_link')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {reportsList.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-6 font-bold text-slate-950">{row.name}</td>
                  <td className="py-4 px-6 text-slate-450 font-semibold">{row.farmer}</td>
                  <td className="py-4 px-6 text-slate-450 font-semibold">{row.date}</td>
                  <td className="py-4 px-6">
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${row.color}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right pr-6">
                    <button className="text-emerald-700 hover:text-emerald-800 bg-transparent border-0 cursor-pointer font-extrabold inline-flex items-center gap-0.5">
                      
                                                    {t('analyticsscreen.download_pdf')} <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= 13. EXPORT ACTIONS SECTION ================= */}
      <div className="flex flex-wrap gap-3 items-center justify-start bg-slate-50 border border-slate-200 p-4 rounded-2xl text-xs font-bold text-slate-800">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider pl-2 pr-4">{t('analyticsscreen.global_actions')}</span>
        
        <button
          onClick={() => alert('analyticsscreen.downloading_analytical_payload')}
          className="px-4 py-2.5 bg-white border border-slate-250 hover:bg-slate-55 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl cursor-pointer inline-flex items-center gap-1.5"
        >
          <Download className="w-4 h-4 text-slate-500" />  {t('analyticsscreen.export_pdf_report')}
                          </button>

        <button
          onClick={() => alert('analyticsscreen.exported_database_records_to')}
          className="px-4 py-2.5 bg-white border border-slate-250 hover:bg-slate-55 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl cursor-pointer inline-flex items-center gap-1.5"
        >
          
                            {t('analyticsscreen.export_csv_records')}
                          </button>

        <button
          onClick={() => alert('analyticsscreen.dashboard_share_payload_copied')}
          className="px-4 py-2.5 bg-white border border-slate-250 hover:bg-slate-55 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl cursor-pointer inline-flex items-center gap-1.5"
        >
          <Share2 className="w-4 h-4 text-slate-500" />  {t('analyticsscreen.share_dashboard')}
                          </button>

        <button
          onClick={() => window.print()}
          className="px-4 py-2.5 bg-white border border-slate-250 hover:bg-slate-55 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl cursor-pointer inline-flex items-center gap-1.5"
        >
          <Printer className="w-4 h-4 text-slate-500" />  {t('analyticsscreen.print_summary')}
                          </button>
      </div>

    </motion.div>
  );
};


