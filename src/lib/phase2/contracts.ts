/**
 * Phase 2 API contracts the frontend is built against.
 *
 * STATUS: the backend does NOT implement these two endpoints yet (see docs/PHASE2_FRONTEND_STATUS.md).
 * They are the *proposed* contract. The UI never assumes they exist: `probeBackendCapabilities`
 * (capabilities.ts) reads the backend's own OpenAPI document and only enables a module when its
 * path is really published there. Responses are validated field by field before they are shown;
 * anything that does not match is treated as an error, never displayed.
 */

export const DISEASE_ASSESS_PATH = "/api/disease/assess";
export const CROP_SUITABILITY_PATH = "/api/crop-suitability/assess";

export type DiseaseRisk = "low" | "moderate" | "high" | "insufficient_evidence";
export type SuitabilityCategory = "suitable" | "partial" | "unsuitable" | "insufficient_information";

export interface EvidenceItem {
  description: string;
  source: string;
}

export interface DiseaseAssessmentRequest {
  plot_id: string;
  crop: string;
  crop_stage?: string;
  symptoms?: string[];
  affected_parts?: string[];
  observations?: string;
}

export interface DiseaseCandidate {
  disease_name: string;
  contributing_factors: string[];
  evidence: EvidenceItem[];
  management: string[];
  precautions: string[];
}

export interface DiseaseAssessment {
  plot_id: string;
  crop: string;
  risk_level: DiseaseRisk;
  candidates: DiseaseCandidate[];
  limitations: string[];
  missing_inputs: string[];
  assessed_at: string;
}

export interface CropSuitabilityRequest {
  plot_id: string;
  soil_report_id?: string;
}

export interface SuitabilityCandidate {
  crop: string;
  category: SuitabilityCategory;
  /** Only displayed when the backend sends it; the frontend never computes a score. */
  score: number | null;
  reasons: string[];
  limitations: string[];
  water_requirement: string | null;
  evidence: EvidenceItem[];
}

export interface CropSuitabilityAssessment {
  plot_id: string;
  ranked: SuitabilityCandidate[];
  missing_inputs: string[];
  assessed_at: string;
}
