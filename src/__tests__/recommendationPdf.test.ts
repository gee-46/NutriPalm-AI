// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  EmptyReportError,
  buildAssessmentPdf,
  buildRecommendationPdf,
  pdfText,
  safeFileName,
} from "../lib/recommendationPdf";
import type { InsufficientDataPayload, RecommendationRecord } from "../lib/apiClient";

const NOW = new Date("2026-10-30T10:00:00Z");

const plot = { name: "Hegde Plot / North", crop: "oil_palm", area: 2.5, areaUnit: "acres" };
const soil = {
  id: "soil-1",
  created_at: "2026-10-29T08:00:00Z",
  verification_status: "user_confirmed",
  nitrogen_kg_ha: 211,
  phosphorus_kg_ha: 23.46,
  potassium_kg_ha: 319,
  organic_carbon_percent: 0.64,
  ph: 5.81,
  electrical_conductivity: null,
};

function record(over: Partial<RecommendationRecord> = {}): RecommendationRecord {
  return {
    id: "rec-1",
    owner_id: "o",
    plot_id: "p1",
    soil_report_id: "soil-1",
    crop: "oil_palm",
    status: "generated",
    created_at: "2026-10-30T09:00:00Z",
    updated_at: "2026-10-30T09:00:00Z",
    deficiencies: [
      { nutrient: "p", display_name: "Phosphorus", soil_value_kg_ha: 23.46, target_kg_ha: 45, status: "deficient", deficit_kg_ha: 21.54, percent_of_target: 52 },
    ],
    fertilizer_plan: [
      { nutrient: "p", product_code: "dap", product_display_name: "Di-Ammonium Phosphate (DAP)", quantity_kg_per_ha: 108.7, quantity_kg_total: 110.2, nutrient_basis: "oxide", estimated_cost_inr: null },
      { nutrient: "k", product_code: "mop", product_display_name: "Muriate of Potash (MOP)", quantity_kg_per_ha: 166.67, quantity_kg_total: 168.9, nutrient_basis: "oxide", estimated_cost_inr: null },
    ],
    yield_prediction: {},
    roi: {},
    explanation: {
      summary: "Phosphorus is below the cited target.",
      identified_issues: [],
      recommended_actions: ["Apply the DAP in two splits."],
      expected_benefit: null,
      warnings: ["Soil-test values were not adjusted for losses."],
    },
    engine_version: "rec-2.2",
    generated_at: "2026-10-30T09:00:00Z",
    provenance: {
      crop: "oil_palm",
      area_ha: 1.01,
      soil_report_id: "soil-1",
      soil_verification_status: "user_confirmed",
      soil_values_used: { nitrogen_kg_ha: 211, phosphorus_kg_ha: 23.46, potassium_kg_ha: 319, organic_carbon_percent: 0.64, ph: 5.81 },
      rule: {
        crop: "oil_palm",
        rule_version: "test-rule-1",
        rule_kind: "published_schedule",
        source: { id: "s", title: "A Cited Source", publisher: "A Publisher", edition: "1st", year: 2019, locator: "Table 1, p. 5", quote: "A verbatim quoted passage." },
        reviewed_by: "A. Agronomist, agronomist",
        reviewed_on: "2026-10-01",
        applicable_stage: "years 1-3",
        region: "India",
      },
      assumptions: ["Doses are applied as printed."],
      not_considered: ["Leaf analysis"],
    },
    ...over,
  } as RecommendationRecord;
}

describe("pdfText", () => {
  it("turns characters the standard PDF fonts cannot draw into safe ASCII", () => {
    expect(pdfText("P₂O₅ → K₂O ≥ 5 ₹100")).toBe("P2O5 -> K2O >= 5 Rs 100");
    expect(pdfText("a\nb\tc")).toBe("a b c");
    expect(pdfText(null)).toBe("");
    expect(pdfText("ಕನ್ನಡ")).not.toMatch(/[ಀ-೿]/); // Kannada cannot be drawn by the built-in fonts: never emit raw glyph codes
  });
});

