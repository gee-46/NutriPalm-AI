import React from "react";
import { Sun } from "lucide-react";
import type { Plot } from "../../data/plots";
import { useEnvironmentalData } from "../../hooks/useEnvironmentalData";

interface DashboardWeatherCardProps {
  /** A saved plot with a mapped boundary; weather is fetched for its centroid. */
  plot: Plot | undefined;
}

const dayLabel = (isoDate: string) => {
  const d = new Date(`${isoDate}T00:00:00`);
  return isNaN(d.getTime()) ? isoDate : d.toLocaleDateString(undefined, { weekday: "short" });
};

/**
 * Weather for one of the user's real plots (Open-Meteo, via the plot centroid).
 * Every value is fetched; when nothing is available the card says so.
 */
export const DashboardWeatherCard: React.FC<DashboardWeatherCardProps> = ({ plot }) => {
  const env = useEnvironmentalData(plot);
  const w = env.weather;

  return (
    <div className="bg-gradient-to-tr from-[#1B4D22] to-[#2E7D32] text-white rounded-3xl p-6 shadow-md relative overflow-hidden text-left">
      <div className="absolute top-0 right-0 w-36 h-36 bg-white/5 rounded-full filter blur-2xl pointer-events-none" />
      <div className="relative z-10 space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[10px] font-bold text-emerald-200 uppercase tracking-widest">
              Weather at your plot
            </p>
            <h4 className="text-lg font-extrabold mt-1">{plot ? plot.name : "No mapped plot"}</h4>
          </div>
          <Sun className="w-10 h-10 text-amber-300" />
        </div>

        {!plot || !env.centroid ? (
          <p className="text-xs font-semibold text-emerald-100">
            Map a plot boundary to see the weather at its location.
          </p>
        ) : env.weatherLoading && !w ? (
          <p className="text-xs font-semibold text-emerald-100">Loading weather…</p>
        ) : env.weatherError && !w ? (
          <p role="alert" className="text-xs font-semibold text-amber-200">
            Weather is unavailable right now: {env.weatherError}
          </p>
        ) : w ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black tracking-tight">{Math.round(w.current.temperatureC)}°C</span>
              <span className="text-xs text-emerald-200">{w.current.conditionText}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 py-3 border-y border-white/10 text-center text-xs">
              <div>
                <p className="text-[9px] text-emerald-200 uppercase font-bold tracking-wider">Humidity</p>
                <p className="font-extrabold mt-0.5">
                  {w.current.humidityPercent !== null ? `${Math.round(w.current.humidityPercent)}%` : "—"}
                </p>
              </div>
              <div>
                <p className="text-[9px] text-emerald-200 uppercase font-bold tracking-wider">Wind</p>
                <p className="font-extrabold mt-0.5">
                  {w.current.windSpeedKmh !== null ? `${Math.round(w.current.windSpeedKmh)} km/h` : "—"}
                </p>
              </div>
              <div>
                <p className="text-[9px] text-emerald-200 uppercase font-bold tracking-wider">Rain now</p>
                <p className="font-extrabold mt-0.5">
                  {w.current.precipitationMm !== null ? `${w.current.precipitationMm} mm` : "—"}
                </p>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <p className="text-[9px] font-bold text-emerald-200 uppercase tracking-widest mb-2">Forecast</p>
              {w.forecast.slice(0, 5).map((fc) => (
                <div key={fc.date} className="flex justify-between items-center text-xs">
                  <span className="w-16 text-emerald-100 font-semibold">{dayLabel(fc.date)}</span>
                  <span className="text-emerald-100">{fc.conditionText}</span>
                  <span className="w-24 text-right font-extrabold">
                    {Math.round(fc.minTempC)}–{Math.round(fc.maxTempC)}°
                    {fc.precipitationProbabilityPercent !== null ? ` · ${fc.precipitationProbabilityPercent}%` : ""}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-[9px] text-emerald-200">
              Source: {w.source}, observed {new Date(w.current.observationTime).toLocaleString()}
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
};
