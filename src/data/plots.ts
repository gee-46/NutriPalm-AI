

import { useSyncExternalStore } from "react";
import { supabase } from "../lib/supabaseClient";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import turfCentroid from "@turf/centroid";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: number[][][]; // [[[lng, lat], ...]]
}

export interface Plot {
  // Identity
  id: string;
  /** True when this plot is synthetic sample/demo data (not a real user farm) */
  isDemo?: boolean;
  /** Optional - DB plots key off owner_id (auth user). Kept for AnalyticsScreen display. */
  farmer?: string;
  /** public.plots.farmer_id -- the farmer this plot belongs to (optional). */
  farmerId?: string;
  name: string;
  crop: string;
  stage: string;
  age: number; // years since planting (plantation_age in DB)

  // Planting metadata (Phase 5 additions)
  plantingDate?: string; // ISO date string, nullable
  plantCount?: number;   // nullable

  // Geometry
  area: number; // acres
  coordinates: string[]; // WGS-84 corner strings for display (derived, not persisted)
  geoJSON?: GeoJSONPolygon; // real polygon (stored as `boundary` in DB)
  elevation?: number; // metres MSL (nullable - from Open-Elevation API)

  // Location (Phase 4 geocoding additions)
  village?: string;  // from Nominatim
  taluk?: string;    // from Nominatim county field (Indian taluk/tehsil equivalent)
  district?: string; // from Nominatim state_district
  state?: string;    // from Nominatim state
  country?: string;  // from Nominatim country

  // Soil / irrigation
  soil: string;
  /** Only `Current` is real (latest digital twin). Past/Prediction are not available yet. */
  soilHealth?: { Past?: number; Current: number; Prediction?: number };
  irrigation: string;

  // FarmPlotScreen display fields
  ndvi?: number;
  moisture?: number;
  lastInspection?: string;
  status: "Healthy" | "Moderate" | "Needs Attention" | "Critical" | "Not Assessed";
  /** Tailwind classes for FarmPlotScreen badge */
  statusColor: string;
  /** Tailwind bg-* class for DigitalTwin status dot */
  statusDotColor: string;
  temp?: string;
  humidity?: string;
  rainProb?: string;
  windSpeed?: string;
  solarRad?: string;
  uvIndex?: string;

  // SVG map shape (kept for seed/non-real plots)
  svgPath: string;
  fillGradient: string;
  strokeColor: string;
  glowColor: string;

  // DigitalTwinScreen timeline fields
  ndviTimeline?: { Past: number; Current: number; Prediction: number };
  moistureTimeline?: { Past: number; Current: number; Prediction: number };
  yieldEst?: { Past: string; Current: string; Prediction: string };
  confidence?: number;
  diseaseRisk?: { Past: string; Current: string; Prediction: string };
  diseasePct?: { Past: number; Current: number; Prediction: number };
  whyDisease?: string;
  recommendedAction?: string;
  advisoryReason?: string;

  // Meta / cross-module status
  boundaryMapped: boolean;      // true when real geoJSON polygon is populated
  soilReportAttached: boolean;  // set by Soil Report module
  createdAt: string;            // ISO date string
}

// ---------------------------------------------------------------------------
// Seed data -- used ONLY for logged-out demo state. Explicitly marked isDemo: true.
// ---------------------------------------------------------------------------

/**
 * Centroid of a GeoJSON polygon as { lat, lng } (WGS84), or null when the
 * polygon is invalid. This is the point used for weather / live-twin lookups.
 */
