// @vitest-environment jsdom
// MOCKED: Supabase (RLS-scoped reads) and the FastAPI client are replaced by deterministic fakes. These tests prove the
// front-end behaviour of the soil report -> recommendation workflow; the real backend, database and browser are exercised
// by supabase/tests/e2e/pipeline.mjs.
import { createRoot } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "../translation/LanguageContext";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ---------------------------------------------------------------- fakes
type Filter = [string, ...unknown[]];
const queries: Array<{ table: string; filters: Filter[] }> = [];
/** soil_reports rows by plot id; a value of "ERROR" makes that plot's query fail. */
let soilByPlot: Record<string, unknown | "ERROR"> = {};
let legacyByPlot: Record<string, Array<{ id: string }>> = {};

function builder(table: string) {
  const rec = { table, filters: [] as Filter[] };
  queries.push(rec);
  const q: Record<string, unknown> = {};
  for (const n of ["select", "eq", "not", "is", "order", "limit", "in"]) {
    q[n] = (...a: unknown[]) => {
      rec.filters.push([n, ...a]);
      return q;
    };
  }
  const plotId = () => rec.filters.find((f) => f[0] === "eq" && f[1] === "plot_id")?.[2] as string;
  const isLegacy = () => rec.filters.some((f) => f[0] === "is" && f[1] === "verification_status");
  q.maybeSingle = () => {
    const v = soilByPlot[plotId()];
    return Promise.resolve(v === "ERROR" ? { data: null, error: { message: "boom" } } : { data: v ?? null, error: null });
  };
  q.update = () => ({ eq: () => Promise.resolve({ error: null }) });
  q.then = (resolve: (v: unknown) => void) =>
    resolve(table === "soil_reports" && isLegacy() ? { data: legacyByPlot[plotId()] ?? [], error: null } : { data: [], error: null });
  return q;
}

vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    from: (t: string) => builder(t),
    auth: {
      getSession: async () => ({ data: { session: { access_token: "tok", user: { id: "user-1" } } } }),
      getUser: async () => ({ data: { user: { id: "user-1" } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  },
}));

const PLOT_A = { id: "plot-aaaa", name: "North Block", crop: "Oil Palm", area: 2, isDemo: false };
const PLOT_B = { id: "plot-bbbb", name: "South Block", crop: "Coconut", area: 3, isDemo: false };
// ids must not start with "plot-" (demo-plot convention in the app), so use uuid-like ids
PLOT_A.id = "a1111111-1111-4111-8111-111111111111";
PLOT_B.id = "b2222222-2222-4222-8222-222222222222";
let plotList: Array<typeof PLOT_A> = [PLOT_A, PLOT_B];

vi.mock("../data/plots", () => ({
  usePlots: () => ({ plots: plotList, isLoading: false, addPlot: vi.fn(), updatePlot: vi.fn(async () => true) }),
}));

vi.mock("../components/analytics/SoilNutrientAnalyticsCard", () => ({ SoilNutrientAnalyticsCard: () => null }));

const createRecommendation = vi.fn();
const listRecommendations = vi.fn();
const listExtractions = vi.fn();
const uploadSoilReport = vi.fn();
const confirmExtraction = vi.fn();
vi.mock("../lib/apiClient", async () => {
  const actual = await vi.importActual<typeof import("../lib/apiClient")>("../lib/apiClient");
  return {
    ...actual,
    createRecommendation: (...a: unknown[]) => createRecommendation(...a),
    listRecommendations: (...a: unknown[]) => listRecommendations(...a),
    listExtractions: (...a: unknown[]) => listExtractions(...a),
    uploadSoilReport: (...a: unknown[]) => uploadSoilReport(...a),
    confirmExtraction: (...a: unknown[]) => confirmExtraction(...a),
  };
});

