import { supabase } from "./supabaseClient";

const API_BASE_URL = "http://localhost:8000";

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

export interface RecommendationRequestPayload {
  plot_id: string;
  soil_report_id: string;
  crop_price_per_ton_inr?: number;
  fertilizer_price_overrides?: Record<string, number>;
}

export interface RecommendationResponsePayload {
  recommendation_id?: string;
  plot_id: string;
  soil_report_id: string;
  crop: string;
  status: string;
  created_at?: string;
  findings: Array<{
    nutrient: string;
    display_name: string;
    soil_value_kg_ha: number;
    target_kg_ha: number;
    status: string;
    deficit_kg_ha: number;
    percent_of_target: number;
  }>;
  ph_in_range: boolean;
  organic_carbon_in_range: boolean;
  overall_severity: string;
  fertilizer_plan: Array<{
    nutrient: string;
    product_code: string;
    product_display_name: string;
    quantity_kg_per_ha: number;
    quantity_kg_total: number;
    estimated_cost_inr: number;
  }>;
  yield_prediction: {
    optimal_yield_t_ha: number;
    current_yield_t_ha: number;
    expected_yield_t_ha: number;
    additional_yield_t_ha: number;
    ph_limiting: boolean;
    organic_carbon_limiting: boolean;
  };
  roi: {
    fertilizer_cost: number;
    current_yield_total_t: number;
    expected_yield_total_t: number;
    expected_additional_yield_t: number;
    crop_price_per_ton_inr: number;
    expected_additional_revenue: number;
    estimated_profit: number;
    roi_percentage: number | null;
  };
  explanation: {
    summary: string;
    identified_issues: string[];
    recommended_actions: string[];
    expected_benefit: string;
    warnings: string[];
  };
}

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
}

export interface OcrExtractedField {
  parameter: string;
  raw_label: string | null;
  value: number | null;
  unit: string | null;
  confidence: number;
  validation: "valid" | "review" | "missing" | "unusable";
  warnings: string[];
}

export interface SoilReportUploadResponsePayload {
  success: boolean;
  persisted: boolean;
  soil_report_id: string | null;
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
  warnings: string[];
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

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({ detail: "Failed to process soil report" }));
    throw new Error(errBody.detail || `Server error: ${response.status}`);
  }

  return response.json();
}

/**
 * Generate a new AI Recommendation from plot and soil report details.
 */
export async function createRecommendation(payload: RecommendationRequestPayload): Promise<RecommendationResponsePayload> {
  const headers = await getHeaders();
  const response = await fetch(`${API_BASE_URL}/api/recommendations`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({ detail: "Failed to generate recommendation" }));
    throw new Error(errBody.detail || `Server error: ${response.status}`);
  }

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


