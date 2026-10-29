import { supabase } from "./supabaseClient";

// VITE_API_BASE_URL selects the FastAPI backend. Local development falls back to
// http://localhost:8000; a production build with no value uses same-origin
// relative URLs (e.g. behind a reverse proxy) instead of silently pointing at localhost.
const configuredApiBase = ((import.meta.env?.VITE_API_BASE_URL as string | undefined) ?? "").trim().replace(/\/+$/, "");
const API_BASE_URL = configuredApiBase || (import.meta.env?.DEV ? "http://localhost:8000" : "");

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

async function getHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
}

/** An API error whose `detail` may be structured (e.g. {code, problems}). */
export class ApiError extends Error {
  status: number;
  code: string | null;
  problems: Record<string, string> | null;
  constructor(status: number, detail: unknown, fallback: string) {
    const d = detail as { code?: string; message?: string; problems?: Record<string, string> } | string | null;
    const message =
      typeof d === "string" ? d : d && typeof d === "object" && d.message ? d.message : fallback;
    super(message);
    this.status = status;
    this.code = d && typeof d === "object" && typeof d.code === "string" ? d.code : null;
    this.problems = d && typeof d === "object" && d.problems ? d.problems : null;
  }
}

async function failFrom(response: Response, fallback: string): Promise<never> {
  const body = await response.json().catch(() => null);
  throw new ApiError(response.status, body?.detail ?? null, fallback || `Server error: ${response.status}`);
}