export function polygonCentroid(geo: GeoJSONPolygon | undefined | null): { lat: number; lng: number } | null {
  try {
    if (!geo || geo.type !== "Polygon") return null;
    const ring = geo.coordinates?.[0];
    if (!Array.isArray(ring) || ring.length < 4) return null;
    const [lng, lat] = turfCentroid(geo).geometry.coordinates;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// DB -> Frontend mapper (snake_case DB row -> camelCase Plot)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbRowToPlot(row: Record<string, any>): Plot {
  // No health assessment exists until a Digital Twin / report produces one.
  const status = (row.status as Plot["status"]) || "Not Assessed";

  // Real geometry from Supabase 'boundary' JSON column (captured via GPS drawing or imported GeoJSON)
  const isGeoJSONValid =
    row.boundary &&
    typeof row.boundary === "object" &&
    row.boundary.type === "Polygon" &&
    Array.isArray(row.boundary.coordinates) &&
    Array.isArray(row.boundary.coordinates[0]) &&
    row.boundary.coordinates[0].length >= 3;

  const geoJSON: GeoJSONPolygon | undefined = isGeoJSONValid ? (row.boundary as GeoJSONPolygon) : undefined;

  const coordinates: string[] =
    geoJSON?.coordinates?.[0]
      ? (geoJSON.coordinates[0] as number[][]).slice(0, 4).map(([lng, lat]) =>
          `${Math.abs(lat).toFixed(4)} ${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(4)} ${lng >= 0 ? "E" : "W"}`
        )
      : [];

  // Extract latest digital twin if joined
  const latestTwin = Array.isArray(row.digital_twins) && row.digital_twins.length > 0
    ? [...row.digital_twins].sort(
        (a, b) =>
          new Date(b.analysis_date || b.created_at || 0).getTime() -
          new Date(a.analysis_date || a.created_at || 0).getTime()
      )[0]
    : null;

  const soilHealth =
    latestTwin && typeof latestTwin.crop_health_score === "number"
      ? { Current: Math.round(latestTwin.crop_health_score) }
      : undefined;

  const ndvi =
    latestTwin && typeof latestTwin.ndvi === "number" ? latestTwin.ndvi : undefined;

  let svgPath = "";
  if (geoJSON) {
    try {
      const coords = geoJSON.coordinates[0] as number[][];
      const lngs = coords.map((c) => c[0]);
      const lats = coords.map((c) => c[1]);
      const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
      const minLat = Math.min(...lats), maxLat = Math.max(...lats);
      const W = 500, H = 250, PAD = 30;
      const points = coords.map(([lng, lat]) => ({
        x: PAD + ((lng - minLng) / (maxLng - minLng || 1)) * (W - PAD * 2),
        y: PAD + ((maxLat - lat) / (maxLat - minLat || 1)) * (H - PAD * 2),
      }));
      svgPath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + " Z";
    } catch { /* use default */ }
  }

  const fillMap: Record<Plot["status"], string> = {
    "Healthy": "url(#healthyGrad)", "Moderate": "url(#stableGrad)",
    "Critical": "url(#criticalGrad)", "Needs Attention": "url(#deficientGrad)", "Not Assessed": "rgba(148, 163, 184, 0.25)",
  };
  const strokeMap: Record<Plot["status"], string> = {
    "Healthy": "#10b981", "Moderate": "#84cc16", "Critical": "#e11d48", "Needs Attention": "#f59e0b", "Not Assessed": "#94a3b8",
  };
  const glowMap: Record<Plot["status"], string> = {
    "Healthy": "rgba(16, 185, 129, 0.4)", "Moderate": "rgba(132, 204, 22, 0.3)",
    "Critical": "rgba(225, 29, 72, 0.4)", "Needs Attention": "rgba(245, 158, 11, 0.3)", "Not Assessed": "rgba(148, 163, 184, 0.3)",
  };

  return {
    id: row.id as string,
    isDemo: false,
    farmerId: (row.farmer_id as string | null) || undefined,
    farmer: (row.farmers && row.farmers.name) || undefined,
    name: row.name as string,
    crop: row.crop || "",
    stage: row.stage || "Seedling",
    age: typeof row.plantation_age === "number" ? row.plantation_age : 0,
    plantingDate: row.planting_date || undefined,
    plantCount: typeof row.plant_count === "number" ? row.plant_count : undefined,
    area: typeof row.area === "number" ? row.area : 0,
    coordinates,
    geoJSON,
    elevation: typeof row.elevation === "number" ? row.elevation : undefined,
    village: row.village || undefined,
    taluk: row.taluk || undefined,
    district: row.district || undefined,
    state: row.state || undefined,
    country: row.country || undefined,
    soil: row.soil || "",
    soilHealth,
    ndvi,
    irrigation: row.irrigation_type || "",
    status,
    statusColor: getStatusColor(status),
    statusDotColor: getStatusDotColor(status),
    svgPath,
    fillGradient: fillMap[status],
    strokeColor: strokeMap[status],
    glowColor: glowMap[status],
    boundaryMapped: Boolean(geoJSON),
    soilReportAttached: row.soil_report_attached === true,
    createdAt: row.created_at as string,
  };
}


// ---------------------------------------------------------------------------
// Module-level external store (useSyncExternalStore compatible)
// ---------------------------------------------------------------------------

let _plots: Plot[] = [];
let _isLoading = false;
let _fetchInitiated = false;
const _listeners = new Set<() => void>();

/** Toast callback -- injected by FarmPlotScreen so we can surface errors from store actions */
let _toastFn: ((msg: string, type: "success" | "info" | "warning") => void) | null = null;

export function registerToastFn(fn: (msg: string, type: "success" | "info" | "warning") => void) {
  _toastFn = fn;
}

function _toast(msg: string, type: "success" | "info" | "warning" = "info") {
  if (_toastFn) _toastFn(msg, type);
}

function _notify() {
  _listeners.forEach((fn) => fn());
}

function _subscribe(fn: () => void) {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

function _getSnapshot(): Plot[] {
  return _plots;
}

export function getIsLoading(): boolean {
  return _isLoading;
}

// ---------------------------------------------------------------------------
// Supabase fetch -- runs once per auth session, non-blocking
// ---------------------------------------------------------------------------

async function _fetchFromDb(userId: string) {
  _isLoading = true;
  _notify();
  try {
    const { data, error } = await supabase
      .from("plots")
      .select("*, digital_twins(*), farmers(name)")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    // Real user with zero plots: clear seed data so the empty state shows correctly
    _plots = data && data.length > 0 ? data.map(dbRowToPlot) : [];
  } catch (err) {
    console.error("[plots] fetch error:", err);
    _plots = [];
    _toast("Could not load your plots from the server. Please refresh to retry.", "warning");
  } finally {
    _isLoading = false;
    _notify();
  }
}


// ---------------------------------------------------------------------------
// Auth state listener -- re-fetch on sign-in, reset on sign-out
// ---------------------------------------------------------------------------

supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
  if (event === "SIGNED_IN" && session?.user) {
    _fetchInitiated = true;
    _fetchFromDb(session.user.id);
  } else if (event === "SIGNED_OUT") {
    _fetchInitiated = false;
    _plots = [];
    _isLoading = false;
    _notify();
  }
});