describe("safeFileName", () => {
  it("is a plain, bounded, date-stamped name", () => {
    expect(safeFileName("NutriPalm_Recommendation", "Hegde Plot / North", "2026-10-30T09:00:00Z")).toBe("NutriPalm_Recommendation_Hegde_Plot_North_2026-10-30.pdf");
    expect(safeFileName("X", "../../etc/passwd", "2026-10-30")).toBe("X_etc_passwd_2026-10-30.pdf");
    expect(safeFileName("X", "", "2026-10-30")).toBe("X_plot_2026-10-30.pdf");
    expect(safeFileName("X", "a".repeat(200), "2026-10-30").length).toBeLessThan(70);
  });
});

describe("recommendation PDF", () => {
  const out = buildRecommendationPdf({ record: record(), plot, farmerName: "Ravi Kumar", soil, now: NOW });
  const text = out.lines.join("\n");

  it("is a real PDF with a safe filename", () => {
    const bytes = new Uint8Array(out.doc.output("arraybuffer"));
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe("%PDF-");
    expect(out.filename).toBe("NutriPalm_Recommendation_Hegde_Plot_North_2026-10-30.pdf");
  });

  it("prints the actual plot, crop, farmer and engine/rule versions", () => {
    expect(text).toContain("Farmer: Ravi Kumar");
    expect(text).toContain("Plot: Hegde Plot / North");
    expect(text).toContain("Crop: oil palm");
    expect(text).toContain("Engine version: rec-2.2");
    expect(text).toContain("Rule: test-rule-1 (published schedule)");
  });

  it("prints the soil values the engine used, with units, and does not invent missing ones", () => {
    expect(text).toContain("Nitrogen (N) | 211 | kg/ha");
    expect(text).toContain("Phosphorus (P) | 23.46 | kg/ha");
    expect(text).toContain("Soil pH | 5.81");
    expect(text).not.toContain("Electrical conductivity | 0");
  });

  it("prints the plan with quantities, units and basis, and the finding table", () => {
    expect(text).toContain("Di-Ammonium Phosphate (DAP) | Phosphorus (oxide) | 108.7 | 110.2");
    expect(text).toContain("Muriate of Potash (MOP) | Potassium (oxide) | 166.67 | 168.9");
    expect(text).toContain("Phosphorus | 23.46 | 45 | 21.54 | deficient");
  });

  it("prints the citation, approval, assumptions, warnings and the advised-not-applied statement", () => {
    expect(text).toContain("Source: A Cited Source");
    expect(text).toContain("Location in source: Table 1, p. 5");
    expect(text).toContain("Reviewed by: A. Agronomist, agronomist on 2026-10-01");
    expect(text).toContain("Doses are applied as printed.");
    expect(text).toContain("Soil-test values were not adjusted for losses.");
    expect(text).toMatch(/not a record of fertilizer applied/);
  });

  it("does not print economics when the rule does not support them", () => {
    expect(text).not.toMatch(/Economics|Estimated profit/);
  });

  it("flows onto more pages without clipping when the content is long", () => {
    const many = Array.from({ length: 60 }, (_, i) => `Warning number ${i + 1}: ${"long text ".repeat(20)}`);
    const long = buildRecommendationPdf({
      record: record({ explanation: { summary: "S", identified_issues: [], recommended_actions: [], expected_benefit: null, warnings: many } }),
      plot,
      soil,
      now: NOW,
    });
    expect(long.doc.getNumberOfPages()).toBeGreaterThan(2);
    for (let i = 1; i <= 60; i++) expect(long.lines.join(" ")).toContain(`Warning number ${i}:`);
    expect(out.doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it("shows the palm schedule arithmetic when the rule was a published schedule", () => {
    const rec = record();
    rec.provenance!.schedule = {
      age_year: 7,
      planting_date: "2020-01-15",
      plant_count: 143,
      palms_per_ha: 143,
      per_palm_g_per_year: { n: 1200, p: 600, k: 1200 },
      nutrient_basis: { n: "elemental", p: "oxide", k: "oxide" },
      products_g_per_palm_per_year: {},
      timing_note: "Two splits before the rains.",
    };
    const t = buildRecommendationPdf({ record: rec, plot, soil, now: NOW }).lines.join("\n");
    expect(t).toContain("Palm age: year 7 (planted 2020-01-15)");
    expect(t).toContain("Dose per palm per year: 1,200 g N, 600 g P2O5, 1,200 g K2O");
    expect(t).toContain("Two splits before the rains.");
  });

  it("refuses to make a report from something the engine did not produce, or from nothing", () => {
    expect(() => buildRecommendationPdf({ record: record({ engine_version: null }), plot, soil })).toThrow(EmptyReportError);
    expect(() => buildRecommendationPdf({ record: record({ id: "" }), plot, soil })).toThrow(EmptyReportError);
    expect(() => buildRecommendationPdf({ record: record({ fertilizer_plan: [], explanation: {} }), plot, soil })).toThrow(EmptyReportError);
    expect(() => buildRecommendationPdf({ record: record(), plot: { name: "" }, soil })).toThrow(EmptyReportError);
  });
});

describe("soil assessment (status) PDF", () => {
  const insufficient: InsufficientDataPayload = {
    state: "insufficient_data",
    plot_id: "p1",
    soil_report_id: "soil-1",
    crop: "Oil Palm",
    engine_version: "rec-2.2",
    generated_at: "2026-10-30T09:00:00Z",
    reasons: [{ code: "no_verified_rule", message: "No agronomist-verified, cited nutrient rule is installed for 'Oil Palm'." }],
    required: ["A cited, agronomist-reviewed nutrient rule for this crop."],
  };

  it("lists the measured values and the reasons, and contains no fertilizer quantity", () => {
    const out = buildAssessmentPdf({ plot, farmerName: "Ravi", soil, insufficient, now: NOW });
    const text = out.lines.join("\n");
    expect(text).toContain("No fertilizer recommendation has been issued");
    expect(text).toContain("Nitrogen (N) | 211 | kg/ha");
    expect(text).toContain("No agronomist-verified, cited nutrient rule is installed");
    expect(text).toContain("A cited, agronomist-reviewed nutrient rule for this crop.");
    expect(text).not.toMatch(/kg per ha|Total kg|Fertilizer plan/);
    expect(out.filename).toBe("NutriPalm_Soil_Assessment_Hegde_Plot_North_2026-10-29.pdf");
  });

  it("says no recommendation was requested yet when there is no engine answer", () => {
    const text = buildAssessmentPdf({ plot, soil, now: NOW }).lines.join("\n");
    expect(text).toContain("A recommendation has not been requested for this plot yet.");
  });

  it("shows the unit printed on the report and the original of a corrected value", () => {
    const readings = [
      { parameter: "phosphorus", value: 23.46, unit: "kg/ha", validation: "valid", rawLabel: "PHOSPHORUS" },
      { parameter: "ph", value: 6.8, unit: null, validation: "valid", corrected: true, originalValue: null },
      { parameter: "boron", value: null, unit: null, validation: "missing" },
    ];
    const text = buildAssessmentPdf({ plot, soil, readings, now: NOW }).lines.join("\n");
    expect(text).toContain('phosphorus | 23.46 | kg/ha | read clearly; report label "PHOSPHORUS"');
    expect(text).toContain("ph | 6.8 | not stated | read clearly; corrected by the owner (read as nothing)");
    expect(text).toContain("boron | not found | not stated | not found in the report");
  });

  it("refuses an empty assessment", () => {
    expect(() => buildAssessmentPdf({ plot, soil: null })).toThrow(EmptyReportError);
    expect(() => buildAssessmentPdf({ plot, soil: { ...soil, nitrogen_kg_ha: null, phosphorus_kg_ha: null, potassium_kg_ha: null, organic_carbon_percent: null, ph: null } })).toThrow(EmptyReportError);
  });

  it("treats zero as a real measurement, not as missing", () => {
    const text = buildAssessmentPdf({ plot, soil: { ...soil, nitrogen_kg_ha: 0 }, now: NOW }).lines.join("\n");
    expect(text).toContain("Nitrogen (N) | 0 | kg/ha");
  });
});