/** Authenticated request to the FastAPI backend (same token handling as every other call in this file). */
export async function authenticatedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = await getHeaders();
  return fetch(`${API_BASE_URL}${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) } });
}

export interface RecommendationRequestPayload {
  plot_id: string;
  soil_report_id: string;
  crop_price_per_ton_inr?: number;
  fertilizer_price_overrides?: Record<string, number>;
}

export interface RecommendationProvenancePayload {
  crop: string;
  area_ha: number;
  soil_report_id: string;
  soil_verification_status: string;
  soil_values_used: Record<string, number>;
  rule: {
    crop: string;
    rule_version: string;
    source: { id: string; title: string; publisher: string; year: number | string; locator: string; quote: string; url?: string };
    reviewed_by: string;
    reviewed_on: string;
  };
  assumptions: string[];
  not_considered: string[];
  /** Published-schedule rules only: how the per-palm doses became product quantities. */
  schedule?: PublishedScheduleDetail | null;
}

/** Palm-age schedule arithmetic behind a published-schedule recommendation (nothing here is estimated). */
export interface PublishedScheduleDetail {
  age_year: number;
  planting_date: string | null;
  plant_count: number;
  palms_per_ha: number;
  /** Grams per palm per year exactly as the cited table states them. */
  per_palm_g_per_year: { n: number; p: number; k: number };
  /** Basis the source states P and K in ("oxide" = P2O5 / K2O). */
  nutrient_basis: { n: string; p: string; k: string };
  products_g_per_palm_per_year: Record<string, number>;
  timing_note: string | null;
}

/** A generated recommendation (advice only -- never a record of fertilizer applied). */
export interface RecommendationResponsePayload {
  state: "generated";
  recommendation_id?: string;
  plot_id: string;
  soil_report_id: string;
  crop: string;
  status: string;
  created_at?: string;
  engine_version: string;
  generated_at: string;
  provenance: RecommendationProvenancePayload;
  /** Empty for published-schedule rules (no soil-test comparison is made). */
  findings: Array<{
    nutrient: string;
    display_name: string;
    soil_value_kg_ha: number;
    target_kg_ha: number;
    status: string;
    deficit_kg_ha: number;
    percent_of_target: number;
  }>;
  ph_in_range: boolean | null;
  organic_carbon_in_range: boolean | null;
  overall_severity: string | null;
  fertilizer_plan: Array<{
    nutrient: string;
    product_code: string;
    product_display_name: string;
    quantity_kg_per_ha: number;
    quantity_kg_total: number;
    /** Basis the P/K deficit was expressed in when the product quantity was computed (elemental or oxide). */
    nutrient_basis?: string;
    /** Only present for products the caller priced. */
    estimated_cost_inr: number | null;
  }>;
  /** Present only when the cited rule also supports a yield model. */
  yield_prediction: {
    optimal_yield_t_ha: number;
    current_yield_t_ha: number;
    expected_yield_t_ha: number;
    additional_yield_t_ha: number;
    ph_limiting: boolean;
    organic_carbon_limiting: boolean;
  } | null;
  roi: {
    fertilizer_cost: number;
    current_yield_total_t: number;
    expected_yield_total_t: number;
    expected_additional_yield_t: number;
    crop_price_per_ton_inr: number;
    expected_additional_revenue: number;
    estimated_profit: number;
    roi_percentage: number | null;
  } | null;
  explanation: {
    summary: string;
    identified_issues: string[];
    recommended_actions: string[];
    expected_benefit: string | null;
    warnings: string[];
  };
}

/** The engine declined to give a recommendation. Nothing was saved. */
export interface InsufficientDataPayload {
  state: "insufficient_data";
  plot_id: string;
  soil_report_id: string;
  crop: string | null;
  engine_version: string;
  generated_at: string;
  reasons: Array<{
    code:
      | "crop_not_set"
      | "unsupported_crop"
      | "no_verified_rule"
      | "state_not_recorded"
      | "region_not_covered"
      | "plant_count_missing"
      | "planting_date_missing"
      | "planting_date_in_future"
      | "age_outside_schedule";
    message: string;
  }>;
  required: string[];
}

export type RecommendationOutcome = RecommendationResponsePayload | InsufficientDataPayload;

export interface RecommendationRecord {
  id: string;
  owner_id: string;
  plot_id: string;
  soil_report_id: string;
  crop: string;
  status: string;
  created_at: string;
  updated_at: string;
  deficiencies: any;
  fertilizer_plan: any;
  yield_prediction: any;
  roi: any;
  explanation: any;
  engine_version?: string | null;
  generated_at?: string | null;
  provenance?: RecommendationProvenancePayload | null;
}

export interface OcrExtractedField {
  parameter: string;
  raw_label: string | null;
  value: number | string | null;
  unit: string | null;
  confidence: number;
  validation: "valid" | "review" | "missing" | "unusable";
  warnings: string[];
  /** Where the value came from in the document. */
  extracted_text?: string | null;
  source_text?: string | null;
  page?: number | null;
  unit_source?: "stated" | "assumed_default" | "not_applicable" | null;
  normalizations?: string[];
}

export type ExtractionStatus = "failed" | "needs_review" | "completed";

export interface SoilReportUploadResponsePayload {
  success: boolean;
  status: ExtractionStatus;
  /** True once a verified soil report exists. */
  persisted: boolean;
  reused: boolean;
  extraction_id: string | null;
  soil_report_id: string | null;
  verification_status: "auto_validated" | "user_confirmed" | "user_corrected" | null;
  plot_id: string;
  raw_text: string;
  nitrogen: OcrExtractedField;
  phosphorus: OcrExtractedField;
  potassium: OcrExtractedField;
  ph: OcrExtractedField;
  electrical_conductivity: OcrExtractedField;
  organic_carbon: OcrExtractedField;
  extras: OcrExtractedField[];
  micronutrients: OcrExtractedField[];
  /** Required parameters that still need a decision. */
  review_required: string[];
  not_saved: string[];
  corrections: Array<Record<string, unknown>>;
  pipeline_version: string | null;
  page_count: number;
  warnings: string[];
}

export interface ConfirmExtractionPayload {
  corrections: Record<string, { value: number; unit: string | null; reason?: string }>;
  confirmed: string[];
}

/**
 * Upload a real soil-test lab report (PDF/JPG/PNG) for OCR + structured
 * extraction. If every required parameter is extracted with high enough
 * confidence, the backend persists a new soil_reports row and returns its
 * id; otherwise `persisted` is false and the extracted fields (with
 * per-field confidence/validation/warnings) are returned for review.
 */
export async function uploadSoilReport(
  plotId: string,
  file: File
): Promise<SoilReportUploadResponsePayload> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  // Do NOT set Content-Type here -- the browser must set the multipart
  // boundary itself.

  const formData = new FormData();
  formData.append("plot_id", plotId);
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/soil-reports/upload`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) return failFrom(response, "Failed to process soil report");

  return response.json();
}