// Also check current session on module load (handles page refresh while logged in)
supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
  if (!_fetchInitiated && data?.session?.user) {
    _fetchInitiated = true;
    _fetchFromDb(data.session.user.id);
  }
});

// ---------------------------------------------------------------------------
// Store actions
// ---------------------------------------------------------------------------

/**
 * Add a new plot to the shared store.
 * Inserts into Supabase when a session exists.
 * VISIBLE TOAST on local-only fallback -- never silently fabricates a save.
 */
export async function addPlot(plotInput: Omit<Plot, "id" | "createdAt">): Promise<Plot> {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;
  if (!user) {
    throw new Error("You must be signed in to save a plot.");
  }

  const centroid = polygonCentroid(plotInput.geoJSON);

  const dbRow: Record<string, unknown> = {
    owner_id: user.id,
    farmer_id: plotInput.farmerId ?? null,
    name: plotInput.name,
    crop: plotInput.crop,
    area: plotInput.area,
    area_unit: "acres",
    boundary: plotInput.geoJSON ?? null,
    // Plot location = centroid of the surveyed boundary (WGS84); null when unmapped.
    latitude: centroid?.lat ?? null,
    longitude: centroid?.lng ?? null,
    village: plotInput.village ?? null,
    taluk: plotInput.taluk ?? null,
    district: plotInput.district ?? null,
    state: plotInput.state ?? null,
    country: plotInput.country ?? null,
    planting_date: plotInput.plantingDate ?? null,
    plantation_age: plotInput.age || null,
    plant_count: plotInput.plantCount ?? null,
    irrigation_type: plotInput.irrigation,
    elevation: plotInput.elevation ?? null,
    soil: plotInput.soil,
    stage: plotInput.stage,
    status: plotInput.status,
    boundary_mapped: plotInput.boundaryMapped,
    soil_report_attached: plotInput.soilReportAttached,
  };

  const { data, error } = await supabase
    .from("plots")
    .insert(dbRow)
    .select("*, farmers(name)")
    .single();

  if (error || !data) {
    console.error("[plots] insert error:", error);
    // Never pretend a plot was saved: the caller shows the failure.
    throw new Error(error?.message || "The plot could not be saved to the server.");
  }

  const newPlot = dbRowToPlot(data as Record<string, unknown>);
  _plots = [newPlot, ..._plots];
  _notify();
  return newPlot;
}

