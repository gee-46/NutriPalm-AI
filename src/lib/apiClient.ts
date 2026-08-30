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
