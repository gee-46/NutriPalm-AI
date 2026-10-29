// @vitest-environment jsdom
import { createRoot } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "../translation/LanguageContext";
import type { OcrExtractedField, SoilReportUploadResponsePayload } from "../lib/apiClient";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const confirmExtraction = vi.fn();
vi.mock("../lib/apiClient", async () => {
  const actual = await vi.importActual<typeof import("../lib/apiClient")>("../lib/apiClient");
  return { ...actual, confirmExtraction: (...a: unknown[]) => confirmExtraction(...a) };
});

import { ApiError } from "../lib/apiClient";
import { ExtractionReview } from "../components/prototype/ExtractionReview";

const f = (parameter: string, over: Partial<OcrExtractedField> = {}): OcrExtractedField => ({
  parameter,
  raw_label: parameter,
  value: null,
  unit: null,
  confidence: 0,
  validation: "missing",
  warnings: [],
  ...over,
});

function result(over: Partial<SoilReportUploadResponsePayload> = {}): SoilReportUploadResponsePayload {
  return {
    success: true,
    status: "needs_review",
    persisted: false,
    reused: false,
    extraction_id: "ext-1",
    soil_report_id: null,
    verification_status: null,
    plot_id: "p1",
    raw_text: "",
    nitrogen: f("nitrogen", { value: 211, unit: "kg/ha", validation: "review", warnings: ["Taken from a line below the label."], source_text: "211 kg/ha PHOSPHORUS:23.46", page: 1 }),
    phosphorus: f("phosphorus", { value: 23.46, unit: "kg/ha", validation: "valid" }),
    potassium: f("potassium"), // not found
    ph: f("ph", { value: 68, validation: "unusable", warnings: ["outside the possible range"] }),
    organic_carbon: f("organic_carbon", { value: 0.64, unit: "%", validation: "valid" }),
    electrical_conductivity: f("electrical_conductivity", { value: 0.08, unit: "dS/m", validation: "valid" }),
    extras: [],
    micronutrients: [
      f("zinc", { value: 0.73, unit: "mg/kg", validation: "review" }),
      f("iron", { value: 12, unit: "mg/kg", validation: "valid" }),
    ],
    review_required: ["nitrogen", "potassium", "ph"],
    not_saved: [],
    corrections: [],
    pipeline_version: "ocr-2.0",
    page_count: 1,
    warnings: [],
    ...over,
  };
}

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const onConfirmed = vi.fn();

async function mount(r = result()) {
  await act(async () =>
    root.render(
      <LanguageProvider>
        <ExtractionReview result={r} onConfirmed={onConfirmed} onDiscard={() => {}} />
      </LanguageProvider>
    )
  );
}
const input = (id: string) => host.querySelector<HTMLInputElement>(`#rv-${id}`)!;
async function type(id: string, value: string) {
  const el = input(id);
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    set.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const button = (re: RegExp) => [...host.querySelectorAll("button")].find((b) => re.test(b.textContent ?? ""))!;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  confirmExtraction.mockReset();
  onConfirmed.mockReset();
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("ExtractionReview", () => {
  it("shows every required parameter as read, with its source line and warnings", async () => {
    await mount();
    for (const id of ["nitrogen", "phosphorus", "potassium", "ph", "organic_carbon"]) expect(input(id)).toBeTruthy();
    expect(host.textContent).toContain("Page 1: “211 kg/ha PHOSPHORUS:23.46”");
    expect(host.textContent).toContain("Taken from a line below the label.");
    expect(host.textContent).toContain("Not found in the report");
  });

  it("never pre-fills a missing or impossible value, and lists only uncertain optional values", async () => {
    await mount();
    expect(input("potassium").value).toBe("");
    expect(input("ph").value).toBe(""); // 68 is not a possible pH: it is shown as read, not offered as the value
    expect(input("nitrogen").value).toBe("211");
    expect(input("zinc")).toBeTruthy(); // optional + needs a decision
    expect(host.querySelector("#rv-iron")).toBeNull(); // optional + already valid: nothing to decide
  });

  it("only offers 'I checked this' for values that need checking", async () => {
    await mount();
    expect(host.querySelectorAll('input[type="checkbox"]').length).toBe(2); // nitrogen + zinc (review)
  });

  it("sends typed values as corrections (in the parameter's own unit) and ticked values as confirmed", async () => {
    confirmExtraction.mockResolvedValue(result({ status: "completed", persisted: true }));
    await mount();
    await type("potassium", "150");
    await type("ph", "6.8");
    await act(async () => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click()); // nitrogen
    await act(async () => button(/Confirm and save/).click());

    expect(confirmExtraction).toHaveBeenCalledTimes(1);
    const [id, payload] = confirmExtraction.mock.calls[0];
    expect(id).toBe("ext-1");
    expect(payload.corrections).toEqual({
      potassium: { value: 150, unit: "kg/ha" },
      ph: { value: 6.8, unit: null },
    });
    expect(payload.confirmed).toEqual(["nitrogen"]);
    expect(onConfirmed).toHaveBeenCalledTimes(1);
  });

  it("a changed value is a correction, not a confirmation", async () => {
    confirmExtraction.mockResolvedValue(result({ status: "completed", persisted: true }));
    await mount();
    await type("nitrogen", "245");
    expect(host.textContent).toContain("You changed this value");
    expect(host.querySelectorAll('input[type="checkbox"]').length).toBe(1); // nitrogen's tick box is gone
    await act(async () => button(/Confirm and save/).click());
    expect(confirmExtraction.mock.calls[0][1].corrections.nitrogen).toEqual({ value: 245, unit: "kg/ha" });
    expect(confirmExtraction.mock.calls[0][1].confirmed).toEqual([]);
  });

  it("shows the server's per-field problems and does not report success", async () => {
    confirmExtraction.mockRejectedValue(
      new ApiError(422, { code: "extraction_not_confirmable", problems: { potassium: "Not found in the report. Enter the value from your report." } }, "x")
    );
    await mount();
    await act(async () => button(/Confirm and save/).click());
    expect(host.querySelector('[role="alert"]')!.textContent).toContain("These values still need your attention");
    expect(host.textContent).toContain("Not found in the report. Enter the value from your report.");
    expect(onConfirmed).not.toHaveBeenCalled();
  });

  it("cannot be submitted without an extraction to confirm", async () => {
    await mount(result({ extraction_id: null }));
    expect((button(/Confirm and save/) as HTMLButtonElement).disabled).toBe(true);
  });
});