const downloads: Array<{ filename: string; lines: string[] }> = [];
vi.mock("../lib/recommendationPdf", async () => {
  const actual = await vi.importActual<typeof import("../lib/recommendationPdf")>("../lib/recommendationPdf");
  return { ...actual, downloadPdf: (r: { filename: string; lines: string[] }) => downloads.push({ filename: r.filename, lines: r.lines }) };
});

import { ApiError } from "../lib/apiClient";
import { RecommendationScreen } from "../components/prototype/RecommendationScreen";
import { SoilReportScreen } from "../components/prototype/SoilReportScreen";

// ---------------------------------------------------------------- helpers
const soilRow = (plotId: string, id: string, n: number) => ({
  id, plot_id: plotId, nitrogen_kg_ha: n, phosphorus_kg_ha: 23.46, potassium_kg_ha: 319, organic_carbon_percent: 0.64, ph: 5.81,
  electrical_conductivity: 0, created_at: "2026-10-29T08:00:00Z", verification_status: "user_confirmed", extraction_id: "ext-" + id,
});

const savedRecord = (plotId: string, over: Record<string, unknown> = {}) => ({
  id: "rec-" + plotId.slice(0, 2), owner_id: "o", plot_id: plotId, soil_report_id: "s", crop: "oil_palm", status: "generated",
  created_at: "2026-10-30T09:00:00Z", updated_at: "2026-10-30T09:00:00Z", generated_at: "2026-10-30T09:00:00Z", engine_version: "rec-2.2",
  deficiencies: [], yield_prediction: {}, roi: {},
  fertilizer_plan: [{ nutrient: "k", product_code: "mop", product_display_name: "Muriate of Potash (MOP)", quantity_kg_per_ha: 166.67, quantity_kg_total: 333.34, nutrient_basis: "oxide", estimated_cost_inr: null }],
  explanation: { summary: "Potassium dose from the cited schedule.", identified_issues: [], recommended_actions: ["Apply MOP."], expected_benefit: null, warnings: [] },
  provenance: {
    crop: "oil_palm", area_ha: 0.8, soil_report_id: "s", soil_verification_status: "user_confirmed",
    soil_values_used: { nitrogen_kg_ha: 211, potassium_kg_ha: 319 },
    rule: { crop: "oil_palm", rule_version: "r-1", source: { id: "x", title: "Cited", publisher: "Pub", year: 2019, locator: "Table 1", quote: "q" }, reviewed_by: "A, agronomist", reviewed_on: "2026-10-01" },
    assumptions: [], not_considered: [],
  },
  ...over,
});

const INSUFFICIENT = {
  state: "insufficient_data", plot_id: PLOT_A.id, soil_report_id: "soil-A", crop: "Oil Palm", engine_version: "rec-2.2", generated_at: "2026-10-30T09:00:00Z",
  reasons: [{ code: "no_verified_rule", message: "No agronomist-verified, cited nutrient rule is installed for 'Oil Palm'." }],
  required: ["A cited, agronomist-reviewed nutrient rule for this crop."],
};

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const text = () => host.textContent ?? "";
/** Wait (inside act) until a condition holds - robust against machine load, unlike a fixed sleep. */
const until = async (cond: () => boolean, ms = 4000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (cond()) return;
    await act(async () => { await new Promise((r) => setTimeout(r, 25)); });
  }
};
const button = (re: RegExp) => [...host.querySelectorAll("button")].find((b) => re.test(b.textContent ?? ""));
const click = (el: Element | undefined | null) => act(async () => { (el as HTMLElement).click(); await new Promise((r) => setTimeout(r, 0)); });

async function mountRecs(props: Partial<React.ComponentProps<typeof RecommendationScreen>> = {}) {
  const base = { selectedPlotId: PLOT_A.id, onPlotChange: vi.fn(), showToast: vi.fn(), farmerName: "Ravi", onNavigate: vi.fn() };
  const p = { ...base, ...props };
  const render = (extra: Partial<typeof p> = {}) =>
    act(async () => root.render(<LanguageProvider><RecommendationScreen {...p} {...extra} /></LanguageProvider>));
  await render();
  await flush();
  await flush();
  return { p, rerender: async (extra: Partial<typeof p>) => { await render(extra); await flush(); await flush(); } };
}