/**
 * Update an existing plot by id (e.g., to attach a soil report).
 * Optimistically updates local state, then syncs to Supabase.
 * Returns false if plot not found.
 */
export async function updatePlot(id: string, updates: Partial<Plot>): Promise<boolean> {
  const idx = _plots.findIndex((p) => p.id === id);
  if (idx === -1) return false;

  // Optimistic update: local state updates immediately for snappy UI
  _plots = _plots.map((p) => (p.id === id ? { ...p, ...updates } : p));
  _notify();

  // Build partial DB row
  const dbUpdates: Record<string, unknown> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.crop !== undefined) dbUpdates.crop = updates.crop;
  if (updates.area !== undefined) dbUpdates.area = updates.area;
  if (updates.geoJSON !== undefined) {
    dbUpdates.boundary = updates.geoJSON;
    const c = polygonCentroid(updates.geoJSON);
    dbUpdates.latitude = c?.lat ?? null;
    dbUpdates.longitude = c?.lng ?? null;
  }
  if (updates.farmerId !== undefined) dbUpdates.farmer_id = updates.farmerId;
  if (updates.village !== undefined) dbUpdates.village = updates.village;
  if (updates.taluk !== undefined) dbUpdates.taluk = updates.taluk;
  if (updates.district !== undefined) dbUpdates.district = updates.district;
  if (updates.state !== undefined) dbUpdates.state = updates.state;
  if (updates.country !== undefined) dbUpdates.country = updates.country;
  if (updates.plantingDate !== undefined) dbUpdates.planting_date = updates.plantingDate;
  if (updates.age !== undefined) dbUpdates.plantation_age = updates.age;
  if (updates.plantCount !== undefined) dbUpdates.plant_count = updates.plantCount;
  if (updates.irrigation !== undefined) dbUpdates.irrigation_type = updates.irrigation;
  if (updates.elevation !== undefined) dbUpdates.elevation = updates.elevation;
  if (updates.soil !== undefined) dbUpdates.soil = updates.soil;
  if (updates.stage !== undefined) dbUpdates.stage = updates.stage;
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.boundaryMapped !== undefined) dbUpdates.boundary_mapped = updates.boundaryMapped;
  if (updates.soilReportAttached !== undefined) dbUpdates.soil_report_attached = updates.soilReportAttached;

  if (Object.keys(dbUpdates).length > 0) {
    const { error } = await supabase.from("plots").update(dbUpdates).eq("id", id);
    if (error) {
      console.error("[plots] update error:", error);
      _toast("Update saved locally -- could not sync to server.", "warning");
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// React hook -- use in both FarmPlotScreen and DigitalTwinScreen
// ---------------------------------------------------------------------------

/**
 * Returns the live plots array, loading state, and store actions.
 * Re-renders the component whenever any plot changes.
 */
export function usePlots(): {
  plots: Plot[];
  isLoading: boolean;
  addPlot: (p: Omit<Plot, "id" | "createdAt">) => Promise<Plot>;
  updatePlot: (id: string, updates: Partial<Plot>) => Promise<boolean>;
} {
  const plots = useSyncExternalStore(_subscribe, _getSnapshot);
  const isLoading = useSyncExternalStore(_subscribe, getIsLoading);
  return { plots, isLoading, addPlot, updatePlot };
}

// ---------------------------------------------------------------------------
// Helpers used by both screens
// ---------------------------------------------------------------------------

/** Derive status color string for the FarmPlotScreen badge from status enum */
export function getStatusColor(status: Plot["status"]): string {
  switch (status) {
    case "Healthy":
      return "text-emerald-600 bg-emerald-50 border border-emerald-100";
    case "Moderate":
      return "text-amber-600 bg-amber-50 border border-amber-100";
    case "Needs Attention":
      return "text-orange-600 bg-orange-50 border border-orange-100";
    case "Critical":
      return "text-rose-650 bg-rose-50 border border-rose-100";
    case "Not Assessed":
      return "text-slate-600 bg-slate-50 border border-slate-200";
  }
}

/** Derive status dot color for DigitalTwin from status enum */
export function getStatusDotColor(status: Plot["status"]): string {
  switch (status) {
    case "Healthy":
      return "bg-emerald-500";
    case "Moderate":
      return "bg-lime-500";
    case "Needs Attention":
      return "bg-orange-500";
    case "Critical":
      return "bg-rose-500";
    case "Not Assessed":
      return "bg-slate-400";
  }
}