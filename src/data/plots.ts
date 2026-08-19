/**
 * plots.ts -- Single source of truth for all farm plot data.
 *
 * Uses a module-level external store so FarmPlotScreen and DigitalTwinScreen
 * stay in sync without needing a shared React Context provider in PrototypeApp.
 *
 * Shared contract for Auth / Soil Report / Recommendation modules:
 *   - Key off `plot.id`  (UUID from Supabase, or "plot-1" ... "plot-5" for seed data)
 *   - Set `plot.soilReportAttached = true` when soil report is uploaded
 *   - `plot.geoJSON` holds the real GeoJSON polygon once mapped
 *
 * Supabase wiring (Phase 6):
 *   - Fetch runs once per auth session, non-blocking -- seed data renders first
 *   - addPlot() -> Supabase insert; visible toast on local-only fallback (not silent)
 *   - updatePlot() -> Supabase update; graceful local-only fallback
 *   - Auth state listener: SIGNED_IN -> re-fetch; SIGNED_OUT -> reset to seed data
 */

import { useSyncExternalStore } from "react";
import { supabase } from "../lib/supabaseClient";

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
  /** Optional - DB plots key off owner_id (auth user). Kept for AnalyticsScreen display. */
  farmer?: string;
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
  soilHealth?: { Past: number; Current: number; Prediction: number };
  irrigation: string;

  // FarmPlotScreen display fields
  ndvi?: number;
  moisture?: number;
  lastInspection?: string;
  status: "Healthy" | "Moderate" | "Needs Attention" | "Critical";
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
  boundaryMapped: boolean;      // true when geoJSON is populated
  soilReportAttached: boolean;  // set by Soil Report module
  createdAt: string;            // ISO date string
}

// ---------------------------------------------------------------------------
// Seed data -- used for logged-out / empty / error states.
// Zero visual change from earlier phases.
// ---------------------------------------------------------------------------

