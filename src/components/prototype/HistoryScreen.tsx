import React, { useCallback, useEffect, useMemo, useState } from "react";
import { History as HistoryIcon } from "lucide-react";
import { useSavedPlots } from "../../hooks/useSavedPlots";
import { useTranslation } from "../../translation/useTranslation";
import { supabase } from "../../lib/supabaseClient";
import { listRecommendations } from "../../lib/apiClient";
import { EmptyState, ErrorBanner, PageHeader, Spinner } from "../phase2/shared";

type Filter = "all" | "soil" | "rec";

interface Entry {
  id: string;
  kind: "soil" | "rec" | "plot";
  at: string;
  plotId: string;
  plotName: string;
  line: string;
}

interface Props {
  onNavigate?: (screen: string) => void;
  onOpenRecommendation?: (plotId: string) => void;
}

export const HistoryScreen: React.FC<Props> = ({ onNavigate, onOpenRecommendation }) => {
  const { t, locale } = useTranslation();
  const plots = useSavedPlots();
  const [filter, setFilter] = useState<Filter>("all");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const nameOf = (id: string) => plots.find((p) => p.id === id)?.name ?? "";
    const out: Entry[] = [];
    const errors: string[] = [];

    try {
      const recs = await listRecommendations();
      recs.forEach((r) =>
        out.push({ id: `rec-${r.id}`, kind: "rec", at: r.created_at, plotId: r.plot_id, plotName: nameOf(r.plot_id), line: t("p2.hist.rec_line", { crop: String(r.crop).replace(/_/g, " ") }) })
      );
    } catch (e) {
      errors.push(e instanceof Error ? e.message : t("p2.common.error_generic"));
    }

    const ids = plots.map((p) => p.id);
    if (ids.length > 0) {
      const { data, error: dbErr } = await supabase
        .from("soil_reports")
        .select("id, plot_id, created_at, ph, nitrogen_kg_ha, phosphorus_kg_ha, potassium_kg_ha")
        .in("plot_id", ids)
        .order("created_at", { ascending: false })
        .limit(100);
      if (dbErr) errors.push(String((dbErr as { message?: string }).message ?? dbErr));
      else
        (data ?? []).forEach((s: { id: string; plot_id: string; created_at: string; ph: number; nitrogen_kg_ha: number; phosphorus_kg_ha: number; potassium_kg_ha: number }) =>
          out.push({
            id: `soil-${s.id}`,
            kind: "soil",
            at: s.created_at,
            plotId: s.plot_id,
            plotName: nameOf(s.plot_id),
            line: t("p2.hist.soil_line", { ph: s.ph, n: s.nitrogen_kg_ha, p: s.phosphorus_kg_ha, k: s.potassium_kg_ha }),
          })
        );
    }

    plots.forEach((p) => {
      if (p.createdAt) out.push({ id: `plot-${p.id}`, kind: "plot", at: p.createdAt, plotId: p.id, plotName: p.name, line: p.crop || "" });
    });

    out.sort((a, b) => (a.at < b.at ? 1 : -1));
    setEntries(out);
    setError(errors.length ? errors.join("; ") : null);
    setLoading(false);
  }, [plots, t]);

  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(
    () => entries.filter((e) => (filter === "all" ? true : filter === "soil" ? e.kind === "soil" : e.kind === "rec")),
    [entries, filter]
  );

  const filters: Array<[Filter, string]> = [
    ["all", t("p2.hist.all")],
    ["soil", t("p2.hist.soil_only")],
    ["rec", t("p2.hist.rec_only")],
  ];

  return (
    <div className="space-y-6 text-left">
      <PageHeader icon={<HistoryIcon className="h-8 w-8" />} title={t("p2.hist.title")} subtitle={t("p2.hist.subtitle")} />

      <div role="group" aria-label={t("p2.hist.filter")} className="flex flex-wrap gap-2">
        {filters.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={`min-h-11 cursor-pointer rounded-xl border px-4 py-2 text-sm font-bold ${
              filter === key ? "border-primary bg-primary text-white" : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <ErrorBanner message={t("p2.hist.error", { message: error })} onRetry={load} />}
      {loading && <Spinner />}

      {!loading && shown.length === 0 && (
        <EmptyState
          title={t("p2.hist.empty_title")}
          body={t("p2.hist.empty_body")}
          action={onNavigate ? { label: t("p2.common.go_soil"), onClick: () => onNavigate("Soil Reports") } : undefined}
        />
      )}

      <ol className="space-y-3">
        {shown.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-xs">
            <div>
              <p className="text-sm font-extrabold text-gray-900">
                {t(`p2.hist.kind.${e.kind}`)}
                {e.plotName ? ` · ${e.plotName}` : ""}
              </p>
              {e.line && <p className="text-sm font-medium text-gray-700">{e.line}</p>}
              <p className="text-sm font-medium text-gray-500">{new Date(e.at).toLocaleString(locale)}</p>
            </div>
            {e.kind === "rec" && onOpenRecommendation && (
              <button
                type="button"
                onClick={() => onOpenRecommendation(e.plotId)}
                className="min-h-11 cursor-pointer rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-800 hover:bg-gray-50"
              >
                {t("p2.hist.open")}
              </button>
            )}
          </li>
        ))}
      </ol>

      <p className="text-sm font-medium text-gray-500">{t("p2.hist.disease_note")}</p>
    </div>
  );
};
