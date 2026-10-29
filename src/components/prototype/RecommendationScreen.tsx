import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlaskConical } from "lucide-react";
import { jsPDF } from "jspdf";
import { useSavedPlots } from "../../hooks/useSavedPlots";
import { useTranslation } from "../../translation/useTranslation";
import { usePlots } from "../../data/plots";
import { useLatestSoilReport } from "../../hooks/useLatestSoilReport";
import { ApiError, createRecommendation, listRecommendations } from "../../lib/apiClient";
import type { InsufficientDataPayload, RecommendationRecord } from "../../lib/apiClient";
import { SUPPORTED_CROP_NAMES, getCropBaseline } from "../../constants/cropBaselines";
import { RecommendationCard } from "../phase2/RecommendationCard";
import {
  EmptyState,
  ErrorBanner,
  FactRow,
  PageHeader,
  PlotSelect,
  Spinner,
  StatusBadge,
  UnavailableState,
  type BadgeKind,
} from "../phase2/shared";

interface RecommendationScreenProps {
  selectedPlotId?: string;
  onPlotChange?: (plotId: string) => void;
  showToast?: (message: string, type?: "success" | "info" | "warning") => void;
  farmerName?: string;
  onNavigate?: (screen: string) => void;
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
  product_code?: string;
  product_display_name: string;
  quantity_kg_per_ha: number;
  quantity_kg_total: number;
  estimated_cost_inr: number | null;
}

const STATUS_BADGE: Record<string, BadgeKind> = { deficient: "deficient", adequate: "adequate", surplus: "surplus" };
const NUTRIENT_KEY: Record<string, string> = { nitrogen: "n", phosphorus: "p", potassium: "k", n: "n", p: "p", k: "k" };

/** Small caption that says what kind of number a block shows (observed / derived / recommendation / predicted). */
const Tag: React.FC<{ label: string }> = ({ label }) => (
  <span className="rounded-full border border-gray-300 bg-gray-50 px-2.5 py-0.5 text-xs font-bold text-gray-700">{label}</span>
);

const Block: React.FC<{ title: string; tag: string; children: React.ReactNode }> = ({ title, tag, children }) => (
  <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xs">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 p-5">
      <h2 className="text-base font-extrabold text-gray-900">{title}</h2>
      <Tag label={tag} />
    </div>
    <div className="overflow-x-auto">{children}</div>
  </section>
);

