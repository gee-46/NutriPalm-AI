import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Cpu,
  Sparkles,
  Heart,
  CloudRain,
  Sun,
  Cloud,
  ArrowRight,
  Activity,
  Calendar,
  Layers3,
  Compass,
  ArrowUpRight,
  Bot,
  X,
  FileText
} from "lucide-react";

// Premium Animated Counter Component
const AnimatedCounter: React.FC<{ value: number; suffix?: string; decimals?: number }> = ({ 
  value, 
  suffix = "", 
  decimals = 0 
}) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 1200; // 1.2s duration
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Cubic ease-out
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      const currentValue = easeProgress * value;
      setCount(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(value);
      }
    };

    requestAnimationFrame(animate);
  }, [value]);

  return (
    <span>
      {decimals > 0 ? count.toFixed(decimals) : Math.round(count)}
      {suffix}
    </span>
  );
};

interface DashboardScreenProps {
  stats: {
    totalFarmers: number;
    totalFarms: number;
    activeTwins: number;
    recommendations: number;
    soilHealthScore: number;
  };
  onNavigate: (screen: string) => void;
  onStartDemo?: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ stats, onNavigate, onStartDemo }) => {
  const [isAssistantExpanded, setIsAssistantExpanded] = useState(false);
  
  // Selected plot state for spatial map
  const [selectedPlot, setSelectedPlot] = useState<{
    id: string;
    farmer: string;
    crop: string;
    soilHealth: string;
    recommendation: string;
    lastInspection: string;
    status: "Healthy" | "Moderate" | "Needs Attention" | "Critical";
    statusColor: string;
  } | null>(null);

  const plots = [
    {
      id: "Plot A",
      farmer: "N. Swamy",
      crop: "Oil Palm (Hybrid)",
      soilHealth: "Optimal NPK (88%)",
      recommendation: "Maintain irrigation cycle",
      lastInspection: "2 hours ago",
      status: "Healthy" as const,
      statusColor: "text-emerald-600",
      path: "M 40 30 L 160 20 L 200 95 L 80 105 Z",
      fill: "rgba(46, 125, 50, 0.25)",
      stroke: "#2E7D32"
    },
    {
      id: "Plot B",
      farmer: "S. Gowda",
      crop: "Oil Palm",
      soilHealth: "Moderate Potassium (72%)",
      recommendation: "Apply potash supplement",
      lastInspection: "5 hours ago",
      status: "Moderate" as const,
      statusColor: "text-amber-500",
      path: "M 175 18 L 300 10 L 320 85 L 210 90 Z",
      fill: "rgba(245, 158, 11, 0.22)",
      stroke: "#F59E0B"
    },
    {
      id: "Plot C",
      farmer: "Rajesh Kumar",
      crop: "Oil Palm (Young)",
      soilHealth: "Low Nitrogen (55%)",
      recommendation: "Apply Slow-Release NPK-A",
      lastInspection: "1 day ago",
      status: "Needs Attention" as const,
      statusColor: "text-orange-500",
      path: "M 218 97 L 330 90 L 370 160 L 230 155 Z",
      fill: "rgba(249, 115, 22, 0.22)",
      stroke: "#F97316"
    },
    {
      id: "Plot D",
      farmer: "K. R. Rao",
      crop: "Oil Palm (Mature)",
      soilHealth: "Critical Nitrogen Dip (38%)",
      recommendation: "Immediate emergency NPK dose",
      lastInspection: "2 days ago",
      status: "Critical" as const,
      statusColor: "text-rose-600",
      path: "M 85 110 L 195 103 L 225 170 L 105 175 Z",
      fill: "rgba(225, 29, 72, 0.22)",
      stroke: "#E11D48"
    }
  ];

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

  const weatherForecast = [
    { day: "Today", temp: "32°", icon: <Sun className="w-4 h-4 text-amber-500 fill-amber-100" />, pop: "15%" },
    { day: "Sat", temp: "30°", icon: <Cloud className="w-4 h-4 text-gray-400 fill-gray-100" />, pop: "20%" },
    { day: "Sun", temp: "29°", icon: <CloudRain className="w-4 h-4 text-sky-400 animate-pulse" />, pop: "75%" },
    { day: "Mon", temp: "31°", icon: <Sun className="w-4 h-4 text-amber-500 fill-amber-100" />, pop: "10%" },
    { day: "Tue", temp: "33°", icon: <Sun className="w-4 h-4 text-amber-500 fill-amber-100" />, pop: "5%" }
  ];

  const timelineActivities = [
    { id: 1, time: "09:32", title: "New Farmer Registered", desc: "Rajesh Kumar enrolled with 7.8 acres.", icon: <Users className="w-3.5 h-3.5 text-white" />, color: "bg-emerald-500" },
    { id: 2, time: "09:18", title: "Soil Report Uploaded", desc: "NPK diagnostic scan completed for Plot 3A.", icon: <FileText className="w-3.5 h-3.5 text-white" />, color: "bg-indigo-500" },
    { id: 3, time: "08:54", title: "Digital Twin Updated", desc: "Sentinel-2 canopy indices calibrated.", icon: <Layers3 className="w-3.5 h-3.5 text-white" />, color: "bg-emerald-600" },
    { id: 4, time: "08:40", title: "Recommendation Generated", desc: "Custom NPK slow-release recipe formulated.", icon: <Sparkles className="w-3.5 h-3.5 text-white" />, color: "bg-amber-500" },
    { id: 5, time: "Yesterday", title: "Weather Synced", desc: "Telangana climate cluster telemetry synchronized.", icon: <Sun className="w-3.5 h-3.5 text-white" />, color: "bg-sky-500" },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6 text-left"
    >
      {/* Premium Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200/50 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight leading-none">
            NutriPalm <span className="text-primary font-black">AI</span> Control Center
          </h1>
          <p className="text-sm font-semibold text-gray-500 mt-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary" />
            by Samruddhi Organics • Real-time Agritech Sensor Telemetry Console
          </p>
        </div>
        <div className="flex items-center gap-3">
          {onStartDemo && (
            <button
              onClick={onStartDemo}
              className="bg-indigo-600 hover:bg-indigo-750 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all border-0 shadow-md shadow-indigo-650/10 cursor-pointer animate-pulse shrink-0"
            >
              <Sparkles className="w-4 h-4 fill-indigo-100" />
              Start Guided Demo
            </button>
          )}
          <div className="flex items-center gap-2 text-xs font-bold bg-white border border-gray-250 px-4 py-2.5 rounded-xl shadow-xs text-gray-650">
            <Calendar className="w-4 h-4 text-primary" />
            <span>Telemetry: Online & Synced</span>
          </div>
        </div>
      </div>

      {/* AI Welcome Section (Status Strip) */}
      <motion.div 
        variants={itemVariants} 
        className="bg-emerald-50/40 border border-emerald-500/10 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-semibold text-gray-700"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-extrabold text-gray-900">Good Morning, Dr. L. Ramana</span>
          <span className="text-2xs text-primary bg-primary/10 border border-primary/10 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
            Lead Agronomist
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            4 farms monitored today
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            18 sensors online
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            AI Engine Active
          </span>
          <span className="flex items-center gap-1.5 text-gray-450 font-mono text-[11px]">
            Last Sync: 2 mins ago
          </span>
        </div>
      </motion.div>

      {/* KPI Cards Grid */}
      <motion.div variants={containerVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        {/* KPI 1 */}
        <motion.div 
          variants={itemVariants} 
          title="Last Updated: 2 mins ago"
          className="bg-white rounded-2xl p-5 border border-gray-150 shadow-xs hover:shadow-md hover:border-primary/20 transition-all duration-300 group flex flex-col justify-between"
        >
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-primary/10 text-primary rounded-xl group-hover:scale-110 transition-transform duration-300">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100/50 px-2 py-0.5 rounded-full">+12% MoM</span>
            </div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Registered Farmers</p>
            <p className="text-3xl font-black text-gray-900 mt-1.5 tracking-tight">
              <AnimatedCounter value={stats.totalFarmers} />
            </p>
          </div>
          {/* Sparkline Progress Bar */}
          <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-4 relative">
            <motion.div 
              className="h-full bg-primary" 
              initial={{ width: 0 }}
              animate={{ width: "72%" }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
          </div>
        </motion.div>

        {/* KPI 2 */}
        <motion.div 
          variants={itemVariants} 
          title="Last Updated: 2 mins ago"
          className="bg-white rounded-2xl p-5 border border-gray-150 shadow-xs hover:shadow-md hover:border-primary/20 transition-all duration-300 group flex flex-col justify-between"
        >
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-emerald-50 text-[#2E7D32] rounded-xl group-hover:scale-110 transition-transform duration-300">
                <Layers3 className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100/50 px-2 py-0.5 rounded-full">GIS Active</span>
            </div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Mapped Plots</p>
            <p className="text-3xl font-black text-gray-900 mt-1.5 tracking-tight">
              <AnimatedCounter value={stats.totalFarms} />
            </p>
          </div>
          {/* Sparkline Progress Bar */}
          <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-4 relative">
            <motion.div 
              className="h-full bg-emerald-500" 
              initial={{ width: 0 }}
              animate={{ width: "85%" }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
          </div>
        </motion.div>

        {/* KPI 3 */}
        <motion.div 
          variants={itemVariants} 
          title="Last Updated: 2 mins ago"
          className="bg-white rounded-2xl p-5 border border-gray-150 shadow-xs hover:shadow-md hover:border-primary/20 transition-all duration-300 group flex flex-col justify-between"
        >
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-secondary/10 text-primary rounded-xl group-hover:scale-110 transition-transform duration-300">
                <Cpu className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold text-[#2E7D32] bg-[#A5D6A7]/25 px-2.5 py-0.5 rounded-full border border-emerald-100/50">99.8%</span>
            </div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Digital Twins</p>
            <p className="text-3xl font-black text-gray-900 mt-1.5 tracking-tight">
              <AnimatedCounter value={stats.activeTwins} />
            </p>
          </div>
          {/* Sparkline Progress Bar */}
          <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-4 relative">
            <motion.div 
              className="h-full bg-primary" 
              initial={{ width: 0 }}
              animate={{ width: "92%" }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
          </div>
        </motion.div>

        {/* KPI 4 */}
        <motion.div 
          variants={itemVariants} 
          title="Last Updated: 2 mins ago"
          className="bg-white rounded-2xl p-5 border border-gray-150 shadow-xs hover:shadow-md hover:border-primary/20 transition-all duration-300 group flex flex-col justify-between"
        >
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl group-hover:scale-110 transition-transform duration-300">
                <Sparkles className="w-5 h-5 fill-indigo-50" />
              </div>
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100/50 px-2 py-0.5 rounded-full">AI Advisories</span>
            </div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Advisories Built</p>
            <p className="text-3xl font-black text-gray-900 mt-1.5 tracking-tight">
              <AnimatedCounter value={stats.recommendations} />
            </p>
          </div>
          {/* Sparkline Progress Bar */}
          <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-4 relative">
            <motion.div 
              className="h-full bg-indigo-500" 
              initial={{ width: 0 }}
              animate={{ width: "64%" }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
          </div>
        </motion.div>

        {/* KPI 5: Soil Health Dial */}
        <motion.div 
          variants={itemVariants} 
          title="Last Updated: 2 mins ago"
          className="bg-white rounded-2xl p-5 border border-gray-150 shadow-xs hover:shadow-md hover:border-primary/20 transition-all duration-300 group flex flex-col justify-between"
        >
          <div className="flex justify-between items-start">
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
              <Heart className="w-5 h-5 fill-rose-50" />
            </div>
            
            {/* Glowing Radial Progress ring */}
            <div className="relative w-12 h-12 flex items-center justify-center filter drop-shadow-xs">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="24" cy="24" r="20" stroke="#F1F5F0" strokeWidth="3.5" fill="transparent" />
                <motion.circle 
                  cx="24" 
                  cy="24" 
                  r="20" 
                  stroke="#2E7D32" 
                  strokeWidth="3.5" 
                  fill="transparent"
                  strokeLinecap="round"
                  initial={{ strokeDashoffset: 2 * Math.PI * 20 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 20 * (1 - stats.soilHealthScore / 100) }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  strokeDasharray={2 * Math.PI * 20}
                />
              </svg>
              <span className="absolute text-[10px] font-black text-gray-800">
                <AnimatedCounter value={stats.soilHealthScore} suffix="%" />
              </span>
            </div>
          </div>
          <div className="mt-3">
            <p className="text-[10px] font-bold text-gray-450 uppercase tracking-wider">Avg Soil Index</p>
            <p className="text-sm font-extrabold text-emerald-700 mt-0.5">Optimal Range</p>
          </div>
        </motion.div>
      </motion.div>

      {/* Main Content Sections: Farm Map & Overview + Weather & Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left/Middle Column (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Farm Overview Card & AI Observations side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            
            {/* Farm Overview Profile Card */}
            <motion.div variants={itemVariants} className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left flex flex-col justify-between">
              <div>
                <span className="text-[9px] font-bold text-primary uppercase tracking-widest bg-emerald-50 border border-emerald-100/50 px-2.5 py-1 rounded-full">
                  Plantation Summary
                </span>
                <h3 className="text-base font-extrabold text-gray-900 mt-3 mb-4 font-sans">Farm Overview Profile</h3>
                
                <div className="space-y-2.5 text-xs text-gray-700">
                  <div className="flex justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-450 font-semibold">Total Mapped Land</span>
                    <span className="font-bold text-gray-850">
                      <AnimatedCounter value={33.5} decimals={1} suffix=" Acres" />
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-450 font-semibold">Crop Variety</span>
                    <span className="font-bold text-gray-850">Oil Palm (85%) / Mixed</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-450 font-semibold">IoT Telemetry Nodes</span>
                    <span className="font-bold text-primary">18 Sensors Active</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-450 font-semibold">Irrigation Type</span>
                    <span className="font-bold text-gray-850">Precision Drip (94%)</span>
                  </div>
                </div>

                {/* 3. Farm Health Section */}
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-450 font-semibold">Farm Health Score</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-primary font-bold">84%</span>
                      <span className="text-[10px] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded-md uppercase">Healthy</span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-primary" 
                      initial={{ width: 0 }}
                      animate={{ width: "84%" }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                    />
                  </div>
                </div>

                {/* 3. Crop Growth Stage Section */}
                <div className="mt-4 space-y-2 text-xs">
                  <span className="text-gray-450 font-semibold block">Crop Growth Stage</span>
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-black">
                    <div className="py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-500">
                      Vegetative
                    </div>
                    <div className="py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary">
                      Flowering
                    </div>
                    <div className="py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-500">
                      Fruiting
                    </div>
                  </div>
                </div>

              </div>
              <button 
                onClick={() => onNavigate("Farm Plots")}
                className="mt-6 w-full flex items-center justify-between text-xs font-bold text-primary hover:text-[#235F26] p-2 bg-emerald-50/50 rounded-xl hover:bg-emerald-50 transition-all border-0 cursor-pointer"
              >
                <span>Manage Farm Boundaries</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>

            {/* AI Core Observations Card */}
            <motion.div variants={itemVariants} className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full filter blur-xl pointer-events-none" />
              
              <div>
                <span className="text-[9px] font-bold text-indigo-700 uppercase tracking-widest bg-indigo-50 border border-indigo-100/50 px-2.5 py-1 rounded-full flex items-center gap-1 w-max">
                  <Bot className="w-3.5 h-3.5" />
                  Samruddhi AI core
                </span>
                <h3 className="text-base font-extrabold text-gray-900 mt-3 mb-4">Real-time Observations</h3>
                
                {/* 4. Grouped Observations by Severity */}
                <div className="space-y-3.5 text-xs text-gray-700">
                  {/* Observation 1: Critical */}
                  <div className="p-3 bg-red-50/50 border border-red-100 rounded-2xl flex gap-3 items-start hover:shadow-xs transition-shadow">
                    <div className="w-2 h-2 rounded-full bg-rose-500 mt-1.5 shrink-0 animate-pulse" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-rose-700 text-[9.5px] uppercase tracking-wider">Critical</span>
                        <span className="text-[9px] font-mono text-gray-400">2 mins ago</span>
                      </div>
                      <p className="text-gray-700 leading-normal mt-0.5">
                        Potassium deficiency detected in Plot 2A. LOW NPK index.
                      </p>
                    </div>
                  </div>

                  {/* Observation 2: Attention */}
                  <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-2xl flex gap-3 items-start hover:shadow-xs transition-shadow">
                    <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0 animate-pulse" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-amber-700 text-[9.5px] uppercase tracking-wider">Attention</span>
                        <span className="text-[9px] font-mono text-gray-400">10 mins ago</span>
                      </div>
                      <p className="text-gray-700 leading-normal mt-0.5">
                        Rainfall may reduce irrigation demand tomorrow.
                      </p>
                    </div>
                  </div>

                  {/* Observation 3: Healthy */}
                  <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-2xl flex gap-3 items-start hover:shadow-xs transition-shadow">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-emerald-700 text-[9.5px] uppercase tracking-wider">Healthy</span>
                        <span className="text-[9px] font-mono text-gray-400">1 hour ago</span>
                      </div>
                      <p className="text-gray-700 leading-normal mt-0.5">
                        NDVI canopy index above regional average.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => onNavigate("Recommendations")}
                className="mt-6 w-full flex items-center justify-between text-xs font-bold text-indigo-700 hover:text-indigo-850 p-2 bg-indigo-50/50 rounded-xl hover:bg-indigo-50 transition-all border-0 cursor-pointer"
              >
                <span>Open Advisory Console</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </motion.div>
          </div>

          {/* Map and AI Insights Row */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* GIS Plot Boundary Map Card (7/12 width) */}
            <motion.div variants={itemVariants} className="md:col-span-7 bg-white rounded-3xl border border-gray-150 overflow-hidden shadow-xs relative flex flex-col justify-between">
              <div>
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-white to-gray-50/50">
                  <div>
                    <h3 className="font-extrabold text-gray-900 text-sm flex items-center gap-2">
                      <Compass className="w-4.5 h-4.5 text-primary" />
                      GIS Plot Boundary Overview
                    </h3>
                    <p className="text-[11px] text-gray-450 mt-0.5">Click on plots for detailed diagnostic overlays</p>
                  </div>
                </div>
                
                {/* 6. Map Canvas with clickable popup popovers */}
                <div className="h-64 bg-slate-950 relative overflow-hidden flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:25px_25px] opacity-40" />
                  
                  <svg className="w-full h-full relative z-10 opacity-90" viewBox="0 0 500 200">
                    {plots.map((plot) => (
                      <path
                        key={plot.id}
                        d={plot.path}
                        fill={plot.fill}
                        stroke={plot.stroke}
                        strokeWidth="2"
                        strokeDasharray={plot.id === "Plot A" ? "4 4" : "0"}
                        onClick={() => setSelectedPlot(plot)}
                        className="hover:fill-white/10 hover:stroke-white transition-all cursor-pointer"
                      />
                    ))}
                    
                    {/* Active telemetry pins */}
                    <g transform="translate(130, 70)" className="animate-pulse pointer-events-none">
                      <circle cx="0" cy="0" r="10" fill="rgba(46, 125, 50, 0.4)" />
                      <circle cx="0" cy="0" r="4" fill="#FFF" />
                    </g>
                    <g transform="translate(260, 60)" className="animate-pulse pointer-events-none">
                      <circle cx="0" cy="0" r="10" fill="rgba(245, 158, 11, 0.4)" />
                      <circle cx="0" cy="0" r="4" fill="#FFF" />
                    </g>
                    <g transform="translate(300, 140)" className="animate-pulse pointer-events-none">
                      <circle cx="0" cy="0" r="10" fill="rgba(249, 115, 22, 0.4)" />
                      <circle cx="0" cy="0" r="4" fill="#FFF" />
                    </g>
                  </svg>
                  
                  {/* Selected Plot Popup Overlay */}
                  <AnimatePresence>
                    {selectedPlot && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute inset-x-4 top-4 bg-slate-900/95 backdrop-blur-md p-4 rounded-2xl border border-slate-800 text-xs text-white z-20 shadow-lg text-left"
                      >
                        <div className="flex justify-between items-center border-b border-slate-800/80 pb-2 mb-2">
                          <span className="font-extrabold text-[12px] flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            {selectedPlot.id} Diagnostic HUD
                          </span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPlot(null);
                            }}
                            className="text-gray-400 hover:text-white cursor-pointer border-0 bg-transparent"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-gray-300 text-[11px] font-sans">
                          <p><span className="text-gray-500 font-bold">Farmer:</span> {selectedPlot.farmer}</p>
                          <p><span className="text-gray-500 font-bold">Crop:</span> {selectedPlot.crop}</p>
                          <p><span className="text-gray-500 font-bold">Soil Health:</span> {selectedPlot.soilHealth}</p>
                          <p><span className="text-gray-500 font-bold">Inspection:</span> {selectedPlot.lastInspection}</p>
                          <p className="col-span-2 border-t border-slate-850 pt-1.5 mt-1">
                            <span className="text-primary font-extrabold">AI Recommendation:</span> {selectedPlot.recommendation}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-[9px] font-mono text-emerald-400 shadow-sm">
                    Spatial Coordinates: EPSG:4326 | Zone 44N
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => onNavigate("Farm Plots")}
                className="w-full flex items-center justify-between text-xs font-bold text-primary hover:text-[#235F26] p-4 bg-linear-to-r from-gray-50 to-white hover:bg-gray-100/50 transition-all border-0 border-t border-gray-100 cursor-pointer"
              >
                <span>Launch Interactive Map Viewer</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </motion.div>

            {/* 7. AI Insights Card (5/12 width) */}
            <motion.div variants={itemVariants} className="md:col-span-5 bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left relative overflow-hidden flex flex-col justify-between h-full">
              <div>
                <span className="text-[9px] font-bold text-primary uppercase tracking-widest bg-emerald-50 border border-emerald-100/50 px-2.5 py-1 rounded-full flex items-center gap-1 w-max">
                  <Cpu className="w-3.5 h-3.5" />
                  Ecosystem Analytics
                </span>
                <h3 className="text-base font-extrabold text-gray-900 mt-3 mb-4 font-sans">AI Insights</h3>
                
                <div className="space-y-3.5 text-xs text-gray-700">
                  <div className="flex items-start gap-2.5 p-1.5 hover:bg-emerald-50/30 rounded-xl transition-colors">
                    <span className="text-rose-500 font-bold shrink-0 mt-0.5">⚠️</span>
                    <div>
                      <p className="font-bold">Nitrogen deficiency detected</p>
                      <p className="text-[10px] text-gray-400 mt-0.5 font-semibold">Confidence: 94% • 2 farms flagged</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 p-1.5 hover:bg-emerald-50/30 rounded-xl transition-colors">
                    <span className="text-sky-500 font-bold shrink-0 mt-0.5">🌧️</span>
                    <div>
                      <p className="font-bold">Precipitation expected tomorrow</p>
                      <p className="text-[10px] text-gray-400 mt-0.5 font-semibold">Confidence: 88% • Telangana Cluster</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 p-1.5 hover:bg-emerald-50/30 rounded-xl transition-colors">
                    <span className="text-emerald-500 font-bold shrink-0 mt-0.5">✓</span>
                    <div>
                      <p className="font-bold">Soil moisture levels optimal</p>
                      <p className="text-[10px] text-gray-400 mt-0.5 font-semibold">Confidence: 96% • Eastern clusters</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 p-1.5 hover:bg-emerald-50/30 rounded-xl transition-colors">
                    <span className="text-emerald-500 font-bold shrink-0 mt-0.5">📈</span>
                    <div>
                      <p className="font-bold">Yield projection calibrated +9%</p>
                      <p className="text-[10px] text-gray-400 mt-0.5 font-semibold">Confidence: 91% • Digital Twin forecast</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 p-1.5 hover:bg-emerald-50/30 rounded-xl transition-colors">
                    <span className="text-emerald-500 font-bold shrink-0 mt-0.5">✓</span>
                    <div>
                      <p className="font-bold">No pest outbreaks detected</p>
                      <p className="text-[10px] text-gray-400 mt-0.5 font-semibold">Confidence: 98% • Satellite surveillance</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

          </div>

        </div>

        {/* Right Column (1/3 width) */}
        <div className="space-y-6">
          
          {/* Weather Widget */}
          <motion.div variants={itemVariants} className="bg-gradient-to-tr from-[#1B4D22] to-[#2E7D32] text-white rounded-3xl p-6 shadow-md relative overflow-hidden text-left">
            <div className="absolute top-0 right-0 w-36 h-36 bg-white/5 rounded-full filter blur-2xl pointer-events-none" />
            
            <div className="relative z-10 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-bold text-emerald-250 uppercase tracking-widest">Regional Microclimate</p>
                  <h4 className="text-lg font-extrabold mt-1">Telangana Cluster</h4>
                </div>
                <Sun className="w-10 h-10 text-amber-300 animate-spin-slow" />
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black tracking-tight">32°C</span>
                <span className="text-xs text-emerald-200">Light wind • Sunny</span>
              </div>

              <div className="grid grid-cols-3 gap-2 py-3 border-y border-white/10 text-center text-xs">
                <div>
                  <p className="text-[9px] text-emerald-250 uppercase font-bold tracking-wider">Humid</p>
                  <p className="font-extrabold mt-0.5">62%</p>
                </div>
                <div>
                  <p className="text-[9px] text-emerald-250 uppercase font-bold tracking-wider">Wind</p>
                  <p className="font-extrabold mt-0.5">11 km/h</p>
                </div>
                <div>
                  <p className="text-[9px] text-emerald-250 uppercase font-bold tracking-wider">Rain %</p>
                  <p className="font-extrabold mt-0.5">15%</p>
                </div>
              </div>

              {/* 5. Detailed weather updates grid */}
              <div className="grid grid-cols-2 gap-x-2 gap-y-2 py-1 text-center text-xs text-emerald-100">
                <div className="flex justify-between items-center px-1">
                  <span className="text-emerald-250 text-[9px] font-bold uppercase tracking-wider">UV Index</span>
                  <span className="font-extrabold">2.4</span>
                </div>
                <div className="flex justify-between items-center px-1">
                  <span className="text-emerald-250 text-[9px] font-bold uppercase tracking-wider">Solar Rad</span>
                  <span className="font-extrabold text-[10px]">340 W/m²</span>
                </div>
                <div className="flex justify-between items-center px-1">
                  <span className="text-emerald-250 text-[9px] font-bold uppercase tracking-wider">Evapotrans</span>
                  <span className="font-extrabold text-[10px]">4.8 mm/d</span>
                </div>
                <div className="flex justify-between items-center px-1">
                  <span className="text-emerald-250 text-[9px] font-bold uppercase tracking-wider">Air Press</span>
                  <span className="font-extrabold text-[10px]">1008 hPa</span>
                </div>
                <div className="col-span-2 flex justify-between items-center px-1 pt-1.5 border-t border-white/5">
                  <span className="text-emerald-250 text-[9px] font-bold uppercase tracking-wider">Cloud Coverage</span>
                  <span className="font-extrabold">22%</span>
                </div>
              </div>

              {/* 5-day crop relative forecast */}
              <div className="space-y-2.5 pt-2 border-t border-white/10">
                <p className="text-[9px] font-bold text-emerald-250 uppercase tracking-widest mb-2">5-Day Agricultural Forecast</p>
                {weatherForecast.map((fc, i) => (
                  <div key={i} className="flex justify-between items-center text-xs">
                    <span className="w-16 text-emerald-100 font-semibold">{fc.day}</span>
                    <span className="flex items-center justify-center">{fc.icon}</span>
                    <span className="w-12 text-right font-extrabold">{fc.temp}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* 8. Recent Activity Dotted Timeline */}
          <motion.div variants={itemVariants} className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left">
            <h3 className="font-extrabold text-gray-900 text-sm mb-6 flex items-center gap-1.5">
              <Activity className="w-4.5 h-4.5 text-primary" />
              Recent Activity Timeline
            </h3>
            
            <div className="relative pl-8 border-l border-gray-100 space-y-6">
              {timelineActivities.map((act) => (
                <div key={act.id} className="relative">
                  {/* Timeline Dot with Icon inside */}
                  <span className={`absolute -left-[45px] top-0.5 w-8 h-8 rounded-full border-4 border-white flex items-center justify-center shadow-md ${act.color}`}>
                    {act.icon}
                  </span>
                  
                  <div className="space-y-1 ml-2">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold text-gray-800">{act.title}</h4>
                      <span className="text-[9px] font-mono text-gray-400 bg-gray-50 border border-gray-150 px-1.5 py-0.5 rounded">{act.time}</span>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed">{act.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

        </div>
      </div>

      {/* 9. Floating AI Assistant (Collapsible/Expandable drawer) */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
        <AnimatePresence>
          {isAssistantExpanded ? (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="w-80 md:w-96 bg-white/95 border-2 border-primary/20 rounded-3xl shadow-2xl p-6 backdrop-blur-md mb-3 text-left relative overflow-hidden"
            >
              {/* Green gradient top strip */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary to-secondary" />
              
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-1.5">
                  <Bot className="w-4 h-4" />
                  NutriPalm AI Assistant
                </span>
                <button 
                  onClick={() => setIsAssistantExpanded(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer p-1 rounded-full hover:bg-gray-50 border-0 bg-transparent"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                {/* Today's Insights */}
                <div className="space-y-1.5">
                  <h4 className="font-extrabold text-gray-450 uppercase text-[10px] tracking-wider">Today's Insights</h4>
                  <p className="text-gray-700 leading-normal bg-gray-50 border border-gray-100 p-2.5 rounded-xl font-medium">
                    • 3 farms require potassium/nitrogen calibration.<br />
                    • Vegetation leaf rate up +14.2% in Plot 2A.
                  </p>
                </div>

                {/* Pending Recommendations */}
                <div className="space-y-1.5">
                  <h4 className="font-extrabold text-gray-450 uppercase text-[10px] tracking-wider">Pending Recommendations</h4>
                  <p className="text-gray-700 leading-normal bg-gray-50 border border-gray-100 p-2.5 rounded-xl font-medium">
                    • Formulate potash supplement recipe for Plot B.<br />
                    • Approve Slow-Release NPK-A prescription for Plot C.
                  </p>
                </div>

                {/* Weather Alerts */}
                <div className="space-y-1.5">
                  <h4 className="font-extrabold text-gray-455 uppercase text-[10px] tracking-wider">Weather Alerts</h4>
                  <p className="text-gray-700 leading-normal bg-amber-50/50 border border-amber-100 p-2.5 rounded-xl text-amber-900 font-medium">
                    • Rainfall expected tomorrow. Irrigation cycle can be safely paused to conserve water.
                  </p>
                </div>

                {/* Quick Actions */}
                <div className="space-y-2 pt-1">
                  <h4 className="font-extrabold text-gray-450 uppercase text-[10px] tracking-wider">Quick Actions</h4>
                  <div className="grid grid-cols-2 gap-2 text-center font-bold">
                    <button 
                      onClick={() => {
                        onNavigate("Recommendations");
                        setIsAssistantExpanded(false);
                      }}
                      className="py-2.5 bg-primary hover:bg-[#235F26] text-white rounded-xl text-[10px] transition-colors border-0 cursor-pointer"
                    >
                      AI Advisories
                    </button>
                    <button 
                      onClick={() => {
                        onNavigate("Soil Reports");
                        setIsAssistantExpanded(false);
                      }}
                      className="py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-800 border border-gray-250 rounded-xl text-[10px] transition-colors cursor-pointer"
                    >
                      Soil Scans
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white/95 border-2 border-primary/20 rounded-2xl p-4 shadow-xl backdrop-blur-md flex items-center gap-3.5 cursor-pointer hover:shadow-2xl hover:border-primary/40 hover:-translate-y-0.5 transition-all text-xs"
              onClick={() => setIsAssistantExpanded(true)}
            >
              <div className="p-2 bg-primary text-white rounded-xl animate-pulse">
                <Bot className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="font-black text-gray-950 flex items-center gap-1">
                  🤖 NutriPalm AI
                </p>
                <p className="text-gray-500 font-bold mt-0.5">3 farms require attention today.</p>
                <p className="text-[10px] text-primary font-black mt-1 uppercase tracking-wider flex items-center gap-0.5">
                  View Summary <ArrowRight className="w-3 h-3" />
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </motion.div>
  );
};
