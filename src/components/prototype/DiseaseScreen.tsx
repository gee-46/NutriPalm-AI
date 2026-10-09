import React, { useMemo, useRef, useState } from "react";
import { Bug } from "lucide-react";
import { useSavedPlots } from "../../hooks/useSavedPlots";
import { useTranslation } from "../../translation/useTranslation";
import { useBackendCapabilities } from "../../hooks/useBackendCapabilities";
import { assessDisease, ModuleUnavailableError } from "../../lib/phase2/capabilities";
import type { DiseaseAssessment, DiseaseRisk } from "../../lib/phase2/contracts";
import { RecommendationCard } from "../phase2/RecommendationCard";
import {
  EmptyState,
  ErrorBanner,
  PageHeader,
  PlotSelect,
  Spinner,
  StatusBadge,
  UnavailableState,
  type BadgeKind,
} from "../phase2/shared";

const CROPS = ["arecanut", "coconut"] as const;
const PARTS = ["leaves", "trunk", "nuts", "crown", "roots"] as const;

const RISK_BADGE: Record<DiseaseRisk, BadgeKind> = {
  low: "low",
  moderate: "moderate",
  high: "high",
  insufficient_evidence: "insufficient",
};
const RISK_EXPLAIN: Record<DiseaseRisk, string> = {
  low: "p2.disease.explain.low",
  moderate: "p2.disease.explain.moderate",
  high: "p2.disease.explain.high",
  insufficient_evidence: "p2.disease.explain.insufficient",
};

interface Props {
  onNavigate?: (screen: string) => void;
}

const cropFromPlot = (name?: string): string => {
  const k = (name || "").trim().toLowerCase();
  return k === "arecanut" || k === "coconut" ? k : "";
};