/** The owner's confirmations/corrections for an extraction awaiting review. */
export async function confirmExtraction(
  extractionId: string,
  payload: ConfirmExtractionPayload
): Promise<SoilReportUploadResponsePayload> {
  const response = await authenticatedFetch(`/api/soil-reports/extractions/${encodeURIComponent(extractionId)}/confirm`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!response.ok) return failFrom(response, "Could not confirm the soil report");
  return response.json();
}

/** Stored extractions for a plot (newest first) -- lets a pending review survive a page refresh. */
export async function listExtractions(plotId: string): Promise<SoilReportUploadResponsePayload[]> {
  const response = await authenticatedFetch(`/api/soil-reports/extractions?plot_id=${encodeURIComponent(plotId)}`);
  if (!response.ok) return failFrom(response, "Could not load soil report extractions");
  return response.json();
}

/**
 * Generate a new AI Recommendation from plot and soil report details.
 */
export async function createRecommendation(payload: RecommendationRequestPayload): Promise<RecommendationOutcome> {
  const headers = await getHeaders();
  const response = await fetch(`${API_BASE_URL}/api/recommendations`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) return failFrom(response, "Failed to generate recommendation");

  return response.json();
}

/**
 * List past recommendation records belonging to the authenticated caller.
 */
export async function listRecommendations(): Promise<RecommendationRecord[]> {
  const headers = await getHeaders();
  const response = await fetch(`${API_BASE_URL}/api/recommendations`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({ detail: "Failed to fetch recommendation list" }));
    throw new Error(errBody.detail || `Server error: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch a single recommendation record by ID.
 */
export async function getRecommendation(id: string): Promise<RecommendationRecord> {
  const headers = await getHeaders();
  const response = await fetch(`${API_BASE_URL}/api/recommendations/${id}`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({ detail: "Failed to retrieve recommendation" }));
    throw new Error(errBody.detail || `Server error: ${response.status}`);
  }

  return response.json();
}

/**
 * Sentinel-2 NDVI for the caller's plot. `available: false` is a normal,
 * expected response (not an error) when the backend Sentinel Hub
 * credentials are not configured for this deployment -- the UI should show
 * a "configuration required" state rather than treating it as a failure.
 */
export interface NdviResponsePayload {
  plot_id: string;
  available: boolean;
  mean_ndvi: number | null;
  min_ndvi: number | null;
  max_ndvi: number | null;
  acquisition_date: string | null;
  cloud_cover_percent: number | null;
  status: "Healthy" | "Moderate" | "Stressed" | null;
  source: string;
  reason: string | null;
}

export async function getPlotNdvi(plotId: string): Promise<NdviResponsePayload> {
  const headers = await getHeaders();
  const response = await fetch(`${API_BASE_URL}/api/geospatial/ndvi/${encodeURIComponent(plotId)}`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({ detail: "Failed to fetch NDVI" }));
    throw new Error(errBody.detail || `Server error: ${response.status}`);
  }

  return response.json();
}

/**
 * Karnataka Bhu-Naksha cadastral parcel lookup. Ships disabled/unavailable
 * by default (see app/services/cadastral_service.py).
 */
export interface CadastralResponsePayload {
  plot_id: string;
  available: boolean;
  parcel_reference: string | null;
  geometry: Record<string, any> | null;
  source: string;
  reason: string | null;
}

export async function getPlotCadastral(plotId: string): Promise<CadastralResponsePayload> {
  const headers = await getHeaders();
  const response = await fetch(`${API_BASE_URL}/api/geospatial/bhunaksha/${encodeURIComponent(plotId)}`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({ detail: "Failed to fetch cadastral data" }));
    throw new Error(errBody.detail || `Server error: ${response.status}`);
  }

  return response.json();
}

/**
 * Digital Twin prediction (NDVI trend & projection) for the caller's plot.
 */
export interface TwinPredictionResponsePayload {
  plot_id: string;
  target_date: string;
  predicted_ndvi: number | null;
  trend_direction: "up" | "down" | "flat" | "insufficient_data";
  is_projection: boolean;
}

export async function getPlotTwinPrediction(plotId: string): Promise<TwinPredictionResponsePayload> {
  const headers = await getHeaders();
  const response = await fetch(`${API_BASE_URL}/api/plots/${encodeURIComponent(plotId)}/twin/prediction`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({ detail: "Failed to fetch twin prediction" }));
    throw new Error(errBody.detail || `Server error: ${response.status}`);
  }

  return response.json();
}


