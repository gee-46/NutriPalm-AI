import React from "react";
import { ExternalLink, ShieldAlert } from "lucide-react";
import { useTranslation } from "../../translation/useTranslation";
import type { ChemicalGuidance, DiseaseAssessment, DiseaseCandidate, DiseaseRisk, DiseaseVocabulary, EvidenceItem } from "../../lib/phase2/contracts";
import { RecommendationCard } from "./RecommendationCard";
import { StatusBadge, type BadgeKind } from "./shared";

export const RISK_BADGE: Record<DiseaseRisk, BadgeKind> = {
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
const CATEGORY_ORDER = [
  "monitoring_and_confirmation",
  "preventive_practices",
  "cultural_management",
  "field_sanitation",
  "irrigation_drainage_field",
  "biological_management",
];

/** Source references with the verbatim quote, shown on demand. https links only. */
const EvidenceDetails: React.FC<{ items: EvidenceItem[] }> = ({ items }) => {
  const { t } = useTranslation();
  if (items.length === 0) return null;
  return (
    <details className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
      <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-gray-800 focus-visible:outline-2 focus-visible:outline-primary">
        {t("p2.dis.evidence_show")} ({items.length})
      </summary>
      <ul className="space-y-3 pb-2 pt-1 text-sm font-medium leading-relaxed text-gray-700">
        {items.map((e, i) => (
          <li key={`${e.evidence_id ?? i}-${i}`}>
            <p>{e.description}</p>
            {e.quote && <blockquote className="mt-1 border-l-4 border-emerald-300 pl-3 italic text-gray-600">“{e.quote}”</blockquote>}
            <p className="mt-1 text-gray-500">
              {e.source}
              {e.url && (
                <>
                  {" "}
                  <a href={e.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-primary underline">
                    {t("p2.dis.open_source")} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </>
              )}
            </p>
          </li>
        ))}
      </ul>
    </details>
  );
};

const ChemicalBlock: React.FC<{ status: string; items: ChemicalGuidance[] }> = ({ status, items }) => {
  const { t } = useTranslation();
  return (
    <section className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50/60 p-4" aria-label={t("p2.dis.chem_title")}>
      <h4 className="flex items-center gap-2 text-sm font-extrabold text-gray-900">
        <ShieldAlert className="h-4 w-4 text-amber-700" aria-hidden="true" />
        {t("p2.dis.chem_title")}
      </h4>
      <p className="text-sm font-semibold leading-relaxed text-gray-800">{t(`p2.dis.chem.${status}`)}</p>
      {items.map((c) => (
        <div key={c.product_id} className="space-y-1.5 rounded-xl bg-white p-3 text-sm font-medium text-gray-700">
          <p className="font-extrabold text-gray-900">
            {c.product_name} <span className="font-medium text-gray-500">· {t("p2.dis.chem.active")}: {c.active_ingredient}</span>
          </p>
          {c.reported_recommendation && (
            <p>
              <span className="font-bold">{t("p2.dis.chem.reported_as")}</span> {c.reported_recommendation}
            </p>
          )}
          <p className="text-gray-600">{c.message}</p>
          <EvidenceDetails items={c.evidence} />
        </div>
      ))}
    </section>
  );
};

const Candidate: React.FC<{ c: DiseaseCandidate; vocab: DiseaseVocabulary | null }> = ({ c, vocab }) => {
  const { t, tOptional } = useTranslation();
  const symLabel = (code: string) => tOptional(`p2.dis.sym.${code}`, vocab?.symptoms.find((s) => s.code === code)?.label_en ?? code);
  const condLabel = (code: string) => tOptional(`p2.dis.cond.${code}`, vocab?.conditions.find((x) => x.code === code)?.label_en ?? code);
  const level: DiseaseRisk = c.risk_level ?? "insufficient_evidence";
  const steps = (c.treatment?.steps ?? []).slice().sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category));
  const byCategory = CATEGORY_ORDER.map((cat) => [cat, steps.filter((s) => s.category === cat)] as const).filter(([, list]) => list.length > 0);

  return (
    <RecommendationCard
      kind="disease"
      title={c.disease_name}
      badge={RISK_BADGE[level]}
      date={`${t("p2.dis.possible_not_confirmed")}${c.scientific_names?.length ? ` · ${c.scientific_names.join(", ")}` : ""}`}
      what={[
        ...(c.matched_symptoms?.length ? [`${t("p2.dis.matched_symptoms")}: ${c.matched_symptoms.map(symLabel).join("; ")}`] : []),
        ...(c.supportive_conditions?.length ? [`${t("p2.dis.supportive")}: ${c.supportive_conditions.map(condLabel).join("; ")}`] : []),
        ...(c.contradicting_observations?.length ? [`${t("p2.dis.contradictions")}: ${c.contradicting_observations.join(" ")}`] : []),
        ...(c.region_note ? [`${t("p2.dis.region")}: ${c.region_note}`] : []),
      ]}
      why={c.contributing_factors}
      evidence={c.evidence.map((e) => ({ description: e.description, source: e.source }))}
    >
      {byCategory.length > 0 && (
        <section className="space-y-3">
          <h4 className="text-sm font-extrabold text-gray-900">{t("p2.dis.management")}</h4>
          {byCategory.map(([cat, list]) => (
            <div key={cat} className="space-y-1.5">
              <p className="text-sm font-bold text-gray-700">{t(`p2.dis.cat.${cat}`)}</p>
              {list.map((s) => (
                <div key={s.id} className="space-y-1">
                  <p className="text-sm font-medium leading-relaxed text-gray-800">{s.text}</p>
                  <EvidenceDetails items={s.evidence} />
                </div>
              ))}
            </div>
          ))}
        </section>
      )}
      {c.treatment && <ChemicalBlock status={c.treatment.chemical_status} items={c.treatment.chemical_management} />}
      <p className="text-sm font-semibold leading-relaxed text-gray-800">{t("p2.dis.referral")}</p>
    </RecommendationCard>
  );
};

