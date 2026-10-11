import type {
  ChemicalGuidance,
  ChemicalStatus,
  ChemicalSummary,
  CropSuitabilityAssessment,
  DiseaseAssessment,
  DiseaseAssessmentRecord,
  DiseaseCandidate,
  DiseaseRisk,
  DiseaseTreatment,
  DiseaseVocabulary,
  EvidenceItem,
  ManagementStep,
  SuitabilityCandidate,
  SuitabilityCategory,
} from "./contracts";

export class ContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractError";
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function str(v: unknown, field: string): string {
  if (typeof v !== "string" || !v.trim()) throw new ContractError(`Invalid response: "${field}" must be a non-empty string.`);
  return v;
}
function optStr(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}
function strList(v: unknown, field: string): string[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) throw new ContractError(`Invalid response: "${field}" must be a list of strings.`);
  return v as string[];
}
function evidence(v: unknown, field: string): EvidenceItem[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) throw new ContractError(`Invalid response: "${field}" must be a list.`);
  return v.map((e, i) => {
    if (!isObj(e)) throw new ContractError(`Invalid response: "${field}[${i}]" must be an object.`);
    const out: EvidenceItem = { description: str(e.description, `${field}[${i}].description`), source: str(e.source, `${field}[${i}].source`) };
    if (typeof e.url === "string") {
      if (!/^https:\/\//.test(e.url)) throw new ContractError(`Invalid response: "${field}[${i}].url" must be an https URL.`);
      out.url = e.url;
    }
    if (typeof e.page === "number") out.page = e.page;
    if (typeof e.quote === "string") out.quote = e.quote;
    if (typeof e.evidence_id === "string") out.evidence_id = e.evidence_id;
    return out;
  });
}

const RISKS: DiseaseRisk[] = ["low", "moderate", "high", "insufficient_evidence"];
const CATEGORIES: SuitabilityCategory[] = ["suitable", "partial", "unsuitable", "insufficient_information"];
const CHEMICAL_STATUSES: ChemicalStatus[] = ["label_verified", "institutional_recommendation", "verification_required"];
const CHEMICAL_SUMMARIES: ChemicalSummary[] = ["not_applicable", "verification_required", "institutional_recommendation_only", "verified_available"];

function parseChemical(c: unknown, field: string): ChemicalGuidance {
  if (!isObj(c)) throw new ContractError(`Invalid response: "${field}" must be an object.`);
  if (!CHEMICAL_STATUSES.includes(c.status as ChemicalStatus)) throw new ContractError(`Invalid response: ${field}.status is unknown.`);
  if (typeof c.actionable !== "boolean") throw new ContractError(`Invalid response: ${field}.actionable must be a boolean.`);
  // Only a label-verified product may ever be actionable; refuse anything else rather than display a dose-like claim.
  if (c.actionable && c.status !== "label_verified") throw new ContractError(`Invalid response: ${field} is actionable without a verified label.`);
  return {
    product_id: str(c.product_id, `${field}.product_id`),
    product_name: str(c.product_name, `${field}.product_name`),
    active_ingredient: str(c.active_ingredient, `${field}.active_ingredient`),
    status: c.status as ChemicalStatus,
    actionable: c.actionable,
    reported_recommendation: typeof c.reported_recommendation === "string" ? c.reported_recommendation : null,
    message: str(c.message, `${field}.message`),
    evidence: evidence(c.evidence, `${field}.evidence`),
  };
}

function parseTreatment(t: unknown, field: string): DiseaseTreatment {
  if (!isObj(t)) throw new ContractError(`Invalid response: "${field}" must be an object.`);
  if (!CHEMICAL_SUMMARIES.includes(t.chemical_status as ChemicalSummary)) throw new ContractError(`Invalid response: ${field}.chemical_status is unknown.`);
  const stepsRaw = t.steps ?? [];
  if (!Array.isArray(stepsRaw)) throw new ContractError(`Invalid response: "${field}.steps" must be a list.`);
  const steps: ManagementStep[] = stepsRaw.map((st, i) => {
    if (!isObj(st)) throw new ContractError(`Invalid response: "${field}.steps[${i}]" must be an object.`);
    return { id: str(st.id, `${field}.steps[${i}].id`), category: str(st.category, `${field}.steps[${i}].category`), text: str(st.text, `${field}.steps[${i}].text`), evidence: evidence(st.evidence, `${field}.steps[${i}].evidence`) };
  });
  const chemRaw = t.chemical_management ?? [];
  if (!Array.isArray(chemRaw)) throw new ContractError(`Invalid response: "${field}.chemical_management" must be a list.`);
  const chemical_management = chemRaw.map((c, i) => parseChemical(c, `${field}.chemical_management[${i}]`));
  // The summary must agree with the items, so the UI can never show "verified" for unverified products.
  const anyActionable = chemical_management.some((c) => c.actionable);
  if ((t.chemical_status === "verified_available") !== anyActionable) throw new ContractError(`Invalid response: ${field}.chemical_status disagrees with its products.`);
  return {
    disease_id: str(t.disease_id, `${field}.disease_id`),
    rule_version: str(t.rule_version, `${field}.rule_version`),
    steps,
    chemical_status: t.chemical_status as ChemicalSummary,
    chemical_management,
    referral: str(t.referral, `${field}.referral`),
  };
}

