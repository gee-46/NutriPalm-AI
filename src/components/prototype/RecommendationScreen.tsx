import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Sparkles, AlertTriangle, Download, FileText, ChevronDown, History
} from "lucide-react";
import { jsPDF } from "jspdf";
import { useTranslation } from "../../translation/useTranslation";
import { usePlots } from "../../data/plots";
import { supabase } from "../../lib/supabaseClient";
import {
  createRecommendation,
  listRecommendations,
} from "../../lib/apiClient";
import type { RecommendationRecord } from "../../lib/apiClient";

interface RecommendationScreenProps {
  selectedPlotId?: string;
  onPlotChange?: (plotId: string) => void;
  showToast?: (message: string, type?: "success" | "info" | "warning") => void;
  farmerName?: string;
  onNavigate?: (screen: string) => void;
}

/** A persisted soil_reports row, as read through RLS. */
interface SoilReportRow {
  id: string;
  plot_id: string;
  nitrogen_kg_ha: number;
  phosphorus_kg_ha: number;
  potassium_kg_ha: number;
  organic_carbon_percent: number;
  ph: number;
  electrical_conductivity: number | null;
  created_at: string;
}

interface Finding {
  nutrient: string;
  display_name: string;
  soil_value_kg_ha: number;
  target_kg_ha: number;
  status: string;
  deficit_kg_ha: number;
  percent_of_target: number;
}

interface Dosage {
  nutrient: string;
  product_display_name: string;
  quantity_kg_per_ha: number;
  quantity_kg_total: number;
  estimated_cost_inr: number;
}

