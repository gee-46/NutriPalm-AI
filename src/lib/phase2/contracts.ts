/**
 * Phase 2 API contracts the frontend is built against.
 *
 * STATUS
 *   - Disease: IMPLEMENTED by the backend (backend/app/routers/disease.py; see docs/DISEASE_INTELLIGENCE.md).
 *   - Crop suitability: still only a PROPOSED contract; the backend does not implement it yet.
 * The UI never assumes a module exists: `probeBackendCapabilities` (capabilities.ts) reads the backend's own
 * OpenAPI document and only enables a module when its path is really published there. Responses are
 * validated field by field before they are shown; anything that does not match is treated as an error,
 * never displayed.
 */

export const DISEASE_ASSESS_PATH = "/api/disease/assess";
export const DISEASE_VOCAB_PATH = "/api/disease/vocabulary";
export const DISEASE_HISTORY_PATH = "/api/disease/assessments";
export const CROP_SUITABILITY_PATH = "/api/crop-suitability/assess";

export type DiseaseRisk = "low" | "moderate" | "high" | "insufficient_evidence";
export type SuitabilityCategory = "suitable" | "partial" | "unsuitable" | "insufficient_information";

export interface EvidenceItem {
  description: string;
  source: string;
  /** Present for disease evidence: a stable reference to the cited document. */
  evidence_id?: string;
  url?: string;
  page?: number;
  quote?: string;
}

export type TriState = "yes" | "no" | "unknown";
export type ChemicalStatus = "label_verified" | "institutional_recommendation" | "verification_required";
export type ChemicalSummary = "not_applicable" | "verification_required" | "institutional_recommendation_only" | "verified_available";

export interface DiseaseAssessmentRequest {
  plot_id: string;
  crop: string;
  crop_stage?: string;
  symptom_codes?: string[];
  /** Free text; the backend matches it literally against the symptom vocabulary. */
  symptoms?: string[];
  affected_parts?: string[];
  observations?: string;
  observation_date?: string;
  severity?: "mild" | "moderate" | "severe";
  duration_days?: number;
  context?: Record<string, TriState>;
  weather?: { source?: string; temperature_c?: number; humidity_pct?: number; rainfall_mm_24h?: number; rainfall_mm_7d?: number };
}

export interface ManagementStep {
  id: string;
  category: string;
  text: string;
  evidence: EvidenceItem[];
}

export interface ChemicalGuidance {
  product_id: string;
  product_name: string;
  active_ingredient: string;
  status: ChemicalStatus;
  /** True only for a label-verified product for this crop and disease. */
  actionable: boolean;
  /** Text reproduced from the cited institute; never a NutriPalm calculation. */
  reported_recommendation: string | null;
  message: string;
  evidence: EvidenceItem[];
}

export interface DiseaseTreatment {
  disease_id: string;
  rule_version: string;
  steps: ManagementStep[];
  chemical_status: ChemicalSummary;
  chemical_management: ChemicalGuidance[];
  referral: string;
}

export interface DiseaseCandidate {
  disease_name: string;
  contributing_factors: string[];
  evidence: EvidenceItem[];
  management: string[];
  precautions: string[];
  // --- present when produced by the NutriPalm backend ---
  disease_id?: string;
  rank?: number;
  scientific_names?: string[];
  risk_level?: DiseaseRisk;
  matched_symptoms?: string[];
  supportive_conditions?: string[];
  contradicting_observations?: string[];
  region_note?: string | null;
  treatment?: DiseaseTreatment | null;
}

export interface DiseaseAssessment {
  plot_id: string;
  crop: string;
  risk_level: DiseaseRisk;
  candidates: DiseaseCandidate[];
  limitations: string[];
  missing_inputs: string[];
  assessed_at: string;
  // --- present when produced by the NutriPalm backend ---
  assessment_id?: string | null;
  risk_explanation?: string;
  inputs_used?: string[];
  inputs_not_used?: string[];
  follow_up_questions?: string[];
  next_steps?: string[];
  kb_version?: string;
  rule_version?: string;
  expert_review_status?: string;
  disclaimer?: string;
  observed?: { symptoms?: Array<{ code: string; label: string }>; crop_stage?: string | null; affected_parts?: string[]; field_conditions?: Record<string, string>; plot_state?: string | null };
}

export interface DiseaseVocabulary {
  version: string;
  kb_version: string;
  rule_version: string;
  crops: string[];
  crops_with_verified_knowledge: string[];
  parts: Array<{ code: string; label_en: string }>;
  stages: Array<{ code: string; label_en: string }>;
  symptoms: Array<{ code: string; label_en: string; part: string | null }>;
  conditions: Array<{ code: string; label_en: string }>;
}

export interface DiseaseAssessmentRecord {
  id: string;
  plot_id: string;
  crop: string;
  risk_level: DiseaseRisk;
  top_disease: string | null;
  kb_version: string;
  rule_version: string;
  created_at: string;
  result: DiseaseAssessment | null;
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
