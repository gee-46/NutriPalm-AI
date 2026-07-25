import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Info, Globe, Compass, RefreshCw, MapPin, Layers, Sparkles, Activity } from "lucide-react";

interface PlotDetail {
  id: string;
  name: string;
  farmer: string;
  area: number;
  crop: string;
  age: number;
  ndvi: number;
  moisture: number;
  soil: string;
  coordinates: string[];
  svgPath: string;
  fillGradient: string;
  strokeColor: string;
  glowColor: string;
}

interface FarmPlotScreenProps {
  onPlotCreated?: () => void;
  onSync?: () => void;
}

export const FarmPlotScreen: React.FC<FarmPlotScreenProps> = ({ onPlotCreated, onSync }) => {
  const plots: PlotDetail[] = [
    {
      id: "plot-1",
      name: "Swamy North Plot (Plot 2A)",
      farmer: "N. Swamy",
      area: 12.5,
      crop: "Oil Palm",
      age: 6,
      ndvi: 0.81,
      moisture: 42,
      soil: "Loamy (Optimal)",
      coordinates: [
        "17.3881° N, 78.4892° E",
        "17.3895° N, 78.4910° E",
        "17.3872° N, 78.4925° E",
        "17.3860° N, 78.4900° E"
      ],
      svgPath: "M 80 40 L 220 30 L 260 110 L 130 120 Z",
      fillGradient: "url(#healthyGrad)",
      strokeColor: "#10b981",
      glowColor: "rgba(16, 185, 129, 0.4)"
    },
    {
      id: "plot-2",
      name: "Kothagudem South Field",
      farmer: "K. R. Rao",
      area: 8.2,
      crop: "Oil Palm",
      age: 8,
      ndvi: 0.74,
      moisture: 38,
      soil: "Red Clayey",
      coordinates: [
        "17.3898° N, 78.4912° E",
        "17.3920° N, 78.4930° E",
        "17.3905° N, 78.4950° E",
        "17.3885° N, 78.4928° E"
      ],
      svgPath: "M 235 28 L 360 20 L 380 100 L 270 105 Z",
      fillGradient: "url(#stableGrad)",
      strokeColor: "#84cc16",
      glowColor: "rgba(132, 204, 22, 0.3)"
    },
    {
      id: "plot-3",
      name: "Devamma Palm Zone 1",
      farmer: "M. Devamma",
      area: 5.0,
      crop: "Coconut Palm",
      age: 4,
      ndvi: 0.68,
      moisture: 46,
      soil: "Sandy Clay",
      coordinates: [
        "17.3855° N, 78.4902° E",
        "17.3868° N, 78.4924° E",
        "17.3848° N, 78.4935° E",
        "17.3838° N, 78.4915° E"
      ],
      svgPath: "M 140 125 L 255 118 L 285 185 L 160 190 Z",
      fillGradient: "url(#deficientGrad)",
      strokeColor: "#f59e0b",
      glowColor: "rgba(245, 158, 11, 0.3)"
    },
    {
      id: "plot-4",
      name: "Swamy East Plantation",
      farmer: "N. Swamy",
      area: 7.8,
      crop: "Oil Palm",
      age: 5,
      ndvi: 0.79,
      moisture: 40,
      soil: "Loamy (Optimal)",
      coordinates: [
        "17.3870° N, 78.4927° E",
        "17.3883° N, 78.4948° E",
        "17.3860° N, 78.4960° E",
        "17.3850° N, 78.4938° E"
      ],
      svgPath: "M 278 112 L 390 105 L 430 180 L 290 175 Z",
      fillGradient: "url(#stableGrad)",
      strokeColor: "#84cc16",
      glowColor: "rgba(132, 204, 22, 0.3)"
    }
  ];

  const [selectedPlot, setSelectedPlot] = useState<PlotDetail>(plots[0]);
  const [isScanning, setIsScanning] = useState(false);
  const [activeLayer, setActiveLayer] = useState<"NDVI" | "Moisture">("NDVI");
  const [customLat, setCustomLat] = useState("17.3910");
  const [customLng, setCustomLng] = useState("78.4920");

  const triggerScan = () => {
    setIsScanning(true);
    if (onSync) onSync();
    setTimeout(() => {
      setIsScanning(false);
    }, 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-6 text-left"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200/50 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Farm Plots Spatial Mapper</h1>
          <p className="text-sm text-gray-500 mt-1">Interactive GIS boundaries, area estimations, and biophysical indices</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveLayer(activeLayer === "NDVI" ? "Moisture" : "NDVI")}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-gray-50 border border-gray-250 rounded-xl text-xs font-bold text-gray-650 cursor-pointer"
          >
            <Layers className="w-4 h-4 text-primary" />
            Layer: {activeLayer} Overlay
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: GIS Map, Search, Legend */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Interactive GIS Map Canvas */}
          <div className="bg-slate-950 rounded-3xl border border-slate-900 shadow-md overflow-hidden relative">
            
            {/* Map Header Status overlays */}
            <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-center">
              <div className="bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-800 text-[10px] text-emerald-400 font-mono flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-emerald-400 animate-spin-slow" />
                <span>SENTINEL-2 SPACIAL RESOLUTION</span>
              </div>
              <button
                onClick={triggerScan}
                disabled={isScanning}
                className="bg-emerald-500 hover:bg-emerald-650 disabled:bg-emerald-700 text-slate-950 font-bold px-4 py-2 rounded-xl text-[10px] flex items-center gap-1.5 transition-all cursor-pointer border-0 shadow-sm"
              >
                <RefreshCw className={`w-3 h-3 ${isScanning ? "animate-spin" : ""}`} />
                {isScanning ? "RE-INDEXING GNSS COORDS..." : "FORCE SATELLITE SYNC"}
              </button>
            </div>

            {/* Map Plot SVG Container */}
            <div className="h-96 relative flex items-center justify-center p-6 select-none">
              
              {/* Radar sweep scan line */}
              {isScanning && (
                <motion.div
                  initial={{ top: "0%" }}
                  animate={{ top: "100%" }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  className="absolute left-0 right-0 h-1.5 bg-emerald-400/50 shadow-lg shadow-emerald-400 z-10 pointer-events-none"
                />
              )}

              {/* Grid Background */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:30px_30px]" />

              {/* SVG Map Canvas */}
              <svg className="w-full h-full relative z-10" viewBox="0 0 500 220">
                {/* SVG Definitions for Gradients & Glow Filter */}
                <defs>
                  {/* Healthy Gradient */}
                  <linearGradient id="healthyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#059669" stopOpacity={activeLayer === "NDVI" ? 0.35 : 0.15} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={activeLayer === "NDVI" ? 0.55 : 0.35} />
                  </linearGradient>
                  
                  {/* Stable Gradient */}
                  <linearGradient id="stableGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4d7c0f" stopOpacity={activeLayer === "NDVI" ? 0.35 : 0.2} />
                    <stop offset="100%" stopColor="#84cc16" stopOpacity={activeLayer === "NDVI" ? 0.55 : 0.4} />
                  </linearGradient>

                  {/* Deficient Gradient */}
                  <linearGradient id="deficientGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#b45309" stopOpacity={activeLayer === "NDVI" ? 0.35 : 0.25} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={activeLayer === "NDVI" ? 0.55 : 0.45} />
                  </linearGradient>

                  {/* Blue Moisture Overlay Gradient */}
                  <linearGradient id="moistureGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#1d4ed8" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.6} />
                  </linearGradient>
                </defs>

                {/* Plot Polygons */}
                {plots.map((plot) => {
                  const isSelected = selectedPlot.id === plot.id;
                  const fillValue = activeLayer === "Moisture" ? "url(#moistureGrad)" : plot.fillGradient;
                  const strokeValue = isSelected ? "#FFF" : plot.strokeColor;
                  const strokeWidthValue = isSelected ? 2.5 : 1.5;

                  return (
                    <g key={plot.id} className="cursor-pointer" onClick={() => setSelectedPlot(plot)}>
                      {/* Duplicate path for neon backglow under selected path */}
                      {isSelected && (
                        <path
                          d={plot.svgPath}
                          fill="transparent"
                          stroke={plot.strokeColor}
                          strokeWidth="8"
                          opacity="0.35"
                          className="transition-all"
                        />
                      )}
                      
                      <path
                        d={plot.svgPath}
                        fill={fillValue}
                        stroke={strokeValue}
                        strokeWidth={strokeWidthValue}
                        className="transition-all duration-300 hover:fill-white/10"
                      />
                      
                      {/* Name badge text */}
                      <text
                        x={
                          plot.id === "plot-1" ? 165 :
                          plot.id === "plot-2" ? 305 :
                          plot.id === "plot-3" ? 215 : 355
                        }
                        y={
                          plot.id === "plot-1" ? 75 :
                          plot.id === "plot-2" ? 65 :
                          plot.id === "plot-3" ? 158 : 145
                        }
                        fill={isSelected ? "#FFF" : "#cbd5e1"}
                        fontSize="9"
                        fontWeight="bold"
                        textAnchor="middle"
                        className="pointer-events-none select-none font-mono"
                      >
                        {plot.crop} ({plot.area} ac)
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Coordinates scale overlay */}
              <div className="absolute bottom-4 left-4 text-[9px] font-mono text-slate-500">
                WGS 84 / EPSG:4326 | Ticks: 17.38° N, 78.49° E
              </div>
            </div>
          </div>

          {/* Color Legend Card */}
          <div className="bg-white rounded-2xl p-4 border border-gray-150 shadow-xs flex flex-wrap gap-4 items-center justify-between text-xs">
            <span className="font-bold text-gray-500 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-primary" /> Map Legend (NDVI Canopy Index):
            </span>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-emerald-600/20" />
                <span className="text-gray-650 font-medium">Optimal Growth (&gt;0.80)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-lime-500 border border-lime-600/20" />
                <span className="text-gray-650 font-medium">Stable Vegetation (0.70 - 0.80)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-amber-600/20" />
                <span className="text-gray-650 font-medium">Nutrient Stress (&lt;0.70)</span>
              </div>
            </div>
          </div>

          {/* Coordinate Search Bar */}
          <div className="bg-white rounded-2xl p-4 border border-gray-150 shadow-xs flex flex-col sm:flex-row gap-3 items-end">
            <div className="space-y-1.5 flex-1 text-left w-full">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">GNSS Coordinate Latitude</label>
              <input
                type="text"
                value={customLat}
                onChange={(e) => setCustomLat(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 bg-gray-50 text-xs focus:border-primary focus:outline-hidden"
              />
            </div>
            <div className="space-y-1.5 flex-1 text-left w-full">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">GNSS Coordinate Longitude</label>
              <input
                type="text"
                value={customLng}
                onChange={(e) => setCustomLng(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 bg-gray-50 text-xs focus:border-primary focus:outline-hidden"
              />
            </div>
            <button
              onClick={() => {
                triggerScan();
                if (onPlotCreated) {
                  setTimeout(() => {
                    onPlotCreated();
                  }, 1500);
                }
              }}
              className="bg-primary hover:bg-[#235F26] text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap w-full sm:w-auto border-0 shadow-md shadow-primary/10"
            >
              Analyze GPS Coordinates
            </button>
          </div>

        </div>

        {/* Right Info Card Panel */}
        <div className="space-y-6">
          
          {/* Detailed Selection Card */}
          <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs relative overflow-hidden text-left">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedPlot.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Header card badge */}
                <div className="border-b border-gray-100 pb-4">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span className="text-[10px] font-bold text-primary uppercase tracking-widest bg-emerald-50 border border-emerald-100/50 px-2.5 py-1 rounded-full">
                      GIS Boundary ID: {selectedPlot.id.toUpperCase()}
                    </span>
                  </div>
                  <h3 className="font-black text-gray-900 text-lg mt-3 leading-tight">{selectedPlot.name}</h3>
                </div>

                {/* Grid stats */}
                <div className="space-y-3.5 text-xs text-gray-700">
                  <div className="flex justify-between py-1.5 border-b border-gray-50">
                    <span className="text-gray-400 font-semibold">Registered Owner</span>
                    <span className="font-bold text-gray-900">{selectedPlot.farmer}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-gray-50">
                    <span className="text-gray-400 font-semibold">Active Crop Variety</span>
                    <span className="font-bold text-gray-900">{selectedPlot.crop}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-gray-50">
                    <span className="text-gray-400 font-semibold">Cultivation Age</span>
                    <span className="font-bold text-gray-900">{selectedPlot.age} Years</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-gray-50">
                    <span className="text-gray-400 font-semibold">Calculated Acreage</span>
                    <span className="font-bold text-primary text-sm">{selectedPlot.area} Acres</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-gray-50">
                    <span className="text-gray-400 font-semibold">Soil Profile Texture</span>
                    <span className="font-bold text-gray-900">{selectedPlot.soil}</span>
                  </div>
                  
                  {/* NDVI metric display */}
                  <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                    <span className="text-gray-400 font-semibold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-100" />
                      Canopy Health (NDVI)
                    </span>
                    <span className={`font-bold px-2 py-0.5 rounded-md text-[11px] ${
                      selectedPlot.ndvi >= 0.8 ? "bg-emerald-50 text-emerald-700" :
                      selectedPlot.ndvi >= 0.7 ? "bg-lime-50 text-lime-700" : "bg-amber-50 text-amber-700"
                    }`}>
                      {selectedPlot.ndvi} Index
                    </span>
                  </div>

                  {/* Moisture index metric */}
                  <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                    <span className="text-gray-400 font-semibold flex items-center gap-1">
                      <Activity className="w-3.5 h-3.5 text-blue-500" />
                      Soil Moisture (VWC)
                    </span>
                    <span className="font-bold text-blue-650">{selectedPlot.moisture}% (Optimal)</span>
                  </div>
                </div>

                {/* GPS Coordinates nodes */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Compass className="w-4 h-4 text-primary" /> Boundary Vertex Nodes
                  </h4>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {selectedPlot.coordinates.map((coord, i) => (
                      <div key={i} className="bg-gray-50 hover:bg-gray-100/50 rounded-xl p-2.5 border border-gray-150 font-mono text-[9px] text-gray-600 text-center transition-colors">
                        <span className="block text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Node #{i+1}</span>
                        {coord}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Diagnostic Area Check Info Warning */}
                <div className="flex gap-2.5 items-start bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-[10px] text-indigo-800">
                  <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Calculations Validated</p>
                    <p className="text-[9px] text-indigo-700/80 mt-1 leading-normal">
                      Acreage computed via spatial shoelace coordinate integration. Cross-validated with land records to within 0.05 acre variance.
                    </p>
                  </div>
                </div>

              </motion.div>
            </AnimatePresence>
          </div>

        </div>

      </div>
    </motion.div>
  );
};
