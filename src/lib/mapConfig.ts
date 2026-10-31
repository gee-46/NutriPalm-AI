/**
 * mapConfig.ts - the ONE satellite imagery provider the whole app uses.
 *
 * Every Leaflet map (boundary surveyor, plot overview, plot picker) takes its tiles and attribution from here. There is no
 * second provider and no automatic fallback: if the configured source cannot be used the maps say so and offer a retry.
 *
 * Configuration (public values only; Vite exposes VITE_* to the browser, so never put a secret here):
 *   VITE_MAP_TILE_URL            tile template with {z} {x} {y}; may contain {apiKey}. Default: Esri World Imagery (see below)
 *   VITE_MAP_API_KEY             a PUBLIC, referrer-restricted key substituted for {apiKey}
 *   VITE_MAP_PROVIDER_NAME       shown to users; REQUIRED with a custom tile URL
 *   VITE_MAP_ATTRIBUTION         plain-text attribution required by the provider; REQUIRED with a custom tile URL
 *   VITE_MAP_MAX_NATIVE_ZOOM     highest zoom the provider really serves (tiles are scaled up beyond it); default 18
 *   VITE_MAP_LICENSE_CONFIRMED   "true" once the OWNER has verified that the provider's terms permit this deployment
 *
 * LICENSING - WHAT WAS VERIFIED AND WHAT WAS NOT
 * The default is Esri's public "World Imagery" tile endpoint. Esri's own terms summary for items it owns in ArcGIS Online
 * (https://www.esri.com/content/dam/arcgisonline/docs/tou_summary.pdf, last updated 21 April 2025) allows use "in conjunction with
 * Esri software or an ArcGIS Online subscription", requires "attribution to Esri and its data providers", and says "If you do not
 * have Esri software, you must purchase an ArcGIS Online subscription." This app uses plain Leaflet, which is not Esri software.
 * Whether this deployment is permitted is therefore NOT established by anything in this repository. For that reason a PRODUCTION
 * build loads no imagery unless VITE_MAP_LICENSE_CONFIRMED=true is set deliberately; development and tests may use the default.
 * Confirming the licence (or switching to a provider whose terms you have accepted, via VITE_MAP_TILE_URL) is a deployment decision.
 */

export interface MapImageryConfig {
  provider: string;
  tileUrl: string;
  /** Plain text, HTML-escaped when shown. */
  attribution: string;
  maxZoom: number;
  maxNativeZoom: number;
  /** True when the app is using the built-in default provider rather than one the owner configured. */
  isDefaultProvider: boolean;
}

export type MapConfigProblem = "license_unconfirmed" | "invalid_config";

export type MapConfigResult =
  | { ok: true; config: MapImageryConfig }
  | { ok: false; problem: MapConfigProblem; message: string };

export const DEFAULT_PROVIDER = {
  provider: "Esri World Imagery",
  tileUrl: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  // The service's own copyrightText (read from its REST endpoint on 2026-10-30).
  attribution: "Tiles © Esri — Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community",
  maxNativeZoom: 18,
  maxZoom: 21,
} as const;

type Env = Record<string, string | undefined>;

const clean = (v: string | undefined) => (v ?? "").trim();

function invalid(message: string): MapConfigResult {
  return { ok: false, problem: "invalid_config", message };
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Resolve the imagery configuration from an environment object. Pure: nothing is read from globals. */
export function resolveMapConfig(env: Env, opts: { production: boolean }): MapConfigResult {
  const customUrl = clean(env.VITE_MAP_TILE_URL);
  const key = clean(env.VITE_MAP_API_KEY);
  const provider = clean(env.VITE_MAP_PROVIDER_NAME);
  const attribution = clean(env.VITE_MAP_ATTRIBUTION);
  const confirmed = clean(env.VITE_MAP_LICENSE_CONFIRMED).toLowerCase() === "true";

  const nativeRaw = clean(env.VITE_MAP_MAX_NATIVE_ZOOM);
  let maxNativeZoom: number = DEFAULT_PROVIDER.maxNativeZoom;
  if (nativeRaw) {
    const n = Number(nativeRaw);
    if (!Number.isInteger(n) || n < 1 || n > 22) return invalid("VITE_MAP_MAX_NATIVE_ZOOM must be a whole number between 1 and 22.");
    maxNativeZoom = n;
  }

  let tileUrl: string = DEFAULT_PROVIDER.tileUrl;
  let isDefaultProvider = true;
  if (customUrl) {
    isDefaultProvider = false;
    if (!provider) return invalid("VITE_MAP_PROVIDER_NAME is required when VITE_MAP_TILE_URL is set.");
    if (!attribution) return invalid("VITE_MAP_ATTRIBUTION is required when VITE_MAP_TILE_URL is set: the provider's attribution must be shown.");
    for (const token of ["{z}", "{x}", "{y}"]) {
      if (!customUrl.includes(token)) return invalid(`VITE_MAP_TILE_URL must contain ${token}.`);
    }
    const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(customUrl);
    if (!/^https:\/\//i.test(customUrl) && !(local && !opts.production)) {
      return invalid("VITE_MAP_TILE_URL must use https (plain http is accepted only for localhost outside production).");
    }
    const hasKeySlot = customUrl.includes("{apiKey}");
    if (hasKeySlot && !key) return invalid("VITE_MAP_TILE_URL contains {apiKey} but VITE_MAP_API_KEY is not set.");
    if (!hasKeySlot && key) return invalid("VITE_MAP_API_KEY is set but VITE_MAP_TILE_URL has no {apiKey} placeholder, so the key would be ignored.");
    tileUrl = hasKeySlot ? customUrl.split("{apiKey}").join(encodeURIComponent(key)) : customUrl;
  } else if (key || provider || attribution) {
    return invalid("VITE_MAP_API_KEY, VITE_MAP_PROVIDER_NAME and VITE_MAP_ATTRIBUTION only apply together with VITE_MAP_TILE_URL.");
  }

  if (opts.production && !confirmed) {
    return {
      ok: false,
      problem: "license_unconfirmed",
      message:
        "Satellite imagery is not enabled for this deployment. The site owner must confirm that the imagery provider's terms permit this use " +
        "(set VITE_MAP_LICENSE_CONFIRMED=true) before imagery is loaded.",
    };
  }

  return {
    ok: true,
    config: {
      provider: isDefaultProvider ? DEFAULT_PROVIDER.provider : provider,
      tileUrl,
      attribution: isDefaultProvider ? DEFAULT_PROVIDER.attribution : attribution,
      maxZoom: Math.max(DEFAULT_PROVIDER.maxZoom, maxNativeZoom),
      maxNativeZoom,
      isDefaultProvider,
    },
  };
}

/** The configuration for this build (reads the Vite environment). */
export function getMapConfig(): MapConfigResult {
  const env = ((import.meta as unknown as { env?: Env }).env ?? {}) as Env;
  const production = (env as unknown as { PROD?: boolean }).PROD === true;
  return resolveMapConfig(env, { production });
}