/** Renders one assessment result. Pure: no network, so it is unit-testable. */
export const DiseaseResult: React.FC<{ result: DiseaseAssessment; vocab: DiseaseVocabulary | null; onNewCheck?: () => void }> = ({ result, vocab, onNewCheck }) => {
  const { t, tOptional, lang, locale } = useTranslation();
  const symLabel = (code: string, fallback: string) => tOptional(`p2.dis.sym.${code}`, fallback);
  const insufficient = result.risk_level === "insufficient_evidence";
  const backendNote = lang === "kn";
  const list = (items?: string[]) => (items && items.length > 0 ? items : null);

  return (
    <section aria-live="polite" className="space-y-5 text-left">
      <div className="space-y-2 rounded-3xl border border-gray-200 bg-white p-5 shadow-xs sm:p-6">
        <p className="inline-block rounded-full border border-gray-300 bg-gray-50 px-3 py-1 text-sm font-bold text-gray-700">{t("p2.dis.not_diagnosis")}</p>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-extrabold text-gray-900">{t("p2.disease.result_title")}</h2>
          <StatusBadge kind={RISK_BADGE[result.risk_level]} />
        </div>
        <p className="text-base font-semibold text-gray-800">{t(RISK_EXPLAIN[result.risk_level])}</p>
        {result.risk_explanation && <p className="text-sm font-medium leading-relaxed text-gray-600">{result.risk_explanation}</p>}
        <p className="text-sm font-medium text-gray-500">
          {t("p2.disease.assessed_at", { date: new Date(result.assessed_at).toLocaleString(locale) })}
          {result.kb_version && result.rule_version ? ` · ${t("p2.dis.versions", { kb: result.kb_version, rules: result.rule_version })}` : ""}
          {` · ${result.assessment_id ? t("p2.dis.saved") : t("p2.dis.not_saved")}`}
        </p>
        {backendNote && <p className="text-sm font-medium text-gray-500">{t("p2.lang.backend_note")}</p>}
      </div>

      {result.observed?.symptoms && result.observed.symptoms.length > 0 && (
        <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-xs">
          <h3 className="mb-2 text-base font-extrabold text-gray-900">{t("p2.dis.what_you_reported")}</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm font-medium text-gray-700">
            {result.observed.symptoms.map((s) => (
              <li key={s.code}>{symLabel(s.code, s.label)}</li>
            ))}
          </ul>
        </section>
      )}

      {insufficient && (
        <div className="space-y-2 rounded-3xl border border-slate-300 bg-slate-50 p-5">
          <h3 className="text-base font-extrabold text-gray-900">{t("p2.dis.insufficient_title")}</h3>
          <p className="text-sm font-medium leading-relaxed text-gray-700">{t("p2.dis.insufficient_note")}</p>
        </div>
      )}

      {result.candidates.map((c) => (
        <Candidate key={c.disease_id ?? c.disease_name} c={c} vocab={vocab} />
      ))}

      {list(result.follow_up_questions) && (
        <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-xs">
          <h3 className="mb-2 text-base font-extrabold text-gray-900">{t("p2.dis.follow_up")}</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm font-medium text-gray-700">
            {result.follow_up_questions!.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </section>
      )}

      {(list(result.missing_inputs) || list(result.limitations)) && (
        <RecommendationCard
          kind="disease"
          title={t("p2.common.limitations")}
          limitations={result.expert_review_status === "pending" ? [t("p2.dis.expert_pending"), ...result.limitations] : result.limitations}
          missing={result.missing_inputs}
        />
      )}

      {(list(result.inputs_used) || list(result.inputs_not_used)) && (
        <details className="rounded-2xl border border-gray-200 bg-white px-4 py-2">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-gray-800">
            {t("p2.dis.inputs_used")} / {t("p2.dis.inputs_not_used")}
          </summary>
          <div className="space-y-2 pb-2 text-sm font-medium text-gray-700">
            {list(result.inputs_used) && (
              <ul className="list-disc pl-5">
                {result.inputs_used!.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            )}
            {list(result.inputs_not_used) && (
              <>
                <p className="font-bold">{t("p2.dis.inputs_not_used")}</p>
                <ul className="list-disc pl-5">
                  {result.inputs_not_used!.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </details>
      )}

      {list(result.next_steps) && (
        <section className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5">
          <h3 className="mb-2 text-base font-extrabold text-gray-900">{t("p2.dis.next_steps")}</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm font-semibold text-gray-800">
            {result.next_steps!.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </section>
      )}

      {result.disclaimer && <p className="text-sm font-medium leading-relaxed text-gray-600">{result.disclaimer}</p>}

      {onNewCheck && (
        <button type="button" onClick={onNewCheck} className="min-h-11 cursor-pointer rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-extrabold text-gray-800 hover:bg-gray-50">
          {t("p2.dis.new_check")}
        </button>
      )}
    </section>
  );
};