async function mountSoil(props: Partial<React.ComponentProps<typeof SoilReportScreen>> = {}) {
  const base = { selectedPlotId: PLOT_A.id, onPlotChange: vi.fn(), onRecommendationClick: vi.fn(), onUploadSuccess: vi.fn(), showToast: vi.fn() };
  const p = { ...base, ...props };
  await act(async () => root.render(<LanguageProvider><SoilReportScreen {...p} /></LanguageProvider>));
  await flush();
  await flush();
  return p;
}

const pickFile = async (name = "report.pdf") => {
  const input = host.querySelector<HTMLInputElement>("input[type=file]")!;
  const file = new File(["%PDF-1.4 x"], name, { type: "application/pdf" });
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); await new Promise((r) => setTimeout(r, 0)); });
  return file;
};

const field = (parameter: string, over: Record<string, unknown> = {}) => ({
  parameter, raw_label: parameter, value: null, unit: null, confidence: 0, validation: "missing", warnings: [], ...over,
});
const extraction = (over: Record<string, unknown> = {}) => ({
  success: true, status: "needs_review", persisted: false, reused: false, extraction_id: "ext-1", soil_report_id: null, verification_status: null,
  plot_id: PLOT_A.id, raw_text: "", nitrogen: field("nitrogen", { value: 211, unit: "kg/ha", validation: "review" }),
  phosphorus: field("phosphorus", { value: 23.46, unit: "kg/ha", validation: "valid" }), potassium: field("potassium"), ph: field("ph"),
  organic_carbon: field("organic_carbon"), electrical_conductivity: field("electrical_conductivity"), extras: [], micronutrients: [],
  review_required: ["nitrogen", "potassium", "ph", "organic_carbon"], not_saved: [], corrections: [], pipeline_version: "t", page_count: 1, warnings: [], ...over,
});

// jsdom has no layout engine
(Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};

/** The recommendation's own PDF button (not the soil-assessment one). */
const recPdfButton = () => [...host.querySelectorAll("button")].find((b) => /pdf/i.test(b.textContent ?? "") && !/assessment/i.test(b.textContent ?? ""));