export const RecommendationScreen: React.FC<RecommendationScreenProps> = ({
  selectedPlotId,
  onPlotChange,
  showToast,
  farmerName,
  onNavigate,
}) => {
  const { t, lang, locale } = useTranslation();
  const { plots } = usePlots();
  const savedPlots = useSavedPlots();

  const [activePlotId, setActivePlotId] = useState<string>(() => selectedPlotId || "");
  const [history, setHistory] = useState<RecommendationRecord[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [selectedRecId, setSelectedRecId] = useState<string | null>(null);
  const [insufficient, setInsufficient] = useState<InsufficientDataPayload | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const notify = useCallback(
    (msg: string, type: "success" | "info" | "warning" = "success") => showToast?.(msg, type),
    [showToast]
  );

  useEffect(() => {
    if (selectedPlotId) setActivePlotId(selectedPlotId);
    else if (!activePlotId && savedPlots.length > 0) setActivePlotId(savedPlots[0].id);
  }, [selectedPlotId, savedPlots, activePlotId]);

  const currentPlot = plots.find((p) => p.id === activePlotId);
  const isSavedPlot = !!currentPlot && savedPlots.some((p) => p.id === currentPlot.id);
  const { report: soilReport, loading: isLoadingReport } = useLatestSoilReport(activePlotId || undefined, isSavedPlot);

  const cropSupported = !!currentPlot && getCropBaseline(currentPlot.crop) !== null;

  const refreshHistory = useCallback(async () => {
    try {
      // Rows without an engine version were not produced by the recommendation engine.
      setHistory((await listRecommendations()).filter((r) => !!r.engine_version));
      setHistoryError(null);
    } catch (err) {
      setHistory([]);
      setHistoryError(err instanceof Error ? err.message : t("p2.common.error_generic"));
    } finally {
      setHistoryLoading(false);
    }
  }, [t]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  const plotHistory = useMemo(
    () => history.filter((r) => r.plot_id === activePlotId).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    [history, activePlotId]
  );

  useEffect(() => {
    setSelectedRecId(null);
    setGenerateError(null);
    setInsufficient(null);
  }, [activePlotId]);

  const shown: RecommendationRecord | null = plotHistory.find((r) => r.id === selectedRecId) ?? plotHistory[0] ?? null;
  const findings: Finding[] = Array.isArray(shown?.deficiencies) ? shown!.deficiencies : [];
  const dosages: Dosage[] = Array.isArray(shown?.fertilizer_plan) ? shown!.fertilizer_plan : [];
  const explanation = shown?.explanation ?? null;
  const hasObj = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === "object" && Object.keys(v as object).length > 0;
  // Stored as {} when the cited rule does not support yield/revenue figures: show nothing then.
  const yieldPred = hasObj(shown?.yield_prediction) ? shown!.yield_prediction : null;
  const roi = hasObj(shown?.roi) ? shown!.roi : null;
  const provenance = shown?.provenance ?? null;
  const deficient = findings.filter((f) => f.status === "deficient");
  const schedule = provenance?.schedule ?? null;
  const gramsLabel = (nutrient: "n" | "p" | "k", basis: string) =>
    nutrient === "n" ? "N" : basis === "oxide" ? (nutrient === "p" ? "P2O5" : "K2O") : nutrient.toUpperCase();
  const isStale = !!shown && !!soilReport && shown.soil_report_id !== soilReport.id;

  const num = (n: unknown, d = 1) => (typeof n === "number" && Number.isFinite(n) ? n.toLocaleString(locale, { maximumFractionDigits: d }) : t("p2.common.not_available"));
  const inr = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : t("p2.common.not_available"));
  const when = (iso?: string | null) => {
    if (!iso) return t("p2.common.not_available");
    const d = new Date(iso);
    return isNaN(d.getTime()) ? t("p2.common.not_available") : d.toLocaleString(locale);
  };
  const nutrientName = (f: { nutrient: string; display_name: string }) => {
    const k = NUTRIENT_KEY[f.nutrient?.toLowerCase()];
    return k ? t(`p2.nutrient.${k}`) : f.display_name || f.nutrient;
  };

  const handleGenerate = async () => {
    if (inFlight.current) return; // no duplicate requests
    setGenerateError(null);
    setInsufficient(null);
    if (!isSavedPlot) return setGenerateError(t("p2.nf.err_plot"));
    if (!soilReport) return setGenerateError(t("p2.nf.err_report"));

    inFlight.current = true;
    setIsProcessing(true);
    try {
      const outcome = await createRecommendation({
        plot_id: activePlotId,
        soil_report_id: soilReport.id,
      });
      if (outcome.state === "insufficient_data") {
        setInsufficient(outcome);
        return;
      }
      await refreshHistory();
      setSelectedRecId(outcome.recommendation_id ?? null);
      notify(t("p2.nf.done", { plot: currentPlot?.name ?? "" }), "success");
    } catch (err) {
      const message =
        err instanceof ApiError && err.code === "soil_report_not_verified"
          ? t("p3.rec.not_verified")
          : err instanceof Error
            ? err.message
            : t("p2.common.error_generic");
      setGenerateError(message);
      notify(message, "warning");
    } finally {
      inFlight.current = false;
      setIsProcessing(false);
    }
  };

  // The PDF is deliberately English-only: the built-in PDF fonts cannot draw Kannada script.
  const handleExportPDF = () => {
    if (!shown || !currentPlot) return;
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
      const rs = (n: unknown) => (typeof n === "number" ? `Rs ${Math.round(n).toLocaleString("en-IN")}` : "n/a");

      line("NutriPalm AI - Crop Recommendation Report", 18, true);
      line(`Generated: ${new Date().toLocaleString("en-IN")}`, 9);
      line(`Recommendation date: ${shown.created_at ? new Date(shown.created_at).toLocaleString("en-IN") : "n/a"}`, 9);
      y += 4;
      line(`Farmer: ${farmerName || "n/a"}`);
      line(`Plot: ${currentPlot.name}   Crop: ${shown.crop}   Area: ${currentPlot.area} acres`);
      y += 4;
      if (explanation?.summary) {
        line("Summary", 12, true);
        line(explanation.summary);
        y += 2;
      }
      if (findings.length) {
        line("Nutrient status (soil vs target, kg/ha)", 12, true);
        findings.forEach((f) => line(`${f.display_name}: ${f.soil_value_kg_ha} / ${f.target_kg_ha} (${f.status})`));
        y += 2;
      }
      if (dosages.length) {
        line("Fertilizer plan", 12, true);
        dosages.forEach((d) =>
          line(`${d.product_display_name} (${d.nutrient}): ${d.quantity_kg_per_ha} kg/ha, total ${d.quantity_kg_total} kg${d.estimated_cost_inr != null ? `, est. ${rs(d.estimated_cost_inr)}` : ""}`)
        );
        y += 2;
      }
      if (roi) {
        line("Economics", 12, true);
        line(`Fertilizer cost: ${rs(roi.fertilizer_cost)}   Additional revenue: ${rs(roi.expected_additional_revenue)}`);
        line(`Crop price used: ${rs(roi.crop_price_per_ton_inr)}/ton   Estimated profit: ${rs(roi.estimated_profit)}`);
      }
      if (Array.isArray(explanation?.warnings) && explanation.warnings.length) {
        y += 2;
        line("Warnings", 12, true);
        explanation.warnings.forEach((w: string) => line(`- ${w}`));
      }
      y += 4;
      if (provenance) {
        line(`Basis: engine ${shown.engine_version ?? ""}; rule ${provenance.rule.rule_version} - ${provenance.rule.source.title} (${provenance.rule.source.publisher}, ${provenance.rule.source.year}, ${provenance.rule.source.locator}).`, 8);
        line(`Not taken into account: ${provenance.not_considered.join(", ")}.`, 8);
      }
      line("This is advice generated from a verified soil report. It is not a record of fertilizer applied. Verify field conditions before application.", 8);
      doc.save(`Advisory_${currentPlot.name.replace(/[^\w-]+/g, "_")}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      notify(t("p2.common.error_generic"), "warning");
    }
  };

  const observedRows: Array<{ label: string; value: string; unit: string }> = soilReport
    ? [
        { label: t("p2.nutrient.n"), value: num(soilReport.nitrogen_kg_ha), unit: "kg/ha" },
        { label: t("p2.nutrient.p"), value: num(soilReport.phosphorus_kg_ha), unit: "kg/ha" },
        { label: t("p2.nutrient.k"), value: num(soilReport.potassium_kg_ha), unit: "kg/ha" },
        { label: t("p2.nutrient.oc"), value: num(soilReport.organic_carbon_percent, 2), unit: "%" },
        { label: t("p2.nutrient.ph"), value: num(soilReport.ph, 2), unit: "pH" },
        {
          label: t("p2.nutrient.ec"),
          value: soilReport.electrical_conductivity !== null ? num(soilReport.electrical_conductivity, 2) : t("p2.common.not_available"),
          unit: "dS/m",
        },
      ]
    : [];

  const cellPad = "px-4 py-3 text-sm";
  const head = "px-4 py-2 text-sm font-bold text-gray-600";

  return (
    <div className="relative space-y-6 text-left">
      <PageHeader
        icon={<FlaskConical className="h-8 w-8" />}
        title={t("p2.nf.title")}
        subtitle={t("p2.nf.subtitle")}
        right={
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-end">
            <PlotSelect
              plots={savedPlots}
              value={activePlotId}
              onChange={(id) => {
                setActivePlotId(id);
                onPlotChange?.(id);
              }}
              id="nf-plot"
            />
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isProcessing || !soilReport || !cropSupported}
              className="min-h-11 cursor-pointer rounded-xl border-0 bg-primary px-5 py-2.5 text-sm font-extrabold text-white hover:bg-[#235F26] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isProcessing ? t("p2.nf.generating") : t("p2.nf.generate")}
            </button>
          </div>
        }
      />
      <p className="-mt-3 text-sm font-medium text-gray-500">{t("p3.rec.generate_note")}</p>

      {isProcessing && <Spinner label={t("p2.nf.generating")} />}

      {savedPlots.length === 0 && (
        <EmptyState
          title={t("p2.common.no_plots_title")}
          body={t("p2.common.no_plots_body")}
          action={onNavigate ? { label: t("p2.common.add_plot"), onClick: () => onNavigate("Farm Plots") } : undefined}
        />
      )}

      {currentPlot && !isSavedPlot && <ErrorBanner message={t("p2.nf.sample")} />}

      {isSavedPlot && !cropSupported && (
        <UnavailableState
          title={t("p2.nf.unsupported_title", { crop: currentPlot!.crop || t("p2.common.crop") })}
          body={t("p2.nf.unsupported_body", { crop: currentPlot!.crop || t("p2.common.crop"), list: SUPPORTED_CROP_NAMES.join(", ") })}
        />
      )}

      {isSavedPlot && cropSupported && !isLoadingReport && !soilReport && (
        <EmptyState
          title={t("p2.nf.no_report_title")}
          body={t("p2.nf.no_report_body")}
          action={onNavigate ? { label: t("p2.common.go_soil"), onClick: () => onNavigate("Soil Reports") } : undefined}
        />
      )}

      {generateError && <ErrorBanner message={generateError} />}
      {insufficient && (
        <section role="status" className="space-y-3 rounded-3xl border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-extrabold text-amber-950">{t("p3.rec.insufficient_title")}</h2>
          <p className="text-sm font-medium text-amber-950">{t("p3.rec.insufficient_body")}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm font-semibold text-amber-950">
            {insufficient.reasons.map((r) => (
              <li key={r.code}>{r.message}</li>
            ))}
          </ul>
          <div>
            <h3 className="text-sm font-extrabold text-amber-950">{t("p3.rec.required")}</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm font-medium text-amber-950">
              {insufficient.required.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          <p className="text-xs font-medium text-amber-900">{t("p2.lang.backend_note")}</p>
        </section>
      )}
      {historyError && <ErrorBanner message={t("p2.nf.err_load", { message: historyError })} onRetry={refreshHistory} />}
      {isStale && <ErrorBanner message={t("p2.nf.stale")} />}
      {lang === "kn" && shown && <p className="text-sm font-medium text-gray-600">{t("p2.lang.backend_note")}</p>}

      {currentPlot && isSavedPlot && (
        <dl className="grid grid-cols-2 gap-x-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-xs md:grid-cols-4">
          <FactRow label={t("p2.nf.field.farmer")} value={farmerName || t("p2.common.not_available")} />
          <FactRow label={t("p2.nf.field.crop")} value={shown?.crop ? shown.crop.replace(/_/g, " ") : currentPlot.crop || t("p2.common.not_available")} />
          <FactRow label={t("p2.nf.field.area")} value={currentPlot.area ? `${currentPlot.area} ${t("p2.common.acres")}` : t("p2.common.not_available")} />
          <FactRow label={t("p2.nf.field.report")} value={soilReport ? when(soilReport.created_at) : t("p2.nf.field.none")} />
        </dl>
      )}

      {isSavedPlot && cropSupported && soilReport && (
        <Block title={t("p2.nf.step.observed")} tag={t("p2.nf.tag.observed")}>
          <table className="w-full text-left">
            <thead>
              <tr>
                <th scope="col" className={head}>{t("p2.nf.col.parameter")}</th>
                <th scope="col" className={head}>{t("p2.nf.col.value")}</th>
                <th scope="col" className={head}>{t("p2.nf.col.unit")}</th>
              </tr>
            </thead>
            <tbody>
              {observedRows.map((r) => (
                <tr key={r.label} className="border-t border-gray-100">
                  <th scope="row" className={`${cellPad} font-bold text-gray-900`}>{r.label}</th>
                  <td className={`${cellPad} font-semibold`}>{r.value}</td>
                  <td className={`${cellPad} text-gray-600`}>{r.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Block>
      )}

      {!shown && isSavedPlot && cropSupported && soilReport && !historyLoading && (
        <p className="rounded-3xl border border-gray-200 bg-white p-6 text-sm font-semibold text-gray-700">{t("p2.nf.no_advice_yet")}</p>
      )}

      {shown && (
        <>
          {findings.length > 0 && (
            <Block title={t("p2.nf.step.status")} tag={t("p2.nf.tag.derived")}>
              <table className="w-full min-w-[32rem] text-left">
                <thead>
                  <tr>
                    <th scope="col" className={head}>{t("p2.nf.col.parameter")}</th>
                    <th scope="col" className={head}>{t("p2.nf.col.value")} (kg/ha)</th>
                    <th scope="col" className={head}>{t("p2.nf.col.target")} (kg/ha)</th>
                    <th scope="col" className={head}>{t("p2.nf.col.short")} (kg/ha)</th>
                    <th scope="col" className={head}>{t("p2.nf.col.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {findings.map((f) => (
                    <tr key={f.nutrient} className="border-t border-gray-100">
                      <th scope="row" className={`${cellPad} font-bold text-gray-900`}>{nutrientName(f)}</th>
                      <td className={cellPad}>{num(f.soil_value_kg_ha)}</td>
                      <td className={cellPad}>{num(f.target_kg_ha)}</td>
                      <td className={cellPad}>{f.status === "deficient" ? num(f.deficit_kg_ha) : "—"}</td>
                      <td className={cellPad}><StatusBadge kind={STATUS_BADGE[f.status] ?? "unknown"} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="space-y-1 border-t border-gray-100 p-4 text-sm font-medium text-gray-700">
                <p className="text-gray-500">{t("p2.nf.reference_note")}</p>
              </div>
            </Block>
          )}

          <Block title={t("p2.nf.step.plan")} tag={t("p2.nf.tag.recommendation")}>
            {dosages.length === 0 ? (
              <p className="p-5 text-sm font-semibold text-gray-700">{t("p2.nf.no_correction")}</p>
            ) : (
              <table className="w-full min-w-[34rem] text-left">
                <thead>
                  <tr>
                    <th scope="col" className={head}>{t("p2.nf.col.product")}</th>
                    <th scope="col" className={head}>{t("p2.nf.col.nutrient")}</th>
                    <th scope="col" className={head}>{t("p2.nf.col.per_ha")}</th>
                    <th scope="col" className={head}>{t("p2.nf.col.total")}</th>
                    <th scope="col" className={head}>{t("p2.nf.col.cost")}</th>
                  </tr>
                </thead>
                <tbody>
                  {dosages.map((d, i) => (
                    <tr key={`${d.product_display_name}-${i}`} className="border-t border-gray-100">
                      <th scope="row" className={`${cellPad} font-bold text-gray-900`}>{d.product_display_name}</th>
                      <td className={cellPad}>{NUTRIENT_KEY[d.nutrient?.toLowerCase()] ? t(`p2.nutrient.${NUTRIENT_KEY[d.nutrient.toLowerCase()]}`) : d.nutrient}</td>
                      <td className={cellPad}>{num(d.quantity_kg_per_ha)}</td>
                      <td className={cellPad}>{num(d.quantity_kg_total)}</td>
                      <td className={cellPad}>{inr(d.estimated_cost_inr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Block>

          {yieldPred && typeof yieldPred.expected_yield_t_ha === "number" && (
            <Block title={t("p2.nf.step.predicted")} tag={t("p2.nf.tag.predicted")}>
              <dl className="grid gap-x-6 p-5 sm:grid-cols-2">
                <FactRow label={t("p2.nf.yield_current")} value={`${num(yieldPred.current_yield_t_ha)} t/ha`} />
                <FactRow label={t("p2.nf.yield_expected")} value={`${num(yieldPred.expected_yield_t_ha)} t/ha`} />
                <FactRow label={t("p2.nf.yield_extra")} value={`${num(yieldPred.additional_yield_t_ha)} t/ha`} />
                {roi && (
                  <>
                    <FactRow label={t("p2.nf.money.cost")} value={inr(roi.fertilizer_cost)} />
                    <FactRow label={t("p2.nf.money.price")} value={`${inr(roi.crop_price_per_ton_inr)}/t`} />
                    <FactRow label={t("p2.nf.money.revenue")} value={inr(roi.expected_additional_revenue)} />
                    <FactRow label={t("p2.nf.money.profit")} value={inr(roi.estimated_profit)} />
                    <FactRow label={t("p2.nf.money.roi")} value={typeof roi.roi_percentage === "number" ? `${num(roi.roi_percentage, 0)}%` : t("p2.common.not_available")} />
                  </>
                )}
              </dl>
            </Block>
          )}

          {schedule && (
            <Block title={t("p3.rec.schedule.title")} tag={t("p2.nf.tag.recommendation")}>
              <div className="space-y-2 p-5 text-sm font-medium text-gray-800">
                <p className="font-bold text-gray-900">
                  {t("p3.rec.schedule.age", { year: String(schedule.age_year), date: schedule.planting_date ?? t("p2.common.not_available") })}
                </p>
                <p>{t("p3.rec.schedule.palms", { count: String(schedule.plant_count), perha: num(schedule.palms_per_ha, 0) })}</p>
                <ul className="list-disc pl-5">
                  {(["n", "p", "k"] as const).map((k) => (
                    <li key={k}>
                      {t("p3.rec.schedule.dose", {
                        nutrient: gramsLabel(k, schedule.nutrient_basis[k]),
                        grams: num(schedule.per_palm_g_per_year[k], 0),
                      })}
                    </li>
                  ))}
                </ul>
                {dosages.some((d) => d.product_code && schedule.products_g_per_palm_per_year[d.product_code] != null) && (
                  <ul className="list-disc pl-5">
                    {dosages.map((d) =>
                      d.product_code && schedule.products_g_per_palm_per_year[d.product_code] != null ? (
                        <li key={d.product_code}>
                          {t("p3.rec.schedule.product", {
                            product: d.product_display_name,
                            grams: num(schedule.products_g_per_palm_per_year[d.product_code], 0),
                          })}
                        </li>
                      ) : null
                    )}
                  </ul>
                )}
                {schedule.timing_note && <p className="text-gray-700">{t("p3.rec.schedule.timing", { text: schedule.timing_note })}</p>}
                <p className="text-gray-600">{t("p3.rec.schedule.soil_note")}</p>
              </div>
            </Block>
          )}

          <p role="note" className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm font-bold text-sky-950">
            {t("p3.rec.not_applied")}{" "}
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate("Digital Twin")}
                className="cursor-pointer border-0 bg-transparent p-0 font-extrabold text-primary underline"
              >
                {t("p3.rec.record")}
              </button>
            )}
          </p>

          {provenance && (
            <Block title={t("p3.rec.basis")} tag={t("p2.nf.tag.recommendation")}>
              <div className="space-y-2 p-5 text-sm font-medium text-gray-800">
                <p>{t("p3.rec.engine", { version: shown.engine_version ?? "", date: when(shown.generated_at) })}</p>
                <p>
                  {t("p3.rec.rule", {
                    version: provenance.rule.rule_version,
                    title: provenance.rule.source.title,
                    publisher: provenance.rule.source.publisher,
                    year: String(provenance.rule.source.year),
                    locator: provenance.rule.source.locator,
                  })}
                </p>
                <p className="text-gray-600">{t("p3.rec.reviewed", { by: provenance.rule.reviewed_by, date: provenance.rule.reviewed_on })}</p>
                <p className="font-bold text-gray-900">
                  {t("p3.rec.soil_used", { status: t(`p3.verified.${provenance.soil_verification_status}`) })}
                </p>
                <p>
                  {Object.entries(provenance.soil_values_used)
                    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
                    .join(" · ")}
                </p>
                <ul className="list-disc pl-5 text-gray-700">
                  {provenance.assumptions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
                <p className="text-gray-700">{t("p3.rec.not_considered", { list: provenance.not_considered.join(", ") })}</p>
              </div>
            </Block>
          )}

          <RecommendationCard
            kind="fertilizer"
            title={t("p2.nf.card_title", { plot: currentPlot?.name ?? "" })}
            badge={schedule ? undefined : deficient.length > 0 ? "deficient" : "adequate"}
            date={t("p2.nf.saved", { date: when(shown.created_at) })}
            what={[
              explanation?.summary,
              ...(Array.isArray(explanation?.identified_issues) ? explanation.identified_issues : []),
            ].filter((x): x is string => typeof x === "string" && x.length > 0)}
            doThis={Array.isArray(explanation?.recommended_actions) ? explanation.recommended_actions : []}
            howMuch={dosages.map((d) => ({
              label: d.product_display_name,
              value: `${num(d.quantity_kg_per_ha)} kg/ha · ${num(d.quantity_kg_total)} kg`,
            }))}
            why={typeof explanation?.expected_benefit === "string" && explanation.expected_benefit ? [explanation.expected_benefit] : []}
            source={t("p2.nf.source")}
            limitations={Array.isArray(explanation?.warnings) ? explanation.warnings : []}
            missing={[
              `${t("p2.nf.not_given.per_plant")} — ${t("p2.nf.not_given.note")}`,
              `${t("p2.nf.not_given.method")} — ${t("p2.nf.not_given.note")}`,
              `${t("p2.nf.not_given.timing")} — ${t("p2.nf.not_given.note")}`,
            ]}
            actions={[{ label: t("p2.nf.pdf"), onClick: handleExportPDF }]}
          />
          {lang === "kn" && <p className="-mt-3 text-sm font-medium text-gray-500">{t("p2.nf.pdf_english")}</p>}

          {plotHistory.length > 1 && (
            <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-xs">
              <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold text-gray-900">
                {t("p2.nf.history")}
              </h2>
              <div className="flex flex-wrap gap-2">
                {plotHistory.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    aria-pressed={r.id === shown.id}
                    onClick={() => setSelectedRecId(r.id)}
                    className={`min-h-11 cursor-pointer rounded-xl border px-3 py-2 text-sm font-semibold ${
                      r.id === shown.id ? "border-primary bg-emerald-50 text-gray-900" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {when(r.created_at)}
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};
