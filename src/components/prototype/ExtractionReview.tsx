import React, { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useTranslation } from "../../translation/useTranslation";
import { ApiError, confirmExtraction } from "../../lib/apiClient";
import type { ConfirmExtractionPayload, OcrExtractedField, SoilReportUploadResponsePayload } from "../../lib/apiClient";

/** Unit each parameter is stored in. A corrected value is entered in this unit; nothing is converted. */
const TARGET_UNIT: Record<string, string | null> = {
  nitrogen: "kg/ha",
  phosphorus: "kg/ha",
  potassium: "kg/ha",
  ph: null,
  organic_carbon: "%",
  electrical_conductivity: "dS/m",
  zinc: "mg/kg",
  iron: "mg/kg",
  manganese: "mg/kg",
  copper: "mg/kg",
  boron: "mg/kg",
  sulfur: "mg/kg",
};

const REQUIRED = ["nitrogen", "phosphorus", "potassium", "ph", "organic_carbon"] as const;
const LABEL_KEY: Record<string, string> = {
  nitrogen: "p2.nutrient.n",
  phosphorus: "p2.nutrient.p",
  potassium: "p2.nutrient.k",
  ph: "p2.nutrient.ph",
  organic_carbon: "p2.nutrient.oc",
  electrical_conductivity: "p2.nutrient.ec",
};

interface Row {
  key: string;
  required: boolean;
  field: OcrExtractedField;
}

interface Props {
  result: SoilReportUploadResponsePayload;
  onConfirmed: (result: SoilReportUploadResponsePayload) => void;
  onDiscard: () => void;
}

const BADGE: Record<string, string> = {
  valid: "border-emerald-300 bg-emerald-50 text-emerald-900",
  review: "border-amber-300 bg-amber-50 text-amber-900",
  missing: "border-gray-300 bg-gray-50 text-gray-800",
  unusable: "border-rose-300 bg-rose-50 text-rose-900",
};

/**
 * Review step for an extraction that was read but is not yet trustworthy enough to save.
 * The reading is always shown as read; a changed value is sent as a correction (the backend keeps
 * the original in the audit record); an uncertain value the owner accepts is sent as "confirmed".
 * Which values are acceptable is decided by the backend, not here.
 */
