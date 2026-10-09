import React from "react";
import { Bug, CloudSun, FlaskConical, Sprout, Wheat } from "lucide-react";
import { useTranslation } from "../../translation/useTranslation";
import { StatusBadge, type BadgeKind } from "./shared";

export type RecommendationKind = "disease" | "suitability" | "nutrient" | "fertilizer" | "weather";

export interface CardEvidence {
  description: string;
  source: string;
}

export interface RecommendationCardProps {
  kind: RecommendationKind;
  title: string;
  badge?: BadgeKind;
  /** What is happening? */
  what?: string[];
  /** What should I do? */
  doThis?: string[];
  /** How should I do it? */
  how?: string[];
  /** Precautions to take. */
  precautions?: string[];
  /** How much? Pre-formatted rows from the backend's own numbers. */
  howMuch?: Array<{ label: string; value: string }>;
  /** When should I do it? */
  when?: string[];
  /** Why is this recommended? */
  why?: string[];
  evidence?: CardEvidence[];
  source?: string;
  limitations?: string[];
  missing?: string[];
  date?: string;
  actions?: Array<{ label: string; onClick: () => void }>;
}

const ICONS: Record<RecommendationKind, React.ElementType> = {
  disease: Bug,
  suitability: Sprout,
  nutrient: FlaskConical,
  fertilizer: Wheat,
  weather: CloudSun,
};

const Section: React.FC<{ heading: string; children: React.ReactNode }> = ({ heading, children }) => (
  <section className="space-y-1.5">
    <h4 className="text-sm font-extrabold text-gray-900">{heading}</h4>
    {children}
  </section>
);

const Bullets: React.FC<{ items: string[] }> = ({ items }) => (
  <ul className="list-disc space-y-1 pl-5 text-sm font-medium leading-relaxed text-gray-700">
    {items.map((x, i) => (
      <li key={i}>{x}</li>
    ))}
  </ul>
);

/**
 * One layout for every kind of advice (disease, crop suitability, nutrient, fertilizer, weather).
 * It answers: what is happening / what to do / how / how much / when / why / what evidence,
 * and shows only the parts the data really contains, followed by limitations and missing inputs.
 * Values are shown exactly as received; nothing is recalculated here.
 */
export const RecommendationCard: React.FC<RecommendationCardProps> = (p) => {
  const { t } = useTranslation();
  const Icon = ICONS[p.kind];
  const has = (a?: unknown[]) => !!a && a.length > 0;

  return (
    <article className="space-y-5 rounded-3xl border border-gray-200 bg-white p-5 text-left shadow-xs sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="rounded-2xl bg-emerald-50 p-2.5 text-primary" aria-hidden="true">
            <Icon className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{t(`p2.rec.kind.${p.kind}`)}</p>
            <h3 className="text-lg font-extrabold leading-snug text-gray-900">{p.title}</h3>
            {p.date && <p className="text-sm font-medium text-gray-500">{p.date}</p>}
          </div>
        </div>
        {p.badge && <StatusBadge kind={p.badge} />}
      </header>

      {has(p.what) && <Section heading={t("p2.rec.what")}><Bullets items={p.what!} /></Section>}
      {has(p.doThis) && <Section heading={t("p2.rec.do")}><Bullets items={p.doThis!} /></Section>}
      {has(p.how) && <Section heading={t("p2.rec.how")}><Bullets items={p.how!} /></Section>}
      {has(p.precautions) && <Section heading={t("p2.rec.precautions")}><Bullets items={p.precautions!} /></Section>}
      {has(p.howMuch) && (
        <Section heading={t("p2.rec.how_much")}>
          <dl className="rounded-2xl bg-gray-50 px-4 py-1">
            {p.howMuch!.map((r, i) => (
              <div key={i} className="flex items-baseline justify-between gap-4 border-b border-gray-200 py-2 last:border-0">
                <dt className="text-sm font-semibold text-gray-600">{r.label}</dt>
                <dd className="text-right text-sm font-extrabold text-gray-900">{r.value}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}
      {has(p.when) && <Section heading={t("p2.rec.when")}><Bullets items={p.when!} /></Section>}
      {has(p.why) && <Section heading={t("p2.rec.why")}><Bullets items={p.why!} /></Section>}

      <Section heading={t("p2.rec.evidence")}>
        {has(p.evidence) ? (
          <ul className="space-y-1.5 text-sm font-medium leading-relaxed text-gray-700">
            {p.evidence!.map((e, i) => (
              <li key={i}>
                {e.description} <span className="text-gray-500">— {e.source}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm font-medium text-gray-500">{t("p2.common.no_evidence")}</p>
        )}
        {p.source && (
          <p className="text-sm font-medium text-gray-500">
            {t("p2.common.source")}: {p.source}
          </p>
        )}
      </Section>

      {has(p.limitations) && (
        <Section heading={t("p2.common.limitations")}>
          <Bullets items={p.limitations!} />
        </Section>
      )}
      {has(p.missing) && (
        <Section heading={t("p2.common.missing_info")}>
          <Bullets items={p.missing!} />
        </Section>
      )}

      {has(p.actions) && (
        <footer className="flex flex-wrap gap-3 pt-1">
          {p.actions!.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={a.onClick}
              className="min-h-11 cursor-pointer rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-extrabold text-gray-800 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {a.label}
            </button>
          ))}
        </footer>
      )}
    </article>
  );
};
