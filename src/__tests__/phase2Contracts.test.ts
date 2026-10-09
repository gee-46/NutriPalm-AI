import { describe, expect, it } from "vitest";
import { capabilitiesFromOpenApi } from "../lib/phase2/capabilities";
import { CROP_SUITABILITY_PATH, DISEASE_ASSESS_PATH } from "../lib/phase2/contracts";
import { ContractError, parseCropSuitability, parseDiseaseAssessment } from "../lib/phase2/validate";

describe("backend capability probe (reads the backend's own OpenAPI document)", () => {
  it("marks both modules unavailable when the paths are not published", () => {
    expect(capabilitiesFromOpenApi({ paths: { "/api/recommendations": { post: {} } } })).toEqual({ disease: "unavailable", cropSuitability: "unavailable" });
  });
  it("marks a module available only when it is published as POST", () => {
    const doc = { paths: { [DISEASE_ASSESS_PATH]: { post: {} }, [CROP_SUITABILITY_PATH]: { get: {} } } };
    expect(capabilitiesFromOpenApi(doc)).toEqual({ disease: "available", cropSuitability: "unavailable" });
  });
  it("treats an unreadable document as unavailable", () => {
    expect(capabilitiesFromOpenApi(null)).toEqual({ disease: "unavailable", cropSuitability: "unavailable" });
  });
});

describe("disease response validation", () => {
  const ok = {
    plot_id: "p1",
    crop: "coconut",
    risk_level: "moderate",
    candidates: [{ disease_name: "X", contributing_factors: ["a"], evidence: [{ description: "d", source: "s" }], management: ["m"], precautions: [] }],
    limitations: ["l"],
    missing_inputs: [],
    assessed_at: "2026-01-01T00:00:00Z",
  };
  it("accepts a well-formed response", () => {
    expect(parseDiseaseAssessment(ok).risk_level).toBe("moderate");
  });
  it("rejects an unknown risk level instead of displaying it", () => {
    expect(() => parseDiseaseAssessment({ ...ok, risk_level: "catastrophic" })).toThrow(ContractError);
  });
  it("rejects evidence without a source", () => {
    expect(() => parseDiseaseAssessment({ ...ok, candidates: [{ ...ok.candidates[0], evidence: [{ description: "d" }] }] })).toThrow(ContractError);
  });
});

describe("crop suitability response validation", () => {
  const ok = {
    plot_id: "p1",
    ranked: [{ crop: "Coconut", category: "suitable", score: 0.8, reasons: ["r"], limitations: [], evidence: [] }],
    missing_inputs: ["soil texture"],
    assessed_at: "2026-01-01T00:00:00Z",
  };
  it("keeps the server's score untouched and null when absent", () => {
    expect(parseCropSuitability(ok).ranked[0].score).toBe(0.8);
    expect(parseCropSuitability({ ...ok, ranked: [{ ...ok.ranked[0], score: undefined }] }).ranked[0].score).toBeNull();
  });
  it("rejects an invented category and a non-numeric score", () => {
    expect(() => parseCropSuitability({ ...ok, ranked: [{ ...ok.ranked[0], category: "great" }] })).toThrow(ContractError);
    expect(() => parseCropSuitability({ ...ok, ranked: [{ ...ok.ranked[0], score: "high" }] })).toThrow(ContractError);
  });
});