const inr = (n: number | null | undefined) =>
  typeof n === "number" ? `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—";

const formatDate = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString();
};

export const RecommendationScreen: React.FC<RecommendationScreenProps> = ({
  selectedPlotId,
  onPlotChange,
  showToast,
  farmerName,
  onNavigate,
}) => {
  const { t } = useTranslation();
  const { plots } = usePlots();

  const [activePlotId, setActivePlotId] = useState<string>(
    () => selectedPlotId || (plots.length > 0 ? plots[0].id : "")
  );
  const [soilReport, setSoilReport] = useState<SoilReportRow | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [history, setHistory] = useState<RecommendationRecord[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectedRecId, setSelectedRecId] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const notify = useCallback(
    (msg: string, type: "success" | "info" | "warning" = "success") => showToast?.(msg, type),
    [showToast]
  );

  useEffect(() => {
    if (selectedPlotId) {
      setActivePlotId(selectedPlotId);
    } else if (plots.length > 0 && !activePlotId) {
      setActivePlotId(plots[0].id);
    }
  }, [selectedPlotId, plots, activePlotId]);

  const currentPlot = plots.find((p) => p.id === activePlotId);
  const isSavedPlot = !!currentPlot && !currentPlot.isDemo && !currentPlot.id.startsWith("plot-");

  // Latest saved soil report for the active plot (RLS limits this to the caller).
  useEffect(() => {
    let cancelled = false;
    setSoilReport(null);
    setGenerateError(null);
    if (!activePlotId || !isSavedPlot) return;

    setIsLoadingReport(true);
    supabase
      .from("soil_reports")
      .select(
        "id, plot_id, nitrogen_kg_ha, phosphorus_kg_ha, potassium_kg_ha, organic_carbon_percent, ph, electrical_conductivity, created_at"
      )
      .eq("plot_id", activePlotId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }: { data: SoilReportRow | null; error: unknown }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load soil report:", error);
          setSoilReport(null);
        } else {
          setSoilReport(data);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingReport(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activePlotId, isSavedPlot]);

  // Persisted recommendation history (GET /api/recommendations -> caller's rows only).
  const refreshHistory = useCallback(async () => {
    try {
      const rows = await listRecommendations();
      setHistory(rows);
      setHistoryError(null);
    } catch (err) {
      setHistory([]);
      setHistoryError(err instanceof Error ? err.message : "Could not load recommendations.");
    }
  }, []);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  const plotHistory = useMemo(
    () =>
      history
        .filter((r) => r.plot_id === activePlotId)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    [history, activePlotId]
  );

  useEffect(() => {
    setSelectedRecId(null);
  }, [activePlotId]);

  const shown: RecommendationRecord | null =
    plotHistory.find((r) => r.id === selectedRecId) ?? plotHistory[0] ?? null;

  const findings: Finding[] = Array.isArray(shown?.deficiencies) ? shown!.deficiencies : [];
  const dosages: Dosage[] = Array.isArray(shown?.fertilizer_plan) ? shown!.fertilizer_plan : [];
  const explanation = shown?.explanation ?? null;
  const yieldPred = shown?.yield_prediction ?? null;
  const roi = shown?.roi ?? null;
  const deficient = findings.filter((f) => f.status === "deficient");
  const isStale = !!shown && !!soilReport && shown.soil_report_id !== soilReport.id;

  const handleGenerate = async () => {
    setGenerateError(null);
    if (!isSavedPlot) {
      setGenerateError("Select one of your saved plots first.");
      return;
    }
    if (!soilReport) {
      setGenerateError("Upload a soil report for this plot before generating a recommendation.");
      return;
    }
    const price = Number(priceInput);
    if (!priceInput.trim() || !Number.isFinite(price) || price <= 0) {
      setGenerateError("Enter the current crop selling price (₹ per ton) to calculate ROI.");
      return;
    }

    setIsProcessing(true);
    try {
      const created = await createRecommendation({
        plot_id: activePlotId,
        soil_report_id: soilReport.id,
        crop_price_per_ton_inr: price,
      });
      await refreshHistory();
      setSelectedRecId(created.recommendation_id ?? null);
      notify(`Recommendation generated and saved for ${currentPlot?.name ?? "this plot"}.`, "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate recommendation.";
      setGenerateError(message);
      notify(message, "warning");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportPDF = () => {
    if (!shown || !currentPlot) {
      notify("Generate a recommendation first, then export it.", "warning");
      return;
    }
    try {
      const doc = new jsPDF();
      const margin = 20;
      let y = 25;
      const line = (text: string, size = 10, bold = false) => {
        if (y > 275) {
          doc.addPage();
          y = 25;
        }
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setFontSize(size);
        const wrapped = doc.splitTextToSize(text, 170);
        doc.text(wrapped, margin, y);
        y += wrapped.length * (size * 0.5 + 1.5);
      };

      line("NutriPalm AI - Crop Recommendation Report", 18, true);
      line(`Generated: ${new Date().toLocaleString()}`, 9);
      line(`Recommendation date: ${formatDate(shown.created_at)}`, 9);
      y += 4;
      line(`Farmer: ${farmerName || "—"}`);
      line(`Plot: ${currentPlot.name}   Crop: ${shown.crop}   Area: ${currentPlot.area} acres`);
      y += 4;

      if (explanation?.summary) {
        line("Summary", 12, true);
        line(explanation.summary);
        y += 2;
      }
      if (findings.length) {
        line("Nutrient status (soil vs target, kg/ha)", 12, true);
        findings.forEach((f) =>
          line(`${f.display_name}: ${f.soil_value_kg_ha} / ${f.target_kg_ha} (${f.status})`)
        );
        y += 2;
      }
      if (dosages.length) {
        line("Fertilizer plan", 12, true);
        dosages.forEach((d) =>
          line(
            `${d.product_display_name} (${d.nutrient}): ${d.quantity_kg_per_ha} kg/ha, total ${d.quantity_kg_total} kg, est. ${inr(d.estimated_cost_inr)}`
          )
        );
        y += 2;
      }
      if (roi) {
        line("Economics", 12, true);
        line(`Fertilizer cost: ${inr(roi.fertilizer_cost)}   Additional revenue: ${inr(roi.expected_additional_revenue)}`);
        line(`Crop price used: ${inr(roi.crop_price_per_ton_inr)}/ton   Estimated profit: ${inr(roi.estimated_profit)}`);
      }
      if (Array.isArray(explanation?.warnings) && explanation.warnings.length) {
        y += 2;
        line("Warnings", 12, true);
        explanation.warnings.forEach((w: string) => line(`- ${w}`));
      }
      y += 4;
      line(
        "Disclaimer: advisory generated from the uploaded soil analysis using V1 default agronomic reference values. Verify field conditions before application.",
        8
      );
      doc.save(`Advisory_${currentPlot.name.replace(/[^\w-]+/g, "_")}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      notify("Failed to compile PDF.", "warning");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      className="space-y-6 text-left relative"
    >
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white/70 backdrop-blur-xs z-30 pointer-events-auto rounded-3xl flex items-center justify-center"
          >
            <div className="bg-white border border-gray-150 p-5 rounded-2xl shadow-xl flex items-center gap-3">
              <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-black text-gray-800">Generating recommendation…</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header + controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-gray-200/50 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight leading-none flex items-center gap-2">
            <Bot className="w-8 h-8 text-primary" />
            {t("recommendationscreen.ai_crop_recommendation_engine")}
          </h1>
          <p className="text-sm font-semibold text-gray-500 mt-2">
            Fertilizer advice computed by the NutriPalm backend from your saved soil report.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {plots.length > 0 && (
            <div className="relative w-full sm:w-56">
              <select
                aria-label="Plot"
                value={activePlotId}
                onChange={(e) => {
                  setActivePlotId(e.target.value);
                  onPlotChange?.(e.target.value);
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
          )}

          <input
            aria-label="Crop selling price in rupees per ton"
            type="number"
            min="0"
            inputMode="decimal"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            placeholder="Crop price ₹/ton"
            className="w-full sm:w-40 bg-white border border-gray-250 text-xs font-bold text-gray-800 rounded-xl px-3.5 py-2.5 h-10 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />

          <button
            onClick={handleGenerate}
            disabled={isProcessing || !soilReport}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-[#235F26] disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold rounded-xl shadow-md active:scale-95 transition-all text-xs cursor-pointer border-0 h-10"
          >
            <Sparkles className="w-4 h-4 text-white" />
            {t("recommendationscreen.generate_new_recommendation")}
          </button>

          <button
            onClick={handleExportPDF}
            disabled={!shown}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-250 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed font-extrabold rounded-xl shadow-xs hover:bg-gray-50 active:scale-95 transition-all text-xs cursor-pointer h-10"
          >
            <Download className="w-4 h-4 text-gray-500" />
            {t("recommendationscreen.export_pdf")}
          </button>
        </div>
      </div>

      {/* State banners */}
      {plots.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 text-sm font-semibold text-gray-600">
          Add a farm plot first. Recommendations are generated per plot.
        </div>
      )}

      {currentPlot && !isSavedPlot && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 text-xs font-bold text-amber-900 flex items-center gap-2.5">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <span>
            <strong>{currentPlot.name}</strong> is sample data, not one of your saved plots. Recommendations can only be generated for saved plots.
          </span>
        </div>
      )}

      {isSavedPlot && !isLoadingReport && !soilReport && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-amber-900 font-bold">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>
              No saved soil report for <strong>{currentPlot?.name}</strong>. A recommendation needs a verified soil report.
            </span>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate("Soil Reports")}
              className="bg-primary hover:bg-[#235F26] text-white font-extrabold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shrink-0 border-0 cursor-pointer shadow-xs"
            >
              <FileText className="w-4 h-4" />
              Upload Soil Report
            </button>
          )}
        </div>
      )}

      {generateError && (
        <div role="alert" className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs font-bold text-rose-800">
          {generateError}
        </div>
      )}

      {historyError && (
        <div role="alert" className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs font-bold text-rose-800">
          Could not load saved recommendations: {historyError}
        </div>
      )}

      {isStale && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 text-xs font-bold text-amber-900">
          This recommendation was based on an older soil report. Generate a new one to use the latest report.
        </div>
      )}

      {/* Plot summary */}
      {currentPlot && (
        <div className="bg-white border border-gray-150 rounded-3xl p-5 shadow-xs grid grid-cols-2 md:grid-cols-5 gap-4 text-xs font-semibold text-gray-700">
          <Field label="Farmer" value={farmerName || "—"} />
          <Field label="Plot" value={currentPlot.name} />
          <Field label="Crop" value={shown?.crop ? shown.crop.replace(/_/g, " ") : currentPlot.crop || "—"} />
          <Field label="Area" value={currentPlot.area ? `${currentPlot.area} acres` : "—"} />
          <Field label="Latest soil report" value={soilReport ? formatDate(soilReport.created_at) : "None"} />
        </div>
      )}

      {!shown && isSavedPlot && soilReport && (
        <div className="bg-white border border-gray-150 rounded-3xl p-6 text-sm font-semibold text-gray-600">
          No recommendation has been generated for this plot yet. Enter the crop price and press
          “Generate”.
        </div>
      )}

      {shown && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 space-y-6">
            {/* Summary */}
            <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs space-y-4">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-emerald-50 border border-emerald-100/50 px-2.5 py-1 rounded-full">
                    Saved {formatDate(shown.created_at)}
                  </span>
                  <h3 className="text-xl font-black text-gray-900 mt-4">
                    {explanation?.summary || "Recommendation"}
                  </h3>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[9px] font-mono text-gray-400 block uppercase">Deficient nutrients</span>
                  <span className="font-black text-sm bg-gray-50 border border-gray-150 px-3 py-1 rounded-xl">
                    {deficient.length === 0 ? "None" : deficient.map((f) => f.nutrient.toUpperCase()).join(", ")}
                  </span>
                </div>
              </div>
              {yieldPred && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <Stat label="Current yield" value={`${Number(yieldPred.current_yield_t_ha).toFixed(1)} t/ha`} />
                  <Stat label="Expected yield" value={`${Number(yieldPred.expected_yield_t_ha).toFixed(1)} t/ha`} />
                  <Stat label="Additional yield" value={`${Number(yieldPred.additional_yield_t_ha).toFixed(1)} t/ha`} />
                </div>
              )}
            </div>

            {/* Findings */}
            {findings.length > 0 && (
              <div className="bg-white rounded-3xl border border-gray-150 overflow-x-auto shadow-xs">
                <div className="p-5 border-b border-gray-100">
                  <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">Nutrient status</h4>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="text-[10px] uppercase text-gray-400">
                    <tr>
                      <th className="p-4 pl-6">Nutrient</th>
                      <th className="p-4">Soil (kg/ha)</th>
                      <th className="p-4">Target (kg/ha)</th>
                      <th className="p-4 pr-6">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {findings.map((f) => (
                      <tr key={f.nutrient} className="border-t border-gray-100">
                        <td className="p-4 pl-6 font-extrabold text-gray-900">{f.display_name}</td>
                        <td className="p-4">{f.soil_value_kg_ha}</td>
                        <td className="p-4">{f.target_kg_ha}</td>
                        <td className="p-4 pr-6 font-bold capitalize">{f.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Dosage plan */}
            <div className="bg-white rounded-3xl border border-gray-150 overflow-x-auto shadow-xs">
              <div className="p-5 border-b border-gray-100">
                <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">
                  {t("recommendationscreen.advisory_dosage_specification")}
                </h4>
              </div>
              {dosages.length === 0 ? (
                <p className="p-6 text-sm font-semibold text-gray-500">
                  No fertilizer correction is needed based on this soil report.
                </p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="text-[10px] uppercase text-gray-400">
                    <tr>
                      <th className="p-4 pl-6">Product</th>
                      <th className="p-4">Dose (kg/ha)</th>
                      <th className="p-4">Total (kg)</th>
                      <th className="p-4">Est. cost</th>
                      <th className="p-4 pr-6">Nutrient</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dosages.map((d, i) => (
                      <tr key={`${d.product_display_name}-${i}`} className="border-t border-gray-100">
                        <td className="p-4 pl-6 font-extrabold text-gray-900">{d.product_display_name}</td>
                        <td className="p-4">{d.quantity_kg_per_ha}</td>
                        <td className="p-4">{d.quantity_kg_total}</td>
                        <td className="p-4">{inr(d.estimated_cost_inr)}</td>
                        <td className="p-4 pr-6">{d.nutrient}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Explanation */}
            {explanation && (
              <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs space-y-4 text-sm">
                {Array.isArray(explanation.identified_issues) && explanation.identified_issues.length > 0 && (
                  <List title="Identified issues" items={explanation.identified_issues} />
                )}
                {Array.isArray(explanation.recommended_actions) && explanation.recommended_actions.length > 0 && (
                  <List title="Recommended actions" items={explanation.recommended_actions} />
                )}
                {explanation.expected_benefit && (
                  <p className="font-semibold text-gray-700">{explanation.expected_benefit}</p>
                )}
                {Array.isArray(explanation.warnings) && explanation.warnings.length > 0 && (
                  <List title="Warnings" items={explanation.warnings} />
                )}
              </div>
            )}
          </div>

          <div className="lg:col-span-4 space-y-6">
            {roi && (
              <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs space-y-3 text-xs font-semibold">
                <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">Economics</h4>
                <Row label="Fertilizer cost" value={inr(roi.fertilizer_cost)} />
                <Row label="Crop price used" value={`${inr(roi.crop_price_per_ton_inr)}/ton`} />
                <Row label="Additional revenue" value={inr(roi.expected_additional_revenue)} />
                <Row label="Estimated profit" value={inr(roi.estimated_profit)} />
                <Row
                  label="ROI"
                  value={typeof roi.roi_percentage === "number" ? `${roi.roi_percentage.toFixed(0)}%` : "—"}
                />
              </div>
            )}

            <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-xs space-y-3">
              <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                <History className="w-4 h-4" /> History
              </h4>
              {plotHistory.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRecId(r.id)}
                  className={`w-full text-left text-xs font-semibold px-3 py-2 rounded-xl border cursor-pointer ${
                    r.id === shown.id ? "border-primary bg-emerald-50" : "border-gray-150 bg-white hover:bg-gray-50"
                  }`}
                >
                  {formatDate(r.created_at)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

const Field: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="space-y-1">
    <span className="block text-[8px] text-gray-400 uppercase">{label}</span>
    <span className="text-gray-900 font-black block">{value}</span>
  </div>
);

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-gray-50 border border-gray-150 p-3.5 rounded-2xl">
    <span className="text-[9px] font-bold text-gray-400 uppercase block">{label}</span>
    <span className="text-xl font-black text-gray-950 mt-1 block">{value}</span>
  </div>
);

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between text-gray-700">
    <span>{label}</span>
    <span className="text-gray-900 font-black">{value}</span>
  </div>
);

const List: React.FC<{ title: string; items: string[] }> = ({ title, items }) => (
  <div>
    <h5 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">{title}</h5>
    <ul className="list-disc pl-5 space-y-1 font-semibold text-gray-700">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  </div>
);
