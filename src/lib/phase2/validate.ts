import type {
  CropSuitabilityAssessment,
  DiseaseAssessment,
  DiseaseCandidate,
  DiseaseRisk,
  EvidenceItem,
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
    return { description: str(e.description, `${field}[${i}].description`), source: str(e.source, `${field}[${i}].source`) };
  });
}

const RISKS: DiseaseRisk[] = ["low", "moderate", "high", "insufficient_evidence"];
const CATEGORIES: SuitabilityCategory[] = ["suitable", "partial", "unsuitable", "insufficient_information"];

export function parseDiseaseAssessment(raw: unknown): DiseaseAssessment {
  if (!isObj(raw)) throw new ContractError("Invalid response: expected an object.");
  const risk = raw.risk_level;
  if (!RISKS.includes(risk as DiseaseRisk)) throw new ContractError("Invalid response: unknown risk_level.");
  const candidatesRaw = raw.candidates ?? [];
  if (!Array.isArray(candidatesRaw)) throw new ContractError('Invalid response: "candidates" must be a list.');
  const candidates: DiseaseCandidate[] = candidatesRaw.map((c, i) => {
    if (!isObj(c)) throw new ContractError(`Invalid response: "candidates[${i}]" must be an object.`);
    return {
      disease_name: str(c.disease_name, `candidates[${i}].disease_name`),
      contributing_factors: strList(c.contributing_factors, `candidates[${i}].contributing_factors`),
      evidence: evidence(c.evidence, `candidates[${i}].evidence`),
      management: strList(c.management, `candidates[${i}].management`),
      precautions: strList(c.precautions, `candidates[${i}].precautions`),
    };
  });
  return {
    plot_id: str(raw.plot_id, "plot_id"),
    crop: str(raw.crop, "crop"),
    risk_level: risk as DiseaseRisk,
    candidates,
    limitations: strList(raw.limitations, "limitations"),
    missing_inputs: strList(raw.missing_inputs, "missing_inputs"),
    assessed_at: str(raw.assessed_at, "assessed_at"),
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
