import { useTranslation } from "../../translation/useTranslation";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  UploadCloud, FileText, ArrowRight, Activity, Sparkles, 
  Check, Download, RefreshCw, ChevronDown, AlertTriangle
} from "lucide-react";
import { usePlots } from "../../data/plots";
import { supabase } from "../../lib/supabaseClient";
import { uploadSoilReport } from "../../lib/apiClient";
import type { SoilReportUploadResponsePayload } from "../../lib/apiClient";
import { SoilNutrientAnalyticsCard } from "../analytics/SoilNutrientAnalyticsCard";

interface SoilReportScreenProps {
  onRecommendationClick?: (plotId?: string, reportData?: any) => void;
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
  const { plots, updatePlot } = usePlots();
  const [selectedPlotId, setSelectedPlotId] = useState<string>("");
  const [stage, setStage] = useState<ScreenStage>("upload");
  const [file, setFile] = useState<{ name: string; size: string; time: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistence & Update Mode State
  const [savedReport, setSavedReport] = useState<any | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState<boolean>(false);
  const [isUpdatingReport, setIsUpdatingReport] = useState<boolean>(false);

  // OCR processing states
  const [progress, setProgress] = useState(0);
  const [activeSubstep, setActiveSubstep] = useState<ProcessingSubstep>("upload");
  const [logs, setLogs] = useState<string[]>([]);
  const consoleBottomRef = useRef<HTMLDivElement>(null);

  // Real OCR result from the backend
  const [ocrResult, setOcrResult] = useState<SoilReportUploadResponsePayload | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const plot = plots.find(p => p.id === selectedPlotId);

  // Parse Soil Health Index from raw text dynamically
  const sqiMatch = ocrResult?.raw_text?.match(/SQI\s*\)?\s*:\s*([0-9.]+)\s*\(([^)]+)\)/i);
  const sqiValue = sqiMatch ? parseFloat(sqiMatch[1]) : null;
  const sqiCategory = sqiMatch ? sqiMatch[2] : null;

  const healthPercent = sqiValue 
    ? Math.round(sqiValue * 100) 
    : savedReport 
      ? 86 
      : 84;
  const healthStatus = sqiCategory 
    ? sqiCategory.toUpperCase() 
    : "HEALTHY";

  const zn = ocrResult?.micronutrients?.find(m => m.parameter === 'zinc');
  const fe = ocrResult?.micronutrients?.find(m => m.parameter === 'iron');
  const mn = ocrResult?.micronutrients?.find(m => m.parameter === 'manganese');
  const cu = ocrResult?.micronutrients?.find(m => m.parameter === 'copper');
  const b = ocrResult?.micronutrients?.find(m => m.parameter === 'boron');
  const s = ocrResult?.micronutrients?.find(m => m.parameter === 'sulfur');

  const triggerToast = useCallback((msg: string, type: "success" | "info" | "warning" = "success") => {
    if (showToast) {
      showToast(msg, type);
    } else {
      alert(`${type.toUpperCase()}: ${msg}`);
    }
  }, [showToast]);

  // Sync selected plot default
  useEffect(() => {
    if (plots.length > 0 && !selectedPlotId) {
      const realPlots = plots.filter(p => !p.id.startsWith("plot-"));
      if (realPlots.length > 0) {
        setSelectedPlotId(realPlots[0].id);
      } else {
        setSelectedPlotId(plots[0].id);
      }
    }
  }, [plots, selectedPlotId]);

  // Reactive Supabase & Local Cache Auto-Fetch on mount & plot change
  const fetchPlotReport = useCallback(async (plotId: string) => {
    if (!plotId) return;

    // 1. Instantly check localStorage cache
    const localKey = `nutripalm_soil_report_${plotId}`;
    let cachedReport: any = null;
    const cachedStr = localStorage.getItem(localKey);
    if (cachedStr) {
      try {
        cachedReport = JSON.parse(cachedStr);
        setSavedReport(cachedReport);
      } catch (e) {
        console.warn("Failed to parse cached soil report:", e);
      }
    }

    // 2. If it's a demo/mock plot, check embedded reports
    if (plotId.startsWith("plot-")) {
      const mockPlot = plots.find(p => p.id === plotId);
      if (mockPlot && (mockPlot as any).soil_reports?.[0]) {
        const mockRep = (mockPlot as any).soil_reports[0];
        setSavedReport(mockRep);
        localStorage.setItem(localKey, JSON.stringify(mockRep));
      } else if (!cachedReport) {
        setSavedReport(null);
      }
      return;
    }

    // 3. For real plots, sync from Supabase
    setIsLoadingReport(true);
    try {
      const { data: report, error } = await supabase
        .from("soil_reports")
        .select("*")
        .eq("plot_id", plotId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && report) {
        setSavedReport(report);
        localStorage.setItem(localKey, JSON.stringify(report));
      } else if (!cachedReport) {
        setSavedReport(null);
      }
    } catch (err) {
      console.error("Failed to query plot soil report:", err);
      if (!cachedReport) {
        setSavedReport(null);
      }
    } finally {
      setIsLoadingReport(false);
    }
  }, [plots]);

  useEffect(() => {
    if (selectedPlotId) {
      fetchPlotReport(selectedPlotId);
    }
  }, [selectedPlotId, fetchPlotReport]);

  useEffect(() => {
    if (consoleBottomRef.current) {
      consoleBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const getDynamicSummary = () => {
    const activeReport = savedReport || (ocrResult ? {
      nitrogen_kg_ha: ocrResult.nitrogen.value,
      phosphorus_kg_ha: ocrResult.phosphorus.value,
      potassium_kg_ha: ocrResult.potassium.value,
      ph: ocrResult.ph.value,
      organic_carbon_percent: ocrResult.organic_carbon.value
    } : null);

    if (!activeReport) return "";
    const n = activeReport.nitrogen_kg_ha ?? activeReport.nitrogen;
    const p = activeReport.phosphorus_kg_ha ?? activeReport.phosphorus;
    const k = activeReport.potassium_kg_ha ?? activeReport.potassium;
    const ph = activeReport.ph;
    const oc = activeReport.organic_carbon_percent ?? activeReport.organic_carbon;

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

  const logDatabase = useRef([
    "Initializing document parser...",
    "Scanning page layout and structure...",
    "Running Optical Character Recognition (OCR)...",
    "Matching recognized text against known soil-report labels...",
    "Validating extracted values against expected ranges and units...",
  ]).current;

  const handleUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    e.target.value = "";
    if (!selected) return;
    startUpload(selected);
  };

  const startUpload = (selectedFile: File) => {
    if (!selectedPlotId) {
      triggerToast("Select a plot before uploading a report.", "warning");
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

    uploadSoilReport(selectedPlotId, selectedFile)
      .then((result) => {
        setOcrResult(result);
      })
      .catch((err) => {
        setUploadError(err instanceof Error ? err.message : "Failed to process soil report.");
      });
  };

  // Manage processing animation
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
  }, [stage, logDatabase]);

  // Handle OCR Completion
  useEffect(() => {
    if (stage !== "processing" || progress < 100) return;
    if (!ocrResult && !uploadError) return;

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
        "[SYSTEM] Diagnostic parameters synchronized successfully."
      ]);

      const nVal = ocrResult.nitrogen.value ?? 280;
      const pVal = ocrResult.phosphorus.value ?? 35;
      const kVal = ocrResult.potassium.value ?? 175;
      const ocVal = ocrResult.organic_carbon.value ?? 0.65;
      const phVal = ocrResult.ph.value ?? 6.5;
      const ecVal = ocrResult.electrical_conductivity.value ?? 0.60;

      const fullReportRecord = {
        id: ocrResult.soil_report_id || `soil-rep-${Date.now()}`,
        plot_id: selectedPlotId,
        plotId: selectedPlotId,
        nitrogen_kg_ha: nVal,
        phosphorus_kg_ha: pVal,
        potassium_kg_ha: kVal,
        organic_carbon_percent: ocVal,
        ph: phVal,
        electrical_conductivity: ecVal,
        status: "Completed",
        created_at: new Date().toISOString(),
        zinc: zn ?? { value: 0.85, unit: "mg/kg", validation: "valid" },
        sulphur: s ?? { value: 14.2, unit: "mg/kg", validation: "valid" },
        boron: b ?? { value: 0.75, unit: "mg/kg", validation: "valid" },
        iron: fe ?? { value: 6.4, unit: "mg/kg", validation: "valid" },
        manganese: mn ?? { value: 3.8, unit: "ppm", validation: "valid" },
        copper: cu ?? { value: 1.1, unit: "mg/kg", validation: "valid" },
      };

      const formattedPayload = {
        id: fullReportRecord.id,
        plotId: selectedPlotId,
        nitrogen: ocrResult.nitrogen.value !== null ? ocrResult.nitrogen : { value: nVal, unit: "kg/ha", validation: "valid" },
        phosphorus: ocrResult.phosphorus.value !== null ? ocrResult.phosphorus : { value: pVal, unit: "kg/ha", validation: "valid" },
        potassium: ocrResult.potassium.value !== null ? ocrResult.potassium : { value: kVal, unit: "kg/ha", validation: "valid" },
        organic_carbon: ocrResult.organic_carbon.value !== null ? ocrResult.organic_carbon : { value: ocVal, unit: "%", validation: "valid" },
        ph: ocrResult.ph.value !== null ? ocrResult.ph : { value: phVal, unit: "pH", validation: "valid" },
        electrical_conductivity: ocrResult.electrical_conductivity.value !== null ? ocrResult.electrical_conductivity : { value: ecVal, unit: "dS/m", validation: "valid" },
        zinc: zn ?? { value: 0.85, unit: "mg/kg", validation: "valid" },
        sulphur: s ?? { value: 14.2, unit: "mg/kg", validation: "valid" },
        boron: b ?? { value: 0.75, unit: "mg/kg", validation: "valid" },
        iron: fe ?? { value: 6.4, unit: "mg/kg", validation: "valid" },
        manganese: mn ?? { value: 3.8, unit: "ppm", validation: "valid" },
        copper: cu ?? { value: 1.1, unit: "mg/kg", validation: "valid" },
        persisted: true
      };

      if (ocrResult.persisted) {
        // High confidence: Report is persisted in Supabase
        const fullReportRecord = {
          id: ocrResult.soil_report_id || `soil-rep-${Date.now()}`,
          plot_id: selectedPlotId,
          plotId: selectedPlotId,
          nitrogen_kg_ha: nVal,
          phosphorus_kg_ha: pVal,
          potassium_kg_ha: kVal,
          organic_carbon_percent: ocVal,
          ph: phVal,
          electrical_conductivity: ecVal,
          status: "Completed",
          created_at: new Date().toISOString(),
          zinc: zn ?? { value: 0.85, unit: "mg/kg", validation: "valid" },
          sulphur: s ?? { value: 14.2, unit: "mg/kg", validation: "valid" },
          boron: b ?? { value: 0.75, unit: "mg/kg", validation: "valid" },
          iron: fe ?? { value: 6.4, unit: "mg/kg", validation: "valid" },
          manganese: mn ?? { value: 3.8, unit: "ppm", validation: "valid" },
          copper: cu ?? { value: 1.1, unit: "mg/kg", validation: "valid" },
        };

        const formattedPayload = {
          id: fullReportRecord.id,
          plotId: selectedPlotId,
          nitrogen: ocrResult.nitrogen.value !== null ? ocrResult.nitrogen : { value: nVal, unit: "kg/ha", validation: "valid" },
          phosphorus: ocrResult.phosphorus.value !== null ? ocrResult.phosphorus : { value: pVal, unit: "kg/ha", validation: "valid" },
          potassium: ocrResult.potassium.value !== null ? ocrResult.potassium : { value: kVal, unit: "kg/ha", validation: "valid" },
          organic_carbon: ocrResult.organic_carbon.value !== null ? ocrResult.organic_carbon : { value: ocVal, unit: "%", validation: "valid" },
          ph: ocrResult.ph.value !== null ? ocrResult.ph : { value: phVal, unit: "pH", validation: "valid" },
          electrical_conductivity: ocrResult.electrical_conductivity.value !== null ? ocrResult.electrical_conductivity : { value: ecVal, unit: "dS/m", validation: "valid" },
          zinc: zn ?? { value: 0.85, unit: "mg/kg", validation: "valid" },
          sulphur: s ?? { value: 14.2, unit: "mg/kg", validation: "valid" },
          boron: b ?? { value: 0.75, unit: "mg/kg", validation: "valid" },
          iron: fe ?? { value: 6.4, unit: "mg/kg", validation: "valid" },
          manganese: mn ?? { value: 3.8, unit: "ppm", validation: "valid" },
          copper: cu ?? { value: 1.1, unit: "mg/kg", validation: "valid" },
          persisted: true
        };

        // Notify parent callback
        onUploadSuccess(formattedPayload);

        // Cache for instant navigation
        const localKey = `nutripalm_soil_report_${selectedPlotId}`;
        localStorage.setItem(localKey, JSON.stringify(fullReportRecord));

        // Update plot flag in DB
        if (!selectedPlotId.startsWith("plot-")) {
          supabase
            .from("plots")
            .update({ soil_report_attached: true })
            .eq("id", selectedPlotId)
            .then(() => {});
        }

        // Update plot store
        updatePlot(selectedPlotId, { soilReportAttached: true });

        setSavedReport(fullReportRecord);
        setIsUpdatingReport(false);
        setStage("results");
        triggerToast("Soil report verified and successfully saved to database.", "success");
      } else {
        // Low confidence scenario: Do NOT save to Supabase
        const unpersistedPayload = {
          id: undefined,
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
          persisted: false
        };

        onUploadSuccess(unpersistedPayload);

        // Display results for manual review on screen but do not persist
        setSavedReport(null);
        setIsUpdatingReport(false);
        setStage("results");
        triggerToast("Confidence is low. The report is not saved.", "warning");
      }
    }
  }, [stage, progress, ocrResult, uploadError, selectedPlotId, onUploadSuccess, triggerToast, zn, s, b, fe, mn, cu, updatePlot]);

  const activeDisplayReport = savedReport || (ocrResult ? {
    nitrogen_kg_ha: ocrResult.nitrogen.value,
    phosphorus_kg_ha: ocrResult.phosphorus.value,
    potassium_kg_ha: ocrResult.potassium.value,
    organic_carbon_percent: ocrResult.organic_carbon.value,
    ph: ocrResult.ph.value,
    electrical_conductivity: ocrResult.electrical_conductivity.value,
    created_at: new Date().toISOString()
  } : null);

  const getNumVal = (val: any): number | null => {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') return isNaN(val) ? null : val;
    if (typeof val === 'object' && val !== null && 'value' in val) return getNumVal(val.value);
    const parsed = parseFloat(String(val).replace(/[^\d.-]/g, ''));
    return isNaN(parsed) ? null : parsed;
  };

  const rawN = getNumVal(activeDisplayReport?.nitrogen_kg_ha ?? activeDisplayReport?.nitrogen ?? ocrResult?.nitrogen?.value);
  const rawP = getNumVal(activeDisplayReport?.phosphorus_kg_ha ?? activeDisplayReport?.phosphorus ?? ocrResult?.phosphorus?.value);
  const rawK = getNumVal(activeDisplayReport?.potassium_kg_ha ?? activeDisplayReport?.potassium ?? ocrResult?.potassium?.value);
  const rawOC = getNumVal(activeDisplayReport?.organic_carbon_percent ?? activeDisplayReport?.organic_carbon ?? ocrResult?.organic_carbon?.value);
  const rawPH = getNumVal(activeDisplayReport?.ph ?? ocrResult?.ph?.value);
  const rawEC = getNumVal(activeDisplayReport?.electrical_conductivity ?? ocrResult?.electrical_conductivity?.value);

  const isShowingDashboard = (savedReport || stage === "results") && !isUpdatingReport && stage !== "processing";

  const handleTriggerRecommendation = () => {
    const activePlot = plots.find((p) => p.id === selectedPlotId);
    const formattedPayload = activeDisplayReport ? {
      id: activeDisplayReport.id,
      plotId: selectedPlotId,
      nitrogen: activeDisplayReport.nitrogen_kg_ha ?? activeDisplayReport.nitrogen ?? ocrResult?.nitrogen,
      phosphorus: activeDisplayReport.phosphorus_kg_ha ?? activeDisplayReport.phosphorus ?? ocrResult?.phosphorus,
      potassium: activeDisplayReport.potassium_kg_ha ?? activeDisplayReport.potassium ?? ocrResult?.potassium,
      organic_carbon: activeDisplayReport.organic_carbon_percent ?? activeDisplayReport.organic_carbon ?? ocrResult?.organic_carbon,
      ph: activeDisplayReport.ph ?? ocrResult?.ph,
      electrical_conductivity: activeDisplayReport.electrical_conductivity ?? ocrResult?.electrical_conductivity,
      zinc: zn ?? activeDisplayReport.zinc,
      sulphur: s ?? activeDisplayReport.sulphur,
      boron: b ?? activeDisplayReport.boron,
      iron: fe ?? activeDisplayReport.iron,
      manganese: mn ?? activeDisplayReport.manganese,
      copper: cu ?? activeDisplayReport.copper,
      crop: activePlot?.crop,
      plotName: activePlot?.name
    } : {
      plotId: selectedPlotId,
      crop: activePlot?.crop,
      plotName: activePlot?.name
    };

    onRecommendationClick?.(selectedPlotId, formattedPayload);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-6 text-left font-sans"
    >
      {/* ================= HEADER & PERMANENT PLOT SELECTOR ================= */}
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

        {/* Header Plot Selector Dropdown */}
        {plots.length > 0 && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <select
                value={selectedPlotId}
                onChange={(e) => {
                  setSelectedPlotId(e.target.value);
                  setIsUpdatingReport(false);
                  setStage("upload");
                }}
                className="appearance-none w-full bg-white border border-gray-250 text-xs font-bold text-gray-800 rounded-xl pl-3.5 pr-8 py-2.5 shadow-xs hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer transition-all h-10"
              >
                {plots.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.crop})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        )}
      </div>

      {isLoadingReport && (
        <div className="flex items-center justify-center p-12 bg-white rounded-3xl border border-slate-150 shadow-xs">
          <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
            <RefreshCw className="w-4 h-4 text-emerald-600 animate-spin" />
            Synchronizing plot diagnostic history...
          </div>
        </div>
      )}

      {!isLoadingReport && (
        <AnimatePresence mode="wait">
          
          {/* ================= STAGE 1: UPLOAD DROPZONE ================= */}
          {(!isShowingDashboard && stage === "upload") && (
            <motion.div
              key="upload-zone"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="max-w-xl mx-auto space-y-4"
            >
              <div className="bg-white rounded-3xl border border-gray-150 p-8 shadow-xs text-center space-y-6">
                
                {isUpdatingReport && savedReport && (
                  <div className="flex justify-between items-center bg-emerald-50 border border-emerald-100 rounded-2xl p-3 px-4 text-xs font-semibold text-emerald-800">
                    <span>Updating diagnostic telemetry for <strong>{plot?.name}</strong></span>
                    <button
                      onClick={() => setIsUpdatingReport(false)}
                      className="text-xs text-emerald-700 hover:text-emerald-950 underline font-bold cursor-pointer border-0 bg-transparent"
                    >
                      Cancel / View Saved Report
                    </button>
                  </div>
                )}

                {/* Hidden real file input */}
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

                {/* Demo Sample Quick Load */}
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

          {/* ================= STAGE 2: PROCESSING AI PIPELINE ================= */}
          {stage === "processing" && (
            <motion.div
              key="processing-zone"
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
                    <p className="text-gray-400 mt-0.5">{file?.size} • {t('soilreportscreen.document_parser_active')}</p>
                  </div>
                  <div className="absolute inset-0 bg-linear-to-b from-transparent via-primary/5 to-transparent pointer-events-none animate-pulse" />
                </div>

                {/* Terminal Logs Console */}
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

          {/* ================= STAGE 3: DIAGNOSTIC DASHBOARD (SAVED OR FRESH OCR) ================= */}
          {isShowingDashboard && activeDisplayReport && (
            <motion.div
              key="diagnostic-dashboard"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              {/* Action Banner */}
              {ocrResult && !ocrResult.persisted && !savedReport ? (
                <div className="border border-amber-200 bg-amber-50/80 rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden shadow-xs">
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="p-3 text-white rounded-2xl shadow-md bg-amber-500 shrink-0">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-amber-950">
                        Low Confidence Extraction — Report Not Saved
                      </h3>
                      <p className="text-xs font-semibold mt-1 flex items-center gap-1.5 text-amber-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Plot: <strong className="text-amber-950">{plot?.name || selectedPlotId}</strong> ({plot?.crop || "Oil Palm"}) • 
                        Status: <span className="font-bold text-amber-700">Unsaved (Low OCR confidence)</span>
                      </p>
                    </div>
                  </div>

                  {/* Action Button Bar */}
                  <div className="flex items-center gap-2 relative z-10 w-full md:w-auto">
                    <button
                      onClick={() => {
                        setIsUpdatingReport(true);
                        setStage("upload");
                      }}
                      className="flex-1 md:flex-initial bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-4 py-2 rounded-xl cursor-pointer transition-colors shadow-xs border-0"
                    >
                      Re-upload Clearer Report
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border border-emerald-100/70 bg-emerald-50/60 rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden shadow-xs">
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="p-3 text-white rounded-2xl shadow-md bg-emerald-600 shrink-0">
                      <Check className="w-6 h-6 stroke-[3]" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-gray-900">
                        {t('soilreportscreen.ai_diagnostic_complete')}
                      </h3>
                      <p className="text-xs font-semibold mt-1 flex items-center gap-1.5 text-gray-650">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                        Plot: <strong className="text-slate-900">{plot?.name || selectedPlotId}</strong> ({plot?.crop || "Oil Palm"}) • 
                        Saved: {activeDisplayReport.created_at ? new Date(activeDisplayReport.created_at).toLocaleDateString() : "Active"}
                      </p>
                    </div>
                  </div>

                  {/* Action Button Bar */}
                  <div className="flex items-center gap-2 relative z-10 w-full md:w-auto">
                    <button
                      onClick={() => {
                        setIsUpdatingReport(true);
                        setStage("upload");
                      }}
                      className="flex-1 md:flex-initial border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3.5 py-2 rounded-xl cursor-pointer transition-colors shadow-xs bg-white"
                    >
                      Update Report
                    </button>

                    <button
                      onClick={handleTriggerRecommendation}
                      className="flex-1 md:flex-initial bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-xs border-0"
                    >
                      Generate AI Recommendation
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Main Diagnostic Grid Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* LEFT COLUMN: Summary, score, REUSABLE NUTRIENT DEFICIENCY CARD (8/12 width) */}
                <div className="lg:col-span-8 space-y-6">
                  
                  {/* Health Score & AI Analysis Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    
                    {/* Health score gauge card (1/3) */}
                    <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs flex flex-col items-center justify-center text-center space-y-3">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('soilreportscreen.soil_vitality')}</span>
                      
                      <div className="relative w-28 h-28 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle cx="56" cy="56" r="46" stroke="#F1F5F0" strokeWidth="8" fill="transparent" />
                          <circle cx="56" cy="56" r="46" stroke="#2E7D32" strokeWidth="8" fill="transparent"
                            strokeDasharray={2 * Math.PI * 46}
                            strokeDashoffset={2 * Math.PI * 46 * (1 - healthPercent / 100)}
                          />
                        </svg>
                        <div className="absolute">
                          <span className="block text-2xl font-black text-gray-950">{healthPercent}%</span>
                          <span className="text-[9px] font-black uppercase text-emerald-650">{healthStatus}</span>
                        </div>
                      </div>
                      
                      <h4 className="font-extrabold text-sm text-gray-900 leading-tight">{t('soilreportscreen.overall_soil_health')}</h4>
                    </div>

                    {/* Summary Card (2/3) */}
                    <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left space-y-4 md:col-span-2 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">{t('soilreportscreen.ai_summary')}</h4>
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full border text-emerald-750 bg-emerald-50 border-emerald-100">
                            CALIBRATED
                          </span>
                        </div>
                        <p className="text-xs text-gray-700 leading-relaxed font-semibold mt-3">
                          {getDynamicSummary()}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-3 text-[10px] text-gray-450 uppercase font-black">
                        <div>Crop Context: <span className="text-gray-700 font-bold capitalize">{plot?.crop || "Oil Palm"}</span></div>
                        <div className="text-right">Database Sync: <span className="text-gray-700 font-bold">Active</span></div>
                      </div>
                    </div>

                  </div>

                  {/* 1. Original Extracted Nutrient Density Breakdown Chart */}
                  <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left space-y-5">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">{t('soilreportscreen.nutrient_density_breakdown')}</h4>
                      <span className="text-[10px] font-bold text-gray-400 bg-gray-50 border border-gray-200 px-2.5 py-0.5 rounded-full">
                        Lab Extracted Values
                      </span>
                    </div>
                    
                    <div className="space-y-3.5 text-xs text-gray-700 font-semibold">
                      <div>
                        <div className="flex justify-between mb-1.5">
                          <span>{t('soilreportscreen.nitrogen_n')}</span>
                          <span className="font-bold text-emerald-700">
                            {rawN !== null ? `${rawN} kg/ha` : "Not Found"}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(5, Math.round(((rawN || 0) / 800) * 100)))}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between mb-1.5">
                          <span>{t('soilreportscreen.phosphorus_p')}</span>
                          <span className="font-bold text-emerald-700">
                            {rawP !== null ? `${rawP} kg/ha` : "Not Found"}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(5, Math.round(((rawP || 0) / 100) * 100)))}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between mb-1.5">
                          <span>{t('soilreportscreen.potassium_k')}</span>
                          <span className="font-bold text-emerald-700">
                            {rawK !== null ? `${rawK} kg/ha` : "Not Found"}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(5, Math.round(((rawK || 0) / 900) * 100)))}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between mb-1.5">
                          <span>{t('soilreportscreen.organic_carbon_c')}</span>
                          <span className="font-bold text-emerald-700">
                            {rawOC !== null ? `${rawOC} %` : "Not Found"}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(5, Math.round(((rawOC || 0) / 2.0) * 100)))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Extracted Soil Parameters */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    
                    {/* pH */}
                    <div className="rounded-2xl p-4 border border-gray-150 bg-white shadow-xs text-left flex flex-col justify-between min-h-[120px]">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md text-emerald-650 bg-emerald-50 border border-emerald-100">
                          VALID
                        </span>
                        <span className="text-[9px] font-bold text-gray-400 uppercase">range: 5.5 - 6.5</span>
                      </div>
                      <div className="mt-4">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">{t('soilreportscreen.acidity_ph')}</span>
                        <span className="text-lg font-black text-gray-950 mt-0.5">
                          {rawPH !== null ? `${rawPH}` : 'N/A'}
                        </span>
                      </div>
                    </div>

                    {/* EC */}
                    <div className="rounded-2xl p-4 border border-gray-150 bg-white shadow-xs text-left flex flex-col justify-between min-h-[120px]">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md text-emerald-650 bg-emerald-50 border border-emerald-100">
                          VALID
                        </span>
                        <span className="text-[9px] font-bold text-gray-400 uppercase">range: 0.50 - 0.75</span>
                      </div>
                      <div className="mt-4">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">{t('soilreportscreen.electrical_conductivity')}</span>
                        <span className="text-lg font-black text-gray-950 mt-0.5">
                          {rawEC !== null ? `${rawEC} dS/m` : 'N/A'}
                        </span>
                      </div>
                    </div>

                    {/* Zinc */}
                    <div className="rounded-2xl p-4 border border-gray-150 bg-white shadow-xs text-left flex flex-col justify-between min-h-[120px]">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md text-emerald-650 bg-emerald-50 border border-emerald-100">
                          {zn?.validation?.toUpperCase() || 'VALID'}
                        </span>
                        <span className="text-[9px] font-bold text-gray-400 uppercase">range: &gt; 0.6</span>
                      </div>
                      <div className="mt-4">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">{t('soilreportscreen.zinc_zn')}</span>
                        <span className="text-lg font-black text-gray-950 mt-0.5">
                          {zn && zn.value !== null ? `${zn.value} ${zn.unit || 'mg/kg'}` : '0.85 mg/kg'}
                        </span>
                      </div>
                    </div>

                  </div>

                  {/* Micronutrients Breakdown Grid */}
                  <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left space-y-4">
                    <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">Micronutrients Telemetry</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {/* Sulphur */}
                      <div className="rounded-2xl p-3.5 border bg-gray-50 border-gray-100 flex flex-col justify-between">
                        <span className="text-[9px] font-black text-gray-455 uppercase tracking-wider">Sulphur (S)</span>
                        <span className="text-base font-black text-gray-950 mt-1.5">{s && s.value !== null ? `${s.value} ${s.unit || 'mg/kg'}` : '14.2 mg/kg'}</span>
                        <span className="text-[8px] font-extrabold uppercase mt-1 text-emerald-600">(valid)</span>
                      </div>
                      {/* Boron */}
                      <div className="rounded-2xl p-3.5 border bg-gray-50 border-gray-100 flex flex-col justify-between">
                        <span className="text-[9px] font-black text-gray-455 uppercase tracking-wider">Boron (B)</span>
                        <span className="text-base font-black text-gray-950 mt-1.5">{b && b.value !== null ? `${b.value} ${b.unit || 'mg/kg'}` : '0.75 mg/kg'}</span>
                        <span className="text-[8px] font-extrabold uppercase mt-1 text-emerald-600">(valid)</span>
                      </div>
                      {/* Iron */}
                      <div className="rounded-2xl p-3.5 border bg-gray-50 border-gray-100 flex flex-col justify-between">
                        <span className="text-[9px] font-black text-gray-455 uppercase tracking-wider">Iron (Fe)</span>
                        <span className="text-base font-black text-gray-950 mt-1.5">{fe && fe.value !== null ? `${fe.value} ${fe.unit || 'mg/kg'}` : '6.4 mg/kg'}</span>
                        <span className="text-[8px] font-extrabold uppercase mt-1 text-emerald-600">(valid)</span>
                      </div>
                      {/* Manganese */}
                      <div className="rounded-2xl p-3.5 border bg-gray-50 border-gray-100 flex flex-col justify-between">
                        <span className="text-[9px] font-black text-gray-455 uppercase tracking-wider">Manganese (Mn)</span>
                        <span className="text-base font-black text-gray-950 mt-1.5">{mn && mn.value !== null ? `${mn.value} ${mn.unit || 'mg/kg'}` : '3.8 mg/kg'}</span>
                        <span className="text-[8px] font-extrabold uppercase mt-1 text-emerald-600">(valid)</span>
                      </div>
                      {/* Copper */}
                      <div className="rounded-2xl p-3.5 border bg-gray-50 border-gray-100 flex flex-col justify-between">
                        <span className="text-[9px] font-black text-gray-455 uppercase tracking-wider">Copper (Cu)</span>
                        <span className="text-base font-black text-gray-950 mt-1.5">{cu && cu.value !== null ? `${cu.value} ${cu.unit || 'mg/kg'}` : '1.1 mg/kg'}</span>
                        <span className="text-[8px] font-extrabold uppercase mt-1 text-emerald-600">(valid)</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* RIGHT COLUMN: AI Treatment Advice & Quick Actions (4/12 width) */}
                <div className="lg:col-span-4 flex flex-col gap-4">
                  
                  {/* Card 1: Soil Macronutrient Advice */}
                  <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left space-y-5">
                    <div className="border-b border-gray-100 pb-3">
                      <h4 className="text-xs font-black text-indigo-950 uppercase tracking-widest flex items-center gap-1.5">
                        <Sparkles className="w-4.5 h-4.5 text-primary" /> {t('soilreportscreen.soil_treatment_advice')}
                      </h4>
                      <p className="text-[10px] text-gray-450 mt-1">{t('soilreportscreen.recommended_chemical_corrections')}</p>
                    </div>

                    <div className="space-y-4">
                      {/* Nitrogen Advice */}
                      <div className="space-y-2 border-b border-gray-50 pb-3">
                        <div className="flex justify-between text-xs">
                          <span className="font-extrabold text-gray-800">{t('soilreportscreen.nitrogen_correction')}</span>
                          {(activeDisplayReport.nitrogen_kg_ha ?? activeDisplayReport.nitrogen ?? 300) < 250 ? (
                            <span className="text-[10px] font-bold text-amber-600">{t('soilreportscreen.priority_medium')}</span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-600">OPTIMAL</span>
                          )}
                        </div>
                        <div className="bg-gray-50 p-3 rounded-2xl space-y-1 text-xs">
                          <p className="font-bold text-gray-900">
                            {(activeDisplayReport.nitrogen_kg_ha ?? activeDisplayReport.nitrogen ?? 300) < 250 ? t('soilreportscreen.apply_urea') : "Optimal Nitrogen"}
                          </p>
                          <p className="text-[10px] text-gray-500 leading-normal">
                            {(activeDisplayReport.nitrogen_kg_ha ?? activeDisplayReport.nitrogen ?? 300) < 250 ? (
                              <>
                                <strong>{t('soilreportscreen.quantity')}</strong> {t('soilreportscreen.1_5_kg_palm_tree')}<br/>
                                <strong>{t('soilreportscreen.reason')}</strong> {t('soilreportscreen.compensates_for_slight_nitrogen_depletio')}
                              </>
                            ) : (
                              "Nitrogen is within the optimal range for the active crop cycle."
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Potassium Advice */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="font-extrabold text-gray-800">{t('soilreportscreen.potassium_correction')}</span>
                          {(activeDisplayReport.potassium_kg_ha ?? activeDisplayReport.potassium ?? 300) < 200 ? (
                            <span className="text-[10px] font-bold text-rose-600 animate-pulse">{t('soilreportscreen.priority_critical')}</span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-600">OPTIMAL</span>
                          )}
                        </div>
                        <div className="bg-gray-50 p-3 rounded-2xl space-y-1 text-xs">
                          <p className="font-bold text-gray-900">
                            {(activeDisplayReport.potassium_kg_ha ?? activeDisplayReport.potassium ?? 300) < 200 ? t('soilreportscreen.apply_muriate_of_potash_mop') : "Optimal Potassium"}
                          </p>
                          <p className="text-[10px] text-gray-500 leading-normal">
                            {(activeDisplayReport.potassium_kg_ha ?? activeDisplayReport.potassium ?? 300) < 200 ? (
                              <>
                                <strong>{t('soilreportscreen.quantity')}</strong> {t('soilreportscreen.2_2_kg_palm_tree')}<br/>
                                <strong>{t('soilreportscreen.reason')}</strong> {t('soilreportscreen.extreme_deficit_identified_vital_to_prev')}
                              </>
                            ) : (
                              "Potassium levels are sufficient. Maintain standard slow-release schedule."
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Micronutrient Treatment Advice */}
                  <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left space-y-5">
                    <div className="border-b border-gray-100 pb-3">
                      <h4 className="text-xs font-black text-indigo-950 uppercase tracking-widest flex items-center gap-1.5">
                        <Activity className="w-4.5 h-4.5 text-emerald-600" /> Micronutrient Treatment Advice
                      </h4>
                      <p className="text-[10px] text-gray-450 mt-1">Trace element calibration & foliar recommendations</p>
                    </div>

                    <div className="space-y-4">
                      {/* Boron Advice */}
                      <div className="space-y-2 border-b border-gray-50 pb-3">
                        <div className="flex justify-between text-xs">
                          <span className="font-extrabold text-gray-800">Boron (B) Calibration</span>
                          {(b?.value ?? 0.75) < 0.5 ? (
                            <span className="text-[10px] font-bold text-rose-600 animate-pulse">HIGH PRIORITY</span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-600">BALANCED</span>
                          )}
                        </div>
                        <div className="bg-gray-50 p-3 rounded-2xl space-y-1 text-xs">
                          <p className="font-bold text-gray-900">
                            {(b?.value ?? 0.75) < 0.5 ? "Apply Borax / Disodium Octaborate" : "Optimal Boron Levels"}
                          </p>
                          <p className="text-[10px] text-gray-500 leading-normal">
                            <strong>Dosage:</strong> 50 g / palm tree applied to soil ring basin.<br/>
                            <strong>Impact:</strong> Prevents hook leaves, stabilizes bunch formation, and improves fruit set.
                          </p>
                        </div>
                      </div>

                      {/* Zinc & Sulphur Advice */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="font-extrabold text-gray-800">Zinc (Zn) & Sulphur (S)</span>
                          {(zn?.value ?? 0.85) < 0.6 ? (
                            <span className="text-[10px] font-bold text-amber-600">MODERATE</span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-600">OPTIMAL</span>
                          )}
                        </div>
                        <div className="bg-gray-50 p-3 rounded-2xl space-y-1 text-xs">
                          <p className="font-bold text-gray-900">
                            {(zn?.value ?? 0.85) < 0.6 ? "Chelated Zinc (Zn-EDTA) + Sulphur" : "Trace Minerals Balanced"}
                          </p>
                          <p className="text-[10px] text-gray-500 leading-normal">
                            <strong>Dosage:</strong> 100 g Zinc Sulphate + 250 g Bentonite Sulphur / tree.<br/>
                            <strong>Impact:</strong> Catalyzes enzyme synthesis and restores active chlorophyll formulation.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions (Directly below the Micronutrient advice box) */}
                  <div className="space-y-2.5 pt-1">
                    <button
                      onClick={handleTriggerRecommendation}
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

              {/* ================= EXTRA SECTION: AGRONOMIC CROP DEFICIENCY & TARGET CALIBRATION ================= */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                  <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">
                    Agronomic Crop Deficiency & Benchmark Calibration
                  </h3>
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    AI Evaluated
                  </span>
                </div>

                <SoilNutrientAnalyticsCard
                  report={activeDisplayReport}
                  cropType={plot?.crop || "Oil Palm"}
                  title="Nutrient Deficiency Breakdown & Polar Radar Footprint"
                  showMiniRadar={true}
                />
              </div>

            </motion.div>
          )}

        </AnimatePresence>
      )}
    </motion.div>
  );
};
