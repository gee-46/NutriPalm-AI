import React, { useCallback, useEffect, useState } from "react";
import { ClipboardList, FlaskConical, Plus, TestTube2, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useTranslation } from "../../translation/useTranslation";

interface SoilRow {
  id: string;
  created_at: string;
  ph: number;
  nitrogen_kg_ha: number;
  phosphorus_kg_ha: number;
  potassium_kg_ha: number;
  organic_carbon_percent: number;
  verification_status: string;
}
interface RecRow {
  id: string;
  created_at: string;
  crop: string;
  engine_version: string;
  fertilizer_plan: Array<{ product_display_name: string; quantity_kg_per_ha: number }> | null;
}
interface AppRow {
  id: string;
  recommendation_id: string | null;
  applied_on: string;
  product_name: string;
  quantity: number;
  quantity_unit: string;
  method: string | null;
  notes: string | null;
}

const UNITS = [
  ["kg", "p3.mgmt.unit.kg"],
  ["kg/ha", "p3.mgmt.unit.kg_ha"],
  ["g/plant", "p3.mgmt.unit.g_plant"],
  ["kg/plant", "p3.mgmt.unit.kg_plant"],
] as const;
const METHODS = ["broadcast", "band", "ring", "fertigation", "foliar", "other"] as const;

const PAGE = 10;
const today = () => new Date().toISOString().slice(0, 10);

interface Props {
  plotId: string;
  showToast?: (message: string, type?: "success" | "info" | "warning") => void;
  onNavigate?: (screen: string) => void;
}

/**
 * Keeps three different kinds of record visibly apart for one plot:
 *   - soil tests      MEASURED (verified reports only)
 *   - recommendations ADVICE from the engine -- never shown as something that happened
 *   - applications    what the farmer SAYS they applied (recorded by hand)
 * Everything is read through row-level security, so only the signed-in owner's rows are visible.
 */
