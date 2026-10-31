import { useTranslation } from "../../translation/useTranslation";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  UploadCloud, FileText, ArrowRight, Activity, Sparkles, 
  Check, RefreshCw, ChevronDown
} from "lucide-react";
import { usePlots } from "../../data/plots";
import { supabase } from "../../lib/supabaseClient";
import { ApiError, listExtractions, uploadSoilReport } from "../../lib/apiClient";
import { useReportReadings } from "../../hooks/useReportReadings";
import type { SoilReportUploadResponsePayload } from "../../lib/apiClient";
import { SoilNutrientAnalyticsCard } from "../analytics/SoilNutrientAnalyticsCard";
import { ExtractionReview } from "./ExtractionReview";
import { getCropBaseline } from "../../constants/cropBaselines";

interface SoilReportScreenProps {
  onRecommendationClick?: (plotId?: string, reportData?: any) => void;
  onUploadSuccess: (nutrients: any) => void;
  /** The plot the farmer is working on (shared with Recommendations). Changes are reported through onPlotChange. */
  selectedPlotId?: string;
  onPlotChange?: (plotId: string) => void;
  /** Bumped by the app when a verified report was saved elsewhere. */
  reportVersion?: number;
  showToast?: (message: string, type?: "success" | "info" | "warning") => void;
}

type ScreenStage = "upload" | "processing" | "review" | "results";
type ProcessingSubstep = "upload" | "ocr" | "extraction" | "analysis" | "completed";

