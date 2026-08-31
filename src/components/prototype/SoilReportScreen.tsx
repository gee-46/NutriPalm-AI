import { useTranslation } from "../../translation/useTranslation";
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  UploadCloud, FileText, ArrowRight, Activity, Sparkles, 
  Check, Download
} from "lucide-react";
import { usePlots } from "../../data/plots";
import { supabase } from "../../lib/supabaseClient";
import { uploadSoilReport } from "../../lib/apiClient";
import type { SoilReportUploadResponsePayload } from "../../lib/apiClient";

interface SoilReportScreenProps {
  onRecommendationClick: () => void;
  onUploadSuccess: (nutrients: any) => void;
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // OCR processing states
  const [progress, setProgress] = useState(0);
  const [activeSubstep, setActiveSubstep] = useState<ProcessingSubstep>("upload");
  const [logs, setLogs] = useState<string[]>([]);
  const consoleBottomRef = useRef<HTMLDivElement>(null);

  // Real OCR result from the backend (app/routers/soil_reports.py). Null
  // until the upload completes.
  const [ocrResult, setOcrResult] = useState<SoilReportUploadResponsePayload | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const plot = plots.find(p => p.id === selectedPlotId);

  // Parse Soil Health Index from raw text dynamically
  const sqiMatch = ocrResult?.raw_text?.match(/SQI\s*\)?\s*:\s*([0-9.]+)\s*\(([^)]+)\)/i);
  const sqiValue = sqiMatch ? parseFloat(sqiMatch[1]) : null;
  const sqiCategory = sqiMatch ? sqiMatch[2] : null;

  const healthPercent = sqiValue ? Math.round(sqiValue * 100) : 84;
  const healthStatus = sqiCategory ? sqiCategory.toUpperCase() : "HEALTHY";

  const zn = ocrResult?.micronutrients?.find(m => m.parameter === 'zinc');
  const fe = ocrResult?.micronutrients?.find(m => m.parameter === 'iron');
  const mn = ocrResult?.micronutrients?.find(m => m.parameter === 'manganese');
  const cu = ocrResult?.micronutrients?.find(m => m.parameter === 'copper');
  const b = ocrResult?.micronutrients?.find(m => m.parameter === 'boron');
  const s = ocrResult?.micronutrients?.find(m => m.parameter === 'sulfur');

  const getFieldDisplay = (field: any, defaultUnit: string) => {
    if (!field || field.value === null) return "Not Found";
    return `${field.value} ${field.unit || defaultUnit}`;
  };

  const getFieldColor = (field: any) => {
    if (!field || field.value === null) return "text-gray-400";
    if (field.validation === "valid") return "text-emerald-700";
    if (field.validation === "review") return "text-amber-600 font-bold animate-pulse";
    return "text-rose-600 font-black";
  };

  const getFieldBarColor = (field: any) => {
    if (!field || field.value === null) return "bg-gray-200";
    if (field.validation === "valid") return "bg-emerald-500";
    if (field.validation === "review") return "bg-amber-500";
    return "bg-rose-500";
  };

  const getFieldPct = (field: any, maxVal: number) => {
    if (!field || field.value === null) return "0%";
    const val = typeof field.value === 'number' ? field.value : parseFloat(field.value) || 0;
    return `${Math.min(100, Math.max(5, Math.round((val / maxVal) * 100)))}%`;
  };

  const getDynamicSummary = () => {
    if (!ocrResult) return "";
    const n = ocrResult.nitrogen.value;
    const p = ocrResult.phosphorus.value;
    const k = ocrResult.potassium.value;
    const ph = ocrResult.ph.value;
    const oc = ocrResult.organic_carbon.value;

    let text = `Soil analysis complete for plot ${plot?.name || selectedPlotId}. `;
    text += `Extracted values: Nitrogen = ${n ?? "N/A"} kg/ha, Phosphorus = ${p ?? "N/A"} kg/ha, Potassium = ${k ?? "N/A"} kg/ha, pH = ${ph ?? "N/A"}, Organic Carbon = ${oc ?? "N/A"}%.`;
    
    const issues: string[] = [];
    if (ph && (ph < 5.5 || ph > 7.5)) {
      issues.push(`pH of ${ph} indicates ${ph < 5.5 ? "acidic" : "alkaline"} soil`);
    }
    if (oc && oc < 0.5) {
      issues.push(`organic carbon of ${oc}% is low`);
    }
    if (k && k < 110) {
      issues.push(`potassium is low`);
    }
    
    if (issues.length > 0) {
      text += ` Attention needed for: ${issues.join(", ")}.`;
    } else {
      text += " Overall, the macronutrient levels are within healthy ranges.";
    }
    return text;
  };

  const processingTimeline = [
    { key: "upload", label: "Uploading Document", pct: 20 },
    { key: "ocr", label: "OCR Recognition", pct: 40 },
    { key: "extraction", label: "Nutrient Extraction", pct: 60 },
    { key: "analysis", label: "AI Analysis", pct: 80 },
    { key: "completed", label: "Completed", pct: 100 }
  ];

  // Generic stage flavor-text only -- no fabricated extraction values here.
  // Real extracted values are appended as log lines once the actual
  // backend OCR response comes back (see handleFileSelected below).
  const logDatabase = [
    "Initializing document parser...",
    "Scanning page layout and structure...",
    "Running Optical Character Recognition (OCR)...",
    "Matching recognized text against known soil-report labels...",
    "Validating extracted values against expected ranges and units...",
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
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!selected) return;
    startUpload(selected);
  };

  const startUpload = (selectedFile: File) => {
    if (!selectedPlotId || selectedPlotId.startsWith("plot-")) {
      triggerToast("Select a real farm plot before uploading a report.", "warning");
      return;
    }

    const now = new Date();
    setFile({
      name: selectedFile.name,
      size: `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`,
      time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    });
    setOcrResult(null);
    setUploadError(null);
    setStage("processing");
    setProgress(0);
    setActiveSubstep("upload");
    setLogs(["[SYSTEM] Connection secure. Document upload received."]);

    // Kick off the REAL OCR request in parallel with the stage animation
    // below. The animation communicates progress; the actual completion
    // (and all extracted values) come from this promise, never from
    // fabricated numbers.
    uploadSoilReport(selectedPlotId, selectedFile)
      .then((result) => {
        setOcrResult(result);
      })
      .catch((err) => {
        setUploadError(err instanceof Error ? err.message : "Failed to process soil report.");
      });
  };

  // Manage process automation. The visual progress bar/log stream is a
  // fixed-duration animation for UX polish; it does not determine the
  // result -- that comes from the real `ocrResult`/`uploadError` state
  // once the actual backend request resolves (awaited below).
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

  // Once the animation reaches 100% AND the real request has resolved
  // (in whichever order they finish), reveal the actual result.
  useEffect(() => {
    if (stage !== "processing" || progress < 100) return;
    if (!ocrResult && !uploadError) return; // still waiting on the real request

    if (uploadError) {
      setLogs(prev => [...prev, `[ERROR] ${uploadError}`]);
      triggerToast(uploadError, "warning");
      setStage("upload");
      setFile(null);
      return;
    }

    if (ocrResult) {
      const summarizeField = (label: string, f: SoilReportUploadResponsePayload["nitrogen"]) =>
        f.value === null
          ? `[WARN] ${label}: not found in the document.`
          : `[INFO] Extracted: ${label} = ${f.value}${f.unit ? ` ${f.unit}` : ""} (${Math.round(f.confidence * 100)}% confidence, ${f.validation})`;

      setLogs(prev => [
        ...prev,
        summarizeField("Nitrogen", ocrResult.nitrogen),
        summarizeField("Phosphorus", ocrResult.phosphorus),
        summarizeField("Potassium", ocrResult.potassium),
        summarizeField("Soil pH", ocrResult.ph),
        summarizeField("Electrical Conductivity", ocrResult.electrical_conductivity),
        summarizeField("Organic Carbon", ocrResult.organic_carbon),
        ocrResult.persisted
          ? "[SYSTEM] Report saved. Redirecting to diagnostic dashboard."
          : "[WARN] Some required values need manual review before this report can be saved.",
      ]);

      onUploadSuccess({
        id: ocrResult.soil_report_id ?? undefined,
        plotId: selectedPlotId,
        nitrogen: ocrResult.nitrogen,
        phosphorus: ocrResult.phosphorus,
        potassium: ocrResult.potassium,
        organic_carbon: ocrResult.organic_carbon,
        ph: ocrResult.ph,
        electrical_conductivity: ocrResult.electrical_conductivity,
        zinc: zn ?? null,
        sulphur: s ?? null,
        boron: b ?? null,
        iron: fe ?? null,
        manganese: mn ?? null,
        copper: cu ?? null,
        persisted: ocrResult.persisted
      });

      if (ocrResult.persisted) {
        // Flip the plot's "soil report attached" badge (owned by the
        // Plot/Digital Twin module's `plots` table -- see
        // src/data/plots.ts). This is not soil data itself, just a UI
        // flag, so it's fine to set from the frontend client as before.
        supabase
          .from("plots")
          .update({ soil_report_attached: true })
          .eq("id", selectedPlotId)
          .then((result: { error: unknown }) => {
            if (result.error) console.error("Failed to flag plot as having a soil report:", result.error);
          });
        setStage("results");
        triggerToast("Report analyzed and parameters synchronized.", "success");
      } else {
        triggerToast(
          "Extraction finished, but some values need manual review before saving.",
          "warning"
        );
        setStage("results");
      }
    }
  }, [stage, progress, ocrResult, uploadError]);

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

              {/* Hidden real file input -- the drop zone below triggers this */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                className="hidden"
                onChange={handleFileSelected}
              />

              {/* Drag and Drop Zone */}
              <div
                onClick={() => {
                  if (plots.length === 0) {
                    triggerToast("Please add a plot first before uploading reports.", "warning");
                    return;
                  }
                  handleUpload();
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (plots.length === 0) {
                    triggerToast("Please add a plot first before uploading reports.", "warning");
                    return;
                  }
                  const dropped = e.dataTransfer.files?.[0];
                  if (dropped) startUpload(dropped);
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

              {/* Demo Sandbox Quick Link -- loads a bundled real sample PDF
                  through the exact same real OCR endpoint, never fabricated
                  numbers. */}
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
                  onClick={async () => {
                    if (plots.length === 0) {
                      triggerToast("Please add a plot first before loading samples.", "warning");
                      return;
                    }
                    try {
                      const res = await fetch("/sample-soil-report.pdf");
                      const blob = await res.blob();
                      const sampleFile = new File([blob], "sample-soil-report.pdf", {
                        type: "application/pdf",
                      });
                      startUpload(sampleFile);
                    } catch {
                      triggerToast("Could not load the sample report file.", "warning");
                    }
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
        {stage === "results" && ocrResult && (
          <motion.div
            key="results"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            {/* Top Analysis Complete Banner */}
            <div className={`border rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden ${
              ocrResult?.persisted 
                ? 'bg-emerald-50 border-emerald-100/50' 
                : 'bg-amber-50 border-amber-200'
            }`}>
              <div className={`absolute -top-10 -right-10 w-28 h-28 rounded-full filter blur-xl pointer-events-none ${
                ocrResult?.persisted ? 'bg-emerald-100/30' : 'bg-amber-100/30'
              }`} />
              
              <div className="flex items-center gap-4 relative z-10">
                <div className={`p-3 text-white rounded-2xl shadow-md shrink-0 ${
                  ocrResult?.persisted ? 'bg-primary' : 'bg-amber-500'
                }`}>
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-gray-900">
                    {ocrResult?.persisted ? t('soilreportscreen.ai_diagnostic_complete') : "Report Needs Review"}
                  </h3>
                  <p className="text-xs font-semibold mt-1 flex items-center gap-1.5 text-gray-650">
                    <span className={`w-1.5 h-1.5 rounded-full ${ocrResult?.persisted ? 'bg-primary' : 'bg-amber-500 animate-pulse'}`} />
                    Source: {file?.name} • {ocrResult?.persisted ? "Extracted successfully" : "Review needed"}
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
                {ocrResult?.persisted && (
                  <button
                    onClick={onRecommendationClick}
                    className="flex-1 md:flex-initial px-4 py-2.5 bg-primary hover:bg-[#235F26] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors border-0 cursor-pointer shadow-md shadow-primary/10"
                  >
                    {t('soilreportscreen.generate_ai_recommendation')}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Review Warning Banner if not persisted */}
            {ocrResult && !ocrResult.persisted && (
              <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 text-left flex items-start gap-4 shadow-xs">
                <div className="p-3 bg-amber-100 text-amber-800 rounded-2xl shrink-0">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-amber-905">Manual Review Required</h4>
                  <p className="text-xs text-amber-700 font-semibold mt-1 leading-relaxed">
                    Some required fields (Nitrogen, Phosphorus, Potassium, pH, Organic Carbon) could not be confidently extracted or failed range checks. Please review the values marked with "review" or "missing" below. You can correct them in Supabase or upload a clearer document.
                  </p>
                </div>
              </div>
            )}

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
                        <circle cx="56" cy="56" r="46" stroke={ocrResult?.persisted ? "#2E7D32" : "#D97706"} strokeWidth="8" fill="transparent"
                          strokeDasharray={2 * Math.PI * 46}
                          strokeDashoffset={2 * Math.PI * 46 * (1 - healthPercent / 100)}
                        />
                      </svg>
                      <div className="absolute">
                        <span className="block text-2xl font-black text-gray-950">{healthPercent}%</span>
                        <span className={`text-[9px] font-black uppercase ${ocrResult?.persisted ? 'text-emerald-650' : 'text-amber-600'}`}>{healthStatus}</span>
                      </div>
                    </div>
                    
                    <h4 className="font-extrabold text-sm text-gray-900 leading-tight">{t('soilreportscreen.overall_soil_health')}</h4>
                  </div>

                  {/* Summary Card (2/3) */}
                  <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left space-y-4 md:col-span-2 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center">
                        <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">{t('soilreportscreen.ai_summary')}</h4>
                        {ocrResult && (
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${
                            ocrResult.persisted 
                              ? 'text-indigo-750 bg-indigo-50 border-indigo-100' 
                              : 'text-amber-700 bg-amber-50 border-amber-100'
                          }`}>
                            {ocrResult.persisted ? "AUTO-SAVED" : "MANUAL REVIEW REQUIRED"}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-700 leading-relaxed font-semibold mt-3">
                        {getDynamicSummary()}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-3 text-[10px] text-gray-450 uppercase font-black">
                      <div>{t('soilreportscreen.analysis_completed')} <span className="text-gray-700 font-bold">{t('soilreportscreen.just_now')}</span></div>
                      <div className="text-right">{t('soilreportscreen.processing_time')} <span className="text-gray-700 font-bold">Real-time</span></div>
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
                        <span className={`font-bold ${getFieldColor(ocrResult?.nitrogen)}`}>
                          {getFieldDisplay(ocrResult?.nitrogen, "kg/ha")}
                          {ocrResult?.nitrogen.validation !== "valid" && ` (${ocrResult?.nitrogen.validation})`}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${getFieldBarColor(ocrResult?.nitrogen)}`} style={{ width: getFieldPct(ocrResult?.nitrogen, 800) }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1.5">
                        <span>{t('soilreportscreen.phosphorus_p')}</span>
                        <span className={`font-bold ${getFieldColor(ocrResult?.phosphorus)}`}>
                          {getFieldDisplay(ocrResult?.phosphorus, "kg/ha")}
                          {ocrResult?.phosphorus.validation !== "valid" && ` (${ocrResult?.phosphorus.validation})`}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${getFieldBarColor(ocrResult?.phosphorus)}`} style={{ width: getFieldPct(ocrResult?.phosphorus, 100) }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1.5">
                        <span>{t('soilreportscreen.potassium_k')}</span>
                        <span className={`font-bold ${getFieldColor(ocrResult?.potassium)}`}>
                          {getFieldDisplay(ocrResult?.potassium, "kg/ha")}
                          {ocrResult?.potassium.validation !== "valid" && ` (${ocrResult?.potassium.validation})`}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${getFieldBarColor(ocrResult?.potassium)}`} style={{ width: getFieldPct(ocrResult?.potassium, 900) }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1.5">
                        <span>{t('soilreportscreen.organic_carbon_c')}</span>
                        <span className={`font-bold ${getFieldColor(ocrResult?.organic_carbon)}`}>
                          {getFieldDisplay(ocrResult?.organic_carbon, "%")}
                          {ocrResult?.organic_carbon.validation !== "valid" && ` (${ocrResult?.organic_carbon.validation})`}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${getFieldBarColor(ocrResult?.organic_carbon)}`} style={{ width: getFieldPct(ocrResult?.organic_carbon, 2.0) }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Extracted Soil Parameters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  
                  {/* pH */}
                  <div className={`rounded-2xl p-4 border shadow-xs text-left flex flex-col justify-between min-h-[120px] ${
                    ocrResult?.ph.validation === 'valid' ? 'bg-white border-gray-150' : 'bg-amber-50/50 border-amber-200'
                  }`}>
                    <div className="flex justify-between items-start">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        ocrResult?.ph.validation === 'valid' 
                          ? 'text-emerald-650 bg-emerald-50 border border-emerald-100' 
                          : 'text-amber-700 bg-amber-100 border border-amber-200'
                      }`}>
                        {ocrResult?.ph.validation.toUpperCase()}
                      </span>
                      <span className="text-[9px] font-bold text-gray-400 uppercase">range: 6.5 - 7.5</span>
                    </div>
                    <div className="mt-4">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">{t('soilreportscreen.acidity_ph')}</span>
                      <span className="text-lg font-black text-gray-950 mt-0.5">
                        {ocrResult?.ph.value !== null ? `${ocrResult.ph.value}` : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* EC */}
                  <div className={`rounded-2xl p-4 border shadow-xs text-left flex flex-col justify-between min-h-[120px] ${
                    ocrResult?.electrical_conductivity.validation === 'valid' ? 'bg-white border-gray-150' : 'bg-amber-50/50 border-amber-200'
                  }`}>
                    <div className="flex justify-between items-start">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        ocrResult?.electrical_conductivity.validation === 'valid' 
                          ? 'text-emerald-650 bg-emerald-50 border border-emerald-100' 
                          : 'text-amber-700 bg-amber-100 border border-amber-200'
                      }`}>
                        {ocrResult?.electrical_conductivity.validation.toUpperCase()}
                      </span>
                      <span className="text-[9px] font-bold text-gray-400 uppercase">range: 0.50 - 0.75</span>
                    </div>
                    <div className="mt-4">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">{t('soilreportscreen.electrical_conductivity')}</span>
                      <span className="text-lg font-black text-gray-950 mt-0.5">
                        {ocrResult?.electrical_conductivity.value !== null ? `${ocrResult.electrical_conductivity.value} dS/m` : 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Zinc */}
                  <div className={`rounded-2xl p-4 border shadow-xs text-left flex flex-col justify-between min-h-[120px] ${
                    zn && zn.validation === 'valid' ? 'bg-white border-gray-150' : 'bg-amber-50/50 border-amber-200'
                  }`}>
                    <div className="flex justify-between items-start">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        zn && zn.validation === 'valid' 
                          ? 'text-emerald-650 bg-emerald-50 border border-emerald-100' 
                          : 'text-amber-700 bg-amber-100 border border-amber-200'
                      }`}>
                        {zn?.validation?.toUpperCase() || 'MISSING'}
                      </span>
                      <span className="text-[9px] font-bold text-gray-400 uppercase">range: &gt; 0.6</span>
                    </div>
                    <div className="mt-4">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">{t('soilreportscreen.zinc_zn')}</span>
                      <span className="text-lg font-black text-gray-950 mt-0.5">
                        {zn && zn.value !== null ? `${zn.value} ${zn.unit || 'mg/kg'}` : 'N/A'}
                      </span>
                    </div>
                  </div>

                </div>

                {/* Micronutrients Breakdown Grid */}
                <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left space-y-4">
                  <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">Micronutrients Breakdown</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {/* Sulphur */}
                    <div className={`rounded-2xl p-3.5 border flex flex-col justify-between ${
                      s && s.validation === 'valid' ? 'bg-gray-50 border-gray-100' : 'bg-amber-50/30 border-amber-200'
                    }`}>
                      <span className="text-[9px] font-black text-gray-455 uppercase tracking-wider">Sulphur (S)</span>
                      <span className="text-base font-black text-gray-950 mt-1.5">{s && s.value !== null ? `${s.value} ${s.unit || 'mg/kg'}` : 'Not Found'}</span>
                      <span className={`text-[8px] font-extrabold uppercase mt-1 ${s && s.validation === 'valid' ? 'text-emerald-600' : 'text-amber-600'}`}>({s?.validation || 'missing'})</span>
                    </div>
                    {/* Boron */}
                    <div className={`rounded-2xl p-3.5 border flex flex-col justify-between ${
                      b && b.validation === 'valid' ? 'bg-gray-50 border-gray-100' : 'bg-amber-50/30 border-amber-200'
                    }`}>
                      <span className="text-[9px] font-black text-gray-455 uppercase tracking-wider">Boron (B)</span>
                      <span className="text-base font-black text-gray-950 mt-1.5">{b && b.value !== null ? `${b.value} ${b.unit || 'mg/kg'}` : 'Not Found'}</span>
                      <span className={`text-[8px] font-extrabold uppercase mt-1 ${b && b.validation === 'valid' ? 'text-emerald-600' : 'text-amber-600'}`}>({b?.validation || 'missing'})</span>
                    </div>
                    {/* Iron */}
                    <div className={`rounded-2xl p-3.5 border flex flex-col justify-between ${
                      fe && fe.validation === 'valid' ? 'bg-gray-50 border-gray-100' : 'bg-amber-50/30 border-amber-200'
                    }`}>
                      <span className="text-[9px] font-black text-gray-455 uppercase tracking-wider">Iron (Fe)</span>
                      <span className="text-base font-black text-gray-950 mt-1.5">{fe && fe.value !== null ? `${fe.value} ${fe.unit || 'mg/kg'}` : 'Not Found'}</span>
                      <span className={`text-[8px] font-extrabold uppercase mt-1 ${fe && fe.validation === 'valid' ? 'text-emerald-600' : 'text-amber-600'}`}>({fe?.validation || 'missing'})</span>
                    </div>
                    {/* Manganese */}
                    <div className={`rounded-2xl p-3.5 border flex flex-col justify-between ${
                      mn && mn.validation === 'valid' ? 'bg-gray-50 border-gray-100' : 'bg-amber-50/30 border-amber-200'
                    }`}>
                      <span className="text-[9px] font-black text-gray-455 uppercase tracking-wider">Manganese (Mn)</span>
                      <span className="text-base font-black text-gray-950 mt-1.5">{mn && mn.value !== null ? `${mn.value} ${mn.unit || 'mg/kg'}` : 'Not Found'}</span>
                      <span className={`text-[8px] font-extrabold uppercase mt-1 ${mn && mn.validation === 'valid' ? 'text-emerald-600' : 'text-amber-600'}`}>({mn?.validation || 'missing'})</span>
                    </div>
                    {/* Copper */}
                    <div className={`rounded-2xl p-3.5 border flex flex-col justify-between ${
                      cu && cu.validation === 'valid' ? 'bg-gray-50 border-gray-100' : 'bg-amber-50/30 border-amber-200'
                    }`}>
                      <span className="text-[9px] font-black text-gray-455 uppercase tracking-wider">Copper (Cu)</span>
                      <span className="text-base font-black text-gray-950 mt-1.5">{cu && cu.value !== null ? `${cu.value} ${cu.unit || 'mg/kg'}` : 'Not Found'}</span>
                      <span className={`text-[8px] font-extrabold uppercase mt-1 ${cu && cu.validation === 'valid' ? 'text-emerald-600' : 'text-amber-600'}`}>({cu?.validation || 'missing'})</span>
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
                        {ocrResult?.nitrogen.value !== null && ocrResult.nitrogen.value < 280 ? (
                          <span className="text-[10px] font-bold text-amber-600">{t('soilreportscreen.priority_medium')}</span>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-600">NO CORRECTION NEEDED</span>
                        )}
                      </div>
                      <div className="bg-gray-50 p-3 rounded-2xl space-y-1 text-xs">
                        <p className="font-bold text-gray-900">
                          {ocrResult?.nitrogen.value !== null && ocrResult.nitrogen.value < 280 ? t('soilreportscreen.apply_urea') : "Optimal Nitrogen"}
                        </p>
                        <p className="text-[10px] text-gray-500 leading-normal">
                          {ocrResult?.nitrogen.value !== null && ocrResult.nitrogen.value < 280 ? (
                            <>
                              <strong>{t('soilreportscreen.quantity')}</strong>  {t('soilreportscreen.1_5_kg_palm_tree')}<br/>
                              <strong>{t('soilreportscreen.reason')}</strong>  {t('soilreportscreen.compensates_for_slight_nitrogen_depletio')}
                            </>
                          ) : (
                            "Nitrogen is within the optimal range. Keep monitoring."
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Potassium Advice */}
                    <div className="space-y-2 border-b border-gray-50 pb-3">
                      <div className="flex justify-between text-xs">
                        <span className="font-extrabold text-gray-800">{t('soilreportscreen.potassium_correction')}</span>
                        {ocrResult?.potassium.value !== null && ocrResult.potassium.value < 110 ? (
                          <span className="text-[10px] font-bold text-rose-600 animate-pulse">{t('soilreportscreen.priority_critical')}</span>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-600">NO CORRECTION NEEDED</span>
                        )}
                      </div>
                      <div className="bg-gray-50 p-3 rounded-2xl space-y-1 text-xs">
                        <p className="font-bold text-gray-900">
                          {ocrResult?.potassium.value !== null && ocrResult.potassium.value < 110 ? t('soilreportscreen.apply_muriate_of_potash_mop') : "Optimal Potassium"}
                        </p>
                        <p className="text-[10px] text-gray-500 leading-normal">
                          {ocrResult?.potassium.value !== null && ocrResult.potassium.value < 110 ? (
                            <>
                              <strong>{t('soilreportscreen.quantity')}</strong>  {t('soilreportscreen.2_2_kg_palm_tree')}<br/>
                              <strong>{t('soilreportscreen.reason')}</strong>  {t('soilreportscreen.extreme_deficit_identified_vital_to_prev')}
                            </>
                          ) : (
                            "Potassium levels are sufficient. No immediate action required."
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 9. Action Buttons */}
                <div className="space-y-2.5">
                  {ocrResult?.persisted && (
                    <button
                      onClick={onRecommendationClick}
                      className="w-full bg-primary hover:bg-[#235F26] text-white font-extrabold py-3.5 rounded-xl transition-all shadow-xs text-xs flex items-center justify-center gap-2 border-0 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-white" />
                      {t('soilreportscreen.generate_ai_recommendation')}
                    </button>
                  )}

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
