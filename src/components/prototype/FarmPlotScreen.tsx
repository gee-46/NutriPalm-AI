import { useTranslation } from "../../translation/useTranslation";
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Globe, RefreshCw, MapPin, Layers, Sparkles, Activity, 
  Plus, Download, X, CheckCircle2, ChevronRight, Wind, Sun, 
  Thermometer, Droplets, FileText, Cpu, FlaskConical
} from "lucide-react";
import { usePlots, type Plot, getStatusColor, getStatusDotColor } from "../../data/plots";
import LeafletMapPicker, { type BoundaryData } from "./LeafletMapPicker";
import { reverseGeocode, getElevation, parseGeoJSONFile, type GeoJSONPolygon } from "../../lib/geo";
import { boundaryToSvgPath, coordinateToSvgPoint, generatePlaceholderSvgPath } from "../../lib/svgPath";


// Premium Animated Counter Component
export const AnimatedCounter: React.FC<{ value: number; suffix?: string; decimals?: number }> = ({ 
  value, 
  suffix = "", 
  decimals = 0 
}) => {
  const [count, setCount] = useState(0);
  const startValueRef = useRef(0);

  useEffect(() => {
    const duration = 1200;
    const startTime = performance.now();
    const startValue = startValueRef.current;
    const diff = value - startValue;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentValue = startValue + (easeProgress * diff);
      setCount(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(value);
        startValueRef.current = value;
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

interface FarmPlotScreenProps {
  onPlotCreated?: () => void;
  onSync?: () => void;
  onNavigate?: (screen: string) => void;
  showToast?: (message: string, type?: "success" | "info" | "warning") => void;
}

export const FarmPlotScreen: React.FC<FarmPlotScreenProps> = ({ 
  onPlotCreated, 
  onSync,
  onNavigate,
  showToast
}) => {
    const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [activeLayer, setActiveLayer] = useState<"NDVI" | "Moisture" | "Boundary">("NDVI");
  const [viewMode, setViewMode] = useState<"Satellite" | "Terrain">("Satellite");
  const [zoomLevel, setZoomLevel] = useState(100);
  
  // Selected plot state
  const [selectedPlotId, setSelectedPlotId] = useState("plot-1");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addStep, setAddStep] = useState(1);

  // New Plot form data
  const [newPlotData, setNewPlotData] = useState({
    name: "",
    farmer: "Swaminathan Gowda",
    area: "",
    crop: "Oil Palm",
    coordinates: "17.3912 N, 78.4948 E",
    soilType: "Loamy",
    irrigation: "Precision Drip",
    // Phase 5 additions
    plantingDate: "",  // optional — ISO date string
    plantCount: "",    // optional — number of plants
  });

  // Phase 2 wizard state — real boundary + geocoding
  const [wizardBoundary, setWizardBoundary] = useState<BoundaryData | null>(null);
  const [wizardAreaUnit, setWizardAreaUnit] = useState<"acres" | "hectares">("acres");
  const [isGeocodingStep3, setIsGeocodingStep3] = useState(false);
  const [step3Data, setStep3Data] = useState<{
    areaAcres: number;
    village: string;
    taluk: string;     // Phase 4 addition
    district: string;
    state: string;     // Phase 4 addition
    country: string;   // Phase 4 addition
    elevation: number;
    geocodeOk: boolean;
  } | null>(null);
  const [importedGeoJSON, setImportedGeoJSON] = useState<GeoJSONPolygon | undefined>(undefined);
  const geoJSONFileInputRef = useRef<HTMLInputElement>(null);

  // ── Shared store ─────────────────────────────────────────────────────────
  const { plots, isLoading: isDbLoading, addPlot: storAddPlot } = usePlots();

  const selectedPlot = plots.find((p) => p.id === selectedPlotId) || plots[0];

  const triggerToast = (msg: string, type: "success" | "info" | "warning" = "success") => {
    if (showToast) {
      showToast(msg, type);
    } else {
      alert(`${type.toUpperCase()}: ${msg}`);
    }
  };

  // Register triggerToast with the plots store so store-level errors (fetch/insert failures)
  // surface as toasts rather than staying silent in the console.
  React.useEffect(() => {
    import("../../data/plots").then(({ registerToastFn }) => registerToastFn(triggerToast));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerScan = () => {
    setIsScanning(true);
    if (onSync) onSync();
    setTimeout(() => {
      setIsScanning(false);
      triggerToast("Satellite diagnostics and vertex nodes verified.", "success");
    }, 1500);
  };

  const handleRefreshMap = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      triggerToast("GIS satellite imagery layers refreshed.", "success");
    }, 800);
  };

  const handleAddPlotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlotData.name) {
      triggerToast("Validation Failed: Please fill Plot Name.", "warning");
      return;
    }
    if (!wizardBoundary && !newPlotData.area) {
      triggerToast("Validation Failed: Please draw a boundary or enter an area.", "warning");
      return;
    }

    const areaAcres = wizardBoundary
      ? wizardBoundary.areaAcres
      : parseFloat(newPlotData.area as string) || 0;

    // Kick off geocoding + elevation while going to step 3
    setAddStep(3);
    setIsGeocodingStep3(true);

    let village = "";
    let taluk = "";
    let district = "";
    let state = "";
    let country = "";
    let elevation = 0;
    let geocodeOk = true;

    if (wizardBoundary?.centroid) {
      const { lat, lng } = wizardBoundary.centroid;
      try {
        const [geoResult, elevResult] = await Promise.allSettled([
          reverseGeocode(lat, lng),
          getElevation(lat, lng),
        ]);
        if (geoResult.status === "fulfilled") {
          village = geoResult.value.village;
          taluk = geoResult.value.taluk;         // Phase 4 addition
          district = geoResult.value.district;
          state = geoResult.value.state;         // Phase 4 addition
          country = geoResult.value.country;     // Phase 4 addition
        } else {
          geocodeOk = false;
        }
        if (elevResult.status === "fulfilled") {
          elevation = elevResult.value;
        }
      } catch {
        geocodeOk = false;
      }
    }

    if (!geocodeOk) {
      triggerToast("Location data unavailable — plot saved with blank fields, editable later.", "info");
    }

    setStep3Data({ areaAcres, village, taluk, district, state, country, elevation, geocodeOk });
    setIsGeocodingStep3(false);

    // Persist to shared store
    const status: Plot["status"] = "Healthy";
    const coordStrings = wizardBoundary
      ? (wizardBoundary.geoJSON.coordinates[0] as number[][]).map(
          ([lng, lat]) => `${Math.abs(lat).toFixed(4)} ${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(4)} ${lng >= 0 ? "E" : "W"}`
        )
      : [newPlotData.coordinates];

    // Derive plantation_age from plantingDate (Phase 5)
    let plantationAge = 0;
    if (newPlotData.plantingDate) {
      const msPerYear = 365.25 * 24 * 3600 * 1000;
      plantationAge = Math.max(0, Math.round((Date.now() - new Date(newPlotData.plantingDate).getTime()) / msPerYear));
    }

    await storAddPlot({
      name: newPlotData.name,
      farmer: newPlotData.farmer,
      crop: newPlotData.crop,
      stage: "Seedling",
      age: plantationAge,
      plantingDate: newPlotData.plantingDate || undefined,
      plantCount: newPlotData.plantCount ? parseInt(newPlotData.plantCount, 10) : undefined,
      area: areaAcres,
      elevation: elevation || undefined,
      village: village || undefined,
      taluk: taluk || undefined,
      district: district || undefined,
      state: state || undefined,
      country: country || undefined,
      coordinates: coordStrings,
      geoJSON: wizardBoundary?.geoJSON,
      soil: newPlotData.soilType,
      irrigation: newPlotData.irrigation,
      status,
      statusColor: getStatusColor(status),
      statusDotColor: getStatusDotColor(status),
      svgPath: wizardBoundary?.geoJSON ? boundaryToSvgPath(wizardBoundary.geoJSON) : generatePlaceholderSvgPath(areaAcres),
      fillGradient: "url(#healthyGrad)",
      strokeColor: "#10b981",
      glowColor: "rgba(16, 185, 129, 0.4)",
      boundaryMapped: !!wizardBoundary,
      soilReportAttached: false,
    });

    if (onPlotCreated) onPlotCreated();
  };

  // GeoJSON file import handler
  const handleGeoJSONImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const result = parseGeoJSONFile(ev.target?.result as string);
        setImportedGeoJSON(result.geoJSON);
        if (result.name && !newPlotData.name) {
          setNewPlotData(prev => ({ ...prev, name: result.name! }));
        }
        // Open wizard at step 2 with the imported boundary
        setAddStep(2);
        setIsAddModalOpen(true);
        triggerToast("GeoJSON boundary loaded — review in the map before confirming.", "success");
      } catch (err) {
        triggerToast(`Invalid GeoJSON: ${(err as Error).message}`, "warning");
      }
    };
    reader.readAsText(file);
    // reset so same file can be re-imported
    e.target.value = "";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-6 text-left"
    >
      
      {/* ================= 1. Farm Plot Header ================= */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200/50 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight leading-none">
            
                                  {t('farmplotscreen.farm_plot_management')}
                                </h1>
          <p className="text-sm font-semibold text-gray-500 mt-2">
            
                                  {t('farmplotscreen.visualize_farm_boundaries_monitor_crop_h')}
                                </p>
        </div>
        
        {/* Top Right Header Action Triggers */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => {
              setAddStep(1);
              setWizardBoundary(null);
              setImportedGeoJSON(undefined);
              setStep3Data(null);
              setNewPlotData({
                name: "",
                farmer: "Swaminathan Gowda",
                area: "",
                crop: "Oil Palm",
                coordinates: "17.3912° N, 78.4948° E",
                soilType: "Loamy",
                irrigation: "Precision Drip",
                plantingDate: "",
                plantCount: "",
              });
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-[#235F26] text-white font-extrabold rounded-xl shadow-md shadow-primary/10 hover:shadow-primary/20 active:scale-95 transition-all text-xs cursor-pointer border-0"
          >
            <Plus className="w-4 h-4" />
            
                                  {t('farmplotscreen.add_plot')}
                                </button>
          
          {/* Hidden GeoJSON file input */}
          <input
            ref={geoJSONFileInputRef}
            type="file"
            accept=".geojson,.json"
            onChange={handleGeoJSONImport}
            className="hidden"
          />
          <button
            onClick={() => geoJSONFileInputRef.current?.click()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-250 text-gray-700 font-extrabold rounded-xl shadow-xs hover:bg-gray-50 active:scale-95 transition-all text-xs cursor-pointer"
          >
            <Download className="w-4 h-4 text-gray-500" />
            
                                  {t('farmplotscreen.import_gis_data')}
                                </button>

          <button
            onClick={handleRefreshMap}
            className="inline-flex items-center justify-center p-2.5 bg-white border border-gray-250 text-gray-700 font-extrabold rounded-xl shadow-xs hover:bg-gray-50 active:scale-95 transition-all cursor-pointer"
            title={t('farmplotscreen.refresh_map_layers')}
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Summary Chips */}
      <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-gray-650">
        <span className="flex items-center gap-1.5 bg-white border border-gray-200 px-3.5 py-1.5 rounded-full shadow-xs">
          
                            {t('farmplotscreen.total_plots')} <strong className="text-primary font-black">{plots.length}</strong>
        </span>
        <span className="flex items-center gap-1.5 bg-white border border-gray-200 px-3.5 py-1.5 rounded-full shadow-xs">
          
                            {t('farmplotscreen.total_area')} <strong className="text-primary font-black">{t('farmplotscreen.39_5_acres')}</strong>
        </span>
        <span className="flex items-center gap-1.5 bg-white border border-gray-200 px-3.5 py-1.5 rounded-full shadow-xs">
          
                            {t('farmplotscreen.gis_sync')} <strong className="text-primary font-black">{t('farmplotscreen.100_online')}</strong>
        </span>
        <span className="flex items-center gap-1.5 bg-white border border-gray-200 px-3.5 py-1.5 rounded-full shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />  {t('farmplotscreen.healthy_plots')} <strong className="text-primary font-black">3</strong>
        </span>
      </div>

      {/* ================= 2. Overview KPI Cards ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* KPI 1 */}
        <div className="bg-white rounded-2xl p-5 border border-gray-150 shadow-xs hover:shadow-md hover:border-primary/20 transition-all duration-300 group flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('farmplotscreen.total_farm_plots')}</p>
            <h3 className="text-3xl font-black text-gray-900 mt-2 tracking-tight">
              <AnimatedCounter value={plots.length} />
            </h3>
          </div>
          <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-4">
            <motion.div className="h-full bg-primary" initial={{ width: 0 }} animate={{ width: "80%" }} transition={{ duration: 1 }} />
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white rounded-2xl p-5 border border-gray-150 shadow-xs hover:shadow-md hover:border-primary/20 transition-all duration-300 group flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('farmplotscreen.cultivated_area')}</p>
            <h3 className="text-3xl font-black text-gray-900 mt-2 tracking-tight">
              <AnimatedCounter value={39.5} decimals={1} suffix=" Ac" />
            </h3>
          </div>
          <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-4">
            <motion.div className="h-full bg-emerald-500" initial={{ width: 0 }} animate={{ width: "90%" }} transition={{ duration: 1 }} />
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white rounded-2xl p-5 border border-gray-150 shadow-xs hover:shadow-md hover:border-primary/20 transition-all duration-300 group flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('farmplotscreen.average_soil_health')}</p>
            <h3 className="text-3xl font-black text-gray-900 mt-2 tracking-tight">
              <AnimatedCounter value={67} suffix="%" />
            </h3>
          </div>
          <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-4">
            <motion.div className="h-full bg-amber-500" initial={{ width: 0 }} animate={{ width: "67%" }} transition={{ duration: 1 }} />
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white rounded-2xl p-5 border border-gray-150 shadow-xs hover:shadow-md hover:border-primary/20 transition-all duration-300 group flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('farmplotscreen.active_crop_types')}</p>
            <h3 className="text-3xl font-black text-gray-900 mt-2 tracking-tight">
              <AnimatedCounter value={3} />
            </h3>
          </div>
          <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-4">
            <motion.div className="h-full bg-indigo-500" initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 1 }} />
          </div>
        </div>

      </div>

      {/* ================= Phase 7: Loading & Empty States ================= */}
      {isDbLoading && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100">
            <RefreshCw className="w-6 h-6 text-primary animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-sm font-extrabold text-gray-800">{t('farmplotscreen.loading_your_plots')}</p>
            <p className="text-xs text-gray-400 mt-1">{t('farmplotscreen.fetching_your_farm_data_from_the_server')}</p>
          </div>
        </div>
      )}

      {!isDbLoading && plots.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-5 text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-200">
            <Globe className="w-8 h-8 text-gray-300" />
          </div>
          <div>
            <p className="text-base font-extrabold text-gray-800">{t('farmplotscreen.no_plots_yet')}</p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs">
              
                                        {t('farmplotscreen.create_your_first_plot_to_start_monitori')}
                                      </p>
          </div>
          <button
            onClick={() => {
              setAddStep(1);
              setWizardBoundary(null);
              setImportedGeoJSON(undefined);
              setStep3Data(null);
              setNewPlotData({ name: "", farmer: "Swaminathan Gowda", area: "", crop: "Oil Palm", coordinates: "17.3912 N, 78.4948 E", soilType: "Loamy", irrigation: "Precision Drip", plantingDate: "", plantCount: "" });
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-5 py-3 bg-primary hover:bg-[#235F26] text-white font-extrabold rounded-xl shadow-md text-xs border-0 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            
                                  {t('farmplotscreen.add_your_first_plot')}
                                </button>
        </div>
      )}

      {/* ================= 2-COLUMN RESPONSIVE LAYOUT ================= */}
      {(plots.length > 0 || isDbLoading) && <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Map toolbar, Canvas, legend, Stats (8/12 width) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* ================= 4. GIS Toolbar ================= */}
          <div className="bg-white rounded-2xl p-4 border border-gray-150 shadow-xs flex flex-wrap gap-2 items-center justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setViewMode("Satellite")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  viewMode === "Satellite" ? "bg-primary text-white border-primary" : "bg-white text-gray-600 border-gray-250 hover:bg-gray-50"
                }`}
              >
                
                                              {t('farmplotscreen.satellite_view')}
                                            </button>
              <button
                onClick={() => setViewMode("Terrain")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  viewMode === "Terrain" ? "bg-primary text-white border-primary" : "bg-white text-gray-600 border-gray-250 hover:bg-gray-50"
                }`}
              >
                
                                              {t('farmplotscreen.terrain_view')}
                                            </button>
              
              <div className="h-6 w-[1px] bg-gray-250 mx-1" />

              <button
                onClick={() => setActiveLayer("NDVI")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  activeLayer === "NDVI" ? "bg-[#84cc16]/10 text-[#5f930e] border-[#84cc16]/30" : "bg-white text-gray-600 border-gray-250 hover:bg-gray-50"
                }`}
              >
                
                                              {t('farmplotscreen.ndvi_layer')}
                                            </button>
              <button
                onClick={() => setActiveLayer("Moisture")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  activeLayer === "Moisture" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-white text-gray-600 border-gray-250 hover:bg-gray-50"
                }`}
              >
                
                                              {t('farmplotscreen.soil_layer')}
                                            </button>
              <button
                onClick={() => setActiveLayer("Boundary")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  activeLayer === "Boundary" ? "bg-gray-100 text-gray-800 border-gray-300" : "bg-white text-gray-600 border-gray-250 hover:bg-gray-50"
                }`}
              >
                
                                              {t('farmplotscreen.boundary_view')}
                                            </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => setZoomLevel(prev => Math.min(prev + 10, 150))}
                className="w-8 h-8 rounded-lg border border-gray-250 bg-white flex items-center justify-center text-xs font-black hover:bg-gray-50 cursor-pointer"
              >
                +
              </button>
              <button 
                onClick={() => setZoomLevel(prev => Math.max(prev - 10, 50))}
                className="w-8 h-8 rounded-lg border border-gray-250 bg-white flex items-center justify-center text-xs font-black hover:bg-gray-50 cursor-pointer"
              >
                -
              </button>
              <button 
                onClick={() => { setZoomLevel(100); setViewMode("Satellite"); setActiveLayer("NDVI"); }}
                className="px-2.5 py-1.5 rounded-lg border border-gray-250 bg-white text-[10px] font-bold hover:bg-gray-50 cursor-pointer"
              >
                
                                              {t('farmplotscreen.center')}
                                            </button>
            </div>
          </div>

          {/* ================= 3. Interactive GIS Farm Map ================= */}
          <div className="bg-slate-950 rounded-3xl border border-slate-900 shadow-md overflow-hidden relative">
            
            {/* Map Header Status overlays */}
            <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-center">
              <div className="bg-slate-900/95 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-800 text-[10px] text-emerald-400 font-mono flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-emerald-400 animate-spin-slow" />
                <span>{t('farmplotscreen.active_view')} {viewMode.toUpperCase()}  {t('farmplotscreen.layer')} {activeLayer.toUpperCase()}</span>
              </div>
              <button
                onClick={triggerScan}
                disabled={isScanning}
                className="bg-emerald-500 hover:bg-emerald-650 disabled:bg-emerald-700 text-slate-950 font-bold px-4 py-2 rounded-xl text-[10px] flex items-center gap-1.5 transition-all cursor-pointer border-0 shadow-sm"
              >
                <RefreshCw className={`w-3 h-3 ${isScanning ? "animate-spin" : ""}`} />
                {isScanning ? "RE-INDEXING GNSS..." : "FORCE SATELLITE SYNC"}
              </button>
            </div>

            {/* Map Canvas */}
            <div className="h-96 relative flex items-center justify-center p-6 select-none overflow-hidden">
              
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

              {/* Map Plot SVG Container */}
              <motion.div 
                style={{ scale: zoomLevel / 100 }}
                className="w-full h-full relative transition-all duration-300 flex items-center justify-center"
              >
                <svg className="w-full h-full relative z-10" viewBox="0 0 500 220">
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

                    {/* Critical Gradient */}
                    <linearGradient id="criticalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#be123c" stopOpacity={activeLayer === "NDVI" ? 0.35 : 0.25} />
                      <stop offset="100%" stopColor="#e11d48" stopOpacity={activeLayer === "NDVI" ? 0.55 : 0.45} />
                    </linearGradient>

                    {/* Moisture Gradient */}
                    <linearGradient id="moistureGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#1e3a8a" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0.6} />
                    </linearGradient>
                  </defs>

                  {/* SVG paths mapping */}
                  {plots.map((plot) => {

                    const isSelected = selectedPlotId === plot.id;
                    const fillValue = activeLayer === "Moisture" ? "url(#moistureGrad)" : plot.fillGradient;
                    const strokeValue = isSelected ? "#FFF" : plot.strokeColor;
                    const strokeWidthValue = isSelected ? 2.5 : 1.5;

                    return (
                      <g key={plot.id} className="cursor-pointer" onClick={() => setSelectedPlotId(plot.id)}>
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
                        
                        <text
                          x={
                            plot.boundaryMapped && plot.geoJSON
                              ? coordinateToSvgPoint(plot.geoJSON).x
                              : (plot.id === "plot-1" ? 165 :
                                 plot.id === "plot-2" ? 305 :
                                 plot.id === "plot-3" ? 215 : 
                                 plot.id === "plot-4" ? 355 : 435)
                          }
                          y={
                            plot.boundaryMapped && plot.geoJSON
                              ? coordinateToSvgPoint(plot.geoJSON).y
                              : (plot.id === "plot-1" ? 75 :
                                 plot.id === "plot-2" ? 65 :
                                 plot.id === "plot-3" ? 158 : 
                                 plot.id === "plot-4" ? 145 : 62)
                          }
                          fill={isSelected ? "#FFF" : "#cbd5e1"}
                          fontSize="9"
                          fontWeight="bold"
                          textAnchor="middle"
                          className="pointer-events-none select-none font-mono drop-shadow-md"
                        >
                          {plot.crop} ({plot.area}  {t('farmplotscreen.ac')}
                                                        </text>
                      </g>
                    );
                  })}
                </svg>
              </motion.div>

              <div className="absolute bottom-4 left-4 text-[9px] font-mono text-slate-500">
                
                                              {t('farmplotscreen.wgs_84_epsg_4326_coordinate_ticks_17_38_')}
                                            </div>
            </div>
          </div>

          {/* ================= 9. GIS Legend Card ================= */}
          <div className="bg-white rounded-2xl p-4 border border-gray-150 shadow-xs space-y-3.5 text-xs text-gray-700">
            <span className="font-bold text-gray-500 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-primary" />  {t('farmplotscreen.spatial_map_legend')}
                                      </span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
              <div className="space-y-1.5">
                <p className="font-extrabold text-[9px] text-gray-400 uppercase">{t('farmplotscreen.health_status')}</p>
                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />  {t('farmplotscreen.healthy')}</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-lime-500" />  {t('farmplotscreen.moderate')}</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" />  {t('farmplotscreen.attention')}</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" />  {t('farmplotscreen.critical')}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="font-extrabold text-[9px] text-gray-400 uppercase">{t('farmplotscreen.crop_types')}</p>
                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-1">{t('farmplotscreen.oil_palm')}</span>
                  <span className="flex items-center gap-1">{t('farmplotscreen.coconut_palm')}</span>
                  <span className="flex items-center gap-1">{t('farmplotscreen.cocoa')}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="font-extrabold text-[9px] text-gray-400 uppercase">{t('farmplotscreen.irrigation')}</p>
                <div className="flex flex-col gap-1">
                  <span className="text-gray-500 font-medium">{t('farmplotscreen.precision_drip')}</span>
                  <span className="text-gray-500 font-medium">{t('farmplotscreen.manual_drip')}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="font-extrabold text-[9px] text-gray-400 uppercase">{t('farmplotscreen.telemetry_nodes')}</p>
                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />  {t('farmplotscreen.iot_sensors')}</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-0.5 bg-white border border-primary" />  {t('farmplotscreen.selected_plot')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ================= 8. Plot Statistics ================= */}
          <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs space-y-6">
            <h3 className="font-extrabold text-gray-900 text-sm flex items-center gap-2">
              <Activity className="w-4.5 h-4.5 text-primary" />
              
                                        {t('farmplotscreen.gis_analytical_summary')}
                                      </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-gray-700">
              {/* Crop Distribution */}
              <div className="space-y-2">
                <p className="font-bold text-gray-400 uppercase text-[9px] tracking-wider">{t('farmplotscreen.crop_distribution')}</p>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between font-bold mb-1">
                      <span>{t('farmplotscreen.oil_palm_1')}</span>
                      <span>85%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: "85%" }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between font-bold mb-1">
                      <span>{t('farmplotscreen.coconut_palm_1')}</span>
                      <span>10%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: "10%" }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between font-bold mb-1">
                      <span>{t('farmplotscreen.cocoa_1')}</span>
                      <span>5%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: "5%" }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Healthy vs Attention Plots */}
              <div className="space-y-2">
                <p className="font-bold text-gray-400 uppercase text-[9px] tracking-wider">{t('farmplotscreen.plot_health_ratios')}</p>
                <div className="flex items-center gap-4 py-2">
                  <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="32" cy="32" r="26" stroke="#F1F5F0" strokeWidth="6" fill="transparent" />
                      <circle cx="32" cy="32" r="26" stroke="#2E7D32" strokeWidth="6" fill="transparent" strokeDasharray={2*Math.PI*26} strokeDashoffset={2*Math.PI*26*(1-0.60)} strokeLinecap="round" />
                    </svg>
                    <span className="absolute text-[10px] font-black text-gray-800">60%</span>
                  </div>
                  <div className="space-y-1.5">
                    <p className="font-bold text-gray-800">{t('farmplotscreen.60_optimal')}</p>
                    <p className="text-gray-400 leading-normal text-[10px]">
                      
                                                                {t('farmplotscreen.3_healthy_1_attention_1_critical_plot_ca')}
                                                              </p>
                  </div>
                </div>
              </div>

              {/* Water Usage / Irrigation */}
              <div className="space-y-2">
                <p className="font-bold text-gray-400 uppercase text-[9px] tracking-wider">{t('farmplotscreen.water_irrigation')}</p>
                <div className="space-y-2 pt-1 font-semibold">
                  <div className="flex justify-between">
                    <span>{t('farmplotscreen.irrigation_coverage')}</span>
                    <span className="text-primary">94%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('farmplotscreen.moisture_efficiency')}</span>
                    <span className="text-primary">{t('farmplotscreen.optimal')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t('farmplotscreen.weekly_water_saved')}</span>
                    <span className="text-primary font-bold">+18.5%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ================= 10. Plot Timeline ================= */}
          <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs">
            <h3 className="font-extrabold text-gray-900 text-sm mb-6 flex items-center gap-1.5">
              <Activity className="w-4.5 h-4.5 text-primary" />
              
                                        {t('farmplotscreen.recent_plot_spatial_logs')}
                                      </h3>
            
            <div className="relative pl-6 border-l border-gray-100 space-y-6 text-xs text-gray-700">
              <div className="relative">
                <span className="absolute -left-[29px] top-0.5 w-2.5 h-2.5 rounded-full border-2 border-white bg-primary shadow-xs" />
                <div className="space-y-0.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold">{t('farmplotscreen.boundary_updated')}</span>
                    <span className="text-[8px] font-mono text-gray-400">{t('farmplotscreen.10_45_am')}</span>
                  </div>
                  <p className="text-gray-500">{t('farmplotscreen.plot_e_boundary_adjusted_after_land_surv')}</p>
                </div>
              </div>

              <div className="relative">
                <span className="absolute -left-[29px] top-0.5 w-2.5 h-2.5 rounded-full border-2 border-white bg-indigo-500 shadow-xs" />
                <div className="space-y-0.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold">{t('farmplotscreen.drone_canopy_survey_completed')}</span>
                    <span className="text-[8px] font-mono text-gray-400">{t('farmplotscreen.09_12_am')}</span>
                  </div>
                  <p className="text-gray-500">{t('farmplotscreen.ndvi_indices_synced_for_swamy_north_plot')}</p>
                </div>
              </div>

              <div className="relative">
                <span className="absolute -left-[29px] top-0.5 w-2.5 h-2.5 rounded-full border-2 border-white bg-emerald-500 shadow-xs" />
                <div className="space-y-0.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold">{t('farmplotscreen.digital_twin_synced')}</span>
                    <span className="text-[8px] font-mono text-gray-400">{t('farmplotscreen.08_00_am')}</span>
                  </div>
                  <p className="text-gray-500">{t('farmplotscreen.canopy_biophysical_metrics_synced_with_t')}</p>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Plot details panel (4/12 width) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* ================= 5. Plot Information Panel ================= */}
          <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs relative overflow-hidden text-left space-y-6">
            
            {/* Header info */}
            <div className="border-b border-gray-100 pb-4">
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-emerald-50 border border-emerald-100/50 px-2.5 py-1 rounded-full">
                    
                                                          {t('farmplotscreen.plot_id')} {selectedPlot.id.toUpperCase()}
                  </span>
                </div>
                {/* Health Badge */}
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${selectedPlot.statusColor}`}>
                  {selectedPlot.status}
                </span>
              </div>
              <h3 className="font-black text-gray-900 text-lg mt-3 leading-tight">{selectedPlot.name}</h3>
            </div>

            {/* Specs detail list */}
            <div className="space-y-3 text-xs text-gray-700 font-semibold">
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-400">{t('farmplotscreen.landholder')}</span>
                <span className="font-bold text-gray-900">{selectedPlot.farmer}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-400">{t('farmplotscreen.acreage')}</span>
                <span className="font-bold text-primary">{selectedPlot.area}  {t('farmplotscreen.acres')}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-400">{t('farmplotscreen.crop_variety')}</span>
                <span className="font-bold text-gray-900">{selectedPlot.crop}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-400">{t('farmplotscreen.growth_stage')}</span>
                <span className="font-bold text-gray-900">{selectedPlot.stage}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-400">{t('farmplotscreen.soil_classification')}</span>
                <span className="font-bold text-gray-900">{selectedPlot.soil}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-400">{t('farmplotscreen.irrigation_method')}</span>
                <span className="font-bold text-gray-900">{selectedPlot.irrigation}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-400">{t('farmplotscreen.elevation')}</span>
                <span className="font-bold text-gray-900">{selectedPlot.elevation}{t('farmplotscreen.m_msl')}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-400">{t('farmplotscreen.last_inspection')}</span>
                <span className="font-bold text-gray-900">{selectedPlot.lastInspection}</span>
              </div>
              
              {/* Soil Health score progress bar */}
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">{t('farmplotscreen.soil_health_score')}</span>
                  {/* soilHealth is optional for DB-sourced plots (AI data not yet populated) */}
                  <span className="text-primary font-bold">{selectedPlot.soilHealth?.Current ?? 0}%</span>
                </div>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-primary" 
                    initial={{ width: 0 }}
                    animate={{ width: `${selectedPlot.soilHealth?.Current ?? 0}%` }}
                    transition={{ duration: 0.8 }}
                  />
                </div>
              </div>
            </div>

            {/* ================= 6. Environmental Snapshot ================= */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-black text-gray-450 uppercase tracking-wider">{t('farmplotscreen.environmental_snapshot')}</h4>
              <div className="grid grid-cols-3 gap-2">
                
                {/* Temp */}
                <div className="bg-gray-50 border border-gray-150 p-2 rounded-xl text-center space-y-0.5">
                  <Thermometer className="w-4.5 h-4.5 text-primary mx-auto" />
                  <span className="block text-[8px] font-bold text-gray-400 uppercase">{t('farmplotscreen.temp')}</span>
                  <span className="text-xs font-extrabold text-gray-800">{selectedPlot.temp}</span>
                </div>

                {/* Humidity */}
                <div className="bg-gray-50 border border-gray-150 p-2 rounded-xl text-center space-y-0.5">
                  <Droplets className="w-4.5 h-4.5 text-primary mx-auto" />
                  <span className="block text-[8px] font-bold text-gray-400 uppercase">{t('farmplotscreen.humidity')}</span>
                  <span className="text-xs font-extrabold text-gray-800">{selectedPlot.humidity}</span>
                </div>

                {/* Wind */}
                <div className="bg-gray-50 border border-gray-150 p-2 rounded-xl text-center space-y-0.5">
                  <Wind className="w-4.5 h-4.5 text-primary mx-auto" />
                  <span className="block text-[8px] font-bold text-gray-400 uppercase">{t('farmplotscreen.wind')}</span>
                  <span className="text-xs font-extrabold text-gray-800">{selectedPlot.windSpeed}</span>
                </div>

                {/* Solar */}
                <div className="bg-gray-50 border border-gray-150 p-2 rounded-xl text-center space-y-0.5">
                  <Sun className="w-4.5 h-4.5 text-primary mx-auto" />
                  <span className="block text-[8px] font-bold text-gray-400 uppercase">{t('farmplotscreen.solar')}</span>
                  <span className="text-[10px] font-extrabold text-gray-800">{selectedPlot.solarRad}</span>
                </div>

                {/* UV */}
                <div className="bg-gray-50 border border-gray-150 p-2 rounded-xl text-center space-y-0.5">
                  <Sparkles className="w-4.5 h-4.5 text-primary mx-auto" />
                  <span className="block text-[8px] font-bold text-gray-400 uppercase">{t('farmplotscreen.uv_index')}</span>
                  <span className="text-xs font-extrabold text-gray-800">{selectedPlot.uvIndex}</span>
                </div>

                {/* NDVI */}
                <div className="bg-gray-50 border border-gray-150 p-2 rounded-xl text-center space-y-0.5">
                  <Layers className="w-4.5 h-4.5 text-primary mx-auto" />
                  <span className="block text-[8px] font-bold text-gray-400 uppercase">{t('farmplotscreen.ndvi')}</span>
                  <span className="text-xs font-extrabold text-primary">{selectedPlot.ndvi}</span>
                </div>

              </div>
            </div>

            {/* ================= 7. AI Plot Insights ================= */}
            <div className="space-y-2.5">
              <h4 className="text-[10px] font-black text-gray-450 uppercase tracking-wider">{t('farmplotscreen.ai_boundary_observations')}</h4>
              <div className="space-y-2 text-xs text-gray-700">
                {/* soilHealth is optional for DB-sourced plots (AI telemetry not yet populated) */}
                {(selectedPlot.soilHealth?.Current ?? 0) < 60 && (
                  <div className="p-2.5 bg-red-50/50 border border-red-100 rounded-xl flex gap-2 items-start">
                    <span className="text-red-500 mt-0.5">⚠️</span>
                    <div className="space-y-0.5">
                      <p className="font-extrabold">{t('farmplotscreen.nitrogen_deficiency_detected')}</p>
                      <p className="text-[9px] text-gray-450 font-medium">{t('farmplotscreen.confidence_94_updated_2_mins_ago')}</p>
                    </div>
                  </div>
                )}
                {selectedPlot.moisture !== undefined && selectedPlot.moisture < 35 ? (
                  <div className="p-2.5 bg-amber-50/50 border border-amber-100 rounded-xl flex gap-2 items-start">
                    <span className="text-amber-500 mt-0.5">⚠️</span>
                    <div className="space-y-0.5">
                      <p className="font-extrabold">{t('farmplotscreen.soil_moisture_below_optimal_vwc')}</p>
                      <p className="text-[9px] text-gray-450 font-medium">{t('farmplotscreen.confidence_89_updated_1_hour_ago')}</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 bg-emerald-50/40 border border-emerald-100/50 rounded-xl flex gap-2 items-start">
                    <span className="text-emerald-500 mt-0.5">✓</span>
                    <div className="space-y-0.5">
                      <p className="font-extrabold">{t('farmplotscreen.soil_moisture_level_optimal')}</p>
                      <p className="text-[9px] text-gray-450 font-medium">{t('farmplotscreen.confidence_96_updated_2_hours_ago')}</p>
                    </div>
                  </div>
                )}
                <div className="p-2.5 bg-emerald-50/40 border border-emerald-100/50 rounded-xl flex gap-2 items-start">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  <div className="space-y-0.5">
                    <p className="font-extrabold">{t('farmplotscreen.healthy_vegetation_indices_scanned')}</p>
                    <p className="text-[9px] text-gray-450 font-medium">{t('farmplotscreen.confidence_91_sentinel_2_calibrated')}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ================= 11. Quick Plot Actions ================= */}
            <div className="space-y-2 pt-4 border-t border-gray-100">
              <button
                onClick={() => onNavigate && onNavigate("Digital Twin")}
                className="w-full bg-primary hover:bg-[#235F26] text-white font-extrabold py-3 rounded-xl transition-all shadow-xs text-xs flex items-center justify-center gap-2 border-0 cursor-pointer"
              >
                <Cpu className="w-4 h-4" />
                
                                              {t('farmplotscreen.open_digital_twin')}
                                            </button>

              <button
                onClick={() => onNavigate && onNavigate("Soil Reports")}
                className="w-full bg-white hover:bg-gray-50 border border-gray-250 text-gray-800 font-extrabold py-3 rounded-xl transition-all text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-primary" />
                
                                              {t('farmplotscreen.upload_soil_report')}
                                            </button>

              <button
                onClick={() => onNavigate && onNavigate("Recommendations")}
                className="w-full bg-indigo-550 hover:bg-indigo-650 text-white font-extrabold py-3 rounded-xl transition-all text-xs flex items-center justify-center gap-2 border-0 cursor-pointer"
              >
                <FlaskConical className="w-4 h-4" />
                
                                              {t('farmplotscreen.generate_ai_recommendation')}
                                            </button>

              <div className="grid grid-cols-2 gap-2 pt-1 font-bold">
                <button
                  onClick={() => triggerToast("Compiling historical GIS satellite delta indices...", "info")}
                  className="py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-250 rounded-xl text-[10px] text-gray-800 cursor-pointer"
                >
                  
                                                    {t('farmplotscreen.view_plot_history')}
                                                  </button>
                <button
                  onClick={() => triggerToast("Generating PDF diagnostics payload report...", "info")}
                  className="py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-250 rounded-xl text-[10px] text-gray-800 cursor-pointer"
                >
                  
                                                    {t('farmplotscreen.export_plot_report')}
                                                  </button>
              </div>
            </div>

          </div>

        </div>

      </div>}

      {/* ================= 12. Add Plot Multi-step Modal ================= */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden">
            {/* Backdrop overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black pointer-events-auto"
              onClick={() => setIsAddModalOpen(false)}
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-[32px] border-2 border-gray-200 shadow-2xl p-6 md:p-8 max-w-lg w-full relative z-10 text-left overflow-y-auto max-h-[90vh]"
            >
              {/* Close Button */}
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="absolute top-6 right-6 p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors border-0 cursor-pointer bg-transparent"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Progress headers */}
              <div className="flex items-center gap-3.5 mb-6 pb-4 border-b border-gray-100">
                <span className="text-[10px] font-black text-primary bg-emerald-50 px-2.5 py-1 rounded-full uppercase">
                  
                                                    {t('farmplotscreen.gis_wizard_step')} {addStep}  {t('farmplotscreen.of_3')}
                                                  </span>
                <span className="text-xs font-bold text-gray-400">
                  {addStep === 1 ? "Plot Info" : addStep === 2 ? "Location Specs" : "Success"}
                </span>
              </div>

              {/* Success View */}
              {addStep === 3 ? (
                <div className="text-center py-6 space-y-5">
                  <div className="w-16 h-16 bg-emerald-50 text-primary rounded-full flex items-center justify-center mx-auto shadow-xs border border-emerald-100/50">
                    {isGeocodingStep3 ? (
                      <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                    ) : (
                      <CheckCircle2 className="w-9 h-9" />
                    )}
                  </div>
                  <div className="space-y-1.5 max-w-sm mx-auto">
                    <h3 className="text-lg font-black text-gray-900">{t('farmplotscreen.gis_boundary_registered_successfully')}</h3>
                    {isGeocodingStep3 ? (
                      <p className="text-xs text-gray-500">{t('farmplotscreen.fetching_location_data_and_elevation_hel')}</p>
                    ) : step3Data ? (
                      <div className="text-left space-y-2 mt-3">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-gray-50 border border-gray-150 p-2.5 rounded-xl">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">{t('farmplotscreen.computed_area')}</p>
                            <p className="font-black text-gray-900 mt-0.5">
                              {step3Data.areaAcres.toFixed(2)}  {t('farmplotscreen.ac_1')}
                                                                                            {" "}
                              <span className="text-gray-400 font-semibold text-[9px]">
                                ({(step3Data.areaAcres * 0.404686).toFixed(2)}  {t('farmplotscreen.ha')}
                                                                                                </span>
                            </p>
                          </div>
                          <div className="bg-gray-50 border border-gray-150 p-2.5 rounded-xl">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">{t('farmplotscreen.elevation')}</p>
                            <p className="font-black text-gray-900 mt-0.5">
                              {step3Data.elevation ? `${step3Data.elevation} m MSL` : "–"}
                            </p>
                          </div>
                        </div>
                        {/* Location row: village / taluk / district / state / country */}
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="bg-gray-50 border border-gray-150 p-2.5 rounded-xl">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">{t('farmplotscreen.village')}</p>
                            <p className="font-black text-gray-900 mt-0.5">{step3Data.village || "–"}</p>
                          </div>
                          <div className="bg-gray-50 border border-gray-150 p-2.5 rounded-xl">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">{t('farmplotscreen.taluk')}</p>
                            <p className="font-black text-gray-900 mt-0.5">{step3Data.taluk || "–"}</p>
                          </div>
                          <div className="bg-gray-50 border border-gray-150 p-2.5 rounded-xl">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">{t('farmplotscreen.district')}</p>
                            <p className="font-black text-gray-900 mt-0.5">{step3Data.district || "–"}</p>
                          </div>
                          <div className="bg-gray-50 border border-gray-150 p-2.5 rounded-xl">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">{t('farmplotscreen.state')}</p>
                            <p className="font-black text-gray-900 mt-0.5">{step3Data.state || "–"}</p>
                          </div>
                          <div className="bg-gray-50 border border-gray-150 p-2.5 col-span-2 rounded-xl">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">{t('farmplotscreen.country')}</p>
                            <p className="font-black text-gray-900 mt-0.5">{step3Data.country || "–"}</p>
                          </div>
                        </div>
                        {!step3Data.geocodeOk && (
                          <p className="text-[10px] text-amber-600 font-semibold">
                            
                                                                                      {t('farmplotscreen.location_data_unavailable_editable_after')}
                                                                                    </p>
                        )}
                        <p className="text-xs text-gray-500 leading-relaxed">
                          
                                                                                {t('farmplotscreen.boundary_mapped_digital_twin_telemetry_w')}
                                                                              </p>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">
                        
                                                                              {t('farmplotscreen.plot_saved_digital_twin_telemetry_will_p')}
                                                                            </p>
                    )}
                  </div>
                  <button
                    onClick={() => setIsAddModalOpen(false)}
                    disabled={isGeocodingStep3}
                    className="w-full bg-primary hover:bg-[#235F26] disabled:opacity-50 text-white font-extrabold py-3.5 rounded-xl shadow-md transition-all text-xs border-0 cursor-pointer"
                  >
                    
                                                          {t('farmplotscreen.done')}
                                                        </button>
                </div>
              ) : (
                <form onSubmit={handleAddPlotSubmit} className="space-y-5">
                  
                  {/* Step 1: Plot Details */}
                  {addStep === 1 && (
                    <div className="space-y-4">
                      <div className="space-y-1 bg-gray-50 p-3 rounded-2xl border border-gray-150 mb-2">
                        <h4 className="text-xs font-extrabold text-gray-800">{t('farmplotscreen.plot_details')}</h4>
                        <p className="text-[11px] text-gray-450">{t('farmplotscreen.please_set_plot_identification_fields')}</p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('farmplotscreen.plot_name')}</label>
                        <input
                          required
                          type="text"
                          value={newPlotData.name}
                          onChange={(e) => setNewPlotData(prev => ({ ...prev, name: e.target.value }))}
                          placeholder={t('farmplotscreen.e_g_swamy_north_plot_plot_2a')}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-250 text-xs focus:ring-2 focus:ring-primary/10 focus:border-primary font-semibold"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('farmplotscreen.farmer_landholder')}</label>
                        <input
                          type="text"
                          required
                          list="farmer-options"
                          value={newPlotData.farmer}
                          onChange={(e) => setNewPlotData(prev => ({ ...prev, farmer: e.target.value }))}
                          placeholder={t('farmplotscreen.e_g_swaminathan_gowda')}
                          className="w-full px-3 py-2.5 rounded-xl border border-gray-250 bg-white text-xs font-semibold focus:border-primary"
                        />
                        <datalist id="farmer-options">
                          <option value="Swaminathan Gowda" />
                          <option value="K. Ramachandra Rao" />
                          <option value="M. Devamma" />
                          <option value="Rajesh Kumar" />
                        </datalist>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('farmplotscreen.estimated_acreage_optional_recalculated_')}</label>
                          <input
                            type="number"
                            step="0.01"
                            value={newPlotData.area}
                            onChange={(e) => setNewPlotData(prev => ({ ...prev, area: e.target.value }))}
                            placeholder={t('farmplotscreen.e_g_12_5')}
                            className="w-full bg-gray-50 border border-gray-250 text-gray-900 text-xs rounded-xl focus:ring-primary focus:border-primary block p-3 transition-colors shadow-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('farmplotscreen.primary_crop')}</label>
                          <input
                            type="text"
                            list="crop-options"
                            value={newPlotData.crop}
                            onChange={(e) => setNewPlotData(prev => ({ ...prev, crop: e.target.value }))}
                            placeholder={t('farmplotscreen.e_g_oil_palm')}
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-250 bg-white text-xs font-semibold focus:border-primary"
                          />
                          <datalist id="crop-options">
                            <option value="Oil Palm" />
                            <option value="Coconut Palm" />
                            <option value="Cocoa" />
                          </datalist>
                        </div>
                      </div>

                      {/* Phase 5: Planting date + plant count (optional) */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('farmplotscreen.planting_date')} <span className="font-normal normal-case text-gray-400">{t('farmplotscreen.optional')}</span></label>
                          <input
                            type="date"
                            value={newPlotData.plantingDate}
                            onChange={(e) => setNewPlotData(prev => ({ ...prev, plantingDate: e.target.value }))}
                            className="w-full bg-gray-50 border border-gray-250 text-gray-900 text-xs rounded-xl focus:ring-primary focus:border-primary block p-3 transition-colors shadow-xs"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('farmplotscreen.no_of_plants')} <span className="font-normal normal-case text-gray-400">{t('farmplotscreen.optional')}</span></label>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={newPlotData.plantCount}
                            onChange={(e) => setNewPlotData(prev => ({ ...prev, plantCount: e.target.value }))}
                            placeholder={t('farmplotscreen.e_g_240')}
                            className="w-full bg-gray-50 border border-gray-250 text-gray-900 text-xs rounded-xl focus:ring-primary focus:border-primary block p-3 transition-colors shadow-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Location specs — real map picker */}
                  {addStep === 2 && (
                    <div className="space-y-4">
                      <div className="space-y-1 bg-gray-50 p-3 rounded-2xl border border-gray-150 mb-2">
                        <h4 className="text-xs font-extrabold text-gray-800">{t('farmplotscreen.draw_boundary_on_map')}</h4>
                        <p className="text-[11px] text-gray-450">{t('farmplotscreen.use_the_polygon_tool_to_trace_your_plot_')}</p>
                      </div>

                      {/* Area unit toggle */}
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('farmplotscreen.area_unit')}</label>
                        <div className="inline-flex bg-gray-50 border border-gray-200 rounded-xl p-0.5">
                          {(["acres", "hectares"] as const).map((u) => (
                            <button
                              key={u}
                              type="button"
                              onClick={() => setWizardAreaUnit(u)}
                              className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                wizardAreaUnit === u ? "bg-white text-primary shadow-xs" : "text-gray-500"
                              }`}
                            >
                              {u}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Real Leaflet map */}
                      <LeafletMapPicker
                        onBoundaryChange={(data) => {
                          setWizardBoundary(data);
                          if (data) {
                            const areaDisplay = wizardAreaUnit === "hectares"
                              ? `${(data.areaAcres * 0.404686).toFixed(2)}`
                              : `${data.areaAcres.toFixed(2)}`;
                            setNewPlotData(prev => ({ ...prev, area: areaDisplay }));
                          }
                        }}
                        initialGeoJSON={importedGeoJSON}
                        areaUnit={wizardAreaUnit}
                        showToast={showToast}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('farmplotscreen.irrigation_method')}</label>
                          <select
                            value={newPlotData.irrigation}
                            onChange={(e) => setNewPlotData(prev => ({ ...prev, irrigation: e.target.value }))}
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-250 bg-white text-xs font-semibold focus:border-primary"
                          >
                            <option>{t('farmplotscreen.precision_drip_1')}</option>
                            <option>{t('farmplotscreen.manual_drip_1')}</option>
                            <option>{t('farmplotscreen.sprinkler')}</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('farmplotscreen.soil_classification')}</label>
                          <select
                            value={newPlotData.soilType}
                            onChange={(e) => setNewPlotData(prev => ({ ...prev, soilType: e.target.value }))}
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-250 bg-white text-xs font-semibold focus:border-primary"
                          >
                            <option>{t('farmplotscreen.loamy')}</option>
                            <option>{t('farmplotscreen.clay')}</option>
                            <option>{t('farmplotscreen.sandy')}</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Navigation Action Footer inside modal */}
                  <div className="flex justify-between items-center pt-4 border-t border-gray-150 mt-6">
                    {addStep === 1 ? (
                      <button
                        type="button"
                        onClick={() => setIsAddModalOpen(false)}
                        className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 bg-transparent border-0 cursor-pointer"
                      >
                        
                                                                          {t('farmplotscreen.cancel')}
                                                                        </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAddStep(1)}
                        className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 flex items-center gap-1.5 bg-transparent border-0 cursor-pointer"
                      >
                        
                                                                              {t('farmplotscreen.back')}
                                                                            </button>
                    )}

                    {addStep === 1 ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (newPlotData.name) {
                            setAddStep(2);
                          } else {
                            triggerToast("Validation Failed: Please fill Plot Name.", "warning");
                          }
                        }}
                        className="px-5 py-2.5 bg-primary hover:bg-[#235F26] text-white font-extrabold text-xs rounded-xl flex items-center gap-1 border-0 cursor-pointer shadow-sm"
                      >
                        
                                                                          {t('farmplotscreen.next_location')}
                                                                          <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={!wizardBoundary}
                        className={`px-5 py-2.5 font-extrabold text-xs rounded-xl flex items-center gap-1 border-0 shadow-sm transition-all ${
                          !wizardBoundary
                            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                            : "bg-primary hover:bg-[#235F26] text-white cursor-pointer animate-pulse"
                        }`}
                      >
                        
                                                                              {t('farmplotscreen.create_plot')}
                                                                            </button>
                    )}
                  </div>

                </form>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
};