export const SoilReportScreen: React.FC<SoilReportScreenProps> = ({
  onRecommendationClick,
  onUploadSuccess,
  showToast,
  selectedPlotId: sharedPlotId,
  onPlotChange,
  reportVersion = 0
}) => {
  const { t } = useTranslation();
  const { plots, updatePlot } = usePlots();
  const [selectedPlotId, setSelectedPlotIdState] = useState<string>(sharedPlotId ?? "");
  const setSelectedPlotId = useCallback((id: string) => {
    setSelectedPlotIdState(id);
    onPlotChange?.(id);
  }, [onPlotChange]);
  // Follow the app's shared plot when it changes from elsewhere (e.g. chosen on the Recommendations screen).
  useEffect(() => {
    if (sharedPlotId && sharedPlotId !== selectedPlotId) setSelectedPlotIdState(sharedPlotId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedPlotId]);
  const [stage, setStage] = useState<ScreenStage>("upload");
  const [file, setFile] = useState<{ name: string; size: string; time: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persistence & Update Mode State
  const [savedReport, setSavedReport] = useState<any | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState<boolean>(false);
  // The database query for the saved report FAILED (not the same as "no report"): shown with a retry.
  const [reportError, setReportError] = useState<boolean>(false);
  const [isUpdatingReport, setIsUpdatingReport] = useState<boolean>(false);
  // An upload that failed stays on screen with its reason and a retry, instead of silently returning to the dropzone.
  const [uploadFailure, setUploadFailure] = useState<{ message: string; details: string[] } | null>(null);
  const lastFileRef = useRef<File | null>(null);
  // Each upload gets a number; only the NEWEST upload's answer may change the screen (a late answer from an older upload
  // must never replace a newer one).
  const uploadSeq = useRef(0);
  // An extraction stored earlier that still waits for the owner's review (survives leaving the screen / refreshing).
  const [pendingExtraction, setPendingExtraction] = useState<SoilReportUploadResponsePayload | null>(null);
  // Reports saved before verification existed: kept in the database, not usable for advice.
  const [legacyReportCount, setLegacyReportCount] = useState<number>(0);

  // OCR processing states
  const [progress, setProgress] = useState(0);
  const [activeSubstep, setActiveSubstep] = useState<ProcessingSubstep>("upload");
  const [logs, setLogs] = useState<string[]>([]);
  const consoleBottomRef = useRef<HTMLDivElement>(null);

  // Real OCR result from the backend
  const [ocrResult, setOcrResult] = useState<SoilReportUploadResponsePayload | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const plot = plots.find(p => p.id === selectedPlotId);
  const cropBaseline = getCropBaseline(plot?.crop);
  const phRangeLabel = cropBaseline ? `range: ${cropBaseline.ph.min} - ${cropBaseline.ph.max}` : "no reference range";

  // Parse Soil Health Index from raw text dynamically
  const sqiMatch = ocrResult?.raw_text?.match(/SQI\s*\)?\s*:\s*([0-9.]+)\s*\(([^)]+)\)/i);
  const sqiValue = sqiMatch ? parseFloat(sqiMatch[1]) : null;
  const sqiCategory = sqiMatch ? sqiMatch[2] : null;

  const healthPercent: number | null = sqiValue !== null ? Math.round(sqiValue * 100) : null;
  const healthStatus = sqiCategory ? sqiCategory.toUpperCase() : "NOT REPORTED";

  type MicroValue = { value: number | string | null; unit?: string | null; validation?: string };
  const micro = (param: string): MicroValue | null =>
    ocrResult?.micronutrients?.find(m => m.parameter === param) ??
    (savedReport?.micronutrients?.[param] as MicroValue | undefined) ??
    null;
  const fmtMicro = (m: MicroValue | null) =>
    m && m.value !== null && m.value !== undefined ? `${m.value} ${m.unit || "mg/kg"}` : "Not reported";
  const microBadge = (m: MicroValue | null) =>
    m && m.value !== null && m.value !== undefined ? (m.validation || "reported").toUpperCase() : "NOT REPORTED";
  const zn = micro("zinc");
  const fe = micro("iron");
  const mn = micro("manganese");
  const cu = micro("copper");
  const b = micro("boron");
  const s = micro("sulfur");

  const triggerToast = useCallback((msg: string, type: "success" | "info" | "warning" = "success") => {
    if (showToast) {
      showToast(msg, type);
    } else {
      alert(`${type.toUpperCase()}: ${msg}`);
    }
  }, [showToast]);

  // Sync selected plot default
  useEffect(() => {
    if (plots.length === 0) return;
    const known = selectedPlotId && plots.some((p) => p.id === selectedPlotId);
    if (known) return;
    // No plot yet, or a remembered id that is not one of this user's plots: start from the first real plot.
    const realPlots = plots.filter(p => !p.id.startsWith("plot-"));
    setSelectedPlotId((realPlots[0] ?? plots[0]).id);
  }, [plots, selectedPlotId, setSelectedPlotId]);

  // Reactive Supabase & Local Cache Auto-Fetch on mount & plot change
  const fetchPlotReport = useCallback(async (plotId: string) => {
    if (!plotId) return;

    // Demo (non-database) plots keep their embedded sample report, if any.
    if (plotId.startsWith("plot-")) {
      const demoPlot = plots.find(p => p.id === plotId) as any;
      setSavedReport(demoPlot?.soil_reports?.[0] ?? null);
      return;
    }

    // Saved plots: the database (RLS-scoped to the signed-in user) is the only source.
    setIsLoadingReport(true);
    setReportError(false);
    // A different plot must never show the previous plot's report while this one loads.
    setSavedReport(null);
    try {
      const { data: report, error } = await supabase
        .from("soil_reports")
        .select("*")
        .eq("plot_id", plotId)
        .not("verification_status", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Failed to query plot soil report:", error);
        setReportError(true);
        setSavedReport(null);
      } else {
        setSavedReport(report ?? null);
      }
    } catch (err) {
      console.error("Failed to query plot soil report:", err);
      setReportError(true);
      setSavedReport(null);
    } finally {
      setIsLoadingReport(false);
    }
  }, [plots]);

  useEffect(() => {
    if (selectedPlotId) {
      fetchPlotReport(selectedPlotId);
    }
  }, [selectedPlotId, fetchPlotReport, reportVersion]);

  // Pending extractions and legacy rows for the plot. Neither is ever shown as a verified report.
  useEffect(() => {
    let cancelled = false;
    setPendingExtraction(null);
    setLegacyReportCount(0);
    if (!selectedPlotId || selectedPlotId.startsWith("plot-")) return;
    listExtractions(selectedPlotId)
      .then((list) => {
        if (!cancelled) setPendingExtraction(list.find((x) => x.status === "needs_review") ?? null);
      })
      .catch(() => {
        /* the dropzone still works; a pending review simply is not offered */
      });
    supabase
      .from("soil_reports")
      .select("id")
      .eq("plot_id", selectedPlotId)
      .is("verification_status", null)
      .limit(50)
      .then(({ data, error }: { data: Array<{ id: string }> | null; error: unknown }) => {
        if (!cancelled && !error) setLegacyReportCount(data?.length ?? 0);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPlotId, reportVersion, savedReport?.id]);

  useEffect(() => {
    if (consoleBottomRef.current) {
      consoleBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // A statement of what was saved - nothing more. Whether a value is adequate for the crop is NOT judged here: that needs a cited,
  // expert-approved rule, and only the recommendation step applies those. A zero is a measurement; only null/undefined is "not reported".
  const getDynamicSummary = () => {
    if (!savedReport) return "";
    const fmt = (v: unknown, unit = "") => (typeof v === "number" && Number.isFinite(v) ? `${v}${unit}` : "not reported");
    const saved = savedReport.created_at ? new Date(savedReport.created_at).toLocaleDateString() : "";
    return (
      `Verified soil report for ${plot?.name || selectedPlotId}${saved ? `, saved ${saved}` : ""}. ` +
      `Nitrogen ${fmt(savedReport.nitrogen_kg_ha, " kg/ha")}, phosphorus ${fmt(savedReport.phosphorus_kg_ha, " kg/ha")}, ` +
      `potassium ${fmt(savedReport.potassium_kg_ha, " kg/ha")}, pH ${fmt(savedReport.ph)}, organic carbon ${fmt(savedReport.organic_carbon_percent, "%")}. ` +
      `These are the measured values. Whether they are adequate for this crop is decided by the recommendation step, using approved rules.`
    );
  };

  const processingTimeline = [
    { key: "upload", label: "p2.soil.step.upload", pct: 20 },
    { key: "ocr", label: "p2.soil.step.ocr", pct: 40 },
    { key: "extraction", label: "p2.soil.step.extraction", pct: 60 },
    { key: "analysis", label: "p2.soil.step.analysis", pct: 80 },
    { key: "completed", label: "p2.soil.step.completed", pct: 100 }
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
    handledAnswer.current = null;
    lastFileRef.current = selectedFile;
    setUploadFailure(null);
    setOcrResult(null);
    setUploadError(null);
    setStage("processing");
    setProgress(0);
    setActiveSubstep("upload");
    setLogs(["[SYSTEM] Connection secure. Document upload received."]);

    const seq = ++uploadSeq.current;
    uploadSoilReport(selectedPlotId, selectedFile)
      .then((result) => {
        if (seq === uploadSeq.current) setOcrResult(result);
      })
      .catch((err) => {
        if (seq !== uploadSeq.current) return;
        setUploadError(
          err instanceof ApiError || err instanceof Error ? err.message : "Failed to process soil report."
        );
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
        const next = Math.min(prev + 1, 90); // 100% is reserved for the real response
        
        if (next < 25) setActiveSubstep("upload");
        else if (next < 50) setActiveSubstep("ocr");
        else if (next < 75) setActiveSubstep("extraction");
        else if (next < 95) setActiveSubstep("analysis");
        else setActiveSubstep("completed");

        return next;
      });
    }, 60);

    return () => {
      clearInterval(progressInterval);
      clearInterval(logInterval);
    };
  }, [stage, logDatabase]);

  // A verified soil report now exists (read clearly, or confirmed/corrected by the owner).
  // Re-read it from the database so what is shown is exactly what was saved (including corrections).
  const applyVerified = useCallback(
    async (result: SoilReportUploadResponsePayload) => {
      onUploadSuccess({ id: result.soil_report_id ?? undefined, plotId: selectedPlotId, persisted: true });
      if (!selectedPlotId.startsWith("plot-")) {
        supabase.from("plots").update({ soil_report_attached: true }).eq("id", selectedPlotId).then(() => {});
      }
      updatePlot(selectedPlotId, { soilReportAttached: true });
      await fetchPlotReport(selectedPlotId);
      setIsUpdatingReport(false);
      setStage("results");
      triggerToast(t("p3.review.saved"), "success");
    },
    [selectedPlotId, onUploadSuccess, updatePlot, fetchPlotReport, triggerToast, t]
  );

  // Handle the backend's answer to an upload -- exactly once per answer. The callbacks this effect uses change
  // identity when the plot store updates (applyVerified itself updates it), so without this guard the effect
  // would re-run, re-save and re-fetch in a loop until the page froze (found by the browser E2E).
  const handledAnswer = useRef<unknown>(null);
  useEffect(() => {
    if (stage !== "processing") return;
    if (!ocrResult && !uploadError) return;
    const answer = ocrResult ?? uploadError;
    if (handledAnswer.current === answer) return;
    handledAnswer.current = answer;
    setProgress(100);

    if (uploadError) {
      setLogs(prev => [...prev, `[ERROR] ${uploadError}`]);
      setUploadFailure({ message: uploadError, details: [] });
      setStage("upload");
      return;
    }

    if (!ocrResult) return;

    if (ocrResult.status === "failed") {
      setUploadFailure({ message: t("p3.soil.failed"), details: ocrResult.warnings ?? [] });
      setStage("upload");
      return;
    }

    if (ocrResult.status === "needs_review") {
      setSavedReport(null);
      setIsUpdatingReport(false);
      setStage("review");
      triggerToast(t("p3.soil.needs_review_toast"), "warning");
      return;
    }

    void applyVerified(ocrResult);
  }, [stage, ocrResult, uploadError, triggerToast, applyVerified, t]);

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

  // The results screen is the VERIFIED, saved report. Values from an unsaved reading are never presented as results.
  const isShowingDashboard = !!savedReport && !isUpdatingReport && stage !== "processing" && stage !== "review";
  // A report was just verified but could not be read back: say so, with a retry (never show the unsaved reading as saved).
  const verifiedButUnreadable = !savedReport && !isLoadingReport && stage === "results" && !isUpdatingReport;

  const { readings } = useReportReadings(selectedPlotId || undefined, savedReport?.id, reportVersion);

  const handleTriggerRecommendation = () => {
    if (!savedReport?.id) {
      triggerToast(t("p4.soil.no_saved_report"), "warning");
      return;
    }
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
                aria-label={t("p3.soil.plot_label")}
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

      {reportError && !isLoadingReport && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-semibold text-rose-900">
          <span>{t("p4.soil.load_failed")}</span>
          <button
            type="button"
            onClick={() => fetchPlotReport(selectedPlotId)}
            className="min-h-11 cursor-pointer rounded-xl border border-rose-400 bg-white px-4 py-2 text-sm font-bold text-rose-900 hover:bg-rose-100"
          >
            {t("p4.common.retry")}
          </button>
        </div>
      )}

      {verifiedButUnreadable && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-950">
          <span>{t("p4.soil.saved_unreadable")}</span>
          <button
            type="button"
            onClick={() => fetchPlotReport(selectedPlotId)}
            className="min-h-11 cursor-pointer rounded-xl border border-amber-400 bg-white px-4 py-2 text-sm font-bold text-amber-950 hover:bg-amber-100"
          >
            {t("p4.common.retry")}
          </button>
        </div>
      )}

      {isLoadingReport && (
        <div className="flex items-center justify-center p-12 bg-white rounded-3xl border border-slate-150 shadow-xs">
          <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
            <RefreshCw className="w-4 h-4 text-emerald-600 animate-spin" />
            {t("p2.ui.synchronizing_plot_diagnostic_history_kjn5vy")}
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
                
                {uploadFailure && (
                  <div role="alert" className="space-y-3 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-left text-sm text-rose-950">
                    <p className="font-bold">{t("p4.soil.failed_title", { plot: plot?.name ?? "" })}</p>
                    <p className="font-medium">{uploadFailure.message}</p>
                    {uploadFailure.details.length > 0 && (
                      <ul className="list-disc space-y-1 pl-5 font-medium">
                        {uploadFailure.details.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    )}
                    <p className="font-medium">{t("p4.soil.failed_hint")}</p>
                    <div className="flex flex-wrap gap-2">
                      {lastFileRef.current && (
                        <button
                          type="button"
                          onClick={() => lastFileRef.current && startUpload(lastFileRef.current)}
                          className="min-h-11 cursor-pointer rounded-xl border-0 bg-rose-700 px-4 py-2 text-sm font-bold text-white hover:bg-rose-800"
                        >
                          {t("p4.soil.retry_upload", { file: lastFileRef.current.name })}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setUploadFailure(null);
                          handleUpload();
                        }}
                        className="min-h-11 cursor-pointer rounded-xl border border-rose-400 bg-white px-4 py-2 text-sm font-bold text-rose-900 hover:bg-rose-100"
                      >
                        {t("p4.soil.choose_other")}
                      </button>
                    </div>
                  </div>
                )}

                {pendingExtraction && !savedReport && (
                  <div role="status" className="space-y-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-left text-sm text-amber-950">
                    <p className="font-bold">{t("p4.soil.pending_title")}</p>
                    <p className="font-medium">{t("p4.soil.pending_body")}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadFailure(null);
                        setOcrResult(pendingExtraction);
                        setStage("review");
                      }}
                      className="min-h-11 cursor-pointer rounded-xl border-0 bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700"
                    >
                      {t("p4.soil.pending_continue")}
                    </button>
                  </div>
                )}

                {legacyReportCount > 0 && !savedReport && (
                  <p role="note" className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-left text-sm font-medium text-gray-700">
                    {t("p4.soil.legacy_note", { count: String(legacyReportCount) })}
                  </p>
                )}

                {isUpdatingReport && savedReport && (
                  <div className="flex justify-between items-center bg-emerald-50 border border-emerald-100 rounded-2xl p-3 px-4 text-xs font-semibold text-emerald-800">
                    <span>{t("p2.ui.updating_diagnostic_telemetry_for_1yiu6po")} <strong>{plot?.name}</strong></span>
                    <button
                      onClick={() => setIsUpdatingReport(false)}
                      className="text-xs text-emerald-700 hover:text-emerald-950 underline font-bold cursor-pointer border-0 bg-transparent"
                    >
                      {t("p2.ui.cancel_view_saved_report_ug93ug")}
                    </button>
                  </div>
                )}

                {/* Hidden real file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  aria-label={t("p3.soil.file_label")}
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
              </div>
            </motion.div>
          )}

          {/* ================= REVIEW: values read but not yet trustworthy ================= */}
          {stage === "review" && ocrResult && (
            <motion.div key="review-zone" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <ExtractionReview
                result={ocrResult}
                onConfirmed={(r) => void applyVerified(r)}
                onDiscard={() => {
                  setOcrResult(null);
                  setFile(null);
                  setStage("upload");
                }}
              />
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
                          {t(step.label)}
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
                        {t("p2.ui.plot_4la7xu")} <strong className="text-slate-900">{plot?.name || selectedPlotId}</strong> ({plot?.crop || t("p2.ui.crop_not_set_4y8vws")}{t("p2.ui.saved_1p21j9r")} {activeDisplayReport.created_at ? new Date(activeDisplayReport.created_at).toLocaleDateString() : t("p2.ui.active_1s25b71")}
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
                      {t("p2.ui.update_report_1lddlms")}
                    </button>

                    <button
                      onClick={handleTriggerRecommendation}
                      className="flex-1 md:flex-initial bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-xs border-0"
                    >
                      {t("p2.ui.generate_ai_recommendation_1dpyonh")}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

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
                          <circle cx="56" cy="56" r="46" stroke="#1E382C" strokeWidth="8" fill="transparent"
                            strokeDasharray={2 * Math.PI * 46}
                            strokeDashoffset={2 * Math.PI * 46 * (1 - (healthPercent ?? 0) / 100)}
                          />
                        </svg>
                        <div className="absolute">
                          <span className="block text-2xl font-black text-gray-950">{healthPercent !== null ? `${healthPercent}%` : "N/A"}</span>
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
                            {savedReport ? t("p2.ui.saved_4m5lmo") : t("p2.ui.not_saved_zkf3bn")}
                          </span>
                        </div>
                        <p className="text-xs text-gray-700 leading-relaxed font-semibold mt-3">
                          {getDynamicSummary()}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-3 text-[10px] text-gray-450 uppercase font-black">
                        <div>{t("p2.ui.crop_context_1q8yxqs")} <span className="text-gray-700 font-bold capitalize">{plot?.crop || "—"}</span></div>
                        <div className="text-right">{t("p2.ui.database_4f3aag")} <span className="text-gray-700 font-bold">{savedReport ? t("p2.ui.saved_4mqpq8") : t("p2.ui.not_saved_7h0rzn")}</span></div>
                      </div>
                    </div>

                  </div>

                  {/* 1. Original Extracted Nutrient Density Breakdown Chart */}
                  <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left space-y-5">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">{t('soilreportscreen.nutrient_density_breakdown')}</h4>
                      <span className="text-[10px] font-bold text-gray-400 bg-gray-50 border border-gray-200 px-2.5 py-0.5 rounded-full">
                        {t("p2.ui.lab_extracted_values_mgggvw")}
                      </span>
                    </div>
                    
                    <div className="space-y-3.5 text-xs text-gray-700 font-semibold">
                      <div>
                        <div className="flex justify-between mb-1.5">
                          <span>{t('soilreportscreen.nitrogen_n')}</span>
                          <span className="font-bold text-emerald-700">
                            {rawN !== null ? `${rawN} kg/ha` : t("p2.ui.not_found_6siyku")}
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
                            {rawP !== null ? `${rawP} kg/ha` : t("p2.ui.not_found_6siyku")}
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
                            {rawK !== null ? `${rawK} kg/ha` : t("p2.ui.not_found_6siyku")}
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
                            {rawOC !== null ? `${rawOC} %` : t("p2.ui.not_found_6siyku")}
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
                          {(ocrResult?.ph.validation ?? "saved").toUpperCase()}
                        </span>
                        <span className="text-[9px] font-bold text-gray-400 uppercase">{phRangeLabel}</span>
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
                          {(ocrResult?.electrical_conductivity.validation ?? "saved").toUpperCase()}
                        </span>
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
                          {microBadge(zn)}
                        </span>
                      </div>
                      <div className="mt-4">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">{t('soilreportscreen.zinc_zn')}</span>
                        <span className="text-lg font-black text-gray-950 mt-0.5">
                          {fmtMicro(zn)}
                        </span>
                      </div>
                    </div>

                  </div>

                  {/* Micronutrients Breakdown Grid */}
                  <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left space-y-4">
                    <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">{t("p2.ui.micronutrients_telemetry_96qw94")}</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {/* Sulphur */}
                      <div className="rounded-2xl p-3.5 border bg-gray-50 border-gray-100 flex flex-col justify-between">
                        <span className="text-[9px] font-black text-gray-455 uppercase tracking-wider">{t("p2.ui.sulphur_s_u3ilue")}</span>
                        <span className="text-base font-black text-gray-950 mt-1.5">{fmtMicro(s)}</span>
                        <span className="text-[8px] font-extrabold uppercase mt-1 text-gray-500">({microBadge(s).toLowerCase()})</span>
                      </div>
                      {/* Boron */}
                      <div className="rounded-2xl p-3.5 border bg-gray-50 border-gray-100 flex flex-col justify-between">
                        <span className="text-[9px] font-black text-gray-455 uppercase tracking-wider">{t("p2.ui.boron_b_iym8gc")}</span>
                        <span className="text-base font-black text-gray-950 mt-1.5">{fmtMicro(b)}</span>
                        <span className="text-[8px] font-extrabold uppercase mt-1 text-gray-500">({microBadge(b).toLowerCase()})</span>
                      </div>
                      {/* Iron */}
                      <div className="rounded-2xl p-3.5 border bg-gray-50 border-gray-100 flex flex-col justify-between">
                        <span className="text-[9px] font-black text-gray-455 uppercase tracking-wider">{t("p2.ui.iron_fe_1rl2zo3")}</span>
                        <span className="text-base font-black text-gray-950 mt-1.5">{fmtMicro(fe)}</span>
                        <span className="text-[8px] font-extrabold uppercase mt-1 text-gray-500">({microBadge(fe).toLowerCase()})</span>
                      </div>
                      {/* Manganese */}
                      <div className="rounded-2xl p-3.5 border bg-gray-50 border-gray-100 flex flex-col justify-between">
                        <span className="text-[9px] font-black text-gray-455 uppercase tracking-wider">{t("p2.ui.manganese_mn_1c3wb62")}</span>
                        <span className="text-base font-black text-gray-950 mt-1.5">{fmtMicro(mn)}</span>
                        <span className="text-[8px] font-extrabold uppercase mt-1 text-gray-500">({microBadge(mn).toLowerCase()})</span>
                      </div>
                      {/* Copper */}
                      <div className="rounded-2xl p-3.5 border bg-gray-50 border-gray-100 flex flex-col justify-between">
                        <span className="text-[9px] font-black text-gray-455 uppercase tracking-wider">{t("p2.ui.copper_cu_3nzcgf")}</span>
                        <span className="text-base font-black text-gray-950 mt-1.5">{fmtMicro(cu)}</span>
                        <span className="text-[8px] font-extrabold uppercase mt-1 text-gray-500">({microBadge(cu).toLowerCase()})</span>
                      </div>
                    </div>
                  </div>

                  {readings.length > 0 && (
                    <section aria-labelledby="readings-title" className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left space-y-3">
                      <h4 id="readings-title" className="text-sm font-extrabold text-gray-900">{t("p4.read.title")}</h4>
                      <p className="text-sm font-medium text-gray-600">{t("p4.read.intro")}</p>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[30rem] text-left text-sm">
                          <thead>
                            <tr className="text-gray-600">
                              <th scope="col" className="py-2 pr-3 font-bold">{t("p4.read.col.parameter")}</th>
                              <th scope="col" className="py-2 pr-3 font-bold">{t("p4.read.col.value")}</th>
                              <th scope="col" className="py-2 pr-3 font-bold">{t("p4.read.col.unit")}</th>
                              <th scope="col" className="py-2 font-bold">{t("p4.read.col.status")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {readings.map((r) => (
                              <tr key={r.parameter} className="border-t border-gray-100">
                                <th scope="row" className="py-2 pr-3 font-semibold text-gray-900">{r.parameter.replace(/_/g, " ")}</th>
                                <td className="py-2 pr-3 font-semibold">{r.value === null || r.value === undefined || r.value === "" ? t("p3.review.not_found") : String(r.value)}</td>
                                <td className="py-2 pr-3 text-gray-700">{r.unit || t("p4.read.unit_not_stated")}</td>
                                <td className="py-2 text-gray-700">
                                  {r.corrected
                                    ? t("p4.read.corrected", { original: r.originalValue === null || r.originalValue === undefined ? t("p3.review.not_found") : String(r.originalValue) })
                                    : r.validation === "confirmed" || r.validation === "not_saved"
                                      ? t(`p4.read.status.${r.validation}`)
                                      : t(`p3.status.${r.validation}`)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}

                </div>

                {/* RIGHT COLUMN: AI Treatment Advice & Quick Actions (4/12 width) */}
                <div className="lg:col-span-4 flex flex-col gap-4">
                  
                  {/* Treatment advice comes only from the backend recommendation engine */}
                  <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs text-left space-y-3">
                    <h4 className="text-xs font-black text-indigo-950 uppercase tracking-widest flex items-center gap-1.5">
                      <Sparkles className="w-4.5 h-4.5 text-primary" /> {t('soilreportscreen.soil_treatment_advice')}
                    </h4>
                    <p className="text-xs font-semibold text-gray-600 leading-relaxed">
                      {t("p2.ui.fertilizer_doses_and_costs_are_calculated_by_vgqwex")}
                    </p>
                  </div>

                  {/* Actions (Directly below the Micronutrient advice box) */}
                  <div className="space-y-2.5 pt-1">
                    <button
                      onClick={handleTriggerRecommendation}
                      className="w-full bg-primary hover:bg-[#2C4D3C] text-white font-extrabold py-3.5 rounded-xl transition-all shadow-xs text-xs flex items-center justify-center gap-2 border-0 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-white" />
                      {t('soilreportscreen.generate_ai_recommendation')}
                    </button>

                  </div>

                </div>

              </div>

              {/* ================= EXTRA SECTION: AGRONOMIC CROP DEFICIENCY & TARGET CALIBRATION ================= */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                  <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">
                    {t("p2.ui.agronomic_crop_deficiency_benchmark_calibrat_worgzm")}
                  </h3>
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    {t("p2.ui.reference_ranges_v1_defaults_qntnt8")}
                  </span>
                </div>

                <SoilNutrientAnalyticsCard
                  report={activeDisplayReport}
                  cropType={plot?.crop}
                  title={t("p2.ui.nutrient_deficiency_breakdown_polar_radar_fo_1118g9x")}
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
