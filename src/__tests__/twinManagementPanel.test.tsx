// @vitest-environment jsdom
import { createRoot } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "../translation/LanguageContext";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Call = { table: string; filters: Array<[string, ...unknown[]]>; insert?: unknown };
const calls: Call[] = [];
let tables: Record<string, unknown[]> = {};
let insertError: { message: string } | null = null;

function query(table: string) {
  const call: Call = { table, filters: [] };
  calls.push(call);
  const q: Record<string, unknown> = {};
  const chain = (name: string) => (...args: unknown[]) => {
    call.filters.push([name, ...args]);
    return q;
  };
  for (const n of ["select", "eq", "not", "order", "limit", "in"]) q[n] = chain(n);
  q.insert = (row: unknown) => {
    call.insert = row;
    return Promise.resolve({ error: insertError });
  };
  q.delete = () => ({ eq: () => Promise.resolve({ error: null }) });
  q.then = (resolve: (v: unknown) => void) => resolve({ data: tables[table] ?? [], error: null });
  return q;
}

vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    from: (t: string) => query(t),
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
  },
}));

import { TwinManagementPanel } from "../components/prototype/TwinManagementPanel";

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const toast = vi.fn();

async function mount() {
  await act(async () =>
    root.render(
      <LanguageProvider>
        <TwinManagementPanel plotId="plot-1" showToast={toast} />
      </LanguageProvider>
    )
  );
}
async function type(id: string, value: string) {
  const el = host.querySelector<HTMLInputElement>(`#${id}`)!;
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}
const submit = () => act(async () => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));

beforeEach(() => {
  calls.length = 0;
  tables = {};
  insertError = null;
  toast.mockReset();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("TwinManagementPanel", () => {
  it("reads only verified soil tests and engine-generated advice for the selected plot", async () => {
    await mount();
    const soil = calls.find((c) => c.table === "soil_reports")!;
    expect(soil.filters).toContainEqual(["eq", "plot_id", "plot-1"]);
    expect(soil.filters).toContainEqual(["not", "verification_status", "is", null]);
    const rec = calls.find((c) => c.table === "recommendations")!;
    expect(rec.filters).toContainEqual(["not", "engine_version", "is", null]);
    expect(calls.find((c) => c.table === "fertilizer_applications")!.filters).toContainEqual(["eq", "plot_id", "plot-1"]);
  });

  it("shows honest empty states, never placeholder rows", async () => {
    await mount();
    expect(host.textContent).toContain("No verified soil test for this plot yet.");
    expect(host.textContent).toContain("No recommendation has been generated for this plot.");
    expect(host.textContent).toContain("No fertilizer application recorded yet.");
  });

  it("keeps measurements, advice and applications in separately labelled sections", async () => {
    tables = {
      soil_reports: [{ id: "s1", created_at: "2026-03-01T00:00:00Z", ph: 6.1, nitrogen_kg_ha: 200, phosphorus_kg_ha: 20, potassium_kg_ha: 250, organic_carbon_percent: 0.7, verification_status: "user_corrected" }],
      recommendations: [{ id: "r1", created_at: "2026-03-02T00:00:00Z", crop: "oil_palm", engine_version: "rec-2.0", fertilizer_plan: [{ product_display_name: "Urea", quantity_kg_per_ha: 120 }] }],
      fertilizer_applications: [{ id: "a1", recommendation_id: "r1", applied_on: "2026-03-05", product_name: "Urea", quantity: 50, quantity_unit: "kg", method: "ring", notes: null }],
    };
    await mount();
    const headings = [...host.querySelectorAll("h3")].map((h) => (h.textContent ?? "").trim());
    expect(headings).toContain("Soil tests (measured)");
    expect(headings).toContain("Recommendations (advice, not applied)");
    expect(headings).toContain("Fertilizer applied (recorded by you)");
    expect(host.textContent).toContain("Corrected by you");
    expect(host.textContent).toContain("Urea: 120 kg/ha"); // advice
    expect(host.textContent).toContain("Urea · 50 kg"); // what was applied is a separate line
    expect(host.textContent).toContain("This is advice only. It does not mean any fertilizer has been applied.");
  });

  it("rejects a future date, an empty product and a non-positive quantity without calling the database", async () => {
    await mount();
    await type("app-date", "2999-01-01");
    await type("app-product", "Urea");
    await type("app-qty", "5");
    await submit();
    expect(host.querySelector('[role="alert"]')!.textContent).toContain("not in the future");

    await type("app-date", new Date().toISOString().slice(0, 10));
    await type("app-product", "  ");
    await submit();
    expect(host.querySelector('[role="alert"]')!.textContent).toContain("product name");

    await type("app-product", "Urea");
    await type("app-qty", "0");
    await submit();
    expect(host.querySelector('[role="alert"]')!.textContent).toContain("greater than zero");
    expect(calls.some((c) => c.insert)).toBe(false);
  });

  it("records a valid application against the plot, owned by the signed-in user", async () => {
    await mount();
    await type("app-product", " Urea ");
    await type("app-qty", "50");
    await type("app-unit", "kg/ha");
    await type("app-method", "ring");
    await submit();
    const insert = calls.find((c) => c.insert)!.insert as Record<string, unknown>;
    expect(insert).toMatchObject({
      owner_id: "user-1",
      plot_id: "plot-1",
      product_name: "Urea",
      quantity: 50,
      quantity_unit: "kg/ha",
      method: "ring",
      recommendation_id: null,
    });
    expect(toast).toHaveBeenCalledWith("Application recorded.", "success");
  });

  it("reports a failed save instead of claiming success", async () => {
    insertError = { message: "row-level security" };
    await mount();
    await type("app-product", "Urea");
    await type("app-qty", "5");
    await submit();
    expect(host.querySelector('[role="alert"]')!.textContent).toContain("Could not save: row-level security");
    expect(toast).not.toHaveBeenCalled();
  });
});
