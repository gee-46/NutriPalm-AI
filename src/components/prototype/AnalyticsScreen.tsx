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
  const [lastUpdated] = useState("Just Now");
  const [isExporting, setIsExporting] = useState(false);
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
    { label: "Registered Farmers", val: 142, trend: "+12%", color: "text-emerald-600", bg: "bg-emerald-50", icon: <Users className="w-5 h-5" />, spark: [30, 42, 58, 80, 110, 142] },
    { label: "Active Farm Plots", val: 39, trend: "+8%", color: "text-emerald-600", bg: "bg-emerald-50", icon: <LayoutGrid className="w-5 h-5" />, spark: [12, 18, 22, 28, 35, 39] },
    { label: "AI Recommendations", val: 185, trend: "+24%", color: "text-emerald-600", bg: "bg-emerald-50", icon: <Bot className="w-5 h-5" />, spark: [40, 75, 110, 130, 160, 185] },
    { label: "Average Soil Health", val: 84, suffix: "%", trend: "+4%", color: "text-emerald-650", bg: "bg-emerald-50", icon: <Activity className="w-5 h-5" />, spark: [78, 80, 81, 83, 82, 84] },
    { label: "Yield Improvement", val: 18.2, suffix: "%", trend: "+14%", color: "text-emerald-605", bg: "bg-emerald-50", icon: <TrendingUp className="w-5 h-5" />, spark: [10, 12, 14, 15, 17, 18.2] },
    { label: "Active IoT Sensors", val: 118, trend: "Online", color: "text-emerald-600", bg: "bg-emerald-50", icon: <Cpu className="w-5 h-5" />, spark: [90, 102, 108, 112, 116, 118] }
  ];

  // 2. Crop Distribution Doughnut Chart Data
  const cropSlices = [
    { name: "Oil Palm", pct: 40, color: "#10b981", acres: 15.8 },
    { name: "Rice", pct: 25, color: "#3b82f6", acres: 9.9 },
    { name: "Sugarcane", pct: 20, color: "#f59e0b", acres: 7.9 },
    { name: "Cocoa / Banana", pct: 15, color: "#8b5cf6", acres: 5.9 }
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
    { month: "Jan", count: 24, x: 20, y: 120 },
    { month: "Feb", count: 42, x: 70, y: 100 },
    { month: "Mar", count: 58, x: 120, y: 85 },
    { month: "Apr", count: 76, x: 170, y: 70 },
    { month: "May", count: 98, x: 220, y: 55 },
    { month: "Jun", count: 124, x: 270, y: 35 },
    { month: "Jul", count: 142, x: 320, y: 20 }
  ];
  const farmerGrowthPath = `M ${farmerGrowth.map(p => `${p.x} ${p.y}`).join(" L ")}`;

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
    { text: "AI detected increasing nitrogen deficiency in 3 farms.", score: "94% Conf", time: "10m ago", icon: <AlertTriangle className="w-4.5 h-4.5 text-amber-500" />, severity: "Warning" },
    { text: "Yield expected to improve by 18.2% this harvesting cycle.", score: "96% Conf", time: "2h ago", icon: <TrendingUp className="w-4.5 h-4.5 text-primary" />, severity: "Optimal" },
    { text: "Monsoon precipitation will decrease active irrigation output needs next week.", score: "89% Conf", time: "4h ago", icon: <Droplets className="w-4.5 h-4.5 text-blue-500" />, severity: "Info" },
    { text: "No biological pests or fungal leaf infections detected in Sentinel-2 scan.", score: "98% Conf", time: "1d ago", icon: <CheckCircle className="w-4.5 h-4.5 text-primary" />, severity: "Optimal" },
    { text: "Average farm health index increased by 8.4% across Dakshina district.", score: "95% Conf", time: "2d ago", icon: <Sparkles className="w-4.5 h-4.5 text-primary" />, severity: "Optimal" }
  ];

  // 11. Reports List Table
  const reportsList = [
    { name: "Soil Chemistry Analysis Report", farmer: "Swaminathan Gowda", date: "Jul 25, 2026", status: "Completed", color: "bg-emerald-50 text-primary border-emerald-150" },
    { name: "Quarterly Yield Prediction Forecast", farmer: "K. Ramachandra Rao", date: "Jul 22, 2026", status: "Completed", color: "bg-emerald-50 text-primary border-emerald-150" },
    { name: "NPK Custom Fertilizer Advisor", farmer: "M. Devamma", date: "Jul 20, 2026", status: "Processing", color: "bg-amber-50 text-amber-600 border-amber-150 animate-pulse" },
    { name: "Water Schedule Optimization Grid", farmer: "Rajesh Kumar", date: "Jul 18, 2026", status: "Pending", color: "bg-gray-50 text-gray-500 border-gray-150" }
  ];

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      alert("Executive AgriTech report generated & downloaded.");
    }, 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-6 text-left"
    >
      {/* ================= 1. ANALYTICS OVERVIEW ================= */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200/50 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight leading-none flex items-center gap-2.5">
            <BarChart3 className="w-8 h-8 text-primary" />
            AI Farm Analytics
          </h1>
          <p className="text-sm font-semibold text-gray-500 mt-2">
            Monitor agricultural performance, AI recommendations, and operational insights across all managed farms.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col items-end text-xs font-mono font-bold text-gray-400">
            <span className="flex items-center gap-1 text-primary">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-md" />
              Operational Core online
            </span>
            <span className="text-[10px] text-gray-450 mt-1">Last Updated: {lastUpdated}</span>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2">
            <select
              value={cropFilter}
              onChange={(e) => setCropFilter(e.target.value)}
              className="px-3 py-2 text-xs font-extrabold text-gray-650 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent cursor-pointer transition-all"
            >
              <option value="All Crops">Crop: All</option>
              <option value="Oil Palm">Oil Palm</option>
              <option value="Rice">Rice</option>
              <option value="Sugarcane">Sugarcane</option>
              <option value="Cocoa / Banana">Cocoa / Banana</option>
            </select>

            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 text-xs font-extrabold text-gray-650 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent cursor-pointer transition-all"
            >
              <option value="Last 30 Days">Last 30 Days</option>
              <option value="This Season">This Season</option>
              <option value="Last 6 Months">Last 6 Months</option>
              <option value="This Year">This Year</option>
            </select>
          </div>

          <button
            onClick={handleExport}
            disabled={isExporting}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold rounded-xl shadow-md transition-all text-xs cursor-pointer border-0"
          >
            {isExporting ? <RefreshCwSpinner /> : <Download className="w-4 h-4" />}
            Export Report
          </button>
        </div>
      </div>

      {/* ================= 2. ANALYTICS KPI CARDS ================= */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpiCards.map((card, i) => {
          const isPos = !card.trend.includes("-");
          return (
            <div 
              key={i} 
              className="bg-white border border-gray-150 p-4 rounded-2xl shadow-xs text-left flex flex-col justify-between min-h-[130px] hover:-translate-y-0.5 hover:shadow-md transition-all"
            >
              <div className="flex justify-between items-start">
                <span className={`p-2 rounded-xl text-primary ${card.bg}`}>{card.icon}</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${
                  card.trend === "Online"
                    ? "text-emerald-700 bg-emerald-100/50 border-emerald-200"
                    : isPos
                    ? "text-emerald-600 bg-emerald-50/50 border-emerald-100"
                    : "text-rose-600 bg-rose-50/50 border-rose-100"
                }`}>
                  {card.trend}
                </span>
              </div>
              
              <div className="mt-4">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">{card.label}</span>
                <span className="text-xl font-black text-gray-950 block mt-0.5">
                  <AnimatedCounter value={card.val} suffix={card.suffix} decimals={card.val % 1 !== 0 ? 1 : 0} />
                </span>
              </div>

              {/* Tiny mini-sparkline */}
              <div className="w-full h-3 mt-2">
                <svg className="w-full h-full" viewBox="0 0 100 12">
                  <path
                    d={getSparklinePath(card.spark, 100, 12)}
                    fill="none"
                    stroke={card.trend === "Online" || isPos ? "#16a34a" : "#e11d48"}
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Line Chart: Farmer registration growth (7/12 width) */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-gray-150 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-gray-900 text-sm mb-4 flex items-center gap-1.5">
              <Users className="w-4.5 h-4.5 text-primary" />
              Farmer Registration Growth
            </h3>
            
            <div className="h-44 relative bg-gray-50/50 border border-gray-150 rounded-2xl p-2 select-none">
              <svg className="w-full h-full" viewBox="0 0 350 140">
                <path d={farmerGrowthPath} fill="none" stroke="#2E7D32" strokeWidth="2.5" />
                
                {/* Points */}
                {farmerGrowth.map((pt, i) => (
                  <circle
                    key={i}
                    cx={pt.x}
                    cy={pt.y}
                    r={hoveredFarmerPoint === i ? 6 : 4}
                    fill="#FFF"
                    stroke="#2E7D32"
                    strokeWidth="2"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredFarmerPoint(i)}
                    onMouseLeave={() => setHoveredFarmerPoint(null)}
                  />
                ))}

                {/* X Axis labels */}
                {farmerGrowth.map((pt, i) => (
                  <text key={i} x={pt.x} y="135" fill="#94a3b8" fontSize="8" textAnchor="middle" className="font-mono">
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
                    className="absolute top-2 left-2 bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-[10px] text-white font-mono shadow-md"
                  >
                    <span className="block font-bold text-emerald-400">Total Registered</span>
                    <span className="block mt-0.5">{farmerGrowth[hoveredFarmerPoint].month}: {farmerGrowth[hoveredFarmerPoint].count} Farmers</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Pie Chart: Crop Distribution (5/12 width) */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-gray-150 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-gray-900 text-sm mb-4 flex items-center gap-1.5">
              <PieChart className="w-4.5 h-4.5 text-primary" />
              Crop Distribution
            </h3>
            
            <div className="h-44 relative flex items-center justify-center bg-gray-50/50 border border-gray-150 rounded-2xl p-2 select-none">
              <svg className="w-40 h-40 transform -rotate-90" viewBox="0 0 160 160">
                <circle cx="80" cy="80" r="54" fill="transparent" stroke="#f1f5f9" strokeWidth="12" />
                
                {preparedSlices.map((slice, i) => {
                  const isHovered = hoveredPieIndex === i;
                  return (
                    <circle
                      key={i}
                      cx="80"
                      cy="80"
                      r="54"
                      fill="transparent"
                      stroke={slice.color}
                      strokeWidth={isHovered ? 16 : 12}
                      strokeDasharray={slice.dashArray}
                      strokeDashoffset={slice.dashOffset}
                      className="transition-all duration-300 cursor-pointer"
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
                      className="text-[10px] font-extrabold uppercase tracking-wider block font-bold"
                      style={{ color: preparedSlices[hoveredPieIndex].color }}
                    >
                      {preparedSlices[hoveredPieIndex].name}
                    </span>
                    <span className="text-sm font-black text-gray-900 block mt-1">
                      {preparedSlices[hoveredPieIndex].acres} Acres
                    </span>
                    <span className="text-[10px] font-bold text-gray-500 block">
                      ({preparedSlices[hoveredPieIndex].pct}%)
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[10px] font-mono text-slate-400 block uppercase font-bold tracking-wider">
                      TOTAL AREA
                    </span>
                    <span className="text-base font-black text-gray-900 block mt-1">
                      39.5 Acres
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] font-bold mt-4">
            {preparedSlices.map((s, i) => (
              <div 
                key={i} 
                className={`bg-slate-50 border p-2 rounded-xl text-gray-700 flex items-center gap-2 cursor-pointer transition-all duration-200 ${
                  hoveredPieIndex === i 
                    ? "border-emerald-500 scale-102 bg-emerald-50/20 shadow-xs" 
                    : "border-gray-200/60"
                }`}
                onMouseEnter={() => setHoveredPieIndex(i)}
                onMouseLeave={() => setHoveredPieIndex(null)}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                <div className="flex flex-col text-left">
                  <span className="text-gray-900 font-extrabold leading-tight">{s.name}</span>
                  <span className="text-[9px] text-gray-500 font-medium mt-0.5">{s.acres} Ac ({s.pct}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ================= CHARTS SECTION ROW 2 ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Area Chart: AI Recommendation Trends (7/12 width) */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-gray-150 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-gray-900 text-sm mb-4 flex items-center gap-1.5">
              <Bot className="w-4.5 h-4.5 text-primary" />
              AI Recommendation Trends
            </h3>
            
            <div className="h-44 relative bg-gray-50/50 border border-gray-150 rounded-2xl p-2 select-none">
              <svg className="w-full h-full" viewBox="0 0 350 140">
                <defs>
                  <linearGradient id="areaGenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2E7D32" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#2E7D32" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="areaAccGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2E7D32" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#2E7D32" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path d={recGenPath} fill="url(#areaGenGrad)" />
                <path d={recAccPath} fill="url(#areaAccGrad)" stroke="#1B4D22" strokeWidth="2" />

                {recTrends.map((pt, i) => (
                  <circle
                    key={i}
                    cx={pt.x}
                    cy={140 - pt.acc / 1.5}
                    r={hoveredRecPoint === i ? 5 : 3.5}
                    fill="#FFF"
                    stroke="#1B4D22"
                    strokeWidth="2"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredRecPoint(i)}
                    onMouseLeave={() => setHoveredRecPoint(null)}
                  />
                ))}

                {/* X labels */}
                {recTrends.map((pt, i) => (
                  <text key={i} x={pt.x} y="135" fill="#94a3b8" fontSize="8" textAnchor="middle" className="font-mono">
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
                    className="absolute top-2 left-2 bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-[10px] text-white font-mono shadow-md"
                  >
                    <span className="block font-bold text-emerald-400">{recTrends[hoveredRecPoint].month} Metrics</span>
                    <span className="block mt-0.5">Generated: {recTrends[hoveredRecPoint].gen} | Accepted: {recTrends[hoveredRecPoint].acc}</span>
                    <span className="block text-[9px] text-gray-400">Completed: {recTrends[hoveredRecPoint].comp} | Pending: {recTrends[hoveredRecPoint].pen}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Multi-Line Chart: Soil Health Trends (5/12 width) */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-gray-150 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-gray-900 text-sm mb-4 flex items-center gap-1.5">
              <Activity className="w-4.5 h-4.5 text-primary" />
              Soil Health Trends (12 Months)
            </h3>
            
            <div className="h-44 relative bg-gray-50/50 border border-gray-150 rounded-2xl p-2 select-none">
              <svg className="w-full h-full" viewBox="0 0 300 140">
                {/* Dynamic path lines (N, P, K, pH, Carbon) */}
                <path d={`M 10 ${140 - soilMetrics.nitrogen[0]} L ${soilMonths.map((_, i) => `${10 + i * 25} ${140 - soilMetrics.nitrogen[i]}`).join(" L ")}`} fill="none" stroke="#F59E0B" strokeWidth="1.5" />
                <path d={`M 10 ${140 - soilMetrics.phosphorus[0]} L ${soilMonths.map((_, i) => `${10 + i * 25} ${140 - soilMetrics.phosphorus[i]}`).join(" L ")}`} fill="none" stroke="#84CC16" strokeWidth="1.5" />
                <path d={`M 10 ${140 - soilMetrics.potassium[0]} L ${soilMonths.map((_, i) => `${10 + i * 25} ${140 - soilMetrics.potassium[i]}`).join(" L ")}`} fill="none" stroke="#EF4444" strokeWidth="1.5" />

                {/* X labels */}
                {soilMonths.map((m, i) => (
                  <text key={i} x={10 + i * 25} y="135" fill="#94a3b8" fontSize="8" textAnchor="middle" className="font-mono">
                    {m}
                  </text>
                ))}
              </svg>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5 text-[9px] font-bold mt-2">
            <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">Nitrogen (N)</span>
            <span className="text-lime-600 bg-lime-50 px-2 py-0.5 rounded-md">Phosphorus (P)</span>
            <span className="text-rose-650 bg-rose-50 px-2 py-0.5 rounded-md">Potassium (K)</span>
          </div>
        </div>

      </div>

      {/* ================= CHARTS SECTION ROW 3 ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Bar Chart: Yield Prediction (Jan - Jun) (7/12 width) */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-gray-150 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-gray-900 text-sm mb-4 flex items-center gap-1.5">
              <BarChart3 className="w-4.5 h-4.5 text-primary" />
              Monthly Yield Predictions (Tons/ha)
            </h3>
            
            <div className="h-44 relative bg-gray-50/50 border border-gray-150 rounded-2xl p-2 select-none">
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
                        fill="#A5D6A7"
                        className="transition-all"
                      />
                      {/* Actual Yield Bar */}
                      <rect
                        x={y.x + 16}
                        y={120 - y.act * 20}
                        width="14"
                        height={y.act * 20}
                        fill="#2E7D32"
                        className="transition-all"
                        onMouseEnter={() => setHoveredYieldBar(i)}
                        onMouseLeave={() => setHoveredYieldBar(null)}
                      />
                    </g>
                  );
                })}

                {/* X Labels */}
                {monthlyYield.map((y, i) => (
                  <text key={i} x={y.x + 15} y="133" fill="#94a3b8" fontSize="8" textAnchor="middle" className="font-mono">
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
                    className="absolute top-2 left-2 bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-[10px] text-white font-mono shadow-md"
                  >
                    <span className="block font-bold text-emerald-400">{monthlyYield[hoveredYieldBar].label} Yields</span>
                    <span className="block mt-0.5">Expected: {monthlyYield[hoveredYieldBar].exp} t/ha</span>
                    <span className="block">Actual: {monthlyYield[hoveredYieldBar].act} t/ha</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Area Chart: Water Usage Analytics (5/12 width) */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-gray-150 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-gray-900 text-sm mb-4 flex items-center gap-1.5">
              <Droplets className="w-4.5 h-4.5 text-blue-500" />
              Water Usage Analytics (L/acre)
            </h3>
            
            <div className="h-44 relative bg-gray-50/50 border border-gray-150 rounded-2xl p-2 select-none">
              <svg className="w-full h-full" viewBox="0 0 350 140">
                <path d={waterConsPath} fill="#EFF6FF" opacity="0.4" />
                <path d={waterOptPath} fill="#DBEAFE" stroke="#2563EB" strokeWidth="2" />
                
                {/* Labels */}
                {waterUsage.map((w, i) => (
                  <text key={i} x={w.x} y="135" fill="#94a3b8" fontSize="8" textAnchor="middle" className="font-mono">
                    {w.label}
                  </text>
                ))}
              </svg>
            </div>
          </div>

          <div className="flex justify-between items-center text-[10px] font-bold text-gray-450 uppercase mt-2 pt-2 border-t border-gray-100">
            <span>Optimized savings</span>
            <span className="text-blue-600 font-extrabold">-12.8% Saved</span>
          </div>
        </div>

      </div>

      {/* ================= CHARTS SECTION ROW 4 ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Horizontal Sensor Online Bar Chart (5/12 width) */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left space-y-4">
          <h3 className="font-extrabold text-gray-900 text-sm flex items-center gap-1.5">
            <Cpu className="w-4.5 h-4.5 text-primary" />
            Sensor Online Reliability
          </h3>
          
          <div className="space-y-3.5 text-xs text-gray-700 font-semibold">
            {sensors.map((s, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between font-bold">
                  <span>{s.label}</span>
                  <span className="text-gray-950">{s.pct}% Online</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${s.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Visual Heatmap Farm Health grid (7/12 width) */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left flex flex-col justify-between min-h-[360px]">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3 mb-4">
              <div>
                <h3 className="font-extrabold text-gray-900 text-sm flex items-center gap-1.5">
                  <LayoutGrid className="w-4.5 h-4.5 text-primary" />
                  Farm Health Heatmap Status
                </h3>
                <p className="text-[10px] font-bold text-gray-400 mt-0.5">
                  Real-time health status of 45 plots
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[9px] font-bold text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-500" /> 80%+</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-450 bg-amber-400" /> 60-79%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-rose-500" /> &lt;60%</span>
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
                            <div>Farmer: <span className="text-white font-bold block text-[11px]">{plot.farmer}</span></div>
                            <div>Crop: <span className="text-white font-bold block text-[11px]">{plot.crop}</span></div>
                            <div>Village: <span className="text-white font-bold block text-[11px]">{plot.village}</span></div>
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
          <div className="mt-4 bg-gray-50 border border-gray-150 p-3 rounded-2xl min-h-[60px] flex items-center justify-between text-[11px]">
            {hoveredHeatmapIndex !== null ? (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 w-full font-mono text-gray-500 leading-tight">
                <div>
                  <span className="block text-[8px] text-gray-400 font-bold uppercase">Plot ID</span>
                  <span className="font-extrabold text-gray-900">{heatmapPlots[hoveredHeatmapIndex].id}</span>
                </div>
                <div>
                  <span className="block text-[8px] text-gray-400 font-bold uppercase">Farmer</span>
                  <span className="font-extrabold text-gray-900 truncate block max-w-[100px]">{heatmapPlots[hoveredHeatmapIndex].farmer}</span>
                </div>
                <div>
                  <span className="block text-[8px] text-gray-400 font-bold uppercase">Crop</span>
                  <span className="font-extrabold text-gray-900">{heatmapPlots[hoveredHeatmapIndex].crop}</span>
                </div>
                <div>
                  <span className="block text-[8px] text-gray-400 font-bold uppercase">Village</span>
                  <span className="font-extrabold text-gray-900">{heatmapPlots[hoveredHeatmapIndex].village}</span>
                </div>
                <div>
                  <span className="block text-[8px] text-gray-400 font-bold uppercase">Health</span>
                  <span className={`font-black ${
                    heatmapPlots[hoveredHeatmapIndex].score >= 80 ? "text-emerald-600" :
                    heatmapPlots[hoveredHeatmapIndex].score >= 60 ? "text-amber-600" : "text-rose-650"
                  }`}>
                    {heatmapPlots[hoveredHeatmapIndex].score}%
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-gray-400 font-semibold italic text-center w-full py-1">
                {cropFilter !== "All Crops" 
                  ? `Showing plots for crop: ${cropFilter}. Hover over highlighted plots to inspect.`
                  : "Hover over any plot block to inspect live telemetry and diagnostics."}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ================= 12. AI INSIGHTS PANEL ================= */}
      <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left space-y-5">
        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          <h4 className="text-xs font-black text-indigo-950 uppercase tracking-widest flex items-center gap-1.5">
            <Bot className="w-4.5 h-4.5 text-primary" /> AI Agronomy Insights
          </h4>
          <span className="text-[10px] font-black text-indigo-750 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
            Real-time recommendations
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {aiInsights.map((insight, idx) => (
            <div key={idx} className="bg-gray-50 border border-gray-150 p-3.5 rounded-2xl space-y-2 flex flex-col justify-between text-xs">
              <div className="flex justify-between items-start">
                <span className="p-1.5 bg-white border border-gray-200 rounded-lg">{insight.icon}</span>
                <span className={`text-[8px] font-black px-2 py-0.5 rounded-md ${
                  insight.severity === "Warning" 
                    ? "bg-amber-50 text-amber-600 border border-amber-100" 
                    : "bg-emerald-50 text-primary border border-emerald-100"
                }`}>
                  {insight.severity}
                </span>
              </div>
              
              <p className="text-[11px] text-gray-800 font-extrabold leading-snug">{insight.text}</p>
              
              <div className="flex justify-between text-[9px] text-gray-400 font-bold uppercase pt-2 border-t border-gray-100/50">
                <span>{insight.score}</span>
                <span>{insight.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ================= 11. RECENT REPORTS TABLE ================= */}
      <div className="bg-white rounded-3xl border border-gray-150 overflow-hidden shadow-xs text-left">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h3 className="font-extrabold text-gray-900 text-sm flex items-center gap-1.5">
              <Calendar className="w-4.5 h-4.5 text-primary" />
              Generated Analytical Reports
            </h3>
            <p className="text-[11px] text-gray-450 mt-0.5">Telemetry reports compiled for cooperatives</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50/75 border-b border-gray-150 text-[10px] font-bold text-gray-450 uppercase tracking-wider">
                <th className="py-3.5 px-6">Report Title</th>
                <th className="py-3.5 px-6">Landholder</th>
                <th className="py-3.5 px-6">Compiled Date</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-right pr-6">Download Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {reportsList.map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                  <td className="py-4 px-6 font-bold text-gray-950">{row.name}</td>
                  <td className="py-4 px-6 text-gray-450 font-semibold">{row.farmer}</td>
                  <td className="py-4 px-6 text-gray-450 font-semibold">{row.date}</td>
                  <td className="py-4 px-6">
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${row.color}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right pr-6">
                    <button className="text-primary hover:text-emerald-700 bg-transparent border-0 cursor-pointer font-extrabold inline-flex items-center gap-0.5">
                      Download PDF <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= 13. EXPORT ACTIONS SECTION ================= */}
      <div className="flex flex-wrap gap-3 items-center justify-start bg-gray-50 border border-gray-150 p-4 rounded-3xl text-xs font-bold text-gray-800">
        <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider pl-2 pr-4">Global actions:</span>
        
        <button
          onClick={() => alert("Downloading analytical payload...")}
          className="px-4 py-2.5 bg-white border border-gray-250 hover:bg-gray-100 rounded-xl cursor-pointer inline-flex items-center gap-1.5"
        >
          <Download className="w-4 h-4 text-gray-500" /> Export PDF Report
        </button>

        <button
          onClick={() => alert("Exported database records to CSV.")}
          className="px-4 py-2.5 bg-white border border-gray-250 hover:bg-gray-100 rounded-xl cursor-pointer inline-flex items-center gap-1.5"
        >
          Export CSV Records
        </button>

        <button
          onClick={() => alert("Dashboard share payload copied.")}
          className="px-4 py-2.5 bg-white border border-gray-250 hover:bg-gray-100 rounded-xl cursor-pointer inline-flex items-center gap-1.5"
        >
          <Share2 className="w-4 h-4 text-gray-500" /> Share Dashboard
        </button>

        <button
          onClick={() => window.print()}
          className="px-4 py-2.5 bg-white border border-gray-250 hover:bg-gray-100 rounded-xl cursor-pointer inline-flex items-center gap-1.5"
        >
          <Printer className="w-4 h-4 text-gray-500" /> Print Summary
        </button>
      </div>

    </motion.div>
  );
};

// Reusable spinner component to satisfy TS compile rules
const RefreshCwSpinner: React.FC = () => {
  return <TrendingUp className="w-4 h-4 text-white animate-spin" />;
};