export const TwinManagementPanel: React.FC<Props> = ({ plotId, showToast, onNavigate }) => {
  const { t, locale } = useTranslation();
  const [soil, setSoil] = useState<SoilRow[]>([]);
  const [recs, setRecs] = useState<RecRow[]>([]);
  const [apps, setApps] = useState<AppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState({ date: today(), product: "", qty: "", unit: "kg", method: "", rec: "", notes: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const [s, r, a] = await Promise.all([
      supabase
        .from("soil_reports")
        .select("id, created_at, ph, nitrogen_kg_ha, phosphorus_kg_ha, potassium_kg_ha, organic_carbon_percent, verification_status")
        .eq("plot_id", plotId)
        .not("verification_status", "is", null)
        .order("created_at", { ascending: false })
        .limit(PAGE),
      supabase
        .from("recommendations")
        .select("id, created_at, crop, engine_version, fertilizer_plan")
        .eq("plot_id", plotId)
        .not("engine_version", "is", null)
        .order("created_at", { ascending: false })
        .limit(PAGE),
      supabase
        .from("fertilizer_applications")
        .select("id, recommendation_id, applied_on, product_name, quantity, quantity_unit, method, notes")
        .eq("plot_id", plotId)
        .order("applied_on", { ascending: false })
        .limit(PAGE * 2),
    ]);
    const firstError = [s.error, r.error, a.error].find(Boolean) as { message?: string } | undefined;
    if (firstError) setLoadError(firstError.message ?? "error");
    setSoil((s.data as SoilRow[] | null) ?? []);
    setRecs((r.data as RecRow[] | null) ?? []);
    setApps((a.data as AppRow[] | null) ?? []);
    setLoading(false);
  }, [plotId]);

  useEffect(() => {
    void load();
  }, [load]);

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(locale);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const qty = Number(form.qty);
    if (!form.date || form.date > today()) return setFormError(t("p3.mgmt.err.date"));
    if (!form.product.trim()) return setFormError(t("p3.mgmt.err.product"));
    if (!form.qty.trim() || !Number.isFinite(qty) || qty <= 0) return setFormError(t("p3.mgmt.err.qty"));

    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const ownerId = auth?.user?.id;
    if (!ownerId) {
      setSaving(false);
      return setFormError(t("p3.mgmt.err.save", { message: "not signed in" }));
    }
    const { error } = await supabase.from("fertilizer_applications").insert({
      owner_id: ownerId,
      plot_id: plotId,
      recommendation_id: form.rec || null,
      applied_on: form.date,
      product_name: form.product.trim(),
      quantity: qty,
      quantity_unit: form.unit,
      method: form.method || null,
      notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (error) return setFormError(t("p3.mgmt.err.save", { message: (error as { message?: string }).message ?? "" }));
    setForm({ date: today(), product: "", qty: "", unit: form.unit, method: "", rec: "", notes: "" });
    showToast?.(t("p3.mgmt.saved"), "success");
    void load();
  };

  const remove = async (row: AppRow) => {
    const { error } = await supabase.from("fertilizer_applications").delete().eq("id", row.id);
    if (error) return showToast?.(t("p3.mgmt.err.save", { message: (error as { message?: string }).message ?? "" }), "warning");
    setApps((prev) => prev.filter((x) => x.id !== row.id));
  };

  const card = "rounded-3xl border border-gray-200 bg-white p-5 shadow-xs";
  const input =
    "min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

  return (
    <section aria-labelledby="twin-mgmt-title" className="mt-8 space-y-5 text-left">
      <h2 id="twin-mgmt-title" className="flex items-center gap-2 text-xl font-extrabold text-gray-900">
        <ClipboardList className="h-6 w-6 text-primary" aria-hidden="true" />
        {t("p3.mgmt.title")}
      </h2>

      {loadError && (
        <p role="alert" className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-semibold text-rose-900">
          {t("p3.mgmt.load_error", { message: loadError })}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* MEASURED */}
        <div className={card}>
          <h3 className="mb-3 flex items-center gap-2 text-base font-extrabold text-gray-900">
            <TestTube2 className="h-5 w-5 text-primary" aria-hidden="true" /> {t("p3.mgmt.soil_title")}
          </h3>
          {!loading && soil.length === 0 && <p className="text-sm font-medium text-gray-600">{t("p3.mgmt.empty_soil")}</p>}
          <ul className="space-y-3">
            {soil.map((s) => (
              <li key={s.id} className="text-sm">
                <p className="font-semibold text-gray-900">
                  {t("p3.mgmt.soil_row", {
                    date: fmtDate(s.created_at),
                    ph: s.ph,
                    n: s.nitrogen_kg_ha,
                    p: s.phosphorus_kg_ha,
                    k: s.potassium_kg_ha,
                    oc: s.organic_carbon_percent,
                  })}
                </p>
                <p className="font-medium text-gray-600">{t(`p3.verified.${s.verification_status}`)}</p>
              </li>
            ))}
          </ul>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate("Soil Reports")}
              className="mt-3 min-h-11 cursor-pointer border-0 bg-transparent p-0 text-sm font-extrabold text-primary underline"
            >
              {t("p2.common.go_soil")}
            </button>
          )}
        </div>

        {/* ADVICE */}
        <div className={card}>
          <h3 className="mb-3 flex items-center gap-2 text-base font-extrabold text-gray-900">
            <FlaskConical className="h-5 w-5 text-primary" aria-hidden="true" /> {t("p3.mgmt.rec_title")}
          </h3>
          <p className="mb-3 text-xs font-bold text-sky-900">{t("p3.rec.not_applied")}</p>
          {!loading && recs.length === 0 && <p className="text-sm font-medium text-gray-600">{t("p3.mgmt.empty_rec")}</p>}
          <ul className="space-y-3">
            {recs.map((r) => (
              <li key={r.id} className="text-sm">
                <p className="font-semibold text-gray-900">
                  {t("p3.mgmt.rec_row", { date: fmtDate(r.created_at), crop: r.crop.replace(/_/g, " "), engine: r.engine_version })}
                </p>
                {(r.fertilizer_plan ?? []).length === 0 ? (
                  <p className="font-medium text-gray-600">{t("p3.mgmt.rec_none")}</p>
                ) : (
                  <ul className="font-medium text-gray-700">
                    {(r.fertilizer_plan ?? []).map((d, i) => (
                      <li key={i}>{t("p3.mgmt.rec_dose", { product: d.product_display_name, perHa: d.quantity_kg_per_ha })}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate("Recommendations")}
              className="mt-3 min-h-11 cursor-pointer border-0 bg-transparent p-0 text-sm font-extrabold text-primary underline"
            >
              {t("p3.mgmt.rec_open")}
            </button>
          )}
        </div>

        {/* ACTUALLY DONE */}
        <div className={card}>
          <h3 className="mb-3 flex items-center gap-2 text-base font-extrabold text-gray-900">
            <Plus className="h-5 w-5 text-primary" aria-hidden="true" /> {t("p3.mgmt.app_title")}
          </h3>
          {!loading && apps.length === 0 && <p className="text-sm font-medium text-gray-600">{t("p3.mgmt.empty_app")}</p>}
          <ul className="space-y-2">
            {apps.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-2 text-sm">
                <div>
                  <p className="font-semibold text-gray-900">
                    {t("p3.mgmt.app_row", { date: fmtDate(a.applied_on), product: a.product_name, qty: a.quantity, unit: a.quantity_unit })}
                  </p>
                  {a.method && <p className="font-medium text-gray-600">{t(`p3.mgmt.method.${a.method}`)}</p>}
                  {a.notes && <p className="font-medium text-gray-600">{a.notes}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => void remove(a)}
                  aria-label={t("p3.mgmt.delete_aria", { product: a.product_name })}
                  className="min-h-11 min-w-11 cursor-pointer rounded-xl border border-gray-300 bg-white p-2 text-gray-700 hover:bg-gray-50"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <form onSubmit={save} className={`${card} space-y-4`} aria-label={t("p3.mgmt.add")}>
        <h3 className="text-base font-extrabold text-gray-900">{t("p3.mgmt.add")}</h3>
        {formError && (
          <p role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm font-semibold text-rose-900">
            {formError}
          </p>
        )}
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label htmlFor="app-date" className="mb-1 block text-sm font-bold text-gray-700">{t("p3.mgmt.f.date")}</label>
            <input id="app-date" type="date" max={today()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={input} />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="app-product" className="mb-1 block text-sm font-bold text-gray-700">{t("p3.mgmt.f.product")}</label>
            <input id="app-product" type="text" maxLength={120} value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} className={input} />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label htmlFor="app-qty" className="mb-1 block text-sm font-bold text-gray-700">{t("p3.mgmt.f.qty")}</label>
              <input id="app-qty" type="number" min="0" step="any" inputMode="decimal" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} className={input} />
            </div>
            <div className="flex-1">
              <label htmlFor="app-unit" className="mb-1 block text-sm font-bold text-gray-700">{t("p3.mgmt.f.unit")}</label>
              <select id="app-unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={input}>
                {UNITS.map(([v, key]) => (
                  <option key={v} value={v}>{t(key)}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="app-method" className="mb-1 block text-sm font-bold text-gray-700">{t("p3.mgmt.f.method")}</label>
            <select id="app-method" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className={input}>
              <option value="">{t("p3.mgmt.f.none")}</option>
              {METHODS.map((m) => (
                <option key={m} value={m}>{t(`p3.mgmt.method.${m}`)}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="app-rec" className="mb-1 block text-sm font-bold text-gray-700">{t("p3.mgmt.f.rec")}</label>
            <select id="app-rec" value={form.rec} onChange={(e) => setForm({ ...form, rec: e.target.value })} className={input}>
              <option value="">{t("p3.mgmt.f.none")}</option>
              {recs.map((r) => (
                <option key={r.id} value={r.id}>{fmtDate(r.created_at)} · {r.crop.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="app-notes" className="mb-1 block text-sm font-bold text-gray-700">{t("p3.mgmt.f.notes")}</label>
            <input id="app-notes" type="text" maxLength={1000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={input} />
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="min-h-11 cursor-pointer rounded-xl border-0 bg-primary px-5 py-2.5 text-sm font-extrabold text-white hover:bg-[#2C4D3C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("p3.mgmt.save")}
        </button>
      </form>
    </section>
  );
};
