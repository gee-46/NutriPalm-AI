import React from "react";
import { CloudSun } from "lucide-react";
import type { Plot } from "../../data/plots";
import { usePlotWeather } from "../../hooks/usePlotWeather";
import { weatherConditionKey } from "../../lib/weatherText";
import { useTranslation } from "../../translation/useTranslation";

interface DashboardWeatherCardProps {
  /** A saved plot with a mapped boundary; weather is fetched for its centroid. */
  plot: Plot | undefined;
  onOpen?: () => void;
}

/**
 * Compact weather for one of the user's real plots (Open-Meteo, via the plot centroid).
 * Every value is fetched; when nothing is available the card says so.
 */
export const DashboardWeatherCard: React.FC<DashboardWeatherCardProps> = ({ plot, onOpen }) => {
  const { t, locale } = useTranslation();
  const wx = usePlotWeather(plot);
  const w = wx.weather;
  const na = t("p2.common.not_available");

  return (
    <div className="space-y-3 text-left">
      <div className="flex items-center gap-2">
        <CloudSun className="h-5 w-5 text-primary" aria-hidden="true" />
        <h3 className="text-base font-extrabold text-gray-900">{t("p2.dash.weather_for")}</h3>
      </div>

      {!plot || !wx.centroid ? (
        <p className="text-sm font-medium text-gray-700">{t("p2.weather.no_boundary")}</p>
      ) : wx.loading && !w ? (
        <p role="status" className="text-sm font-medium text-gray-600">{t("p2.common.loading")}</p>
      ) : wx.error && !w ? (
        <p role="alert" className="text-sm font-semibold text-rose-800">{t("p2.weather.unavailable")}</p>
      ) : w ? (
        <>
          <p className="text-3xl font-black text-gray-900">
            {Math.round(w.current.temperatureC)}°C{" "}
            <span className="text-base font-semibold text-gray-600">{t(weatherConditionKey(w.current.conditionCode))}</span>
          </p>
          <dl className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <dt className="font-semibold text-gray-600">{t("p2.weather.humidity")}</dt>
              <dd className="font-extrabold text-gray-900">{w.current.humidityPercent !== null ? `${Math.round(w.current.humidityPercent)}%` : na}</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-600">{t("p2.weather.wind")}</dt>
              <dd className="font-extrabold text-gray-900">{w.current.windSpeedKmh !== null ? `${Math.round(w.current.windSpeedKmh)} km/h` : na}</dd>
            </div>
            <div>
              <dt className="font-semibold text-gray-600">{t("p2.weather.rain_now")}</dt>
              <dd className="font-extrabold text-gray-900">{w.current.precipitationMm !== null ? `${w.current.precipitationMm} mm` : na}</dd>
            </div>
          </dl>
          <p className="text-sm font-medium text-gray-500">
            {t("p2.weather.observed", { source: w.source, time: new Date(w.current.observationTime).toLocaleString(locale) })}
          </p>
        </>
      ) : null}

      {onOpen && (
        <button type="button" onClick={onOpen} className="min-h-11 cursor-pointer rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-800 hover:bg-gray-50">
          {t("p2.weather.more")}
        </button>
      )}
    </div>
  );
};