const SEED_PLOTS: Plot[] = [
  {
    id: "plot-1",
    name: "Swamy North Plot (Plot 2A)",
    farmer: "Swaminathan Gowda",
    crop: "Oil Palm",
    stage: "Fruit Development",
    age: 6,
    area: 12.5,
    elevation: 152,
    coordinates: [
      "17.3881 N, 78.4892 E",
      "17.3895 N, 78.4910 E",
      "17.3872 N, 78.4925 E",
      "17.3860 N, 78.4900 E",
    ],
    soil: "Loamy (Optimal)",
    soilHealth: { Past: 84, Current: 88, Prediction: 92 },
    irrigation: "Precision Drip (94%)",
    ndvi: 0.82,
    moisture: 42,
    lastInspection: "2 hours ago",
    status: "Healthy",
    statusColor: "text-emerald-600 bg-emerald-50 border border-emerald-100",
    statusDotColor: "bg-emerald-500",
    temp: "32 C",
    humidity: "62%",
    rainProb: "15%",
    windSpeed: "11 km/h",
    solarRad: "340 W/m2",
    uvIndex: "2.4",
    svgPath: "M 80 40 L 220 30 L 260 110 L 130 120 Z",
    fillGradient: "url(#healthyGrad)",
    strokeColor: "#10b981",
    glowColor: "rgba(16, 185, 129, 0.4)",
    ndviTimeline: { Past: 0.74, Current: 0.82, Prediction: 0.88 },
    moistureTimeline: { Past: 45, Current: 42, Prediction: 36 },
    yieldEst: { Past: "14.2 Tons", Current: "18.6 Tons", Prediction: "21.5 Tons" },
    confidence: 96,
    diseaseRisk: { Past: "Low", Current: "Low", Prediction: "Low" },
    diseasePct: { Past: 2, Current: 4, Prediction: 3 },
    whyDisease: "Foliar canopy vigor limits pathogen spore reproduction.",
    recommendedAction: "Apply Phosphorus Enrichment and Optimize Micro-Drip Timing",
    advisoryReason:
      "Soil Nitrogen and Potassium complexes are highly saturated; phosphorus optimizes fruit bunch sizes.",
    boundaryMapped: false,
    soilReportAttached: false,
    createdAt: "2026-01-15T00:00:00Z",
  },
  {
    id: "plot-2",
    name: "Kothagudem South Field",
    farmer: "K. Ramachandra Rao",
    crop: "Oil Palm",
    stage: "Flowering",
    age: 8,
    area: 8.2,
    elevation: 145,
    coordinates: [
      "17.3898 N, 78.4912 E",
      "17.3920 N, 78.4930 E",
      "17.3905 N, 78.4950 E",
      "17.3885 N, 78.4928 E",
    ],
    soil: "Red Clayey",
    soilHealth: { Past: 68, Current: 72, Prediction: 76 },
    irrigation: "Precision Drip",
    ndvi: 0.74,
    moisture: 38,
    lastInspection: "5 hours ago",
    status: "Moderate",
    statusColor: "text-amber-600 bg-amber-50 border border-amber-100",
    statusDotColor: "bg-lime-500",
    temp: "31 C",
    humidity: "64%",
    rainProb: "10%",
    windSpeed: "12 km/h",
    solarRad: "330 W/m2",
    uvIndex: "2.1",
    svgPath: "M 235 28 L 360 20 L 380 100 L 270 105 Z",
    fillGradient: "url(#stableGrad)",
    strokeColor: "#84cc16",
    glowColor: "rgba(132, 204, 22, 0.3)",
    ndviTimeline: { Past: 0.70, Current: 0.74, Prediction: 0.79 },
    moistureTimeline: { Past: 40, Current: 38, Prediction: 34 },
    yieldEst: { Past: "11.0 Tons", Current: "13.0 Tons", Prediction: "15.2 Tons" },
    confidence: 94,
    diseaseRisk: { Past: "Low", Current: "Low", Prediction: "Low" },
    diseasePct: { Past: 4, Current: 5, Prediction: 4 },
    whyDisease: "Clay texture holds humidity steady around trunk bases.",
    recommendedAction: "Local Nitrate supplement to sustain vegetative greening",
    advisoryReason: "Pre-empt nitrogen leeching before the wet monsoon cycle begins.",
    boundaryMapped: false,
    soilReportAttached: false,
    createdAt: "2026-01-20T00:00:00Z",
  },
  {
    id: "plot-3",
    name: "Devamma Palm Zone 1",
    farmer: "M. Devamma",
    crop: "Coconut Palm",
    stage: "Flowering",
    age: 4,
    area: 5.0,
    elevation: 160,
    coordinates: [
      "17.3855 N, 78.4902 E",
      "17.3868 N, 78.4924 E",
      "17.3848 N, 78.4935 E",
      "17.3838 N, 78.4915 E",
    ],
    soil: "Sandy Clay",
    soilHealth: { Past: 52, Current: 55, Prediction: 60 },
    irrigation: "Drip Irrigation",
    ndvi: 0.68,
    moisture: 46,
    lastInspection: "1 day ago",
    status: "Needs Attention",
    statusColor: "text-orange-600 bg-orange-50 border border-orange-100",
    statusDotColor: "bg-orange-500",
    temp: "33 C",
    humidity: "60%",
    rainProb: "18%",
    windSpeed: "9 km/h",
    solarRad: "350 W/m2",
    uvIndex: "2.8",
    svgPath: "M 140 125 L 255 118 L 285 185 L 160 190 Z",
    fillGradient: "url(#deficientGrad)",
    strokeColor: "#f59e0b",
    glowColor: "rgba(245, 158, 11, 0.3)",
    ndviTimeline: { Past: 0.62, Current: 0.68, Prediction: 0.73 },
    moistureTimeline: { Past: 48, Current: 46, Prediction: 40 },
    yieldEst: { Past: "5.5 Tons", Current: "6.5 Tons", Prediction: "7.8 Tons" },
    confidence: 89,
    diseaseRisk: { Past: "Moderate", Current: "Attention", Prediction: "Moderate" },
    diseasePct: { Past: 12, Current: 18, Prediction: 15 },
    whyDisease: "Fungal leaf spots detected in satellite spectrum profiles.",
    recommendedAction: "Schedule copper-based fungicide spray",
    advisoryReason: "NDVI reduction correlates directly to early-stage bud rot symptoms.",
    boundaryMapped: false,
    soilReportAttached: false,
    createdAt: "2026-02-01T00:00:00Z",
  },
  {
    id: "plot-4",
    name: "Swamy East Plantation",
    farmer: "Swaminathan Gowda",
    crop: "Oil Palm",
    stage: "Fruiting",
    age: 5,
    area: 7.8,
    elevation: 152,
    coordinates: [
      "17.3870 N, 78.4927 E",
      "17.3883 N, 78.4948 E",
      "17.3860 N, 78.4960 E",
      "17.3850 N, 78.4938 E",
    ],
    soil: "Loamy (Optimal)",
    soilHealth: { Past: 76, Current: 79, Prediction: 84 },
    irrigation: "Precision Drip",
    ndvi: 0.79,
    moisture: 40,
    lastInspection: "1 day ago",
    status: "Healthy",
    statusColor: "text-emerald-600 bg-emerald-50 border border-emerald-100",
    statusDotColor: "bg-emerald-500",
    temp: "32 C",
    humidity: "62%",
    rainProb: "15%",
    windSpeed: "11 km/h",
    solarRad: "340 W/m2",
    uvIndex: "2.4",
    svgPath: "M 278 112 L 390 105 L 430 180 L 290 175 Z",
    fillGradient: "url(#stableGrad)",
    strokeColor: "#84cc16",
    glowColor: "rgba(132, 204, 22, 0.3)",
    ndviTimeline: { Past: 0.75, Current: 0.79, Prediction: 0.84 },
    moistureTimeline: { Past: 42, Current: 40, Prediction: 35 },
    yieldEst: { Past: "8.5 Tons", Current: "10.2 Tons", Prediction: "12.0 Tons" },
    confidence: 93,
    diseaseRisk: { Past: "Low", Current: "Low", Prediction: "Low" },
    diseasePct: { Past: 3, Current: 4, Prediction: 3 },
    whyDisease: "Optimal spacing maximizes daylight capture and airflow.",
    recommendedAction: "Routine potassium top-up during cell division",
    advisoryReason: "Maintains optimal moisture uptake metrics across leaves.",
    boundaryMapped: false,
    soilReportAttached: false,
    createdAt: "2026-02-10T00:00:00Z",
  },
  {
    id: "plot-5",
    name: "Hassan Cocoa Plot",
    farmer: "Rajesh Kumar",
    crop: "Cocoa",
    stage: "Vegetative",
    age: 3,
    area: 6.0,
    elevation: 138,
    coordinates: [
      "17.3912 N, 78.4948 E",
      "17.3930 N, 78.4965 E",
      "17.3915 N, 78.4985 E",
      "17.3895 N, 78.4962 E",
    ],
    soil: "Sandy Loam",
    soilHealth: { Past: 42, Current: 38, Prediction: 45 },
    irrigation: "Manual Drip",
    ndvi: 0.55,
    moisture: 28,
    lastInspection: "2 days ago",
    status: "Critical",
    statusColor: "text-rose-650 bg-rose-50 border border-rose-100",
    statusDotColor: "bg-rose-500",
    temp: "30 C",
    humidity: "66%",
    rainProb: "22%",
    windSpeed: "14 km/h",
    solarRad: "310 W/m2",
    uvIndex: "1.9",
    svgPath: "M 380 20 L 470 15 L 490 85 L 395 95 Z",
    fillGradient: "url(#criticalGrad)",
    strokeColor: "#e11d48",
    glowColor: "rgba(225, 29, 72, 0.4)",
    ndviTimeline: { Past: 0.58, Current: 0.55, Prediction: 0.62 },
    moistureTimeline: { Past: 32, Current: 28, Prediction: 30 },
    yieldEst: { Past: "1.8 Tons", Current: "2.1 Tons", Prediction: "2.6 Tons" },
    confidence: 91,
    diseaseRisk: { Past: "Attention", Current: "Critical", Prediction: "Attention" },
    diseasePct: { Past: 22, Current: 38, Prediction: 25 },
    whyDisease: "Critical water stress weakens sapling vascular immunity.",
    recommendedAction: "Execute emergency moisture recovery drip",
    advisoryReason:
      "Water deficit triggers leaf drop, reducing chlorophyll conversion efficiency.",
    boundaryMapped: false,
    soilReportAttached: false,
    createdAt: "2026-02-15T00:00:00Z",
  },
];

