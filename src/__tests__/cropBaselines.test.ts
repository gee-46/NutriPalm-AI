import { describe, it, expect } from "vitest";
import cropRulesPy from "../../backend/app/services/crop_rules.py?raw";
import { CROP_BASELINES, getCropBaseline, normalizeCropKey, ADEQUATE_TOLERANCE_FRACTION } from "../constants/cropBaselines";

/** Parse the backend catalog (the recommendation engine's source of truth). */
function parseBackendCatalog(src: string) {
  const out: Record<string, Record<string, number>> = {};
  const re = /"([a-z_]+)":\s*CropRequirement\(([\s\S]*?)\n\s*\),/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const fields: Record<string, number> = {};
    for (const f of m[2].matchAll(/([a-z_]+)=([0-9.]+)/g)) fields[f[1]] = Number(f[2]);
    out[m[1]] = fields;
  }
  return out;
}

describe("frontend crop reference mirrors backend crop_rules.py", () => {
  const backend = parseBackendCatalog(cropRulesPy);

  it("parses a non-trivial backend catalog (guards the parser itself)", () => {
    expect(Object.keys(backend).length).toBeGreaterThanOrEqual(6);
    expect(backend.oil_palm.n_target_kg_ha).toBe(280);
  });

  it("supports exactly the crops the backend supports", () => {
    expect(Object.keys(CROP_BASELINES).sort()).toEqual(Object.keys(backend).sort());
  });

  it.each(Object.keys(parseBackendCatalog(cropRulesPy)))("%s: targets, pH range and organic carbon match", (crop) => {
    const b = backend[crop];
    const f = CROP_BASELINES[crop];
    expect(f.nitrogen.target).toBe(b.n_target_kg_ha);
    expect(f.phosphorus.target).toBe(b.p_target_kg_ha);
    expect(f.potassium.target).toBe(b.k_target_kg_ha);
    expect(f.ph.min).toBe(b.ph_min);
    expect(f.ph.max).toBe(b.ph_max);
    expect(f.organic_carbon.min).toBe(b.organic_carbon_min_percent);
  });

  it("uses the backend's +/-5% adequate band", () => {
    expect(ADEQUATE_TOLERANCE_FRACTION).toBe(0.05);
    expect(CROP_BASELINES.oil_palm.phosphorus.min).toBeCloseTo(45 * 0.95, 6);
    expect(CROP_BASELINES.oil_palm.phosphorus.max).toBeCloseTo(45 * 1.05, 6);
  });
});

describe("crop name matching is as strict as the backend", () => {
  it("normalises like the backend (case and spaces)", () => {
    expect(normalizeCropKey(" Oil Palm ")).toBe("oil_palm");
    expect(getCropBaseline("Oil Palm")).toBe(CROP_BASELINES.oil_palm);
    expect(getCropBaseline("RICE")).toBe(CROP_BASELINES.rice);
  });
  it("does not guess: crops the backend rejects have no reference either", () => {
    for (const unsupported of ["Cocoa", "Coconut Palm", "Arecanut", "palm", "", undefined]) {
      expect(getCropBaseline(unsupported as string | undefined)).toBeNull();
    }
  });
});
