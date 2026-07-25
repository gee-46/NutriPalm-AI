import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  TrendingUp, 
  BarChart3, 
  PieChart, 
  Calendar, 
  Sparkles, 
  ArrowUpRight 
} from "lucide-react";

export const AnalyticsScreen: React.FC = () => {
  const [hoveredLinePoint, setHoveredLinePoint] = useState<number | null>(null);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [hoveredPieSlice, setHoveredPieSlice] = useState<string | null>(null);

  // 1. Soil Health Trends (Jan - Jun)
  const linePoints = [
    { month: "Jan", val: 62, x: 40, y: 110 },
    { month: "Feb", val: 65, x: 100, y: 102 },
    { month: "Mar", val: 72, x: 160, y: 85 },
    { month: "Apr", val: 76, x: 220, y: 75 },
    { month: "May", val: 81, x: 280, y: 62 },
    { month: "Jun", val: 84, x: 340, y: 55 }
  ];

  // 2. Fertilizer Usage (N, P, K volumes)
  const bars = [
    { chemical: "Nitrogen (N)", weight: 480, height: 95, x: 50, color: "from-amber-400 to-amber-500", glow: "rgba(245, 158, 11, 0.4)" },
    { chemical: "Phosphorus (P)", weight: 240, height: 50, x: 150, color: "from-lime-400 to-lime-500", glow: "rgba(132, 204, 22, 0.4)" },
    { chemical: "Potassium (K)", weight: 880, height: 140, x: 250, color: "from-emerald-500 to-emerald-600", glow: "rgba(16, 185, 129, 0.4)" }
  ];

  // 3. Crop Distribution
  const pieSlices = [
    { name: "Oil Palm", percentage: 65, color: "#1B4D22", dashArray: "339.2", dashOffset: "0" },
    { name: "Coconut Palm", percentage: 20, color: "#2E7D32", dashArray: "339.2", dashOffset: "-220.5" },
    { name: "Cocoa", percentage: 10, color: "#66BB6A", dashArray: "339.2", dashOffset: "-288.3" },
    { name: "Coffee", percentage: 5, color: "#A5D6A7", dashArray: "339.2", dashOffset: "-322.2" }
  ];

  // 4. Recommendation History
  const history = [
    { id: "REC-2026-9041", date: "June 12, 2026", farmer: "N. Swamy", health: "81%", prescribed: "Mix-B (K-High)", status: "Applied" },
    { id: "REC-2026-8812", date: "June 08, 2026", farmer: "K. R. Rao", health: "74%", prescribed: "Mix-A (Nitrogen-High)", status: "Applied" },
    { id: "REC-2026-8794", date: "May 28, 2026", farmer: "M. Devamma", health: "68%", prescribed: "Mix-B (K-High)", status: "Applied" },
    { id: "REC-2026-8510", date: "May 15, 2026", farmer: "Rajesh Kumar", health: "76%", prescribed: "Zinc Foliar Spray", status: "Pending" }
  ];

  // SVG Area path generator
  const areaPath = `M ${linePoints[0].x} 150 L ${linePoints.map(p => `${p.x} ${p.y}`).join(" L ")} L ${linePoints[linePoints.length - 1].x} 150 Z`;
  const linePath = `M ${linePoints.map(p => `${p.x} ${p.y}`).join(" L ")}`;

  // Motion stagger configs
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants: any = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6 text-left"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200/50 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Agricultural Analytics & Trends</h1>
          <p className="text-sm text-gray-500 mt-1">Aggregated fertilizer usage, crop yields, and historic recommendation logs</p>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Chart 1: Soil Health Trends (Line Area Chart) */}
        <motion.div variants={itemVariants} className="bg-white rounded-3xl border border-gray-150 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-gray-900 text-sm mb-4 flex items-center gap-1.5">
              <TrendingUp className="w-4.5 h-4.5 text-primary" />
              Soil Health Index Trends
            </h3>
            
            <div className="h-44 relative bg-gray-50/50 border border-gray-150 rounded-2xl p-2 select-none">
              <svg className="w-full h-full" viewBox="0 0 380 160">
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2E7D32" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#2E7D32" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                
                {/* Area Background */}
                <path d={areaPath} fill="url(#areaGrad)" />
                
                {/* Line */}
                <path d={linePath} fill="none" stroke="#2E7D32" strokeWidth="2.5" />
                
                {/* Horizontal grid lines */}
                <line x1="20" y1="150" x2="360" y2="150" stroke="#e2e8f0" strokeWidth="1" />
                <line x1="20" y1="100" x2="360" y2="100" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="20" y1="50" x2="360" y2="50" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 4" />

                {/* Hover line indicator */}
                {hoveredLinePoint !== null && (
                  <line 
                    x1={linePoints[hoveredLinePoint].x} 
                    y1="20" 
                    x2={linePoints[hoveredLinePoint].x} 
                    y2="150" 
                    stroke="rgba(46, 125, 50, 0.4)" 
                    strokeWidth="1.5" 
                    strokeDasharray="2 2"
                  />
                )}

                {/* Data Nodes */}
                {linePoints.map((pt, i) => (
                  <circle
                    key={i}
                    cx={pt.x}
                    cy={pt.y}
                    r={hoveredLinePoint === i ? 6 : 4}
                    fill={hoveredLinePoint === i ? "#2E7D32" : "#FFF"}
                    stroke="#2E7D32"
                    strokeWidth="2.5"
                    className="cursor-pointer transition-all duration-150"
                    onMouseEnter={() => setHoveredLinePoint(i)}
                    onMouseLeave={() => setHoveredLinePoint(null)}
                  />
                ))}

                {/* Labels */}
                {linePoints.map((pt, i) => (
                  <text key={i} x={pt.x} y="158" fill="#94a3b8" fontSize="8" textAnchor="middle" className="font-mono">
                    {pt.month}
                  </text>
                ))}
              </svg>

              {/* Tooltip Overlay */}
              <AnimatePresence>
                {hoveredLinePoint !== null && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute top-2 left-2 bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-[10px] text-white font-mono shadow-md"
                  >
                    <span className="block font-bold text-emerald-400">Avg Soil Index</span>
                    <span className="block mt-0.5">{linePoints[hoveredLinePoint].month}: {linePoints[hoveredLinePoint].val}% Health</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center text-[10px] font-bold text-gray-450 uppercase">
            <span>Soil Recovery Rate</span>
            <span className="text-emerald-700 flex items-center gap-1 font-extrabold">
              <Sparkles className="w-3.5 h-3.5 fill-emerald-50" />
              +22% Gain (6m)
            </span>
          </div>
        </motion.div>

        {/* Chart 2: Fertilizer Usage (Bar Chart) */}
        <motion.div variants={itemVariants} className="bg-white rounded-3xl border border-gray-150 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-gray-900 text-sm mb-4 flex items-center gap-1.5">
              <BarChart3 className="w-4.5 h-4.5 text-primary" />
              Fertilizer Volume Applied (NPK)
            </h3>
            
            <div className="h-44 relative bg-gray-50/50 border border-gray-150 rounded-2xl p-2 select-none">
              <svg className="w-full h-full" viewBox="0 0 350 160">
                {/* Horizontal scale lines */}
                <line x1="20" y1="140" x2="330" y2="140" stroke="#e2e8f0" strokeWidth="1" />
                <line x1="20" y1="90" x2="330" y2="90" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="20" y1="40" x2="330" y2="40" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 4" />

                {/* Bars */}
                {bars.map((bar, i) => {
                  const isHovered = hoveredBar === i;
                  return (
                    <g key={i} className="cursor-pointer">
                      {/* Glow effect */}
                      {isHovered && (
                        <rect
                          x={bar.x - 2}
                          y={140 - bar.height - 2}
                          width="34"
                          height={bar.height + 4}
                          fill={bar.glow}
                          rx="8"
                          className="transition-all"
                        />
                      )}
                      
                      {/* Gradient Bar */}
                      <defs>
                        <linearGradient id={`barGrad-${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={bar.color.split(" ")[0].replace("from-", "")} />
                          <stop offset="100%" stopColor={bar.color.split(" ")[1].replace("to-", "")} />
                        </linearGradient>
                      </defs>
                      <rect
                        x={bar.x}
                        y={140 - bar.height}
                        width="30"
                        height={bar.height}
                        fill={`url(#barGrad-${i})`}
                        rx="6"
                        onMouseEnter={() => setHoveredBar(i)}
                        onMouseLeave={() => setHoveredBar(null)}
                        className="transition-all duration-300"
                      />
                    </g>
                  );
                })}

                {/* Labels */}
                {bars.map((bar, i) => (
                  <text key={i} x={bar.x + 15} y="153" fill="#94a3b8" fontSize="8" textAnchor="middle" className="font-mono">
                    {bar.chemical.split(" ")[0]}
                  </text>
                ))}
              </svg>

              {/* Tooltip Overlay */}
              <AnimatePresence>
                {hoveredBar !== null && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute top-2 left-2 bg-slate-900/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-[10px] text-white font-mono shadow-md"
                  >
                    <span className="block font-bold text-emerald-400">{bars[hoveredBar].chemical}</span>
                    <span className="block mt-0.5">Applied: {bars[hoveredBar].weight} kg</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center text-[10px] font-bold text-gray-450 uppercase">
            <span>Soil Carbon target</span>
            <span className="text-gray-650 font-bold">1,600 kg Total</span>
          </div>
        </motion.div>

        {/* Chart 3: Crop Distribution (Doughnut Chart) */}
        <motion.div variants={itemVariants} className="bg-white rounded-3xl border border-gray-150 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-gray-900 text-sm mb-4 flex items-center gap-1.5">
              <PieChart className="w-4.5 h-4.5 text-primary" />
              Crop Distribution
            </h3>
            
            <div className="h-44 relative flex items-center justify-center bg-gray-50/50 border border-gray-150 rounded-2xl p-2 select-none">
              <svg className="w-40 h-40 transform -rotate-90">
                <circle cx="80" cy="80" r="54" fill="transparent" stroke="#f1f5f9" strokeWidth="12" />
                
                {pieSlices.map((slice, i) => {
                  const isHovered = hoveredPieSlice === slice.name;
                  const strokeWidthValue = isHovered ? 16 : 12;

                  return (
                    <circle
                      key={i}
                      cx="80"
                      cy="80"
                      r="54"
                      fill="transparent"
                      stroke={slice.color}
                      strokeWidth={strokeWidthValue}
                      strokeDasharray={slice.dashArray}
                      strokeDashoffset={slice.dashOffset}
                      className="transition-all duration-300 cursor-pointer"
                      onMouseEnter={() => setHoveredPieSlice(slice.name)}
                      onMouseLeave={() => setHoveredPieSlice(null)}
                    />
                  );
                })}
              </svg>

              {/* Central text overlay */}
              <div className="absolute text-center">
                <span className="text-[9px] font-mono text-slate-400 block uppercase leading-none">
                  {hoveredPieSlice ? "SELECTED CROP" : "TOTAL MAPPED"}
                </span>
                <span className="text-sm font-black text-gray-800 block mt-1 leading-none">
                  {hoveredPieSlice 
                    ? `${hoveredPieSlice} (${pieSlices.find(s => s.name === hoveredPieSlice)?.percentage}%)`
                    : "33.5 Acres"
                  }
                </span>
              </div>
            </div>
          </div>

          {/* Premium Legend Badges */}
          <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-2 text-[9px] font-bold">
            {pieSlices.map((slice, i) => (
              <div key={i} className="flex items-center gap-1 bg-gray-50 border border-gray-200/50 px-2 py-0.5 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: slice.color }} />
                <span className="text-gray-600">{slice.name} ({slice.percentage}%)</span>
              </div>
            ))}
          </div>
        </motion.div>

      </div>

      {/* Row 2: Recommendation History Table */}
      <motion.div variants={itemVariants} className="bg-white rounded-3xl border border-gray-150 overflow-hidden shadow-xs text-left">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-linear-to-r from-white to-gray-50/50">
          <div>
            <h3 className="font-extrabold text-gray-900 text-sm flex items-center gap-2">
              <Calendar className="w-4.5 h-4.5 text-primary" />
              NPK Advisory Generation History
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Telemetry compilation log of chemical diagnostic reports</p>
          </div>
        </div>

        {/* Table layout */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50/75 border-b border-gray-150 text-[10px] font-bold text-gray-450 uppercase tracking-wider">
                <th className="py-3.5 px-6">Recipe ID</th>
                <th className="py-3.5 px-6">Generated Date</th>
                <th className="py-3.5 px-6">Landholder</th>
                <th className="py-3.5 px-6">Avg Soil Index</th>
                <th className="py-3.5 px-6">Prescribed Formulation</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {history.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="py-4 px-6 font-mono text-[10px] font-bold text-gray-900">{row.id}</td>
                  <td className="py-4 px-6 text-gray-450 font-semibold">{row.date}</td>
                  <td className="py-4 px-6 font-bold text-gray-800">{row.farmer}</td>
                  <td className="py-4 px-6 font-mono font-bold text-emerald-700">{row.health}</td>
                  <td className="py-4 px-6">
                    <span className="bg-emerald-50 text-primary border border-emerald-100/50 text-[10px] font-bold px-2.5 py-1 rounded-lg">
                      {row.prescribed}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      row.status === "Applied" 
                        ? "bg-emerald-50 text-primary border border-emerald-100/50" 
                        : "bg-amber-50 text-amber-700 border border-amber-100/50 animate-pulse"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${row.status === "Applied" ? "bg-primary" : "bg-amber-500"}`} />
                      {row.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button className="inline-flex items-center gap-0.5 text-xs font-bold text-primary hover:text-emerald-700 bg-transparent border-0 cursor-pointer">
                      Download Report
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
};
