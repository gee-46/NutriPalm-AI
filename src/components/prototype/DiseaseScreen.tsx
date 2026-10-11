import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bug } from "lucide-react";
import { useSavedPlots } from "../../hooks/useSavedPlots";
import { usePlotWeather } from "../../hooks/usePlotWeather";
import { useTranslation } from "../../translation/useTranslation";
import { useBackendCapabilities } from "../../hooks/useBackendCapabilities";
import {
  assessDisease,
  fetchDiseaseVocabulary,
  getDiseaseAssessment,
  listDiseaseAssessments,
  ModuleUnavailableError,
} from "../../lib/phase2/capabilities";
import type { DiseaseAssessment, DiseaseAssessmentRecord, DiseaseAssessmentRequest, DiseaseVocabulary, TriState } from "../../lib/phase2/contracts";
import { DiseaseResult, RISK_BADGE } from "../phase2/DiseaseResult";
import { EmptyState, ErrorBanner, PageHeader, PlotSelect, Spinner, StatusBadge, UnavailableState } from "../phase2/shared";

interface Props {
  onNavigate?: (screen: string) => void;
}

const SEVERITIES = ["mild", "moderate", "severe"] as const;

const normaliseCrop = (name?: string): string => {
  const k = (name || "").trim().toLowerCase();
  return k === "arecanut" || k === "coconut" ? k : "";
};