// ---------------------------------------------------------------------------
// DB -> Frontend mapper (snake_case DB row -> camelCase Plot)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbRowToPlot(row: Record<string, any>): Plot {
  const status = (row.status as Plot["status"]) || "Healthy";
  const geoJSON: GeoJSONPolygon | undefined =
    row.boundary && typeof row.boundary === "object" ? (row.boundary as GeoJSONPolygon) : undefined;

  const coordinates: string[] =
    geoJSON?.coordinates?.[0]
      ? (geoJSON.coordinates[0] as number[][]).slice(0, 4).map(([lng, lat]) =>
          `${Math.abs(lat).toFixed(4)} ${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(4)} ${lng >= 0 ? "E" : "W"}`
        )
      : [];

  let svgPath = "M 80 40 L 220 30 L 260 110 L 130 120 Z";
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
    "Critical": "url(#criticalGrad)", "Needs Attention": "url(#deficientGrad)",
  };
  const strokeMap: Record<Plot["status"], string> = {
    "Healthy": "#10b981", "Moderate": "#84cc16", "Critical": "#e11d48", "Needs Attention": "#f59e0b",
  };
  const glowMap: Record<Plot["status"], string> = {
    "Healthy": "rgba(16, 185, 129, 0.4)", "Moderate": "rgba(132, 204, 22, 0.3)",
    "Critical": "rgba(225, 29, 72, 0.4)", "Needs Attention": "rgba(245, 158, 11, 0.3)",
  };

  return {
    id: row.id as string,
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
    irrigation: row.irrigation_type || "",
    status,
    statusColor: getStatusColor(status),
    statusDotColor: getStatusDotColor(status),
    svgPath,
    fillGradient: fillMap[status],
    strokeColor: strokeMap[status],
    glowColor: glowMap[status],
    boundaryMapped: row.boundary_mapped === true || !!geoJSON,
    soilReportAttached: row.soil_report_attached === true,
    createdAt: row.created_at as string,
  };
}

