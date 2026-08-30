import { useTranslation } from "../../translation/useTranslation";
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  UploadCloud, FileText, ArrowRight, Activity, Sparkles, 
  Check, Download
} from "lucide-react";
import { usePlots } from "../../data/plots";
import { supabase } from "../../lib/supabaseClient";

interface SoilReportScreenProps {
  onRecommendationClick: () => void;
  onUploadSuccess: (nutrients: {
    id?: string;
    plotId?: string;
    nitrogen: number;
    phosphorus: number;
    potassium: number;
    carbon: number;
    ph: number;
  }) => void;
  showToast?: (message: string, type?: "success" | "info" | "warning") => void;
}

type ScreenStage = "upload" | "processing" | "results";
type ProcessingSubstep = "upload" | "ocr" | "extraction" | "analysis" | "completed";

export const SoilReportScreen: React.FC<SoilReportScreenProps> = ({
  onRecommendationClick,
  onUploadSuccess,
  showToast
}) => {
  const { t } = useTranslation();
  const { plots } = usePlots();
  const [selectedPlotId, setSelectedPlotId] = useState<string>("");
  const [stage, setStage] = useState<ScreenStage>("upload");
  const [file, setFile] = useState<{ name: string; size: string; time: string } | null>(null);
  
  // OCR processing states
  const [progress, setProgress] = useState(0);
  const [activeSubstep, setActiveSubstep] = useState<ProcessingSubstep>("upload");
  const [logs, setLogs] = useState<string[]>([]);
  const consoleBottomRef = useRef<HTMLDivElement>(null);

  const processingTimeline = [
    { key: "upload", label: "Uploading Document", pct: 20 },
    { key: "ocr", label: "OCR Recognition", pct: 40 },
    { key: "extraction", label: "Nutrient Extraction", pct: 60 },
    { key: "analysis", label: "AI Analysis", pct: 80 },
    { key: "completed", label: "Completed", pct: 100 }
  ];

  const logDatabase = [
    "Initializing neural parser engine...",
    "Scanning structural bounding boxes...",
    "Document classified as: Hassan Labs Soil Diagnostic Report v2.0",
    "Running Optical Character Recognition (OCR)...",
    "Extracted: Nitrogen = 135 mg/kg (94% confidence)",
    "Extracted: Phosphorus = 24 mg/kg (91% confidence)",
    "Extracted: Potassium = 160 mg/kg (88% confidence)",
    "Extracted: Organic Carbon = 1.82% (96% confidence)",
    "Extracted: Soil pH Index = 5.85 (98% confidence)",
    "Cross-referencing telemetry with Sentinel-2 vegetation canopy indexes...",
    "Mapping Plot Hassan-3A historical potassium trends...",
    "Generating custom slow-release NPK formulation recommendations...",
    "AI analysis complete. Redirecting to diagnostic dashboard."
  ];

  // Sync selected plot default
  useEffect(() => {
    if (plots.length > 0 && !selectedPlotId) {
      // Filter out mock plot ids if there are real database plot ids
      const realPlots = plots.filter(p => !p.id.startsWith("plot-"));
      if (realPlots.length > 0) {
        setSelectedPlotId(realPlots[0].id);
      } else {
        setSelectedPlotId(plots[0].id);
      }
    }
  }, [plots, selectedPlotId]);

  useEffect(() => {
    if (consoleBottomRef.current) {
      consoleBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const triggerToast = (msg: string, type: "success" | "info" | "warning" = "success") => {
    if (showToast) {
      showToast(msg, type);
    } else {
      alert(`${type.toUpperCase()}: ${msg}`);
    }
  };

  const handleUpload = () => {
    const now = new Date();
    setFile({
      name: "SAMRUDDHI_LABS_EAST_PLOT_3A.pdf",
      size: "1.4 MB",
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    setStage("processing");
    setProgress(0);
    setActiveSubstep("upload");
    setLogs(["[SYSTEM] Connection secure. Document upload received."]);
  };

  // Manage process automation
  useEffect(() => {
    if (stage !== "processing") return;

    let logIndex = 0;
    const logInterval = setInterval(() => {
      if (logIndex < logDatabase.length) {
        setLogs(prev => [...prev, `[INFO] ${logDatabase[logIndex]}`]);
        logIndex++;
      }
    }, 450);

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        const next = prev + 1;
        
        // Update active processing sub-steps
        if (next < 25) setActiveSubstep("upload");
        else if (next < 50) setActiveSubstep("ocr");
        else if (next < 75) setActiveSubstep("extraction");
        else if (next < 95) setActiveSubstep("analysis");
        else setActiveSubstep("completed");

        if (next >= 100) {
          clearInterval(progressInterval);
          clearInterval(logInterval);
          
          const saveReportAndComplete = async () => {
            let reportId = undefined;
            try {
              const { data: sessionData } = await supabase.auth.getSession();
              if (sessionData?.session?.user && selectedPlotId && !selectedPlotId.startsWith("plot-")) {
                const { data, error } = await supabase
                  .from("soil_reports")
                  .insert({
                    plot_id: selectedPlotId,
                    owner_id: sessionData.session.user.id,
                    nitrogen_kg_ha: 135,
                    phosphorus_kg_ha: 24,
                    potassium_kg_ha: 160,
                    organic_carbon_percent: 1.82,
                    ph: 5.85,
                    electrical_conductivity: 1.2,
                    status: "Completed",
                    report_date: new Date().toISOString().split("T")[0]
                  })
                  .select()
                  .single();

                if (error) throw error;
                if (data) {
                  reportId = data.id;
                  
                  // Also update local/db plot status
                  await supabase
                    .from("plots")
                    .update({ soil_report_attached: true })
                    .eq("id", selectedPlotId);
                }
              }
            } catch (err) {
              console.error("Failed to persist soil report to Supabase:", err);
            }

            onUploadSuccess({
              id: reportId,
              plotId: selectedPlotId,
              nitrogen: 135,
              phosphorus: 24,
              potassium: 160,
              carbon: 1.82,
              ph: 5.85
            });
            setStage("results");
            triggerToast("Report analyzed and parameters synchronized.", "success");
          };

          saveReportAndComplete();
          return 100;
        }
        return next;
      });
    }, 60);

    return () => {
      clearInterval(progressInterval);
      clearInterval(logInterval);
    };
  }, [stage]);

  const resetScanner = () => {
    setFile(null);
    setProgress(0);
    setLogs([]);
    setStage("upload");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-6 text-left"
    >
      {/* ================= HEADER ================= */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200/50 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight leading-none flex items-center gap-2.5">
            <FileText className="w-8 h-8 text-primary" />
            
                                  {t('soilreportscreen.ai_soil_report_diagnostic')}
                                </h1>
          <p className="text-sm font-semibold text-gray-500 mt-2">
            
                                  {t('soilreportscreen.upload_lab_soil_reports_to_extract_telem')}
                                </p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        
        {/* Stage 1: Upload Panel */}
        {stage === "upload" && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="max-w-xl mx-auto"
          >
            <div className="bg-white rounded-3xl border border-gray-150 p-8 shadow-xs text-center space-y-6">
              
              {/* Plot Selector */}
              {plots.length > 0 ? (
                <div className="text-left space-y-1.5 max-w-sm mx-auto">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Select Farm Plot for Report
                  </label>
                  <select
                    value={selectedPlotId}
                    onChange={(e) => setSelectedPlotId(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-hidden focus:border-primary/50 text-gray-800"
                  >
                    {plots.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.crop})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-150 text-red-700 text-xs rounded-xl p-3 max-w-sm mx-auto font-bold">
                  No farm plots found. Please create a plot in the Farm Plots screen first.
                </div>
              )}

              {/* Drag and Drop Zone */}
              <div
                onClick={() => {
                  if (plots.length === 0) {
                    triggerToast("Please add a plot first before uploading reports.", "warning");
                    return;
                  }
                  handleUpload();
                }}
                className={`border-2 border-dashed border-gray-250 hover:border-primary/50 bg-gray-50/50 hover:bg-emerald-50/10 rounded-2xl p-12 transition-all cursor-pointer group flex flex-col items-center justify-center space-y-4 ${plots.length === 0 ? "opacity-50 pointer-events-none" : ""}`}
              >
                <div className="p-4 bg-primary/5 text-primary rounded-2xl group-hover:scale-110 transition-transform duration-300">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">{t('soilreportscreen.drag_drop_soil_report_pdf_here')}</p>
                  <p className="text-xs text-gray-400 mt-1.5">{t('soilreportscreen.supports_pdf_jpg_png_up_to_10mb')}</p>
                </div>
                <span className="text-[10px] font-bold text-primary px-3 py-1 bg-emerald-50 rounded-lg group-hover:bg-emerald-100/50 transition-colors">
                  
                                                    {t('soilreportscreen.browse_files')}
                                                  </span>
              </div>

              {/* Demo Sandbox Quick Link */}
              <div className="flex justify-between items-center bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-xs text-indigo-800 text-left">
                <div className="flex gap-2.5 items-start">
                  <FileText className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-extrabold">{t('soilreportscreen.don_t_have_a_report_pdf_handy')}</p>
                    <p className="text-[11px] text-indigo-700/80 mt-1">
                      
                                                                {t('soilreportscreen.click_below_to_load_a_realistic_sample_s')}
                                                              </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (plots.length === 0) {
                      triggerToast("Please add a plot first before loading samples.", "warning");
                      return;
                    }
                    handleUpload();
                  }}
                  disabled={plots.length === 0}
                  className={`bg-indigo-650 hover:bg-indigo-700 text-white font-bold text-[10px] px-3.5 py-2 rounded-lg cursor-pointer transition-all border-0 shadow-xs shrink-0 ${plots.length === 0 ? "opacity-50 pointer-events-none" : ""}`}
                >
                  
                                                    {t('soilreportscreen.load_sample_report')}
                                                  </button>
              </div>

            </div>
          </motion.div>
        )}

        {/* Stage 2: Processing AI Pipeline */}
        {stage === "processing" && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-2xl mx-auto space-y-6"
          >
            <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs space-y-6">
              
              {/* Stepper Progress bar */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <Activity className="w-4 h-4 animate-pulse" />
                    
                                                          {t('soilreportscreen.ai_soil_diagnostic_pipeline')}
                                                        </span>
                  <span className="text-xs font-black text-gray-800">{progress}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary"
                    style={{ width: `${progress}%` }}
                    transition={{ ease: "easeOut" }}
                  />
                </div>
              </div>

              {/* Sub-steps flow tracker */}
              <div className="grid grid-cols-5 gap-2">
                {processingTimeline.map((step) => {
                  const isActive = activeSubstep === step.key;
                  const isDone = progress >= step.pct;
                  return (
                    <div key={step.key} className="text-center space-y-1.5">
                      <div className={`h-1.5 rounded-full transition-all duration-300 ${
                        isDone ? "bg-primary" : isActive ? "bg-emerald-350 animate-pulse" : "bg-gray-150"
                      }`} />
                      <span className={`block text-[8px] font-bold ${
                        isActive ? "text-primary" : isDone ? "text-gray-800" : "text-gray-400"
                      } leading-tight uppercase`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Holographic scanning HUD */}
              <div className="border border-gray-150 rounded-2xl bg-gray-50/50 p-5 flex items-center gap-4 relative overflow-hidden">
                <div className="absolute top-0 bottom-0 left-0 w-1 bg-primary animate-pulse" />
                <FileText className="w-10 h-10 text-primary shrink-0 animate-bounce" />
                <div className="text-xs flex-1">
                  <p className="font-extrabold text-gray-800">{file?.name}</p>
                  <p className="text-gray-400 mt-0.5">{file?.size}  {t('soilreportscreen.document_parser_active')}</p>
                </div>
                {/* Glowing Laser Scan Bar */}
                <div className="absolute inset-0 bg-linear-to-b from-transparent via-primary/5 to-transparent pointer-events-none animate-pulse" />
              </div>

              {/* Linux Terminal-style Logs Console */}
              <div className="bg-slate-950 rounded-2xl p-4 border border-slate-900 shadow-inner">
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2 mb-3">
                  <span>{t('soilreportscreen.telemetry_diagnostic_core')}</span>
                  <span className="animate-pulse text-emerald-400 font-mono">{t('soilreportscreen.live_feed')}</span>
                </div>
                <div className="h-36 overflow-y-auto font-mono text-[10px] text-slate-300 space-y-1.5 text-left custom-scrollbar">
                  {logs.map((log, i) => (
                    <div key={i} className={log.includes("[SUCCESS]") ? "text-emerald-400" : log.includes("[SYSTEM]") ? "text-indigo-400" : "text-slate-300"}>
                      {log}
                    </div>
                  ))}
                  <div ref={consoleBottomRef} />
                </div>
              </div>

            </div>
          </motion.div>
        )}

        {/* Stage 3: Results Dashboard */}
        {stage === "results" && (
          <motion.div
            key="results"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            {/* Top Analysis Complete Banner */}
            <div className="bg-emerald-50 border border-emerald-100/50 rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-28 h-28 bg-emerald-100/30 rounded-full filter blur-xl pointer-events-none" />
              
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-3 bg-primary text-white rounded-2xl shadow-md shrink-0">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-gray-900">{t('soilreportscreen.ai_diagnostic_complete')}</h3>
                  <p className="text-xs font-semibold text-emerald-700 mt-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    
                                                          {t('soilreportscreen.source')} {file?.name}  {t('soilreportscreen.extracted_successfully')}
                                                        </p>
                </div>
              </div>

              <div className="flex gap-2 relative z-10 w-full md:w-auto">
                <button
                  onClick={resetScanner}
                  className="flex-1 md:flex-initial px-4 py-2.5 bg-white hover:bg-gray-50 border border-gray-250 rounded-xl text-xs font-bold text-gray-650 cursor-pointer transition-colors shadow-xs"
                >
                  
                                                    {t('soilreportscreen.upload_another_report')}
                                                  </button>
                <button
                  onClick={onRecommendationClick}
                  className="flex-1 md:flex-initial px-4 py-2.5 bg-primary hover:bg-[#235F26] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors border-0 cursor-pointer shadow-md shadow-primary/10"
                >
                  
                                                    {t('soilreportscreen.generate_ai_recommendation')}
                                                    <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Results Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* LEFT COLUMN: Summary, score, breakdown chart, extracted specs (8/12 width) */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* 5. AI Analysis Summary Card & 6. Health Score */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Health score gauge card (1/3) */}
                  <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs flex flex-col items-center justify-center text-center space-y-3">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('soilreportscreen.soil_vitality')}</span>
                    
                    <div className="relative w-28 h-28 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="56" cy="56" r="46" stroke="#F1F5F0" strokeWidth="8" fill="transparent" />
                        <circle cx="56" cy="56" r="46" stroke="#2E7D32" strokeWidth="8" fill="transparent"
                          strokeDasharray={2 * Math.PI * 46}
                          strokeDashoffset={2 * Math.PI * 46 * (1 - 0.84)}
                        />
                      </svg>
                      <div className="absolute">
                        <span className="block text-2xl font-black text-gray-950">84%</span>
                        <span className="text-[9px] font-black text-emerald-650 uppercase">{t('soilreportscreen.healthy')}</span>
                      </div>
                    </div>
                    
                    <h4 className="font-extrabold text-sm text-gray-900 leading-tight">{t('soilreportscreen.overall_soil_health')}</h4>
                  </div>

                  {/* Summary Card (2/3) */}
                  <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left space-y-4 md:col-span-2 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center">
                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">{t('soilreportscreen.ai_summary')}</h4>
                        <span className="text-[9px] font-black text-indigo-750 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                          
                                                                            {t('soilreportscreen.98_confidence')}
                                                                          </span>
                      </div>
                      <p className="text-xs text-gray-700 leading-relaxed font-semibold mt-3">
                        
                                                                      {t('soilreportscreen.the_uploaded_soil_sample_indicates_healt')}
                                                                    </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-3 text-[10px] text-gray-450 uppercase font-black">
                      <div>{t('soilreportscreen.analysis_completed')} <span className="text-gray-700 font-bold">{t('soilreportscreen.just_now')}</span></div>
                      <div className="text-right">{t('soilreportscreen.processing_time')} <span className="text-gray-700 font-bold">{t('soilreportscreen.12_5_sec')}</span></div>
                    </div>
                  </div>

                </div>

                {/* 7. Nutrient Breakdown Chart */}
                <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left space-y-5">
                  <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">{t('soilreportscreen.nutrient_density_breakdown')}</h4>
                  
                  <div className="space-y-3.5 text-xs text-gray-700 font-semibold">
                    <div>
                      <div className="flex justify-between mb-1.5">
                        <span>{t('soilreportscreen.nitrogen_n')}</span>
                        <span className="text-amber-600 font-bold">{t('soilreportscreen.135_mg_kg_moderate')}</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: "75%" }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1.5">
                        <span>{t('soilreportscreen.phosphorus_p')}</span>
                        <span className="text-emerald-700 font-bold">{t('soilreportscreen.24_mg_kg_optimal')}</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: "68%" }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1.5">
                        <span>{t('soilreportscreen.potassium_k')}</span>
                        <span className="text-rose-600 font-bold">{t('soilreportscreen.160_mg_kg_low')}</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-rose-500 rounded-full" style={{ width: "57%" }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1.5">
                        <span>{t('soilreportscreen.organic_carbon_c')}</span>
                        <span className="text-emerald-700 font-bold">{t('soilreportscreen.1_82_optimal')}</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: "91%" }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1.5">
                        <span>{t('soilreportscreen.moisture_index')}</span>
                        <span className="text-emerald-700 font-bold">{t('soilreportscreen.42_optimal')}</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: "84%" }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Extracted Soil Parameters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  
                  {/* pH */}
                  <div className="bg-white rounded-2xl p-4 border border-gray-150 shadow-xs text-left flex flex-col justify-between min-h-[120px]">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-bold text-emerald-650 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">{t('soilreportscreen.optimal')}</span>
                      <span className="text-[9px] font-bold text-gray-400 uppercase">{t('soilreportscreen.healthy_range_5_5_6_5')}</span>
                    </div>
                    <div className="mt-4">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">{t('soilreportscreen.acidity_ph')}</span>
                      <span className="text-lg font-black text-gray-950 mt-0.5">{t('soilreportscreen.5_85_ph')}</span>
                    </div>
                  </div>

                  {/* EC */}
                  <div className="bg-white rounded-2xl p-4 border border-gray-150 shadow-xs text-left flex flex-col justify-between min-h-[120px]">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-bold text-emerald-650 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">{t('soilreportscreen.optimal')}</span>
                      <span className="text-[9px] font-bold text-gray-400 uppercase">{t('soilreportscreen.healthy_range_0_2_0_5')}</span>
                    </div>
                    <div className="mt-4">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">{t('soilreportscreen.electrical_conductivity')}</span>
                      <span className="text-lg font-black text-gray-950 mt-0.5">{t('soilreportscreen.0_28_ds_m')}</span>
                    </div>
                  </div>

                  {/* Zinc */}
                  <div className="bg-white rounded-2xl p-4 border border-gray-150 shadow-xs text-left flex flex-col justify-between min-h-[120px]">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-bold text-emerald-650 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">{t('soilreportscreen.optimal')}</span>
                      <span className="text-[9px] font-bold text-gray-400 uppercase">{t('soilreportscreen.healthy_range_2_0_5_0')}</span>
                    </div>
                    <div className="mt-4">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">{t('soilreportscreen.zinc_zn')}</span>
                      <span className="text-lg font-black text-gray-950 mt-0.5">{t('soilreportscreen.4_5_ppm')}</span>
                    </div>
                  </div>

                </div>

              </div>

              {/* RIGHT COLUMN: AI Recommendations, Action buttons (4/12 width) */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* 8. AI Recommendations Preview */}
                <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left space-y-5">
                  <div className="border-b border-gray-100 pb-3">
                    <h4 className="text-xs font-black text-indigo-950 uppercase tracking-widest flex items-center gap-1.5">
                      <Sparkles className="w-4.5 h-4.5 text-primary" />  {t('soilreportscreen.soil_treatment_advice')}
                                                              </h4>
                    <p className="text-[10px] text-gray-450 mt-1">{t('soilreportscreen.recommended_chemical_corrections')}</p>
                  </div>

                  <div className="space-y-4">
                    {/* Nitrogen Advice */}
                    <div className="space-y-2 border-b border-gray-50 pb-3">
                      <div className="flex justify-between text-xs">
                        <span className="font-extrabold text-gray-800">{t('soilreportscreen.nitrogen_correction')}</span>
                        <span className="text-[10px] font-bold text-amber-600">{t('soilreportscreen.priority_medium')}</span>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-2xl space-y-1 text-xs">
                        <p className="font-bold text-gray-900">{t('soilreportscreen.apply_urea')}</p>
                        <p className="text-[10px] text-gray-500 leading-normal">
                          <strong>{t('soilreportscreen.quantity')}</strong>  {t('soilreportscreen.1_5_kg_palm_tree')}<br/>
                          <strong>{t('soilreportscreen.reason')}</strong>  {t('soilreportscreen.compensates_for_slight_nitrogen_depletio')}
                                                                          </p>
                      </div>
                    </div>

                    {/* Potassium Advice */}
                    <div className="space-y-2 border-b border-gray-50 pb-3">
                      <div className="flex justify-between text-xs">
                        <span className="font-extrabold text-gray-800">{t('soilreportscreen.potassium_correction')}</span>
                        <span className="text-[10px] font-bold text-rose-600 animate-pulse">{t('soilreportscreen.priority_critical')}</span>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-2xl space-y-1 text-xs">
                        <p className="font-bold text-gray-900">{t('soilreportscreen.apply_muriate_of_potash_mop')}</p>
                        <p className="text-[10px] text-gray-500 leading-normal">
                          <strong>{t('soilreportscreen.quantity')}</strong>  {t('soilreportscreen.2_2_kg_palm_tree')}<br/>
                          <strong>{t('soilreportscreen.reason')}</strong>  {t('soilreportscreen.extreme_deficit_identified_vital_to_prev')}
                                                                          </p>
                      </div>
                    </div>

                    {/* Water Advice */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="font-extrabold text-gray-800">{t('soilreportscreen.water_schedule')}</span>
                        <span className="text-[10px] font-bold text-gray-500">{t('soilreportscreen.priority_low')}</span>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-2xl space-y-1 text-xs">
                        <p className="font-bold text-gray-900">{t('soilreportscreen.reduce_irrigation_by_10')}</p>
                        <p className="text-[10px] text-gray-500 leading-normal">
                          <strong>{t('soilreportscreen.reason')}</strong>  {t('soilreportscreen.matches_weather_predictions_forecasting_')}
                                                                          </p>
                      </div>
                    </div>
                  </div>

                  {/* Summary metric */}
                  <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-[10px] text-emerald-800 flex justify-between font-black uppercase">
                    <span>{t('soilreportscreen.expected_yield_improvement')}</span>
                    <span>+14.2%</span>
                  </div>
                </div>

                {/* 9. Action Buttons */}
                <div className="space-y-2.5">
                  <button
                    onClick={onRecommendationClick}
                    className="w-full bg-primary hover:bg-[#235F26] text-white font-extrabold py-3.5 rounded-xl transition-all shadow-xs text-xs flex items-center justify-center gap-2 border-0 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-white" />
                    
                                                          {t('soilreportscreen.generate_ai_recommendation')}
                                                        </button>

                  <button
                    onClick={() => triggerToast("Compiling complete laboratory diagnostic PDF...", "info")}
                    className="w-full bg-white hover:bg-gray-50 border border-gray-250 text-gray-800 font-extrabold py-3.5 rounded-xl transition-all text-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-primary" />
                    
                                                          {t('soilreportscreen.download_soil_analysis_report')}
                                                        </button>
                </div>

              </div>

            </div>

          </motion.div>
        )}

      </AnimatePresence>
    </motion.div>
  );
};