export function parseDiseaseAssessment(raw: unknown): DiseaseAssessment {
  if (!isObj(raw)) throw new ContractError("Invalid response: expected an object.");
  const risk = raw.risk_level;
  if (!RISKS.includes(risk as DiseaseRisk)) throw new ContractError("Invalid response: unknown risk_level.");
  const candidatesRaw = raw.candidates ?? [];
  if (!Array.isArray(candidatesRaw)) throw new ContractError('Invalid response: "candidates" must be a list.');
  const candidates: DiseaseCandidate[] = candidatesRaw.map((c, i) => {
    if (!isObj(c)) throw new ContractError(`Invalid response: "candidates[${i}]" must be an object.`);
    if (c.is_confirmed_diagnosis === true) throw new ContractError(`Invalid response: candidates[${i}] claims a confirmed diagnosis.`);
    const cand: DiseaseCandidate = {
      disease_name: str(c.disease_name, `candidates[${i}].disease_name`),
      contributing_factors: strList(c.contributing_factors, `candidates[${i}].contributing_factors`),
      evidence: evidence(c.evidence, `candidates[${i}].evidence`),
      management: strList(c.management, `candidates[${i}].management`),
      precautions: strList(c.precautions, `candidates[${i}].precautions`),
    };
    if (c.disease_id !== undefined) cand.disease_id = str(c.disease_id, `candidates[${i}].disease_id`);
    if (typeof c.rank === "number") cand.rank = c.rank;
    if (c.scientific_names !== undefined) cand.scientific_names = strList(c.scientific_names, `candidates[${i}].scientific_names`);
    if (c.risk_level !== undefined) {
      if (!RISKS.includes(c.risk_level as DiseaseRisk)) throw new ContractError(`Invalid response: candidates[${i}].risk_level is unknown.`);
      cand.risk_level = c.risk_level as DiseaseRisk;
    }
    if (c.matched_symptoms !== undefined) cand.matched_symptoms = strList(c.matched_symptoms, `candidates[${i}].matched_symptoms`);
    if (c.supportive_conditions !== undefined) cand.supportive_conditions = strList(c.supportive_conditions, `candidates[${i}].supportive_conditions`);
    if (c.contradicting_observations !== undefined) cand.contradicting_observations = strList(c.contradicting_observations, `candidates[${i}].contradicting_observations`);
    cand.region_note = typeof c.region_note === "string" ? c.region_note : null;
    cand.treatment = c.treatment ? parseTreatment(c.treatment, `candidates[${i}].treatment`) : null;
    return cand;
  });
  const out: DiseaseAssessment = {
    plot_id: str(raw.plot_id, "plot_id"),
    crop: str(raw.crop, "crop"),
    risk_level: risk as DiseaseRisk,
    candidates,
    limitations: strList(raw.limitations, "limitations"),
    missing_inputs: strList(raw.missing_inputs, "missing_inputs"),
    assessed_at: str(raw.assessed_at, "assessed_at"),
    assessment_id: typeof raw.assessment_id === "string" ? raw.assessment_id : null,
    risk_explanation: optStr(raw.risk_explanation),
    inputs_used: strList(raw.inputs_used, "inputs_used"),
    inputs_not_used: strList(raw.inputs_not_used, "inputs_not_used"),
    follow_up_questions: strList(raw.follow_up_questions, "follow_up_questions"),
    next_steps: strList(raw.next_steps, "next_steps"),
    kb_version: optStr(raw.kb_version),
    rule_version: optStr(raw.rule_version),
    expert_review_status: optStr(raw.expert_review_status),
    disclaimer: optStr(raw.disclaimer),
  };
  if (isObj(raw.observed)) {
    const o = raw.observed;
    out.observed = {
      symptoms: Array.isArray(o.symptoms) ? o.symptoms.filter(isObj).map((x) => ({ code: String(x.code), label: String(x.label) })) : [],
      crop_stage: typeof o.crop_stage === "string" ? o.crop_stage : null,
      affected_parts: Array.isArray(o.affected_parts) ? o.affected_parts.map(String) : [],
      field_conditions: isObj(o.field_conditions) ? (Object.fromEntries(Object.entries(o.field_conditions).map(([k, v]) => [k, String(v)])) as Record<string, string>) : {},
      plot_state: typeof o.plot_state === "string" ? o.plot_state : null,
    };
  }
  return out;
}

