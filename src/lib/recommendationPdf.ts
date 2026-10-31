import { jsPDF } from "jspdf";
import type { InsufficientDataPayload, RecommendationRecord } from "./apiClient";

/**
 * PDF reports. Two kinds, both built only from records the server produced or the database holds:
 *
 *   buildRecommendationPdf  a persisted recommendation, with its soil values, plan, citation and assumptions
 *   buildAssessmentPdf      the soil assessment and WHY no recommendation was issued (insufficient_data / none yet)
 *
 * The PDF is English-only: jsPDF's built-in fonts cannot draw Kannada script. Text is sanitised to what those fonts can
 * draw (subscripts and arrows become ASCII) so nothing silently turns into garbage characters.
 * Nothing here calculates agronomy; it prints what it is given. An empty or invalid input throws instead of downloading.
 */

export class EmptyReportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmptyReportError";
  }
}

export interface PdfPlot {
  name: string;
  crop?: string | null;
  area?: number | null;
  areaUnit?: string | null;
}

export interface PdfSoil {
  id?: string | null;
  created_at?: string | null;
  verification_status?: string | null;
  nitrogen_kg_ha: number | null;
  phosphorus_kg_ha: number | null;
  potassium_kg_ha: number | null;
  organic_carbon_percent: number | null;
  ph: number | null;
  electrical_conductivity?: number | null;
}

/** One value as the pipeline read it from the document (kept so a report can show the basis a value was reported on). */
export interface PdfReading {
  parameter: string;
  value: number | string | null;
  unit: string | null;
  validation: string;
  rawLabel?: string | null;
  corrected?: boolean;
  /** What the pipeline read before the owner corrected it. */
  originalValue?: number | string | null;
}

export interface PdfResult {
  doc: jsPDF;
  filename: string;
  /** Every text line placed on the pages, in order (what a test or a reviewer can read without parsing the PDF). */
  lines: string[];
}

const SUBSCRIPTS: Record<string, string> = { "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9" };

