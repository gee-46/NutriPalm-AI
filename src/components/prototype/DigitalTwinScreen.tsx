import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Cpu, 
  RefreshCw, 
  AlertTriangle, 
  Droplet, 
  Sun, 
  Wind, 
  Sparkles, 
  Clock, 
  Activity, 
  TrendingUp, 
  Bot, 
  Zap 
} from "lucide-react";

export const DigitalTwinScreen: React.FC = () => {
  const [growthStage, setGrowthStage] = useState(3); // 1: Nursery, 2: Immature, 3: Mature, 4: Peak, 5: Senior
  const [droughtSim, setDroughtSim] = useState(false);
  const [fertilizerSim, setFertilizerSim] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [telemetryPulse, setTelemetryPulse] = useState(true);

  // Toggle periodic telemetry pulse animation
  useEffect(() => {
    const interval = setInterval(() => {
      setTelemetryPulse(prev => !prev);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const triggerSync = () => {
    setIsSyncing(true);
    setTimeout(() => setIsSyncing(false), 1200);
  };

  const lifecycleStages = [
    { num: 1, name: "Nursery", desc: "0-1 yrs" },
    { num: 2, name: "Immature", desc: "1-3 yrs" },
    { num: 3, name: "Mature Producing", desc: "3-8 yrs" },
    { num: 4, name: "Peak Yield", desc: "8-15 yrs" },
    { num: 5, name: "Senior Palm", desc: "15+ yrs" }
  ];

  // Dynamic calculations based on simulation state
  const moisture = droughtSim ? 22 : 44;
  const temp = droughtSim ? "34.8°C" : "31.4°C";
  const humidity = droughtSim ? "52%" : "64%";
  


  let ndvi = 0.81;
  if (droughtSim) ndvi -= 0.12;
  if (fertilizerSim) ndvi += 0.05;
  if (ndvi > 1) ndvi = 1.0;

  const healthScore = Math.round((ndvi * 100) + (moisture * 0.15));
  const healthLabel = healthScore >= 85 ? "Optimal" : healthScore >= 70 ? "Stable" : "Critical Stress";

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-6 text-left"
    >
      {/* Top Console Command Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200/50 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2.5">
            <Cpu className="w-6 h-6 text-primary" />
            Biophysical Digital Twin (Plot 2A)
          </h1>
          <p className="text-sm text-gray-500 mt-1">Live telemetry sync models & environment sandbox diagnostics</p>
        </div>
        
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-mono font-bold border ${
            isSyncing 
              ? "bg-amber-50 text-amber-600 border-amber-100" 
              : "bg-emerald-50 text-primary border-emerald-100/50"
          }`}>
            <span className={`w-2 h-2 rounded-full ${isSyncing ? "bg-amber-500 animate-ping" : "bg-primary"}`} />
            {isSyncing ? "CALIBRATING TELEMETRY..." : "TWIN LIVE SYNCED"}
          </span>
          <button
            onClick={triggerSync}
            disabled={isSyncing}
            className="p-2.5 bg-white hover:bg-gray-50 text-gray-500 hover:text-gray-900 border border-gray-250 rounded-xl transition-all cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Flagship Digital Twin Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Column 1 & 2: Animated HUD Visual & Stepper */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Main Visual Twin Chamber */}
          <div className="bg-slate-950 rounded-3xl border border-slate-900 p-6 shadow-xl relative flex flex-col justify-between overflow-hidden min-h-[440px]">
            {/* Top Info overlays */}
            <div className="flex justify-between items-start z-10">
              <div>
                <p className="text-[10px] font-bold text-emerald-400 font-mono flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  REAL-TIME SIMULATION
                </p>
                <h3 className="text-white font-extrabold text-lg mt-1.5">Vegetation Canopy Model</h3>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-mono text-slate-500 block uppercase">NDVI REFLECTANCE</span>
                <span className="text-white font-black text-sm">{ndvi.toFixed(2)} Index</span>
              </div>
            </div>

            {/* Isometric Plant Model Visual HUD */}
            <div className="my-6 flex justify-center items-center relative h-64">
              
              {/* Radar Scanner Sweep */}
              <motion.div
                animate={{ top: ["10%", "90%", "10%"] }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="absolute left-10 right-10 h-[1.5px] bg-emerald-400/30 shadow-lg shadow-emerald-400/50 z-10 pointer-events-none"
              />

              {/* Grid backdrop */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:25px_25px] opacity-40" />

              <svg className="w-full h-full max-w-xs relative z-10" viewBox="0 0 200 200">
                {/* Horizontal Scan lines */}
                <line x1="10" y1="60" x2="190" y2="60" stroke="rgba(16, 185, 129, 0.08)" strokeDasharray="4 4" />
                <line x1="10" y1="130" x2="190" y2="130" stroke="rgba(16, 185, 129, 0.08)" strokeDasharray="4 4" />

                {/* Telemetry Dotted HUD Lines from plant to text */}
                <motion.g animate={{ opacity: telemetryPulse ? 0.7 : 0.4 }} transition={{ duration: 1 }}>
                  {/* Leaf telemetry callout */}
                  <line x1="50" y1="110" x2="25" y2="90" stroke="#10b981" strokeWidth="1" strokeDasharray="2 2" />
                  <circle cx="25" cy="90" r="2" fill="#10b981" />
                  
                  {/* Root telemetry callout */}
                  <line x1="115" y1="170" x2="145" y2="185" stroke="#10b981" strokeWidth="1" strokeDasharray="2 2" />
                  <circle cx="145" cy="185" r="2" fill="#10b981" />
                </motion.g>

                {/* Roots */}
                <path
                  d={`M 100 150 C 95 165 82 ${162 + growthStage * 6} 82 ${168 + growthStage * 6} 
                     M 100 150 C 105 165 118 ${162 + growthStage * 6} 118 ${168 + growthStage * 6}`}
                  stroke={droughtSim ? "#b45309" : "#7c2d12"}
                  strokeWidth="2.5"
                  fill="none"
                  strokeLinecap="round"
                />

                {/* Trunk */}
                <rect
                  x="96"
                  y={150 - growthStage * 12}
                  width="8"
                  height={growthStage * 12}
                  fill="#5c3a21"
                  rx="1.5"
                />

                <g style={{ transformOrigin: `100px ${150 - growthStage * 12}px` }}>
                  {/* Left leaf */}
                  <path
                    d={`M 100 ${150 - growthStage * 12} C 65 ${138 - growthStage * 14} 35 ${128 - growthStage * 9} 25 ${142 - growthStage * 8}`}
                    fill="none"
                    stroke={droughtSim ? "#a1a1aa" : "#10b981"}
                    strokeWidth={2.5 + growthStage * 0.4}
                    strokeLinecap="round"
                  />
                  {/* Right leaf */}
                  <path
                    d={`M 100 ${150 - growthStage * 12} C 135 ${138 - growthStage * 14} 165 ${128 - growthStage * 9} 175 ${142 - growthStage * 8}`}
                    fill="none"
                    stroke={droughtSim ? "#a1a1aa" : "#10b981"}
                    strokeWidth={2.5 + growthStage * 0.4}
                    strokeLinecap="round"
                  />
                  {/* Center shoot */}
                  <path
                    d={`M 100 ${150 - growthStage * 12} C 95 ${118 - growthStage * 14} 90 ${98 - growthStage * 14} 100 ${78 - growthStage * 14}`}
                    fill="none"
                    stroke={droughtSim ? "#d97706" : "#66bb6a"}
                    strokeWidth={2 + growthStage * 0.3}
                    strokeLinecap="round"
                  />
                </g>

                {/* Satellite Focus Beam */}
                <polygon
                  points="65,60 135,60 100,160"
                  fill="rgba(16, 185, 129, 0.02)"
                  stroke="rgba(16, 185, 129, 0.05)"
                  strokeWidth="1"
                />
              </svg>

              {/* Text HUD Overlays on Map */}
              <div className="absolute top-24 left-4 text-left font-mono text-[9px] text-[#10b981] space-y-0.5 pointer-events-none">
                <span className="block text-slate-500 font-bold">CANOPY VIGOR</span>
                <span>Foliar Chlorophyll: 78.4%</span>
                <span>Stomatal Index: 0.88</span>
              </div>

              <div className="absolute bottom-16 right-4 text-right font-mono text-[9px] text-[#10b981] space-y-0.5 pointer-events-none">
                <span className="block text-slate-500 font-bold">ROOT TELEMETRY</span>
                <span>Water Uptake: {moisture - 4}%</span>
                <span>Soil pH range: 5.8</span>
              </div>
            </div>

            {/* Simulated Stage selection HUD */}
            <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl p-4 border border-slate-800">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Growth Cycle Stepper Control</span>
                <span className="text-xs font-bold text-emerald-400">Current Phase: {lifecycleStages.find(s => s.num === growthStage)?.name}</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                value={growthStage}
                onChange={(e) => setGrowthStage(parseInt(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Plant Lifecycle Stepper Timeline */}
          <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs relative overflow-hidden">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6">Crop Lifecycle Stepper</h4>
            
            <div className="flex justify-between items-center relative">
              {/* Connector line */}
              <div className="absolute left-[30px] right-[30px] top-[14px] h-0.5 bg-gray-100 -z-10" />
              <div 
                className="absolute left-[30px] top-[14px] h-0.5 bg-primary -z-10 transition-all duration-500" 
                style={{ width: `${((growthStage - 1) / 4) * 85}%` }}
              />

              {lifecycleStages.map((stage) => {
                const isCurrent = stage.num === growthStage;
                const isCompleted = stage.num < growthStage;

                return (
                  <div key={stage.num} className="flex flex-col items-center">
                    <button
                      onClick={() => setGrowthStage(stage.num)}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-xs transition-all cursor-pointer ${
                        isCurrent
                          ? "bg-primary border-primary text-white scale-110 shadow-md shadow-primary/25"
                          : isCompleted
                          ? "bg-emerald-50 border-primary text-primary"
                          : "bg-white border-gray-200 text-gray-400"
                      }`}
                    >
                      {stage.num}
                    </button>
                    <span className={`text-[10px] font-bold mt-2 ${isCurrent ? "text-primary" : "text-gray-500"}`}>
                      {stage.name}
                    </span>
                    <span className="text-[8px] text-gray-400 mt-0.5">{stage.desc}</span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Column 3: Telemetry parameters, sandbox, AI predictions */}
        <div className="space-y-6">
          
          {/* Health Score Card */}
          <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Telemetry Vitality</span>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                healthLabel === "Optimal" ? "bg-emerald-50 text-primary border border-emerald-100" :
                healthLabel === "Stable" ? "bg-lime-50 text-lime-700 border border-lime-100" :
                "bg-rose-50 text-rose-700 border border-rose-100 animate-pulse"
              }`}>
                {healthLabel}
              </span>
            </div>

            <div className="flex items-center gap-4">
              {/* Radial Score Gauge */}
              <div className="relative w-20 h-20 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="40" cy="40" r="34" stroke="#F1F5F0" strokeWidth="6" fill="transparent" />
                  <circle cx="40" cy="40" r="34" stroke={droughtSim ? "#EF4444" : "#2E7D32"} strokeWidth="6" fill="transparent"
                    strokeDasharray={2 * Math.PI * 34}
                    strokeDashoffset={2 * Math.PI * 34 * (1 - healthScore / 100)}
                    className="transition-all duration-700"
                  />
                </svg>
                <span className="absolute text-sm font-black text-gray-900">{healthScore}%</span>
              </div>
              <div className="text-xs">
                <h4 className="font-extrabold text-gray-800">Biophysical Health Index</h4>
                <p className="text-[11px] text-gray-400 mt-1 leading-normal">
                  Synthesized from leaf area ratios, chlorophyll reflectance index and root tension.
                </p>
              </div>
            </div>

            {droughtSim && (
              <div className="mt-4 flex gap-2.5 items-start bg-rose-50 border border-rose-100 rounded-2xl p-4 text-[10px] text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Drought Stress Detected</p>
                  <p className="text-rose-700/80 mt-1 leading-normal">
                    Low root moisture tension reduces potassium solubilization. Foliar spray recommended.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Microclimate Telemetry dials */}
          <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left space-y-4">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">Environment Status</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-150 text-left flex flex-col justify-between">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl w-max">
                  <Droplet className="w-4 h-4 fill-blue-50" />
                </div>
                <div className="mt-4">
                  <span className="text-[9px] font-bold text-gray-400 uppercase">Soil Moisture</span>
                  <p className="text-base font-black text-gray-800 mt-0.5">{moisture}% VWC</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-150 text-left flex flex-col justify-between">
                <div className="p-2 bg-amber-50 text-amber-500 rounded-xl w-max">
                  <Sun className="w-4 h-4" />
                </div>
                <div className="mt-4">
                  <span className="text-[9px] font-bold text-gray-400 uppercase">Temperature</span>
                  <p className="text-base font-black text-gray-800 mt-0.5">{temp}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs py-1 border-t border-gray-100 pt-3">
              <span className="text-gray-450 font-semibold flex items-center gap-1">
                <Wind className="w-3.5 h-3.5 text-slate-400" /> Relative Humidity
              </span>
              <span className="font-bold text-gray-800">{humidity}</span>
            </div>
          </div>

          {/* AI Prediction Panel */}
          <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left relative overflow-hidden">
            <span className="absolute top-6 right-6">
              <Bot className="w-4 h-4 text-indigo-500 animate-bounce" />
            </span>
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2 mb-4">
              AI Yield Predictions
            </h4>

            <div className="space-y-3.5 text-xs text-gray-700">
              <div className="flex justify-between">
                <span className="text-gray-400 font-semibold flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" /> Leaf Area Projection
                </span>
                <span className="font-bold text-emerald-600">+14% in 60d</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 font-semibold flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-indigo-500" /> Absorption Ratio
                </span>
                <span className="font-bold text-gray-900">87.5% (Optimal)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 font-semibold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Est Peak Bunch Weight
                </span>
                <span className="font-bold text-primary">24.2 kg / bunch</span>
              </div>
            </div>

            {/* Recommendation Preview link */}
            <div className="mt-5 pt-4 border-t border-gray-100 flex justify-between items-center text-[10px] font-bold bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/50">
              <div className="text-left">
                <span className="text-primary font-bold uppercase tracking-wider block text-[8px]">NPK Mix Advisories</span>
                <span className="text-gray-750 font-semibold block mt-0.5">Mix-B (K-High) recommended</span>
              </div>
              <span className="text-primary hover:text-emerald-700 flex items-center gap-0.5 cursor-pointer">
                Prescription <Clock className="w-3 h-3" />
              </span>
            </div>
          </div>

          {/* Sandbox controls toggles */}
          <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xs text-left space-y-4">
            <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest border-b border-slate-800 pb-2 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" /> Telemetry Sandbox Toggles
            </h4>
            
            <div className="flex justify-between items-center py-0.5">
              <div>
                <p className="text-xs font-bold">Simulate Severe Drought</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Drop soil VWC to 22%</p>
              </div>
              <button
                type="button"
                onClick={() => setDroughtSim(!droughtSim)}
                className={`w-10 h-6 rounded-full p-1 transition-all cursor-pointer border-0 ${
                  droughtSim ? "bg-rose-500 flex justify-end" : "bg-slate-800 flex justify-start"
                }`}
              >
                <span className="w-4 h-4 bg-white rounded-full block shadow-xs" />
              </button>
            </div>

            <div className="flex justify-between items-center py-0.5">
              <div>
                <p className="text-xs font-bold">Custom NPK Fertilizer Boost</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Enrich soil chemical concentration</p>
              </div>
              <button
                type="button"
                onClick={() => setFertilizerSim(!fertilizerSim)}
                className={`w-10 h-6 rounded-full p-1 transition-all cursor-pointer border-0 ${
                  fertilizerSim ? "bg-emerald-500 flex justify-end" : "bg-slate-800 flex justify-start"
                }`}
              >
                <span className="w-4 h-4 bg-white rounded-full block shadow-xs" />
              </button>
            </div>
          </div>

        </div>

      </div>
    </motion.div>
  );
};
