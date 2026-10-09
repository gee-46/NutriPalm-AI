import React, { useMemo, useState } from "react";
import { CloudSun } from "lucide-react";
import { useSavedPlots } from "../../hooks/useSavedPlots";
import { useTranslation } from "../../translation/useTranslation";
import { usePlotWeather } from "../../hooks/usePlotWeather";
import { weatherConditionKey } from "../../lib/weatherText";
import {
  EmptyState,
  ErrorBanner,
  FactRow,
  PageHeader,
  PlotSelect,
  Spinner,
  UnavailableState,
} from "../phase2/shared";

interface Props {
  onNavigate?: (screen: string) => void;
}

export const WeatherAdvisoryScreen: React.FC<Props> = ({ onNavigate }) => {
  const { t, locale } = useTranslation();
  const plots = useSavedPlots();
  const [plotId, setPlotId] = useState("");
  const plot = useMemo(() => plots.find((p) => p.id === plotId), [plots, plotId]);
  const wx = usePlotWeather(plot);
  const w = wx.weather;
  const na = t("p2.common.not_available");
  const num = (v: number | null, unit: string, digits = 0) =>
    v === null || v === undefined ? na : `${v.toLocaleString(locale, { maximumFractionDigits: digits })} ${unit}`;
  const day = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`);
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
  };

  return (
    <div className="space-y-6 text-left">
      <PageHeader icon={<CloudSun className="h-8 w-8" />} title={t("p2.weather.title")} subtitle={t("p2.weather.subtitle")} />

      {plots.length === 0 ? (
        <EmptyState
          title={t("p2.common.no_plots_title")}
          body={t("p2.common.no_plots_body")}
          action={onNavigate ? { label: t("p2.common.add_plot"), onClick: () => onNavigate("Farm Plots") } : undefined}
        />
      ) : (
        <>
          <PlotSelect plots={plots} value={plotId} onChange={setPlotId} id="weather-plot" />

          {plot && !wx.centroid && <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-gray-700">{t("p2.weather.no_boundary")}</p>}
          {plot && wx.centroid && wx.loading && !w && <Spinner />}
          {plot && wx.centroid && wx.error && !w && <ErrorBanner message={t("p2.weather.unavailable")} onRetry={wx.refresh} />}

          {w && (
            <>
              <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-xs sm:p-6">
                <h2 className="mb-1 text-base font-extrabold text-gray-900">{t("p2.weather.now")} · {plot?.name}</h2>
                <p className="mb-3 text-3xl font-black text-gray-900">
                  {Math.round(w.current.temperatureC)}°C <span className="text-base font-semibold text-gray-600">{t(weatherConditionKey(w.current.conditionCode))}</span>
                </p>
                <dl>
                  <FactRow label={t("p2.weather.feels_like")} value={num(w.current.apparentTemperatureC, "°C")} />
                  <FactRow label={t("p2.weather.humidity")} value={num(w.current.humidityPercent, "%")} />
                  <FactRow label={t("p2.weather.wind")} value={num(w.current.windSpeedKmh, "km/h")} />
                  <FactRow label={t("p2.weather.rain_now")} value={num(w.current.precipitationMm, "mm", 1)} />
                </dl>
                <p className="mt-3 text-sm font-medium text-gray-500">
                  {t("p2.weather.observed", { source: w.source, time: new Date(w.current.observationTime).toLocaleString(locale) })}
                </p>
              </section>

              <section className="overflow-x-auto rounded-3xl border border-gray-200 bg-white shadow-xs">
                <h2 className="p-5 pb-2 text-base font-extrabold text-gray-900">{t("p2.weather.forecast")}</h2>
                <table className="w-full min-w-[34rem] text-left text-sm">
                  <thead className="text-gray-600">
                    <tr>
                      <th scope="col" className="px-5 py-2 font-bold">{t("p2.weather.day")}</th>
                      <th scope="col" className="px-3 py-2 font-bold">{t("p2.weather.sky")}</th>
                      <th scope="col" className="px-3 py-2 font-bold">{t("p2.weather.temp_range")}</th>
                      <th scope="col" className="px-5 py-2 font-bold">{t("p2.weather.rain_chance")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {w.forecast.map((f) => (
                      <tr key={f.date} className="border-t border-gray-100">
                        <th scope="row" className="px-5 py-3 font-bold text-gray-900">{day(f.date)}</th>
                        <td className="px-3 py-3 font-medium text-gray-800">{t(weatherConditionKey(f.conditionCode))}</td>
                        <td className="px-3 py-3 font-semibold text-gray-900">{Math.round(f.minTempC)}° – {Math.round(f.maxTempC)}°C</td>
                        <td className="px-5 py-3 font-semibold text-gray-900">{num(f.precipitationProbabilityPercent, "%")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          )}

          {plot && (
            <section aria-label={t("p2.weather.advisory_title")}>
              <UnavailableState title={t("p2.weather.advisory_unavailable_title")} body={t("p2.weather.advisory_unavailable_body")} />
            </section>
          )}
        </>
      )}
    </div>
  );
};
