import React, { useState } from "react";
import { Bot, Activity } from "lucide-react";
import { getCropBaseline } from "../../constants/cropBaselines";
import type { CropBenchmark, NutrientTarget } from "../../constants/cropBaselines";

export interface SoilReportInput {
  nitrogen_kg_ha?: number | null;
  nitrogen?: number | { value: number | null; unit?: string } | null;
  phosphorus_kg_ha?: number | null;
  phosphorus?: number | { value: number | null; unit?: string } | null;
  potassium_kg_ha?: number | null;
  potassium?: number | { value: number | null; unit?: string } | null;
  organic_carbon_percent?: number | null;
  organic_carbon?: number | { value: number | null; unit?: string } | null;
  ph?: number | { value: number | null; unit?: string } | null;
  electrical_conductivity?: number | { value: number | null; unit?: string } | null;
  N?: number | null;
  P?: number | null;
  K?: number | null;
  OC?: number | null;
  pH?: number | null;
  [key: string]: any;
}

export interface SoilNutrientAnalyticsCardProps {
  report?: SoilReportInput | null;
  cropType?: string;
  title?: string;
  showMiniRadar?: boolean;
}

interface MetricRow {
  key: "nitrogen" | "phosphorus" | "potassium" | "organic_carbon" | "ph";
  label: string;
  symbol: string;
  actual: number | null;
  target: NutrientTarget;
  unit: string;
  delta: number | null;
  severity: "critical" | "moderate" | "optimal" | "unknown";
  severityLabel: string;
  badgeClass: string;
  barColor: string;
  progressPct: number;
}

