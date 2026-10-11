import { describe, expect, it } from "vitest";
import high from "./fixtures/disease-assessment.high.sample.json";
import arecanut from "./fixtures/disease-assessment.arecanut.sample.json";
import insufficient from "./fixtures/disease-assessment.insufficient.sample.json";
import vocab from "./fixtures/disease-vocabulary.sample.json";
import { ContractError, parseDiseaseAssessment, parseDiseaseAssessmentRecord, parseDiseaseVocabulary } from "../lib/phase2/validate";

// The fixtures are REAL backend output for fixed example inputs (regenerated and checked by backend/tests/disease/test_contract_samples.py).
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

describe("disease contract: what the backend actually sends", () => {
  it("parses a high-risk coconut assessment including treatment, evidence and versions", () => {
    const a = parseDiseaseAssessment(high);
    expect(a.risk_level).toBe("high");
    expect(a.candidates[0].disease_id).toBe("coconut_bud_rot");
    expect(a.candidates[0].treatment?.chemical_status).toBe("institutional_recommendation_only");
    expect(a.candidates[0].evidence.every((e) => e.url?.startsWith("https://") && !!e.quote)).toBe(true);
    expect(a.kb_version).toBeTruthy();
    expect(a.rule_version).toBeTruthy();
    expect(a.disclaimer).toMatch(/not a diagnosis/i);
  });

  it("parses the arecanut sample independently and the insufficient-evidence sample", () => {
    expect(parseDiseaseAssessment(arecanut).candidates[0].disease_id).toBe("areca_fruit_rot");
    const i = parseDiseaseAssessment(insufficient);
    expect(i.risk_level).toBe("insufficient_evidence");
    expect(i.candidates).toEqual([]);
    expect(i.follow_up_questions?.length).toBeGreaterThan(0);
  });

  it("parses the vocabulary and a history record", () => {
    const v = parseDiseaseVocabulary(vocab);
    expect(v.crops_with_verified_knowledge).toEqual(["arecanut", "coconut"]);
    expect(v.symptoms.length).toBeGreaterThan(10);
    const rec = parseDiseaseAssessmentRecord({ id: "1", plot_id: "p", crop: "coconut", risk_level: "high", top_disease: "coconut_bud_rot", kb_version: "0.1.0", rule_version: "1.0.0", created_at: "2026-01-01T00:00:00Z", result: high });
    expect(rec.result?.risk_level).toBe("high");
  });

  it("no sample carries an actionable chemical (nothing in the knowledge base is label-verified)", () => {
    for (const s of [high, arecanut]) {
      for (const c of parseDiseaseAssessment(s).candidates) {
        for (const p of c.treatment?.chemical_management ?? []) expect(p.actionable).toBe(false);
      }
    }
  });
});

describe("disease contract: unsafe or malformed responses are refused, never displayed", () => {
  it("rejects a response that claims a confirmed diagnosis", () => {
    const bad = clone(high) as any;
    bad.candidates[0].is_confirmed_diagnosis = true;
    expect(() => parseDiseaseAssessment(bad)).toThrow(ContractError);
  });

  it("rejects an actionable chemical without a verified label", () => {
    const bad = clone(high) as any;
    bad.candidates[0].treatment.chemical_management[0].actionable = true;
    expect(() => parseDiseaseAssessment(bad)).toThrow(/actionable without a verified label/);
  });

  it("rejects a chemical summary that disagrees with its products", () => {
    const bad = clone(high) as any;
    bad.candidates[0].treatment.chemical_status = "verified_available";
    expect(() => parseDiseaseAssessment(bad)).toThrow(/disagrees/);
  });

  it("rejects non-boolean actionable, unknown statuses, unknown risk and non-https source links", () => {
    for (const mutate of [
      (b: any) => (b.candidates[0].treatment.chemical_management[0].actionable = "yes"),
      (b: any) => (b.candidates[0].treatment.chemical_management[0].status = "approved"),
      (b: any) => (b.risk_level = "severe"),
      (b: any) => (b.candidates[0].risk_level = "certain"),
      (b: any) => (b.candidates[0].evidence[0].url = "http://insecure.example/doc.pdf"),
      (b: any) => (b.candidates[0].evidence[0].source = ""),
      (b: any) => (b.assessed_at = ""),
    ]) {
      const bad = clone(high) as any;
      mutate(bad);
      expect(() => parseDiseaseAssessment(bad)).toThrow(ContractError);
    }
  });

  it("still accepts the older, smaller contract (no new fields)", () => {
    const old = {
      plot_id: "p", crop: "coconut", risk_level: "low", assessed_at: "2026-01-01T00:00:00Z",
      candidates: [{ disease_name: "X", contributing_factors: [], evidence: [{ description: "d", source: "s" }], management: [], precautions: [] }],
      limitations: [], missing_inputs: [],
    };
    expect(parseDiseaseAssessment(old).candidates[0].treatment).toBeNull();
  });
});