export const DiseaseScreen: React.FC<Props> = ({ onNavigate }) => {
  const { t, locale } = useTranslation();
  const plots = useSavedPlots();
  const caps = useBackendCapabilities();

  const [plotId, setPlotId] = useState("");
  const [crop, setCrop] = useState("");
  const [stage, setStage] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [parts, setParts] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DiseaseAssessment | null>(null);
  const inFlight = useRef(false);

  const available = caps.disease === "available";
  const plot = useMemo(() => plots.find((p) => p.id === plotId), [plots, plotId]);

  const choosePlot = (id: string) => {
    setPlotId(id);
    setResult(null);
    setError(null);
    const p = plots.find((x) => x.id === id);
    setCrop(cropFromPlot(p?.crop));
  };

  const togglePart = (part: string) =>
    setParts((prev) => (prev.includes(part) ? prev.filter((x) => x !== part) : [...prev, part]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current) return; // prevent duplicate requests
    setError(null);
    if (!plotId) return setError(t("p2.disease.err_plot"));
    if (!crop) return setError(t("p2.disease.err_crop"));
    if (!symptoms.trim() && parts.length === 0) return setError(t("p2.disease.err_input"));

    inFlight.current = true;
    setBusy(true);
    setResult(null);
    try {
      const res = await assessDisease({
        plot_id: plotId,
        crop,
        crop_stage: stage.trim() || undefined,
        symptoms: symptoms.trim() ? [symptoms.trim()] : undefined,
        affected_parts: parts.length ? parts : undefined,
        observations: notes.trim() || undefined,
      });
      setResult(res);
    } catch (err) {
      if (err instanceof ModuleUnavailableError) setError(t("p2.disease.unavailable_title"));
      else setError(t("p2.disease.error", { message: err instanceof Error ? err.message : t("p2.common.error_generic") }));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleString(locale);
  };

  const inputCls =
    "min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:bg-gray-100 disabled:text-gray-500";
  const labelCls = "mb-1 block text-sm font-bold text-gray-700";

  return (
    <div className="space-y-6 text-left">
      <PageHeader icon={<Bug className="h-8 w-8" />} title={t("p2.disease.title")} subtitle={t("p2.disease.subtitle")} />

      {plots.length === 0 ? (
        <EmptyState
          title={t("p2.common.no_plots_title")}
          body={t("p2.common.no_plots_body")}
          action={onNavigate ? { label: t("p2.common.add_plot"), onClick: () => onNavigate("Farm Plots") } : undefined}
        />
      ) : (
        <>
          {caps.disease === "checking" && <Spinner label={t("p2.disease.checking_service")} />}
          {caps.disease === "unavailable" && (
            <UnavailableState
              title={t("p2.disease.unavailable_title")}
              body={t("p2.disease.unavailable_body")}
              detail={t("p2.disease.unavailable_detail")}
            />
          )}

          <form onSubmit={submit} className="space-y-5 rounded-3xl border border-gray-200 bg-white p-5 shadow-xs sm:p-6" noValidate>
            <fieldset disabled={!available || busy} className="space-y-5 border-0 p-0">
              <div className="grid gap-4 sm:grid-cols-2">
                <PlotSelect plots={plots} value={plotId} onChange={choosePlot} id="disease-plot" />
                <div>
                  <label htmlFor="disease-crop" className={labelCls}>{t("p2.disease.crop_label")}</label>
                  <select id="disease-crop" value={crop} onChange={(e) => setCrop(e.target.value)} className={inputCls}>
                    <option value="">{t("p2.disease.crop_choose")}</option>
                    {CROPS.map((c) => (
                      <option key={c} value={c}>{t(`p2.disease.crop.${c}`)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="disease-stage" className={labelCls}>
                  {t("p2.disease.stage_label")} <span className="font-medium text-gray-500">({t("p2.common.optional")})</span>
                </label>
                <input id="disease-stage" value={stage} onChange={(e) => setStage(e.target.value)} placeholder={t("p2.disease.stage_ph")} className={inputCls} />
              </div>

              <div>
                <label htmlFor="disease-symptoms" className={labelCls}>{t("p2.disease.symptoms_label")}</label>
                <textarea id="disease-symptoms" rows={3} value={symptoms} onChange={(e) => setSymptoms(e.target.value)} placeholder={t("p2.disease.symptoms_ph")} className={inputCls} />
              </div>

              <div role="group" aria-labelledby="disease-parts-label">
                <p id="disease-parts-label" className={labelCls}>{t("p2.disease.parts_label")}</p>
                <div className="flex flex-wrap gap-2">
                  {PARTS.map((part) => (
                    <label key={part} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 has-[:checked]:border-primary has-[:checked]:bg-emerald-50">
                      <input type="checkbox" checked={parts.includes(part)} onChange={() => togglePart(part)} className="h-5 w-5 accent-[#2E7D32]" />
                      {t(`p2.disease.part.${part}`)}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="disease-notes" className={labelCls}>
                  {t("p2.disease.notes_label")} <span className="font-medium text-gray-500">({t("p2.common.optional")})</span>
                </label>
                <textarea id="disease-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("p2.disease.notes_ph")} className={inputCls} />
              </div>
            </fieldset>

            <p className="text-sm font-medium text-gray-600">{t("p2.disease.photo_note")}</p>

            {error && <ErrorBanner message={error} />}

            <button
              type="submit"
              disabled={!available || busy}
              className="min-h-11 cursor-pointer rounded-xl border-0 bg-primary px-5 py-2.5 text-sm font-extrabold text-white hover:bg-[#235F26] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? t("p2.disease.submitting") : t("p2.disease.submit")}
            </button>
          </form>

          {result && (
            <section aria-live="polite" className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-extrabold text-gray-900">{t("p2.disease.result_title")}</h2>
                <StatusBadge kind={RISK_BADGE[result.risk_level]} />
              </div>
              <p className="text-base font-medium text-gray-700">{t(RISK_EXPLAIN[result.risk_level])}</p>

              {result.candidates.length === 0 ? (
                <p className="text-sm font-medium text-gray-600">{t("p2.disease.no_candidates")}</p>
              ) : (
                result.candidates.map((c, i) => (
                  <RecommendationCard
                    key={`${c.disease_name}-${i}`}
                    kind="disease"
                    title={t("p2.disease.possible", { name: c.disease_name })}
                    badge={RISK_BADGE[result.risk_level]}
                    what={c.contributing_factors}
                    doThis={c.management}
                    precautions={c.precautions}
                    evidence={c.evidence}
                    limitations={result.limitations}
                    missing={result.missing_inputs}
                    date={t("p2.disease.assessed_at", { date: fmtDate(result.assessed_at) })}
                  />
                ))
              )}
              {result.candidates.length === 0 && (result.limitations.length > 0 || result.missing_inputs.length > 0) && (
                <RecommendationCard
                  kind="disease"
                  title={plot ? plot.name : t("p2.disease.result_title")}
                  badge={RISK_BADGE[result.risk_level]}
                  limitations={result.limitations}
                  missing={result.missing_inputs}
                  date={t("p2.disease.assessed_at", { date: fmtDate(result.assessed_at) })}
                />
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
};