function extractValue(val: any): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return isNaN(val) ? null : val;
  if (typeof val === "object" && val !== null && "value" in val) {
    return extractValue(val.value);
  }
  if (typeof val === "string") {
    const parsed = parseFloat(val.replace(/[^\d.-]/g, ""));
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

export const SoilNutrientAnalyticsCard: React.FC<SoilNutrientAnalyticsCardProps> = ({
  report,
  cropType = "Oil Palm",
  title = "Nutrient Deficiency Breakdown",
  showMiniRadar = true,
}) => {
  const [hoveredAxis, setHoveredAxis] = useState<number | null>(null);
  const baseline: CropBenchmark = getCropBaseline(cropType);

  // Extract raw numerical values from any incoming format
  const rawN = extractValue(report?.nitrogen_kg_ha ?? report?.nitrogen ?? report?.N);
  const rawP = extractValue(report?.phosphorus_kg_ha ?? report?.phosphorus ?? report?.P);
  const rawK = extractValue(report?.potassium_kg_ha ?? report?.potassium ?? report?.K);
  const rawOC = extractValue(report?.organic_carbon_percent ?? report?.organic_carbon ?? report?.OC);
  const rawPH = extractValue(report?.ph ?? report?.pH);

  const evaluateMetric = (
    key: "nitrogen" | "phosphorus" | "potassium" | "organic_carbon" | "ph",
    label: string,
    symbol: string,
    actual: number | null,
    target: NutrientTarget
  ): MetricRow => {
    if (actual === null) {
      return {
        key,
        label,
        symbol,
        actual: null,
        target,
        unit: target.unit,
        delta: null,
        severity: "unknown",
        severityLabel: "Missing",
        badgeClass: "bg-slate-50 text-slate-500 border-slate-200",
        barColor: "bg-slate-200",
        progressPct: 0,
      };
    }

    const delta = Number((actual - target.target).toFixed(2));
    const ratio = actual / target.target;

    let severity: "critical" | "moderate" | "optimal" = "optimal";
    let severityLabel = "Optimal / Adequate";
    let badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
    let barColor = "bg-emerald-500";

    if (key === "ph") {
      if (actual < target.min - 0.5 || actual > target.max + 0.5) {
        severity = "critical";
        severityLabel = actual < target.min ? "Critical Acidity" : "Critical Alkalinity";
        badgeClass = "bg-rose-50 text-rose-700 border-rose-200";
        barColor = "bg-rose-500";
      } else if (actual < target.min || actual > target.max) {
        severity = "moderate";
        severityLabel = actual < target.min ? "Mild Acidity" : "Mild Alkalinity";
        badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
        barColor = "bg-amber-500";
      } else {
        severity = "optimal";
        severityLabel = "Optimal Buffer";
        badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
        barColor = "bg-emerald-500";
      }
    } else {
      if (ratio < 0.7) {
        severity = "critical";
        severityLabel = "Critical Deficit";
        badgeClass = "bg-rose-50 text-rose-700 border-rose-200";
        barColor = "bg-rose-500";
      } else if (ratio < 0.95) {
        severity = "moderate";
        severityLabel = "Moderate Deficit";
        badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
        barColor = "bg-amber-500";
      } else {
        severity = "optimal";
        severityLabel = "Optimal / Adequate";
        badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
        barColor = "bg-emerald-500";
      }
    }

    // Scale progress relative to target baseline (100% = target, max visually clamped at 130%)
    const progressPct = Math.min(100, Math.max(4, Math.round((actual / (target.target * 1.3)) * 100)));

    return {
      key,
      label,
      symbol,
      actual,
      target,
      unit: target.unit,
      delta,
      severity,
      severityLabel,
      badgeClass,
      barColor,
      progressPct,
    };
  };

  const rows: MetricRow[] = [
    evaluateMetric("nitrogen", "Nitrogen", "N", rawN, baseline.nitrogen),
    evaluateMetric("phosphorus", "Phosphorus", "P", rawP, baseline.phosphorus),
    evaluateMetric("potassium", "Potassium", "K", rawK, baseline.potassium),
    evaluateMetric("organic_carbon", "Organic Carbon", "OC", rawOC, baseline.organic_carbon),
    evaluateMetric("ph", "Soil Reaction", "pH", rawPH, baseline.ph),
  ];

  // ---------------------------------------------------------------------------
  // 5-Axis Mini Radar calculations
  // ---------------------------------------------------------------------------
  const radarCx = 110;
  const radarCy = 100;
  const radarMaxRadius = 65;

  const radarAxes = [
    { key: "N", label: "N", row: rows[0] },
    { key: "P", label: "P", row: rows[1] },
    { key: "K", label: "K", row: rows[2] },
    { key: "OC", label: "OC", row: rows[3] },
    { key: "pH", label: "pH", row: rows[4] },
  ];

  const getRadarCoordinates = (useTargets: boolean) => {
    return radarAxes.map((axis, i) => {
      const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const targetVal = axis.row.target.target;
      const actualVal = axis.row.actual ?? 0;
      const ratio = useTargets ? 1.0 : Math.min(1.25, actualVal / targetVal);
      const r = radarMaxRadius * 0.8 * ratio;
      const x = radarCx + r * Math.cos(angle);
      const y = radarCy + r * Math.sin(angle);
      return { x, y, val: actualVal, targetVal };
    });
  };

  const targetCoords = getRadarCoordinates(true);
  const actualCoords = getRadarCoordinates(false);

  const targetPointsStr = targetCoords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const actualPointsStr = actualCoords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs text-left font-sans space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
            <Bot className="w-4 h-4 text-emerald-600 shrink-0" />
            {title}
          </h3>
          <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
            Calibrated against agronomic standards for <span className="font-bold text-slate-700 capitalize">{cropType}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60 uppercase tracking-wider">
            {cropType} Baseline
          </span>
        </div>
      </div>

      <div className={`grid grid-cols-1 ${showMiniRadar ? "lg:grid-cols-12" : "grid-cols-1"} gap-6 items-start`}>
        {/* Metric Rows Telemetry (Main breakdown) */}
        <div className={`${showMiniRadar ? "lg:col-span-8" : "w-full"} space-y-4`}>
          {rows.map((row) => {
            const hasData = row.actual !== null;
            const targetMarkerLeft = `${Math.min(95, Math.round((1.0 / 1.3) * 100))}%`;

            return (
              <div
                key={row.key}
                className="p-3.5 rounded-xl border border-slate-150/70 bg-slate-50/40 hover:bg-slate-50 transition-colors space-y-2"
              >
                {/* Row Top: Name, Values, Target, Severity Badge */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-emerald-100/70 text-emerald-800 font-extrabold text-[10px] flex items-center justify-center">
                      {row.symbol}
                    </span>
                    <div>
                      <span className="font-extrabold text-slate-900">{row.label}</span>
                      <span className="text-slate-400 font-medium ml-1.5 text-[11px]">
                        ({row.actual !== null ? `${row.actual} ${row.unit}` : "Not Found"})
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-2xs">
                      Target: {row.target.target} {row.unit}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shadow-2xs ${row.badgeClass}`}
                    >
                      {row.severityLabel}
                    </span>
                  </div>
                </div>

                {/* Comparative Visual Bar */}
                <div className="relative pt-1 pb-0.5">
                  <div className="w-full h-2.5 bg-slate-200/70 rounded-full overflow-hidden relative">
                    {/* Actual Value Bar */}
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${row.barColor}`}
                      style={{ width: `${row.progressPct}%` }}
                    />
                  </div>

                  {/* Target Reference Tick Marker */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-slate-700 rounded-full z-10"
                    style={{ left: targetMarkerLeft }}
                    title={`Baseline Target: ${row.target.target} ${row.unit}`}
                  />
                </div>

                {/* Row Bottom: Deficit Delta & Bio-range */}
                <div className="flex justify-between items-center text-[10px] font-medium text-slate-500 pt-0.5">
                  <div>
                    {hasData && row.delta !== null ? (
                      <span>
                        {row.delta < 0 ? (
                          <strong className="text-rose-600 font-bold">
                            Deficit: {row.delta} {row.unit} below target
                          </strong>
                        ) : row.delta === 0 ? (
                          <strong className="text-emerald-600 font-bold">On Target</strong>
                        ) : (
                          <strong className="text-emerald-700 font-bold">
                            Surplus: +{row.delta} {row.unit} above target
                          </strong>
                        )}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">No lab data recorded</span>
                    )}
                  </div>

                  <div className="text-slate-400 font-mono text-[9px]">
                    Band: {row.target.min} - {row.target.max} {row.unit}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Mini 5-Axis Radar Chart & Summary Callout */}
        {showMiniRadar && (
          <div className="lg:col-span-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 flex flex-col items-center justify-between text-center space-y-3 h-full">
            <div className="w-full flex justify-between items-center border-b border-slate-200/60 pb-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-emerald-600" />
                Polar Radar Matrix
              </span>
              <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                5-Axis
              </span>
            </div>

            {/* SVG Radar */}
            <div className="relative w-full flex items-center justify-center py-1">
              <svg className="w-56 h-48 overflow-visible select-none" viewBox="0 0 220 200">
                {/* Background rings */}
                {[0.33, 0.66, 1.0].map((scale, i) => {
                  const r = radarMaxRadius * scale;
                  const pts = radarAxes
                    .map((_, idx) => {
                      const angle = (idx * 2 * Math.PI) / 5 - Math.PI / 2;
                      return `${(radarCx + r * Math.cos(angle)).toFixed(1)},${(radarCy + r * Math.sin(angle)).toFixed(1)}`;
                    })
                    .join(" ");
                  return (
                    <polygon
                      key={i}
                      points={pts}
                      fill="none"
                      stroke="#CBD5E1"
                      strokeWidth="1"
                      strokeDasharray={scale < 1.0 ? "2 2" : "none"}
                    />
                  );
                })}

                {/* Spokes */}
                {radarAxes.map((_, i) => {
                  const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                  const x = radarCx + radarMaxRadius * Math.cos(angle);
                  const y = radarCy + radarMaxRadius * Math.sin(angle);
                  return (
                    <line
                      key={i}
                      x1={radarCx}
                      y1={radarCy}
                      x2={x}
                      y2={y}
                      stroke="#E2E8F0"
                      strokeWidth="1"
                    />
                  );
                })}

                {/* Target footprint */}
                <polygon
                  points={targetPointsStr}
                  fill="none"
                  stroke="#94A3B8"
                  strokeDasharray="3 2"
                  strokeWidth="1.2"
                />

                {/* Actual soil chemistry footprint */}
                <polygon
                  points={actualPointsStr}
                  fill="rgba(16, 185, 129, 0.2)"
                  stroke="#059669"
                  strokeWidth="2"
                />

                {/* Axis Vertices */}
                {actualCoords.map((coord, i) => {
                  const axis = radarAxes[i];
                  const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                  const labelX = radarCx + (radarMaxRadius + 14) * Math.cos(angle);
                  const labelY = radarCy + (radarMaxRadius + 10) * Math.sin(angle);
                  const isHovered = hoveredAxis === i;

                  return (
                    <g key={i}>
                      <circle
                        cx={coord.x}
                        cy={coord.y}
                        r={isHovered ? "4.5" : "3"}
                        fill="#059669"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                      <circle
                        cx={coord.x}
                        cy={coord.y}
                        r="14"
                        fill="transparent"
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredAxis(i)}
                        onMouseLeave={() => setHoveredAxis(null)}
                      />
                      <text
                        x={labelX}
                        y={labelY}
                        fill={isHovered ? "#059669" : "#64748B"}
                        fontSize="9"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {axis.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Micro legend */}
            <div className="flex justify-center gap-3 text-[9px] font-bold text-slate-500 border-t border-slate-200/60 pt-2 w-full">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-600" /> Current Field
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-0.5 bg-slate-400 border-b border-dashed" /> Target Baseline
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