beforeEach(() => {
  queries.length = 0;
  soilByPlot = {};
  legacyByPlot = {};
  downloads.length = 0;
  plotList = [PLOT_A, PLOT_B];
  for (const m of [createRecommendation, listRecommendations, listExtractions, uploadSoilReport, confirmExtraction]) m.mockReset();
  listRecommendations.mockResolvedValue([]);
  listExtractions.mockResolvedValue([]);
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* ignore */ }
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const soilQueryPlots = () =>
  queries.filter((q) => q.table === "soil_reports" && q.filters.some((f) => f[0] === "not")).map((q) => q.filters.find((f) => f[0] === "eq")?.[2]);

// ================================================================ Recommendations: plot context
describe("Recommendations opens the plot the farmer is working on", () => {
  it("uses the shared plot and reads THAT plot's verified report (not the first plot's)", async () => {
    soilByPlot[PLOT_A.id] = soilRow(PLOT_A.id, "soil-A", 111);
    soilByPlot[PLOT_B.id] = soilRow(PLOT_B.id, "soil-B", 222);
    await mountRecs({ selectedPlotId: PLOT_B.id });
    expect(soilQueryPlots()).toEqual([PLOT_B.id]);
    expect(text()).toContain("222");
    expect(text()).not.toContain("111");
  });

  it("with no remembered plot it starts from the first saved plot AND tells the app, so the next screen agrees", async () => {
    soilByPlot[PLOT_A.id] = soilRow(PLOT_A.id, "soil-A", 111);
    const { p } = await mountRecs({ selectedPlotId: "" });
    expect(p.onPlotChange).toHaveBeenCalledWith(PLOT_A.id);
    expect(soilQueryPlots()).toContain(PLOT_A.id);
  });

  it("ignores a remembered id that is not one of the user's plots", async () => {
    soilByPlot[PLOT_A.id] = soilRow(PLOT_A.id, "soil-A", 111);
    const { p } = await mountRecs({ selectedPlotId: "deadbeef-0000-4000-8000-000000000000" });
    expect(p.onPlotChange).toHaveBeenCalledWith(PLOT_A.id);
    expect(soilQueryPlots()).not.toContain("deadbeef-0000-4000-8000-000000000000");
  });

  it("changing the plot never shows another plot's report or recommendation", async () => {
    soilByPlot[PLOT_A.id] = soilRow(PLOT_A.id, "soil-A", 111);
    soilByPlot[PLOT_B.id] = soilRow(PLOT_B.id, "soil-B", 222);
    listRecommendations.mockResolvedValue([savedRecord(PLOT_A.id, { crop: "oil_palm" })]);
    const { rerender } = await mountRecs({ selectedPlotId: PLOT_A.id });
    expect(text()).toContain("111");
    expect(text()).toContain("Potassium dose from the cited schedule.");
    await rerender({ selectedPlotId: PLOT_B.id });
    expect(text()).toContain("222");
    expect(text()).not.toContain("111");
    expect(text()).not.toContain("Potassium dose from the cited schedule."); // plot A's advice is not plot B's
  });

  it("a plot without a verified report says so and offers Soil Reports - it does not redirect by itself", async () => {
    const { p } = await mountRecs({ selectedPlotId: PLOT_A.id });
    expect(text()).toMatch(/no verified soil report|Soil/i);
    expect(p.onNavigate).not.toHaveBeenCalled();
    expect(button(/soil/i)).toBeTruthy();
    await click(button(/soil/i));
    expect(p.onNavigate).toHaveBeenCalledWith("Soil Reports");
  });
});

describe("a failed lookup is not 'no report'", () => {
  it("shows an error with a retry, and the retry loads the report", async () => {
    soilByPlot[PLOT_A.id] = "ERROR";
    await mountRecs({ selectedPlotId: PLOT_A.id });
    expect(text()).toMatch(/could not be loaded/);
    expect(text()).not.toMatch(/No soil report|no verified soil report for this plot/i);
    expect(button(/get advice/i)!.hasAttribute("disabled")).toBe(true);
    soilByPlot[PLOT_A.id] = soilRow(PLOT_A.id, "soil-A", 111);
    await click([...host.querySelectorAll("button")].find((b) => /retry|try again/i.test(b.textContent ?? "")));
    await flush();
    expect(text()).toContain("111");
    expect(button(/get advice/i)!.hasAttribute("disabled")).toBe(false);
  });

  it("a newly verified report is picked up without a reload when the app says one was saved", async () => {
    const { rerender } = await mountRecs({ selectedPlotId: PLOT_A.id, reportVersion: 0 });
    expect(text()).not.toContain("111");
    soilByPlot[PLOT_A.id] = soilRow(PLOT_A.id, "soil-A", 111);
    await rerender({ reportVersion: 1 });
    expect(text()).toContain("111");
  });
});

// ================================================================ Recommendations: the request and its outcomes
describe("generating advice", () => {
  it("sends exactly the plot id and the VERIFIED report id - nothing computed in the browser", async () => {
    soilByPlot[PLOT_A.id] = soilRow(PLOT_A.id, "soil-A", 111);
    createRecommendation.mockResolvedValue(INSUFFICIENT);
    await mountRecs({ selectedPlotId: PLOT_A.id });
    await click(button(/get advice/i));
    expect(createRecommendation).toHaveBeenCalledTimes(1);
    expect(createRecommendation).toHaveBeenCalledWith({ plot_id: PLOT_A.id, soil_report_id: "soil-A" });
  });

  it("renders insufficient_data with the reasons and the soil values, does not navigate, and invents nothing", async () => {
    soilByPlot[PLOT_A.id] = soilRow(PLOT_A.id, "soil-A", 111);
    createRecommendation.mockResolvedValue(INSUFFICIENT);
    const { p } = await mountRecs({ selectedPlotId: PLOT_A.id });
    await click(button(/get advice/i));
    expect(text()).toContain("No agronomist-verified, cited nutrient rule is installed for 'Oil Palm'.");
    expect(text()).toContain("A cited, agronomist-reviewed nutrient rule for this crop.");
    expect(text()).toContain("111"); // the measured value stays on screen
    expect(text()).not.toMatch(/Fertilizer to apply|kg\/ha ·/); // no plan, no dose
    expect(p.onNavigate).not.toHaveBeenCalled();
    expect(listRecommendations).toHaveBeenCalled();
  });

  it("offers the soil assessment PDF for insufficient_data - with the reasons, and no dose", async () => {
    soilByPlot[PLOT_A.id] = soilRow(PLOT_A.id, "soil-A", 111);
    createRecommendation.mockResolvedValue(INSUFFICIENT);
    await mountRecs({ selectedPlotId: PLOT_A.id });
    await click(button(/get advice/i));
    await click(button(/soil assessment/i));
    expect(downloads).toHaveLength(1);
    expect(downloads[0].filename).toMatch(/^NutriPalm_Soil_Assessment_North_Block_2026-10-29\.pdf$/);
    const all = downloads[0].lines.join("\n");
    expect(all).toContain("No fertilizer recommendation has been issued");
    expect(all).toContain("No agronomist-verified, cited nutrient rule is installed");
    expect(all).toContain("Nitrogen (N) | 111 | kg/ha");
    expect(all).not.toMatch(/Fertilizer plan|kg per ha/);
  });

  it("a backend failure is shown as an error, never as advice", async () => {
    soilByPlot[PLOT_A.id] = soilRow(PLOT_A.id, "soil-A", 111);
    createRecommendation.mockRejectedValue(new ApiError(0, { code: "network_error", message: "Could not reach the NutriPalm server. Check your connection and try again." }, "x"));
    await mountRecs({ selectedPlotId: PLOT_A.id });
    await click(button(/get advice/i));
    expect(text()).toContain("Could not reach the NutriPalm server");
    expect(text()).not.toMatch(/Fertilizer to apply/);
  });

  it("a crop outside any list is not blocked in the browser: the server decides and the reason is shown", async () => {
    plotList = [{ ...PLOT_A, crop: "Arecanut" }, PLOT_B];
    soilByPlot[PLOT_A.id] = soilRow(PLOT_A.id, "soil-A", 111);
    createRecommendation.mockResolvedValue({ ...INSUFFICIENT, crop: "Arecanut", reasons: [{ code: "unsupported_crop", message: "'Arecanut' is not a crop the engine has rules for." }] });
    await mountRecs({ selectedPlotId: PLOT_A.id });
    expect(text()).toContain("111"); // measurements are shown for any crop
    expect(button(/get advice/i)!.hasAttribute("disabled")).toBe(false);
    await click(button(/get advice/i));
    expect(text()).toContain("'Arecanut' is not a crop the engine has rules for.");
  });
});

describe("saved recommendations, history and the PDF", () => {
  it("shows the saved recommendation after a fresh mount (survives refresh) and downloads a PDF that matches it", async () => {
    soilByPlot[PLOT_A.id] = soilRow(PLOT_A.id, "soil-A", 111);
    listRecommendations.mockResolvedValue([savedRecord(PLOT_A.id)]);
    await mountRecs({ selectedPlotId: PLOT_A.id });
    expect(text()).toContain("Muriate of Potash (MOP)");
    expect(text()).toContain("Potassium dose from the cited schedule.");
    await click(recPdfButton());
    expect(downloads).toHaveLength(1);
    const pdf = downloads[0].lines.join("\n");
    expect(downloads[0].filename).toBe("NutriPalm_Recommendation_North_Block_2026-10-30.pdf");
    expect(pdf).toContain("Plot: North Block");
    expect(pdf).toContain("Muriate of Potash (MOP) | Potassium (oxide) | 166.67 | 333.34");
    expect(pdf).toContain("Source: Cited");
    expect(pdf).toContain("Engine version: rec-2.2");
    expect(pdf).toMatch(/not a record of fertilizer applied/);
  });

  it("the PDF is for the SELECTED recommendation of the SELECTED plot, not a stale one", async () => {
    soilByPlot[PLOT_A.id] = soilRow(PLOT_A.id, "soil-A", 111);
    soilByPlot[PLOT_B.id] = soilRow(PLOT_B.id, "soil-B", 222);
    listRecommendations.mockResolvedValue([
      savedRecord(PLOT_A.id, { id: "rec-old", created_at: "2026-10-01T09:00:00Z", generated_at: "2026-10-01T09:00:00Z", explanation: { summary: "OLD A", identified_issues: [], recommended_actions: [], expected_benefit: null, warnings: [] } }),
      savedRecord(PLOT_A.id, { id: "rec-new", explanation: { summary: "NEW A", identified_issues: [], recommended_actions: [], expected_benefit: null, warnings: [] } }),
      savedRecord(PLOT_B.id, { id: "rec-b", explanation: { summary: "ONLY B", identified_issues: [], recommended_actions: [], expected_benefit: null, warnings: [] } }),
    ]);
    const { rerender } = await mountRecs({ selectedPlotId: PLOT_A.id });
    await click([...host.querySelectorAll("button[aria-pressed]")].find((b) => b.getAttribute("aria-pressed") === "false")); // pick the older one
    await click(recPdfButton());
    expect(downloads.at(-1)!.lines.join("\n")).toContain("OLD A");
    await rerender({ selectedPlotId: PLOT_B.id });
    await click(recPdfButton());
    const last = downloads.at(-1)!.lines.join("\n");
    expect(last).toContain("ONLY B");
    expect(last).toContain("Plot: South Block");
    expect(last).not.toContain("OLD A");
  });

  it("earlier records (no engine version) stay visible as history but are never shown as advice and have no report", async () => {
    soilByPlot[PLOT_A.id] = soilRow(PLOT_A.id, "soil-A", 111);
    listRecommendations.mockResolvedValue([savedRecord(PLOT_A.id, { id: "old-1", engine_version: null, generated_at: null, explanation: { summary: "LEGACY SUMMARY", identified_issues: [], recommended_actions: [], expected_benefit: null, warnings: [] } })]);
    await mountRecs({ selectedPlotId: PLOT_A.id });
    expect(text()).toContain("Earlier records for this plot");
    expect(text()).not.toContain("LEGACY SUMMARY");
    expect(text()).not.toContain("Muriate of Potash (MOP)");
    expect(recPdfButton()).toBeFalsy(); // no recommendation report can be made from an earlier record
  });

  it("a history load failure is an error with a retry, not an empty history", async () => {
    soilByPlot[PLOT_A.id] = soilRow(PLOT_A.id, "soil-A", 111);
    listRecommendations.mockRejectedValue(new ApiError(401, { code: "session_expired", message: "Your session has expired. Please sign in again." }, "x"));
    await mountRecs({ selectedPlotId: PLOT_A.id });
    expect(text()).toContain("Your session has expired. Please sign in again.");
  });
});

// ================================================================ Soil Reports
describe("Soil Reports: upload outcomes", () => {
  it("a failed read stays on screen with its reason and a retry that re-sends the SAME file for the SAME plot", async () => {
    uploadSoilReport.mockResolvedValueOnce(extraction({ status: "failed", extraction_id: null, warnings: ["No readable text found in the document."] }));
    await mountSoil();
    const file = await pickFile("scan.pdf");
    await until(() => /could not be read/.test(text()));
    expect(text()).toContain("could not be read");
    expect(text()).toContain("No readable text found in the document.");
    expect(uploadSoilReport).toHaveBeenCalledTimes(1);
    expect(uploadSoilReport.mock.calls[0][0]).toBe(PLOT_A.id);
    uploadSoilReport.mockResolvedValueOnce(extraction({ status: "failed", extraction_id: null, warnings: ["again"] }));
    await click(button(/scan\.pdf/));
    expect(uploadSoilReport).toHaveBeenCalledTimes(2);
    expect(uploadSoilReport.mock.calls[1][0]).toBe(PLOT_A.id);
    expect(uploadSoilReport.mock.calls[1][1]).toBe(file);
  });

  it("a network failure is shown with its message and a retry (not a silent return to the dropzone)", async () => {
    uploadSoilReport.mockRejectedValueOnce(new ApiError(0, { code: "network_error", message: "Could not reach the NutriPalm server. Check your connection and try again." }, "x"));
    await mountSoil();
    await pickFile("scan.pdf");
    await until(() => /Could not reach/.test(text()));
    expect(text()).toContain("Could not reach the NutriPalm server");
    expect(button(/scan\.pdf/)).toBeTruthy();
    expect(button(/another file/i)).toBeTruthy();
  });

  it("needs_review opens the review step with the values as read and the missing ones marked", async () => {
    uploadSoilReport.mockResolvedValueOnce(extraction());
    await mountSoil();
    await pickFile();
    await until(() => !!host.querySelector("#review-title"));
    expect(host.querySelector("#review-title")).toBeTruthy();
    expect(text()).toContain("211 kg/ha");
    expect(text()).toContain("23.46 kg/ha");
    expect(text()).toMatch(/Not found/i);
  });

  it("after the owner confirms, the saved record is re-read and the recommendation action carries the REAL saved id and plot", async () => {
    uploadSoilReport.mockResolvedValueOnce(extraction());
    confirmExtraction.mockResolvedValue(extraction({ status: "completed", persisted: true, soil_report_id: "soil-77", verification_status: "user_corrected" }));
    const p = await mountSoil();
    await pickFile();
    await until(() => !!host.querySelector("#review-title"));
    soilByPlot[PLOT_A.id] = soilRow(PLOT_A.id, "soil-77", 211);
    // the owner confirms (what is typed is validated by the backend)
    const submit = [...host.querySelectorAll("button")].find((b) => /confirm|save|submit/i.test(b.textContent ?? "") && !/discard/i.test(b.textContent ?? ""));
    await click(submit);
    await until(() => text().includes("211 kg/ha") && !host.querySelector("#review-title"));
    expect(confirmExtraction).toHaveBeenCalledWith("ext-1", expect.any(Object));
    expect(p.onUploadSuccess).toHaveBeenCalledWith(expect.objectContaining({ id: "soil-77", plotId: PLOT_A.id, persisted: true }));
    expect(text()).toContain("211 kg/ha"); // from the database row, not from the unsaved reading
    await click(button(/generate/i));
    expect(p.onRecommendationClick).toHaveBeenCalledWith(PLOT_A.id, expect.objectContaining({ id: "soil-77", plotId: PLOT_A.id }));
  });
});

describe("Soil Reports: what survives leaving and coming back", () => {
  it("offers to continue a stored extraction that is still waiting for review", async () => {
    listExtractions.mockResolvedValue([extraction()]);
    await mountSoil();
    expect(text()).toContain("waiting for your check");
    await click(button(/continue checking/i));
    await until(() => !!host.querySelector("#review-title")); // the upload zone animates out first
    expect(host.querySelector("#review-title")).toBeTruthy();
    expect(text()).toContain("211 kg/ha");
  });

  it("never presents a pending extraction as a verified report", async () => {
    listExtractions.mockResolvedValue([extraction()]);
    await mountSoil();
    expect(text()).not.toMatch(/AI Diagnostic Complete/);
    expect(button(/generate/i)).toBeFalsy();
  });

  it("shows a failed lookup as an error with retry - not as an empty upload screen", async () => {
    soilByPlot[PLOT_A.id] = "ERROR";
    await mountSoil();
    expect(text()).toMatch(/could not be loaded/);
    soilByPlot[PLOT_A.id] = soilRow(PLOT_A.id, "soil-A", 211);
    await click([...host.querySelectorAll("button")].find((b) => /try again/i.test(b.textContent ?? "")));
    await until(() => text().includes("211 kg/ha"));
    expect(text()).toContain("211 kg/ha");
  });

  it("notes legacy (unverified) reports without using them", async () => {
    legacyByPlot[PLOT_A.id] = [{ id: "old-1" }, { id: "old-2" }];
    await mountSoil();
    expect(text()).toMatch(/2 earlier soil report\(s\)/);
    expect(button(/generate/i)).toBeFalsy();
  });

  it("labels values the owner confirmed as confirmed (not 'please check') in the as-read table", async () => {
    soilByPlot[PLOT_A.id] = soilRow(PLOT_A.id, "soil-A", 211);
    listExtractions.mockResolvedValue([
      extraction({ status: "completed", persisted: true, soil_report_id: "soil-A", not_saved: ["zinc"], micronutrients: [field("zinc", { value: 0.7, unit: "mg/kg", validation: "review" })] }),
    ]);
    await mountSoil();
    await until(() => /As read from your laboratory report/.test(text()));
    expect(text()).toContain("Confirmed by you");          // nitrogen was 'review' and the report is verified
    expect(text()).toContain("Read, but not saved");        // the optional zinc value was left out
    expect(text()).not.toContain("Please check");
  });

  it("the summary states what was saved and judges nothing (no invented thresholds, zero is not 'missing')", async () => {
    soilByPlot[PLOT_A.id] = { ...soilRow(PLOT_A.id, "soil-A", 0), potassium_kg_ha: 0, ph: 4.0 };
    await mountSoil();
    await until(() => /Verified soil report for North Block/.test(text()));
    expect(text()).toContain("potassium 0 kg/ha");
    expect(text()).toContain("Nitrogen 0 kg/ha");
    expect(text()).not.toMatch(/within healthy ranges|Attention needed|acidic|is low/);
  });

  it("shows the saved verified report with values straight from the database - a zero is shown as 0, not as missing", async () => {
    soilByPlot[PLOT_A.id] = { ...soilRow(PLOT_A.id, "soil-A", 0), electrical_conductivity: 0 };
    await mountSoil();
    await until(() => text().includes("0 dS/m"));
    expect(text()).toContain("0 kg/ha");
    expect(text()).toContain("0 dS/m");
    expect(text()).not.toMatch(/Nitrogen \(N\)\s*(Not found|N\/A)/);
  });

  it("switching plot on this screen reports the change to the app and reads that plot", async () => {
    soilByPlot[PLOT_A.id] = soilRow(PLOT_A.id, "soil-A", 111);
    soilByPlot[PLOT_B.id] = soilRow(PLOT_B.id, "soil-B", 222);
    const p = await mountSoil();
    expect(text()).toContain("111");
    const select = host.querySelector("select")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(select, PLOT_B.id);
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await until(() => text().includes("222"));
    expect(p.onPlotChange).toHaveBeenCalledWith(PLOT_B.id);
    expect(text()).toContain("222");
    expect(text()).not.toContain("111 kg/ha");
  });
});