// ---------------------------------------------------------------------------
// Module-level external store (useSyncExternalStore compatible)
// ---------------------------------------------------------------------------

let _plots: Plot[] = [...SEED_PLOTS];
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
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    // Real user with zero plots: clear seed data so the empty state shows correctly
    _plots = data && data.length > 0 ? data.map(dbRowToPlot) : [];
  } catch (err) {
    console.error("[plots] fetch error:", err);
    _plots = [...SEED_PLOTS];
    _toast("Could not load your plots from the server. Showing example data.", "warning");
  } finally {
    _isLoading = false;
    _notify();
  }
}

// ---------------------------------------------------------------------------
// Auth state listener -- re-fetch on sign-in, reset on sign-out
// ---------------------------------------------------------------------------

supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_IN" && session?.user) {
    _fetchInitiated = true;
    _fetchFromDb(session.user.id);
  } else if (event === "SIGNED_OUT") {
    _fetchInitiated = false;
    _plots = [...SEED_PLOTS];
    _isLoading = false;
    _notify();
  }
});

// Also check current session on module load (handles page refresh while logged in)
supabase.auth.getSession().then(({ data }) => {
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
  const createdAt = new Date().toISOString();

  const dbRow: Record<string, unknown> = {
    name: plotInput.name,
    crop: plotInput.crop,
    area: plotInput.area,
    area_unit: "acres",
    boundary: plotInput.geoJSON ?? null,
    latitude: plotInput.geoJSON?.coordinates?.[0]?.[0]?.[1] ?? null,
    longitude: plotInput.geoJSON?.coordinates?.[0]?.[0]?.[0] ?? null,
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

  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData?.session?.user) {
    dbRow.owner_id = sessionData.session.user.id;
    const { data, error } = await supabase
      .from("plots")
      .insert(dbRow)
      .select()
      .single();

    if (!error && data) {
      const newPlot = dbRowToPlot(data as Record<string, unknown>);
      _plots = [newPlot, ..._plots];
      _notify();
      return newPlot;
    }
    // Supabase returned an error -- fall through to local-only with VISIBLE warning
    console.error("[plots] insert error:", error);
    _toast(
      "Saved locally only -- could not reach the server. This plot will not persist after refresh.",
      "warning"
    );
  }

  // Local-only fallback (no session, or insert failed)
  const nextIndex = _plots.length + 1;
  const newPlot: Plot = { ...plotInput, id: `plot-${nextIndex}`, createdAt };
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
  if (updates.geoJSON !== undefined) dbUpdates.boundary = updates.geoJSON;
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

  // Only push to DB for real UUID rows (seed plots use "plot-N" string ids)
  if (Object.keys(dbUpdates).length > 0 && !id.startsWith("plot-")) {
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
  }
}