export function parseDiseaseVocabulary(raw: unknown): DiseaseVocabulary {
  if (!isObj(raw)) throw new ContractError("Invalid response: expected an object.");
  const items = (v: unknown, field: string) => {
    if (!Array.isArray(v)) throw new ContractError(`Invalid response: "${field}" must be a list.`);
    return v.map((x, i) => {
      if (!isObj(x)) throw new ContractError(`Invalid response: "${field}[${i}]" must be an object.`);
      return { code: str(x.code, `${field}[${i}].code`), label_en: str(x.label_en, `${field}[${i}].label_en`), part: typeof x.part === "string" ? x.part : null };
    });
  };
  const plain = (v: unknown, field: string) => items(v, field).map(({ code, label_en }) => ({ code, label_en }));
  return {
    version: str(raw.version, "version"),
    kb_version: str(raw.kb_version, "kb_version"),
    rule_version: str(raw.rule_version, "rule_version"),
    crops: strList(raw.crops, "crops"),
    crops_with_verified_knowledge: strList(raw.crops_with_verified_knowledge, "crops_with_verified_knowledge"),
    parts: plain(raw.parts, "parts"),
    stages: plain(raw.stages, "stages"),
    symptoms: items(raw.symptoms, "symptoms"),
    conditions: plain(raw.conditions, "conditions"),
  };
}

export function parseDiseaseAssessmentRecord(raw: unknown): DiseaseAssessmentRecord {
  if (!isObj(raw)) throw new ContractError("Invalid response: expected an object.");
  if (!RISKS.includes(raw.risk_level as DiseaseRisk)) throw new ContractError("Invalid response: unknown risk_level.");
  return {
    id: str(raw.id, "id"),
    plot_id: str(raw.plot_id, "plot_id"),
    crop: str(raw.crop, "crop"),
    risk_level: raw.risk_level as DiseaseRisk,
    top_disease: typeof raw.top_disease === "string" ? raw.top_disease : null,
    kb_version: str(raw.kb_version, "kb_version"),
    rule_version: str(raw.rule_version, "rule_version"),
    created_at: str(raw.created_at, "created_at"),
    result: raw.result ? parseDiseaseAssessment(raw.result) : null,
  };
}

export function parseCropSuitability(raw: unknown): CropSuitabilityAssessment {
  if (!isObj(raw)) throw new ContractError("Invalid response: expected an object.");
  const rankedRaw = raw.ranked ?? [];
  if (!Array.isArray(rankedRaw)) throw new ContractError('Invalid response: "ranked" must be a list.');
  const ranked: SuitabilityCandidate[] = rankedRaw.map((c, i) => {
    if (!isObj(c)) throw new ContractError(`Invalid response: "ranked[${i}]" must be an object.`);
    if (!CATEGORIES.includes(c.category as SuitabilityCategory)) throw new ContractError(`Invalid response: ranked[${i}].category is unknown.`);
    const score = c.score;
    if (score !== undefined && score !== null && (typeof score !== "number" || !Number.isFinite(score))) {
      throw new ContractError(`Invalid response: ranked[${i}].score must be a number.`);
    }
    return {
      crop: str(c.crop, `ranked[${i}].crop`),
      category: c.category as SuitabilityCategory,
      score: typeof score === "number" ? score : null,
      reasons: strList(c.reasons, `ranked[${i}].reasons`),
      limitations: strList(c.limitations, `ranked[${i}].limitations`),
      water_requirement: typeof c.water_requirement === "string" && c.water_requirement ? c.water_requirement : null,
      evidence: evidence(c.evidence, `ranked[${i}].evidence`),
    };
  });
  return {
    plot_id: str(raw.plot_id, "plot_id"),
    ranked,
    missing_inputs: strList(raw.missing_inputs, "missing_inputs"),
    assessed_at: str(raw.assessed_at, "assessed_at"),
  };
}