/** Reduce text to what the standard PDF fonts can draw. */
export function pdfText(input: unknown): string {
  const raw = input === null || input === undefined ? "" : String(input);
  let out = "";
  for (const ch of raw) {
    if (SUBSCRIPTS[ch]) out += SUBSCRIPTS[ch];
    else if (ch === "→") out += "->";
    else if (ch === "≥") out += ">=";
    else if (ch === "≤") out += "<=";
    else if (ch === "₹") out += "Rs ";
    else if (ch === "‑" || ch === "−") out += "-";
    else if (ch === " " || ch === " " || ch === " ") out += " ";
    else if (ch === "\n" || ch === "\t") out += " ";
    else if (ch.codePointAt(0)! <= 0xff || "‘’“”–—•…".includes(ch)) out += ch;
    else out += "?";
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

export function safeFileName(prefix: string, plotName: string, isoDate: string): string {
  const slug = pdfText(plotName).replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "plot";
  const day = /^\d{4}-\d{2}-\d{2}/.test(isoDate) ? isoDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
  return `${prefix}_${slug}_${day}.pdf`;
}

const num = (n: unknown, d = 2): string =>
  typeof n === "number" && Number.isFinite(n) ? n.toLocaleString("en-IN", { maximumFractionDigits: d }) : "not reported";
const dateText = (iso?: string | null): string => {
  if (!iso) return "not recorded";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "not recorded" : d.toLocaleString("en-IN");
};
const asArray = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const hasKeys = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length > 0;

const SOIL_LABEL: Record<string, [string, string]> = {
  nitrogen_kg_ha: ["Nitrogen (N)", "kg/ha"],
  phosphorus_kg_ha: ["Phosphorus (P)", "kg/ha"],
  potassium_kg_ha: ["Potassium (K)", "kg/ha"],
  organic_carbon_percent: ["Organic carbon", "%"],
  ph: ["Soil pH", ""],
  electrical_conductivity: ["Electrical conductivity", "dS/m"],
};
const NUTRIENT_NAME: Record<string, string> = { n: "Nitrogen (N)", p: "Phosphorus", k: "Potassium", nitrogen: "Nitrogen (N)", phosphorus: "Phosphorus", potassium: "Potassium" };

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 18;
const BOTTOM = 20;
const WIDTH = PAGE_W - MARGIN * 2;

class Writer {
  doc = new jsPDF({ unit: "mm", format: "a4" });
  y = MARGIN + 8;
  lines: string[] = [];

  private title: string;

  constructor(title: string) {
    this.title = title;
  }

  private room(h: number) {
    if (this.y + h > PAGE_H - BOTTOM) {
      this.doc.addPage();
      this.y = MARGIN + 8;
    }
  }

  text(raw: unknown, opts: { size?: number; bold?: boolean; indent?: number; gap?: number; color?: [number, number, number] } = {}) {
    const { size = 10, bold = false, indent = 0, gap = 1.6, color = [30, 30, 30] } = opts;
    const text = pdfText(raw);
    if (!text) return;
    this.doc.setFont("helvetica", bold ? "bold" : "normal");
    this.doc.setFontSize(size);
    this.doc.setTextColor(...color);
    const wrapped: string[] = this.doc.splitTextToSize(text, WIDTH - indent);
    const lh = size * 0.4 + gap;
    for (const l of wrapped) {
      this.room(lh);
      this.doc.text(l, MARGIN + indent, this.y);
      this.lines.push(l);
      this.y += lh;
    }
  }

  heading(raw: string) {
    this.y += 3;
    this.room(14);
    this.text(raw, { size: 12, bold: true, color: [21, 61, 50] });
    this.doc.setDrawColor(190, 205, 195);
    this.doc.line(MARGIN, this.y - 1.2, MARGIN + WIDTH, this.y - 1.2);
    this.y += 1.5;
  }

  /** A label / value row; the value wraps beside a fixed label column. */
  row(label: string, value: unknown) {
    const v = pdfText(value);
    this.doc.setFontSize(10);
    this.doc.setFont("helvetica", "normal");
    const wrapped: string[] = this.doc.splitTextToSize(v || "-", WIDTH - 52);
    this.room(wrapped.length * 5 + 1);
    this.doc.setFont("helvetica", "bold");
    this.doc.setTextColor(60, 60, 60);
    this.doc.text(pdfText(label), MARGIN, this.y);
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(30, 30, 30);
    wrapped.forEach((l, i) => this.doc.text(l, MARGIN + 52, this.y + i * 5));
    this.lines.push(`${pdfText(label)}: ${v}`);
    this.y += wrapped.length * 5 + 1;
  }

  /** A simple table: header + rows; cells wrap inside their column. */
  table(head: string[], widths: number[], rows: string[][]) {
    const total = widths.reduce((a, b) => a + b, 0);
    const scale = WIDTH / total;
    const w = widths.map((x) => x * scale);
    const cell = (cells: string[], bold: boolean) => {
      this.doc.setFont("helvetica", bold ? "bold" : "normal");
      this.doc.setFontSize(9);
      this.doc.setTextColor(bold ? 60 : 30, bold ? 60 : 30, bold ? 60 : 30);
      const wrapped = cells.map((c, i) => this.doc.splitTextToSize(pdfText(c) || "-", w[i] - 2) as string[]);
      const rowLines = Math.max(...wrapped.map((x) => x.length));
      this.room(rowLines * 4.4 + 2);
      let x = MARGIN;
      wrapped.forEach((ls, i) => {
        ls.forEach((l, j) => this.doc.text(l, x + 1, this.y + j * 4.4));
        x += w[i];
      });
      this.lines.push(cells.map((c) => pdfText(c)).join(" | "));
      this.y += rowLines * 4.4 + 1.2;
      this.doc.setDrawColor(225, 230, 226);
      this.doc.line(MARGIN, this.y - 2.8, MARGIN + WIDTH, this.y - 2.8);
    };
    cell(head, true);
    rows.forEach((r) => cell(r, false));
    this.y += 1;
  }

  bullets(items: string[]) {
    for (const it of items) this.text(`-  ${it}`, { indent: 3 });
  }

  /** Header and "page X of Y" on every page; call once when the content is complete. */
  finish(): void {
    const total = this.doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      this.doc.setPage(i);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(9);
      this.doc.setTextColor(21, 61, 50);
      this.doc.text("NutriPalm AI", MARGIN, 12);
      this.doc.setFont("helvetica", "normal");
      this.doc.setTextColor(110, 110, 110);
      this.doc.text(pdfText(this.title), PAGE_W - MARGIN, 12, { align: "right" });
      this.doc.setDrawColor(190, 205, 195);
      this.doc.line(MARGIN, 14, PAGE_W - MARGIN, 14);
      this.doc.text(`Page ${i} of ${total}`, PAGE_W - MARGIN, PAGE_H - 10, { align: "right" });
    }
  }
}

function plotRows(w: Writer, plot: PdfPlot, farmerName?: string | null, cropOverride?: string | null) {
  w.row("Farmer", farmerName || "not recorded");
  w.row("Plot", plot.name);
  w.row("Crop", (cropOverride || plot.crop || "not set").replace(/_/g, " "));
  w.row("Plot area", plot.area ? `${num(plot.area)} ${plot.areaUnit || "acres"}` : "not recorded");
}

function readingsTable(w: Writer, readings: PdfReading[]) {
  const status: Record<string, string> = {
    valid: "read clearly",
    review: "read, needs checking",
    missing: "not found in the report",
    unusable: "unreadable / invalid",
    confirmed: "read, confirmed by the owner",
    not_saved: "read but not saved (not confirmed)",
  };
  w.table(
    ["Parameter", "Value as read", "Unit on report", "Status"],
    [34, 40, 34, 66],
    readings.map((r) => [
      r.parameter.replace(/_/g, " "),
      r.value === null || r.value === undefined || r.value === "" ? "not found" : String(r.value),
      r.unit || "not stated",
      `${status[r.validation] ?? r.validation}${r.corrected ? `; corrected by the owner (read as ${r.originalValue === null || r.originalValue === undefined ? "nothing" : r.originalValue})` : ""}${r.rawLabel ? `; report label "${r.rawLabel}"` : ""}`,
    ])
  );
}

function soilRows(w: Writer, soil: PdfSoil) {
  const rows: Array<[string, number | null | undefined]> = [
    ["nitrogen_kg_ha", soil.nitrogen_kg_ha],
    ["phosphorus_kg_ha", soil.phosphorus_kg_ha],
    ["potassium_kg_ha", soil.potassium_kg_ha],
    ["organic_carbon_percent", soil.organic_carbon_percent],
    ["ph", soil.ph],
    ["electrical_conductivity", soil.electrical_conductivity],
  ];
  w.table(
    ["Parameter", "Value", "Unit"],
    [70, 60, 44],
    rows.map(([k, v]) => [SOIL_LABEL[k][0], num(v), SOIL_LABEL[k][1] || "-"])
  );
}

/** A persisted, engine-produced recommendation. Throws EmptyReportError when there is nothing real to print. */
export function buildRecommendationPdf(input: {
  record: RecommendationRecord;
  plot: PdfPlot;
  farmerName?: string | null;
  soil?: PdfSoil | null;
  readings?: PdfReading[];
  now?: Date;
}): PdfResult {
  const { record, plot } = input;
  const plan = asArray(record?.fertilizer_plan);
  const findings = asArray(record?.deficiencies);
  const explanation = hasKeys(record?.explanation) ? record.explanation : null;
  const prov = record?.provenance ?? null;
  if (!record?.id || !record.engine_version) throw new EmptyReportError("This record was not produced by the recommendation engine, so no report can be made from it.");
  if (!plot?.name) throw new EmptyReportError("The plot for this recommendation is not available.");
  if (plan.length === 0 && !explanation?.summary) throw new EmptyReportError("The recommendation has no plan or explanation to report.");

  const now = input.now ?? new Date();
  const w = new Writer("Fertilizer Recommendation Report");
  w.text("Fertilizer Recommendation Report", { size: 18, bold: true, color: [21, 61, 50], gap: 3 });
  w.text("Advice only. This is what the engine recommends from a verified soil report; it is not a record of fertilizer applied.", { size: 9, color: [90, 90, 90] });
  w.row("Report created", now.toLocaleString("en-IN"));
  w.row("Recommendation generated", dateText(record.generated_at ?? record.created_at));
  w.row("Recommendation record", record.id);
  w.row("Engine version", record.engine_version);
  if (prov?.rule) w.row("Rule", `${prov.rule.rule_version}${prov.rule.rule_kind ? ` (${String(prov.rule.rule_kind).replace(/_/g, " ")})` : ""}`);

  w.heading("Plot and crop");
  plotRows(w, plot, input.farmerName, record.crop);

  w.heading("Soil values used");
  if (prov?.soil_values_used && hasKeys(prov.soil_values_used)) {
    w.row("Soil report", `${prov.soil_report_id ?? record.soil_report_id} (verification: ${String(prov.soil_verification_status ?? "n/a").replace(/_/g, " ")})`);
    const used = prov.soil_values_used as Record<string, number>;
    w.table(
      ["Parameter", "Value", "Unit"],
      [70, 60, 44],
      Object.entries(used).map(([k, v]) => [SOIL_LABEL[k]?.[0] ?? k.replace(/_/g, " "), num(v), SOIL_LABEL[k]?.[1] || "-"])
    );
  } else if (input.soil) {
    soilRows(w, input.soil);
  }
  if (input.readings?.length) {
    w.text("As read from the laboratory report:", { size: 9, bold: true });
    readingsTable(w, input.readings);
  }

  if (findings.length) {
    w.heading("Nutrient status (soil value against the rule's target, kg/ha)");
    w.table(
      ["Nutrient", "Soil value", "Target", "Shortfall", "Status"],
      [46, 30, 30, 30, 38],
      findings.map((f) => [
        NUTRIENT_NAME[String(f.nutrient).toLowerCase()] ?? f.display_name ?? f.nutrient,
        num(f.soil_value_kg_ha),
        num(f.target_kg_ha),
        f.status === "deficient" ? num(f.deficit_kg_ha) : "-",
        String(f.status ?? "-"),
      ])
    );
  }

  const sched = prov?.schedule;
  if (hasKeys(sched)) {
    w.heading("Published dose schedule applied");
    w.row("Palm age", `year ${sched.age_year}${sched.planting_date ? ` (planted ${sched.planting_date})` : ""}`);
    w.row("Palms on the plot", `${sched.plant_count}${sched.palms_per_ha ? ` (about ${num(sched.palms_per_ha, 0)} per hectare)` : ""}`);
    const lab = (k: "n" | "p" | "k") => (k === "n" ? "N" : sched.nutrient_basis?.[k] === "oxide" ? (k === "p" ? "P2O5" : "K2O") : k.toUpperCase());
    const g = sched.per_palm_g_per_year ?? {};
    w.row("Dose per palm per year", (["n", "p", "k"] as const).map((k) => `${num(g[k], 0)} g ${lab(k)}`).join(", "));
    if (sched.timing_note) w.row("Timing (as stated by the source)", sched.timing_note);
  }

  w.heading("Fertilizer plan (advised quantities)");
  if (plan.length === 0) {
    w.text("The engine found no correction to recommend.");
  } else {
    const priced = plan.some((d) => typeof d.estimated_cost_inr === "number");
    w.table(
      ["Product", "Nutrient", "kg per ha", "Total kg", ...(priced ? ["Est. cost"] : [])],
      priced ? [50, 38, 28, 28, 30] : [58, 44, 36, 36],
      plan.map((d) => [
        String(d.product_display_name ?? d.product_code ?? "-"),
        `${NUTRIENT_NAME[String(d.nutrient).toLowerCase()] ?? d.nutrient}${d.nutrient_basis && d.nutrient !== "n" ? ` (${d.nutrient_basis})` : ""}`,
        num(d.quantity_kg_per_ha),
        num(d.quantity_kg_total),
        ...(priced ? [typeof d.estimated_cost_inr === "number" ? `Rs ${Math.round(d.estimated_cost_inr).toLocaleString("en-IN")}` : "-"] : []),
      ])
    );
    w.text("Costs appear only for products the caller priced; they are not market data.", { size: 8, color: [110, 110, 110] });
  }

  if (explanation) {
    w.heading("Explanation");
    if (explanation.summary) w.text(explanation.summary);
    const actions = asArray(explanation.recommended_actions);
    if (actions.length) {
      w.text("Recommended actions", { bold: true });
      w.bullets(actions.map(String));
    }
    const issues = asArray(explanation.identified_issues);
    if (issues.length) {
      w.text("Issues identified", { bold: true });
      w.bullets(issues.map(String));
    }
    const warnings = asArray(explanation.warnings);
    if (warnings.length) {
      w.text("Warnings", { bold: true });
      w.bullets(warnings.map(String));
    }
  }

  if (hasKeys(record.roi)) {
    w.heading("Economics (only because the cited rule supports a yield model)");
    w.row("Fertilizer cost", `Rs ${Math.round(record.roi.fertilizer_cost ?? 0).toLocaleString("en-IN")}`);
    w.row("Crop price used", `Rs ${Math.round(record.roi.crop_price_per_ton_inr ?? 0).toLocaleString("en-IN")} per tonne`);
    w.row("Estimated profit", `Rs ${Math.round(record.roi.estimated_profit ?? 0).toLocaleString("en-IN")}`);
  }

  if (prov?.rule) {
    const s = prov.rule.source ?? ({} as Record<string, any>);
    w.heading("Source and approval");
    w.row("Source", s.title);
    w.row("Publisher", s.publisher);
    w.row("Edition / year", `${s.edition ? `${s.edition}, ` : ""}${s.year}`);
    w.row("Location in source", s.locator);
    if (s.quote) w.row("Quoted passage", `"${s.quote}"`);
    if (s.url) w.row("Link", s.url);
    if (prov.rule.applicable_stage) w.row("Applies to", `${prov.rule.applicable_stage}${prov.rule.region ? ` - ${prov.rule.region}` : ""}`);
    w.row("Reviewed by", `${prov.rule.reviewed_by} on ${prov.rule.reviewed_on}`);
  }

  if (prov) {
    if (asArray(prov.assumptions).length) {
      w.heading("Assumptions");
      w.bullets(asArray(prov.assumptions).map(String));
    }
    if (asArray(prov.not_considered).length) {
      w.heading("Not taken into account");
      w.bullets(asArray(prov.not_considered).map(String));
    }
  }

  w.heading("Important");
  w.text("This report advises what to apply. It does not record anything the farmer applied; applications are recorded separately in the Digital Twin. Check field conditions before applying any fertilizer.", { size: 9 });
  w.finish();
  return { doc: w.doc, filename: safeFileName("NutriPalm_Recommendation", plot.name, record.generated_at ?? record.created_at ?? now.toISOString()), lines: w.lines };
}

/** The soil assessment, and the reasons no recommendation was issued. Never contains a dose. */
export function buildAssessmentPdf(input: {
  plot: PdfPlot;
  farmerName?: string | null;
  soil: PdfSoil | null;
  insufficient?: InsufficientDataPayload | null;
  readings?: PdfReading[];
  now?: Date;
}): PdfResult {
  const { plot, soil } = input;
  if (!plot?.name) throw new EmptyReportError("The plot is not available.");
  if (!soil) throw new EmptyReportError("There is no verified soil report to report on.");
  const hasValue = [soil.nitrogen_kg_ha, soil.phosphorus_kg_ha, soil.potassium_kg_ha, soil.organic_carbon_percent, soil.ph].some((v) => typeof v === "number");
  if (!hasValue) throw new EmptyReportError("The soil report has no values to report.");

  const now = input.now ?? new Date();
  const w = new Writer("Soil Assessment Status Report");
  w.text("Soil Assessment Status Report", { size: 18, bold: true, color: [21, 61, 50], gap: 3 });
  w.text("No fertilizer recommendation has been issued in this report. It lists the verified soil measurements and what is needed before advice can be given.", { size: 9, color: [90, 90, 90] });
  w.row("Report created", now.toLocaleString("en-IN"));

  w.heading("Plot and crop");
  plotRows(w, plot, input.farmerName);

  w.heading("Verified soil report");
  w.row("Soil report", soil.id ?? "not recorded");
  w.row("Report saved", dateText(soil.created_at));
  w.row("Verification", String(soil.verification_status ?? "not verified").replace(/_/g, " "));
  soilRows(w, soil);
  if (input.readings?.length) {
    w.text("As read from the laboratory report:", { size: 9, bold: true });
    readingsTable(w, input.readings);
  }

  w.heading("Why no recommendation was issued");
  const ins = input.insufficient;
  if (ins) {
    w.text("The recommendation engine answered that it cannot give a fertilizer quantity yet:");
    w.bullets(ins.reasons.map((r) => r.message));
    if (ins.required.length) {
      w.text("What is needed", { bold: true });
      w.bullets(ins.required);
    }
    w.row("Engine version", ins.engine_version);
    w.row("Checked", dateText(ins.generated_at));
  } else {
    w.text("A recommendation has not been requested for this plot yet. Fertilizer quantities are given only from a verified soil report and an expert-reviewed, cited rule for the crop.");
  }

  w.heading("Important");
  w.text("The values above are laboratory measurements saved in NutriPalm AI. They are not advice. NutriPalm AI does not give a fertilizer quantity without an approved rule, and does not estimate one.", { size: 9 });
  w.finish();
  return { doc: w.doc, filename: safeFileName("NutriPalm_Soil_Assessment", plot.name, soil.created_at ?? now.toISOString()), lines: w.lines };
}

/** Save a built report through the browser. */
export function downloadPdf(result: PdfResult): void {
  result.doc.save(result.filename);
}