export const DiseaseScreen: React.FC<Props> = ({ onNavigate }) => {
  const { t, tOptional, locale } = useTranslation();
  const plots = useSavedPlots();
  const caps = useBackendCapabilities();

  const [vocab, setVocab] = useState<DiseaseVocabulary | null>(null);
  const [vocabError, setVocabError] = useState<string | null>(null);

  const [plotId, setPlotId] = useState("");
  const [crop, setCrop] = useState("");
  const [stage, setStage] = useState("");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [parts, setParts] = useState<string[]>([]);
  const [context, setContext] = useState<Record<string, TriState>>({});
  const [severity, setSeverity] = useState("");
  const [duration, setDuration] = useState("");
  const [obsDate, setObsDate] = useState("");
  const [notes, setNotes] = useState("");
  const [attachWeather, setAttachWeather] = useState(true);

  const [errors, setErrors] = useState<string[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DiseaseAssessment | null>(null);
  const [history, setHistory] = useState<DiseaseAssessmentRecord[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const available = caps.disease === "available";
  const plot = useMemo(() => plots.find((p) => p.id === plotId), [plots, plotId]);
  const wx = usePlotWeather(plot);
  const today = new Date().toISOString().slice(0, 10);

  // The symptom list comes from the backend, so it grows with the knowledge base (and with new crops).
  useEffect(() => {
    if (!available) return;
    let cancelled = false;
    fetchDiseaseVocabulary()
      .then((v) => !cancelled && (setVocab(v), setVocabError(null)))
      .catch((e) => !cancelled && setVocabError(e instanceof Error ? e.message : t("p2.common.error_generic")));
    return () => {
      cancelled = true;
    };
  }, [available, t]);

  const refreshHistory = useCallback(async () => {
    if (!available || !plotId) {
      setHistory([]);
      return;
    }
    try {
      setHistory(await listDiseaseAssessments(plotId));
      setHistoryError(null);
    } catch (e) {
      setHistory([]);
      setHistoryError(e instanceof Error ? e.message : t("p2.common.error_generic"));
    }
  }, [available, plotId, t]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  const choosePlot = (id: string) => {
    setPlotId(id);
    setResult(null);
    setErrors([]);
    setApiError(null);
    setCrop(normaliseCrop(plots.find((x) => x.id === id)?.crop));
  };

  const toggle = (list: string[], setList: (v: string[]) => void, code: string) =>
    setList(list.includes(code) ? list.filter((x) => x !== code) : [...list, code]);

  const coverageMissing = !!vocab && !!crop && !vocab.crops_with_verified_knowledge.includes(crop);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current) return; // no duplicate requests
    const problems: string[] = [];
    if (!plotId) problems.push(t("p2.disease.err_plot"));
    else if (!crop) problems.push(t("p2.disease.err_crop"));
    if (symptoms.length === 0) problems.push(t("p2.dis.err_symptom"));
    if (duration.trim() && !/^\d{1,4}$/.test(duration.trim())) problems.push(t("p2.dis.err_duration"));
    if (obsDate && obsDate > today) problems.push(t("p2.dis.err_date"));
    setErrors(problems);
    setApiError(null);
    if (problems.length) return;

    const w = wx.weather;
    const body: DiseaseAssessmentRequest = {
      plot_id: plotId,
      crop,
      crop_stage: stage || undefined,
      symptom_codes: symptoms,
      affected_parts: parts.length ? parts : undefined,
      observations: notes.trim() || undefined,
      observation_date: obsDate || undefined,
      severity: (severity as DiseaseAssessmentRequest["severity"]) || undefined,
      duration_days: duration.trim() ? Number(duration.trim()) : undefined,
      context: Object.fromEntries(Object.entries(context).filter(([, v]) => v !== "unknown")),
      weather:
        attachWeather && w
          ? { source: w.source, temperature_c: w.current.temperatureC, ...(w.current.humidityPercent !== null ? { humidity_pct: w.current.humidityPercent } : {}) }
          : undefined,
    };

    inFlight.current = true;
    setBusy(true);
    setResult(null);
    try {
      const res = await assessDisease(body);
      setResult(res);
      refreshHistory();
    } catch (err) {
      if (err instanceof ModuleUnavailableError) setApiError(t("p2.disease.unavailable_title"));
      else setApiError(t("p2.disease.error", { message: err instanceof Error ? err.message : t("p2.common.error_generic") }));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const openHistory = async (id: string) => {
    setApiError(null);
    try {
      const rec = await getDiseaseAssessment(id);
      if (rec.result) setResult(rec.result);
    } catch (err) {
      setApiError(t("p2.disease.error", { message: err instanceof Error ? err.message : t("p2.common.error_generic") }));
    }
  };

  // symptoms grouped by the plant part they appear on
  const groups = useMemo(() => {
    if (!vocab) return [] as Array<{ part: string; items: DiseaseVocabulary["symptoms"] }>;
    const order = vocab.parts.map((p) => p.code);
    const by = new Map<string, DiseaseVocabulary["symptoms"]>();
    for (const s of vocab.symptoms) {
      const key = s.part && order.includes(s.part) ? s.part : "other";
      by.set(key, [...(by.get(key) ?? []), s]);
    }
    return [...order, "other"].filter((k) => by.has(k)).map((k) => ({ part: k, items: by.get(k)! }));
  }, [vocab]);

  const inputCls =
    "min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:bg-gray-100 disabled:text-gray-500";
  const labelCls = "mb-1 block text-sm font-bold text-gray-700";
  const partLabel = (code: string) => (code === "other" ? t("p2.dis.symptoms_group.other") : tOptional(`p2.dis.part.${code}`, tOptional(`p2.disease.part.${code}`, vocab?.parts.find((p) => p.code === code)?.label_en ?? code)));
  const formReady = available && !!vocab;

  return (
    <div className="space-y-6 text-left">
      <PageHeader icon={<Bug className="h-8 w-8" />} title={t("p2.disease.title")} subtitle={t("p2.dis.subtitle")} />

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
            <UnavailableState title={t("p2.disease.unavailable_title")} body={t("p2.disease.unavailable_body")} detail={t("p2.disease.unavailable_detail")} />
          )}
          {available && !vocab && !vocabError && <Spinner label={t("p2.dis.vocab_loading")} />}
          {vocabError && <ErrorBanner message={t("p2.dis.vocab_error", { message: vocabError })} />}

          <form onSubmit={submit} className="space-y-5 rounded-3xl border border-gray-200 bg-white p-5 shadow-xs sm:p-6" noValidate>
            <fieldset disabled={!formReady || busy} className="space-y-5 border-0 p-0">
              <div className="grid gap-4 sm:grid-cols-3">
                <PlotSelect plots={plots} value={plotId} onChange={choosePlot} id="disease-plot" />
                <div>
                  <label htmlFor="disease-crop" className={labelCls}>{t("p2.disease.crop_label")}</label>
                  <select id="disease-crop" value={crop} onChange={(e) => setCrop(e.target.value)} className={inputCls}>
                    <option value="">{t("p2.disease.crop_choose")}</option>
                    {(vocab?.crops ?? ["arecanut", "coconut"]).map((c) => (
                      <option key={c} value={c}>{tOptional(`p2.disease.crop.${c}`, c)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="disease-stage" className={labelCls}>
                    {t("p2.disease.stage_label")} <span className="font-medium text-gray-500">({t("p2.common.optional")})</span>
                  </label>
                  <select id="disease-stage" value={stage} onChange={(e) => setStage(e.target.value)} className={inputCls}>
                    <option value="">{t("p2.dis.stage_unsure")}</option>
                    {(vocab?.stages ?? []).map((s) => (
                      <option key={s.code} value={s.code}>{tOptional(`p2.dis.stage.${s.code}`, s.label_en)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {coverageMissing && <p role="status" className="rounded-xl bg-slate-50 p-3 text-sm font-semibold text-gray-700">{t("p2.dis.crop_not_covered")}</p>}

              <fieldset className="space-y-3 border-0 p-0">
                <legend className="mb-1 text-sm font-extrabold text-gray-900">{t("p2.dis.symptoms_legend")}</legend>
                {groups.map((g) => (
                  <div key={g.part} role="group" aria-label={partLabel(g.part)} className="space-y-2">
                    <p className="text-sm font-bold text-gray-600">{partLabel(g.part)}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {g.items.map((s) => (
                        <label
                          key={s.code}
                          className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold leading-snug text-gray-800 has-[:checked]:border-primary has-[:checked]:bg-emerald-50"
                        >
                          <input type="checkbox" checked={symptoms.includes(s.code)} onChange={() => toggle(symptoms, setSymptoms, s.code)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#2E7D32]" />
                          <span>{tOptional(`p2.dis.sym.${s.code}`, s.label_en)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </fieldset>

              <fieldset className="space-y-2 border-0 p-0">
                <legend className="mb-1 text-sm font-extrabold text-gray-900">{t("p2.disease.parts_label")}</legend>
                <div className="flex flex-wrap gap-2">
                  {(vocab?.parts ?? []).map((p) => (
                    <label key={p.code} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 has-[:checked]:border-primary has-[:checked]:bg-emerald-50">
                      <input type="checkbox" checked={parts.includes(p.code)} onChange={() => toggle(parts, setParts, p.code)} className="h-5 w-5 accent-[#2E7D32]" />
                      {partLabel(p.code)}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="space-y-3 border-0 p-0">
                <legend className="mb-1 text-sm font-extrabold text-gray-900">{t("p2.dis.conditions_legend")}</legend>
                {(vocab?.conditions ?? []).map((c) => (
                  <div key={c.code} className="grid gap-2 sm:grid-cols-[1fr_11rem] sm:items-center">
                    <label htmlFor={`cond-${c.code}`} className="text-sm font-semibold leading-snug text-gray-800">{tOptional(`p2.dis.cond.${c.code}`, c.label_en)}</label>
                    <select
                      id={`cond-${c.code}`}
                      value={context[c.code] ?? "unknown"}
                      onChange={(e) => setContext({ ...context, [c.code]: e.target.value as TriState })}
                      className={inputCls}
                    >
                      <option value="unknown">{t("p2.dis.unsure")}</option>
                      <option value="yes">{t("p2.dis.yes")}</option>
                      <option value="no">{t("p2.dis.no")}</option>
                    </select>
                  </div>
                ))}
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="disease-severity" className={labelCls}>{t("p2.dis.severity")} <span className="font-medium text-gray-500">({t("p2.common.optional")})</span></label>
                  <select id="disease-severity" value={severity} onChange={(e) => setSeverity(e.target.value)} className={inputCls}>
                    <option value="">{t("p2.dis.unsure")}</option>
                    {SEVERITIES.map((s) => (
                      <option key={s} value={s}>{t(`p2.dis.severity.${s}`)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="disease-duration" className={labelCls}>{t("p2.dis.duration")} <span className="font-medium text-gray-500">({t("p2.common.optional")})</span></label>
                  <input id="disease-duration" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label htmlFor="disease-date" className={labelCls}>{t("p2.dis.obs_date")} <span className="font-medium text-gray-500">({t("p2.common.optional")})</span></label>
                  <input id="disease-date" type="date" max={today} value={obsDate} onChange={(e) => setObsDate(e.target.value)} className={inputCls} />
                </div>
              </div>

              <div>
                <label htmlFor="disease-notes" className={labelCls}>{t("p2.disease.notes_label")} <span className="font-medium text-gray-500">({t("p2.common.optional")})</span></label>
                <textarea id="disease-notes" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("p2.disease.notes_ph")} className={inputCls} />
              </div>

              {wx.weather && (
                <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm font-semibold text-gray-700">
                  <input type="checkbox" checked={attachWeather} onChange={(e) => setAttachWeather(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#2E7D32]" />
                  {t("p2.dis.attach_weather")}
                </label>
              )}
            </fieldset>

            <p className="text-sm font-medium text-gray-600">{t("p2.disease.photo_note")}</p>

            {errors.length > 0 && (
              <div role="alert" className="space-y-1 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-900">
                {errors.map((m) => (
                  <p key={m}>{m}</p>
                ))}
              </div>
            )}
            {apiError && <ErrorBanner message={apiError} />}

            <button
              type="submit"
              disabled={!formReady || busy}
              className="min-h-11 cursor-pointer rounded-xl border-0 bg-primary px-5 py-2.5 text-sm font-extrabold text-white hover:bg-[#235F26] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? t("p2.disease.submitting") : t("p2.disease.submit")}
            </button>
          </form>

          {busy && <Spinner label={t("p2.disease.submitting")} />}
          {result && <DiseaseResult result={result} vocab={vocab} onNewCheck={() => { setResult(null); window.scrollTo?.({ top: 0 }); }} />}

          {available && plotId && (
            <section className="space-y-3 rounded-3xl border border-gray-200 bg-white p-5 shadow-xs" aria-label={t("p2.dis.history_title")}>
              <h2 className="text-base font-extrabold text-gray-900">{t("p2.dis.history_title")}</h2>
              {historyError && <ErrorBanner message={t("p2.dis.history_error", { message: historyError })} onRetry={refreshHistory} />}
              {!historyError && history.length === 0 && <p className="text-sm font-medium text-gray-600">{t("p2.dis.history_empty")}</p>}
              <ul className="space-y-2">
                {history.map((h) => (
                  <li key={h.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 p-3">
                    <div className="space-y-1">
                      <StatusBadge kind={RISK_BADGE[h.risk_level]} />
                      <p className="text-sm font-medium text-gray-500">{new Date(h.created_at).toLocaleString(locale)}</p>
                    </div>
                    <button type="button" onClick={() => openHistory(h.id)} className="min-h-11 cursor-pointer rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-800 hover:bg-gray-50">
                      {t("p2.dis.history_open")}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
};