export const ExtractionReview: React.FC<Props> = ({ result, onConfirmed, onDiscard }) => {
  const { t } = useTranslation();

  const rows: Row[] = useMemo(() => {
    const all: Record<string, OcrExtractedField> = {
      nitrogen: result.nitrogen,
      phosphorus: result.phosphorus,
      potassium: result.potassium,
      ph: result.ph,
      organic_carbon: result.organic_carbon,
      electrical_conductivity: result.electrical_conductivity,
    };
    for (const m of result.micronutrients) all[m.parameter] = m;
    const out: Row[] = REQUIRED.map((key) => ({ key, required: true, field: all[key] }));
    // Optional values are listed only if something was read and it still needs a decision.
    for (const key of Object.keys(all)) {
      if ((REQUIRED as readonly string[]).includes(key)) continue;
      const f = all[key];
      if (f && f.value !== null && f.validation !== "valid") out.push({ key, required: false, field: f });
    }
    return out;
  }, [result]);

  const initialInput = (f: OcrExtractedField) =>
    typeof f.value === "number" && f.validation !== "unusable" ? String(f.value) : "";
  const [inputs, setInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.key, initialInput(r.field)]))
  );
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<Record<string, string>>({});

  const label = (key: string) => (LABEL_KEY[key] ? t(LABEL_KEY[key]) : key.charAt(0).toUpperCase() + key.slice(1));
  const isChanged = (r: Row) => {
    const raw = inputs[r.key]?.trim();
    if (!raw) return false;
    const n = Number(raw);
    return !(typeof r.field.value === "number" && Number.isFinite(n) && n === r.field.value);
  };

  const asRead = (f: OcrExtractedField) =>
    f.value === null ? t("p3.review.not_found") : `${f.value}${f.unit ? ` ${f.unit}` : ""}`;

  const submit = async () => {
    setBusy(true);
    setError(null);
    setProblems({});
    const payload: ConfirmExtractionPayload = { corrections: {}, confirmed: [] };
    for (const r of rows) {
      const raw = inputs[r.key]?.trim();
      if (raw && isChanged(r)) {
        payload.corrections[r.key] = { value: Number(raw), unit: TARGET_UNIT[r.key] ?? null };
      } else if (r.field.validation === "review" && checked[r.key]) {
        payload.confirmed.push(r.key);
      }
    }
    try {
      onConfirmed(await confirmExtraction(result.extraction_id as string, payload));
    } catch (err) {
      if (err instanceof ApiError && err.problems) setProblems(err.problems);
      setError(err instanceof Error ? err.message : t("p2.common.error_generic"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="review-title" className="space-y-5 rounded-3xl border border-amber-200 bg-white p-6 shadow-xs">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-1 h-6 w-6 shrink-0 text-amber-600" aria-hidden="true" />
        <div>
          <h2 id="review-title" className="text-lg font-extrabold text-gray-900">{t("p3.review.title")}</h2>
          <p className="text-sm font-medium text-gray-700">{t("p3.review.intro")}</p>
          {result.reused && <p className="mt-1 text-sm font-semibold text-gray-600">{t("p3.review.reused")}</p>}
        </div>
      </div>

      {Object.keys(problems).length > 0 && (
        <div role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
          <p className="font-extrabold">{t("p3.review.problems")}</p>
          <ul className="mt-1 list-disc pl-5 font-medium">
            {Object.entries(problems).map(([k, msg]) => (
              <li key={k}><strong>{label(k)}:</strong> {msg}</li>
            ))}
          </ul>
        </div>
      )}
      {error && Object.keys(problems).length === 0 && (
        <div role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-semibold text-rose-900">{error}</div>
      )}

      <ul className="divide-y divide-gray-100">
        {rows.map((r) => {
          const f = r.field;
          const unit = TARGET_UNIT[r.key];
          const inputId = `rv-${r.key}`;
          const status = f.validation;
          const changed = isChanged(r);
          const needsCheck = status === "review" && !changed;
          return (
            <li key={r.key} className="grid gap-3 py-4 md:grid-cols-[10rem_1fr_16rem]">
              <div>
                <p className="text-sm font-extrabold text-gray-900">
                  <label htmlFor={inputId}>{label(r.key)}</label>
                </p>
                <span className={`mt-1 inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold ${BADGE[status]}`}>
                  {t(`p3.status.${status}`)}
                </span>
              </div>

              <div className="space-y-1 text-sm">
                <p className="font-semibold text-gray-800">{asRead(f)}</p>
                {f.source_text && (
                  <p className="font-medium text-gray-600">
                    {f.page ? t("p3.review.source", { page: f.page, text: f.source_text }) : t("p3.review.source_nopage", { text: f.source_text })}
                  </p>
                )}
                {f.warnings.map((w, i) => (
                  <p key={i} className="font-medium text-amber-900">{w}</p>
                ))}
                {problems[r.key] && <p className="font-bold text-rose-800">{problems[r.key]}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    id={inputId}
                    type="number"
                    step="any"
                    inputMode="decimal"
                    value={inputs[r.key] ?? ""}
                    placeholder={f.value === null || status === "unusable" ? t("p3.review.enter") : ""}
                    aria-invalid={!!problems[r.key]}
                    onChange={(e) => setInputs((prev) => ({ ...prev, [r.key]: e.target.value }))}
                    className="min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  />
                  {unit && <span className="whitespace-nowrap text-sm font-semibold text-gray-600">{unit}</span>}
                </div>
                {changed && <p className="text-xs font-semibold text-gray-600">{t("p3.review.changed")}</p>}
                {needsCheck && (
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-gray-800">
                    <input
                      type="checkbox"
                      checked={!!checked[r.key]}
                      onChange={(e) => setChecked((prev) => ({ ...prev, [r.key]: e.target.checked }))}
                      className="h-5 w-5"
                    />
                    {t("p3.review.checked")}
                  </label>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-sm font-medium text-gray-600">{t("p3.review.optional")}</p>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !result.extraction_id}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-0 bg-primary px-5 py-2.5 text-sm font-extrabold text-white hover:bg-[#235F26] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          {busy ? t("p3.review.saving") : t("p3.review.submit")}
        </button>
        <button
          type="button"
          onClick={onDiscard}
          disabled={busy}
          className="min-h-11 cursor-pointer rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-bold text-gray-800 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t("p3.review.discard")}
        </button>
      </div>
    </section>
  );
};
