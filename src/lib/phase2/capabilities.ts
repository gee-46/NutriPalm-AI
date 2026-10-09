import { authenticatedFetch, getApiBaseUrl } from "../apiClient";
import {
  CROP_SUITABILITY_PATH,
  DISEASE_ASSESS_PATH,
  type CropSuitabilityAssessment,
  type CropSuitabilityRequest,
  type DiseaseAssessment,
  type DiseaseAssessmentRequest,
} from "./contracts";
import { parseCropSuitability, parseDiseaseAssessment } from "./validate";

export type ModuleAvailability = "checking" | "available" | "unavailable";

export interface BackendCapabilities {
  disease: ModuleAvailability;
  cropSuitability: ModuleAvailability;
}

export class ModuleUnavailableError extends Error {
  constructor(module: string) {
    super(`The ${module} service is not available on this backend.`);
    this.name = "ModuleUnavailableError";
  }
}

/** Pure: which Phase 2 endpoints does this OpenAPI document actually publish (as POST)? */
export function capabilitiesFromOpenApi(doc: unknown): BackendCapabilities {
  const paths = (doc as { paths?: Record<string, Record<string, unknown>> } | null)?.paths ?? {};
  const has = (p: string) => !!paths[p] && "post" in paths[p];
  return {
    disease: has(DISEASE_ASSESS_PATH) ? "available" : "unavailable",
    cropSuitability: has(CROP_SUITABILITY_PATH) ? "available" : "unavailable",
  };
}

let cached: Promise<BackendCapabilities> | null = null;

/** Reads the backend's own /openapi.json once per session. If it cannot be read, every module is "unavailable". */
export function probeBackendCapabilities(force = false): Promise<BackendCapabilities> {
  if (!cached || force) {
    cached = (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/openapi.json`);
        if (!res.ok) throw new Error(String(res.status));
        return capabilitiesFromOpenApi(await res.json());
      } catch {
        return { disease: "unavailable", cropSuitability: "unavailable" } as BackendCapabilities;
      }
    })();
  }
  return cached;
}

async function postJson<T>(path: string, body: unknown, parse: (raw: unknown) => T): Promise<T> {
  const res = await authenticatedFetch(path, { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err?.detail === "string" ? err.detail : `Server error: ${res.status}`);
  }
  return parse(await res.json());
}

export async function assessDisease(req: DiseaseAssessmentRequest): Promise<DiseaseAssessment> {
  if ((await probeBackendCapabilities()).disease !== "available") throw new ModuleUnavailableError("disease assessment");
  return postJson(DISEASE_ASSESS_PATH, req, parseDiseaseAssessment);
}

export async function assessCropSuitability(req: CropSuitabilityRequest): Promise<CropSuitabilityAssessment> {
  if ((await probeBackendCapabilities()).cropSuitability !== "available") throw new ModuleUnavailableError("crop suitability");
  return postJson(CROP_SUITABILITY_PATH, req, parseCropSuitability);
}
