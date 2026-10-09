import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Info,
  Loader2,
  MinusCircle,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  XCircle,
} from "lucide-react";
import { useTranslation } from "../../translation/useTranslation";
import type { Plot } from "../../data/plots";

export type BadgeKind =
  | "low" | "moderate" | "high" | "insufficient" | "unavailable"
  | "suitable" | "partial" | "unsuitable" | "insufficient_info"
  | "deficient" | "adequate" | "surplus" | "unknown";

const BADGE: Record<BadgeKind, { key: string; cls: string; Icon: React.ElementType }> = {
  low: { key: "p2.status.low", cls: "bg-emerald-50 text-emerald-900 border-emerald-300", Icon: ShieldCheck },
  moderate: { key: "p2.status.moderate", cls: "bg-amber-50 text-amber-900 border-amber-300", Icon: ShieldAlert },
  high: { key: "p2.status.high", cls: "bg-rose-50 text-rose-900 border-rose-300", Icon: AlertTriangle },
  insufficient: { key: "p2.status.insufficient", cls: "bg-slate-100 text-slate-800 border-slate-300", Icon: ShieldQuestion },
  unavailable: { key: "p2.status.unavailable", cls: "bg-slate-100 text-slate-800 border-slate-300", Icon: MinusCircle },
  suitable: { key: "p2.status.suitable", cls: "bg-emerald-50 text-emerald-900 border-emerald-300", Icon: CheckCircle2 },
  partial: { key: "p2.status.partial", cls: "bg-amber-50 text-amber-900 border-amber-300", Icon: CircleHelp },
  unsuitable: { key: "p2.status.unsuitable", cls: "bg-rose-50 text-rose-900 border-rose-300", Icon: XCircle },
  insufficient_info: { key: "p2.status.insufficient_info", cls: "bg-slate-100 text-slate-800 border-slate-300", Icon: ShieldQuestion },
  deficient: { key: "p2.status.deficient", cls: "bg-rose-50 text-rose-900 border-rose-300", Icon: AlertTriangle },
  adequate: { key: "p2.status.adequate", cls: "bg-emerald-50 text-emerald-900 border-emerald-300", Icon: CheckCircle2 },
  surplus: { key: "p2.status.surplus", cls: "bg-amber-50 text-amber-900 border-amber-300", Icon: Info },
  unknown: { key: "p2.status.unknown", cls: "bg-slate-100 text-slate-800 border-slate-300", Icon: CircleHelp },
};

/** Status is always icon + words, never colour alone. */
export const StatusBadge: React.FC<{ kind: BadgeKind }> = ({ kind }) => {
  const { t } = useTranslation();
  const b = BADGE[kind] ?? BADGE.unknown;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-bold ${b.cls}`}>
      <b.Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {t(b.key)}
    </span>
  );
};

export const Spinner: React.FC<{ label?: string }> = ({ label }) => {
  const { t } = useTranslation();
  return (
    <div role="status" className="flex items-center gap-2 text-sm font-semibold text-gray-600">
      <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      {label ?? t("p2.common.loading")}
    </div>
  );
};

/** Honest "this module's backend is not available" state. Never shows sample results. */
export const UnavailableState: React.FC<{ title: string; body: string; detail?: string }> = ({ title, body, detail }) => (
  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-left">
    <div className="flex items-start gap-3">
      <MinusCircle className="mt-0.5 h-6 w-6 shrink-0 text-slate-500" aria-hidden="true" />
      <div className="space-y-1.5">
        <h3 className="text-base font-extrabold text-gray-900">{title}</h3>
        <p className="text-sm font-medium leading-relaxed text-gray-700">{body}</p>
        {detail && <p className="text-sm font-medium leading-relaxed text-gray-500">{detail}</p>}
      </div>
    </div>
  </div>
);

export const EmptyState: React.FC<{ title: string; body?: string; action?: { label: string; onClick: () => void } }> = ({ title, body, action }) => (
  <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-6 text-left">
    <h3 className="text-base font-extrabold text-gray-900">{title}</h3>
    {body && <p className="mt-1 text-sm font-medium leading-relaxed text-gray-600">{body}</p>}
    {action && (
      <button
        type="button"
        onClick={action.onClick}
        className="mt-4 min-h-11 cursor-pointer rounded-xl border-0 bg-primary px-4 py-2 text-sm font-extrabold text-white hover:bg-[#235F26] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {action.label}
      </button>
    )}
  </div>
);

export const ErrorBanner: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => {
  const { t } = useTranslation();
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-900">
      <span>{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="min-h-11 cursor-pointer rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-bold text-rose-900 hover:bg-rose-100">
          {t("p2.common.retry")}
        </button>
      )}
    </div>
  );
};

export const PageHeader: React.FC<{ icon: React.ReactNode; title: string; subtitle: string; right?: React.ReactNode }> = ({ icon, title, subtitle, right }) => (
  <div className="flex flex-col gap-4 border-b border-gray-200/60 pb-5 text-left lg:flex-row lg:items-end lg:justify-between">
    <div>
      <h1 className="flex items-center gap-2.5 text-2xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-3xl">
        <span className="text-primary" aria-hidden="true">{icon}</span>
        {title}
      </h1>
      <p className="mt-2 max-w-3xl text-base font-medium leading-relaxed text-gray-600">{subtitle}</p>
    </div>
    {right}
  </div>
);

/** Labelled plot dropdown over the farmer's saved plots. */
export const PlotSelect: React.FC<{ plots: Plot[]; value: string; onChange: (id: string) => void; id?: string }> = ({ plots, value, onChange, id = "plot-select" }) => {
  const { t } = useTranslation();
  return (
    <div className="w-full sm:w-72">
      <label htmlFor={id} className="mb-1 block text-sm font-bold text-gray-700">{t("p2.common.plot")}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 w-full cursor-pointer rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <option value="">{t("p2.common.choose_plot")}</option>
        {plots.map((p) => (
          <option key={p.id} value={p.id}>{p.name}{p.crop ? ` (${p.crop})` : ""}</option>
        ))}
      </select>
    </div>
  );
};

export const FactRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-baseline justify-between gap-4 border-b border-gray-100 py-2 last:border-0">
    <dt className="text-sm font-semibold text-gray-600">{label}</dt>
    <dd className="text-right text-sm font-extrabold text-gray-900">{value}</dd>
  </div>
);
