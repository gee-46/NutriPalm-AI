import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useTranslation } from "../../translation/useTranslation";

interface Props {
  /** "tiles": the configured provider is not loading (retry possible). "config": imagery is not configured/enabled (a deployment matter). */
  kind: "tiles" | "config";
  provider?: string;
  /** For kind "config": the explanation produced by the configuration check. */
  message?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Shown over a map instead of a silently blank one. It never offers another map source: the app uses one imagery provider.
 */
export const MapImageryNotice: React.FC<Props> = ({ kind, provider, message, onRetry, className = "" }) => {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className={`absolute inset-0 z-30 flex items-center justify-center bg-slate-950/85 p-4 text-center ${className}`}
    >
      <div className="max-w-sm space-y-3 rounded-3xl border border-amber-500/40 bg-slate-900 p-6 text-slate-100 shadow-xl">
        <AlertTriangle className="mx-auto h-8 w-8 text-amber-400" aria-hidden="true" />
        <h3 className="text-base font-semibold">{kind === "tiles" ? t("p5.map.tiles_failed_title") : t("p5.map.config_title")}</h3>
        <p className="text-sm leading-relaxed text-slate-300">
          {kind === "tiles" ? t("p5.map.tiles_failed_body", { provider: provider ?? "" }) : message}
        </p>
        {kind === "tiles" && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {t("p4.common.retry")}
          </button>
        )}
      </div>
    </div>
  );
};
