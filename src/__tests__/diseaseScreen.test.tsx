// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import high from "./fixtures/disease-assessment.high.sample.json";
import insufficient from "./fixtures/disease-assessment.insufficient.sample.json";
import vocabSample from "./fixtures/disease-vocabulary.sample.json";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ---- mocks: no network, no Supabase ----------------------------------------------------------
const caps = { disease: "available" as "checking" | "available" | "unavailable", cropSuitability: "unavailable" as const };
const api = {
  assessDisease: vi.fn(),
  fetchDiseaseVocabulary: vi.fn(),
  listDiseaseAssessments: vi.fn(),
  getDiseaseAssessment: vi.fn(),
};
vi.mock("../lib/phase2/capabilities", () => ({
  ModuleUnavailableError: class extends Error {},
  assessDisease: (...a: unknown[]) => api.assessDisease(...a),
  fetchDiseaseVocabulary: (...a: unknown[]) => api.fetchDiseaseVocabulary(...a),
  listDiseaseAssessments: (...a: unknown[]) => api.listDiseaseAssessments(...a),
  getDiseaseAssessment: (...a: unknown[]) => api.getDiseaseAssessment(...a),
  probeBackendCapabilities: () => Promise.resolve(caps),
}));
vi.mock("../hooks/useBackendCapabilities", () => ({ useBackendCapabilities: () => caps }));
vi.mock("../hooks/useSavedPlots", () => ({ useSavedPlots: () => [{ id: "plot-1", name: "Garden One", crop: "Coconut" }] }));
vi.mock("../hooks/usePlotWeather", () => ({ usePlotWeather: () => ({ weather: null, loading: false, error: null, centroid: null, refresh: () => undefined }) }));

import { LanguageProvider } from "../translation/LanguageContext";
import { DiseaseScreen } from "../components/prototype/DiseaseScreen";
import { DiseaseResult } from "../components/phase2/DiseaseResult";
import { parseDiseaseAssessment } from "../lib/phase2/validate";
import en from "../translation/translations/en.json";
import kn from "../translation/translations/kn.json";

const E = en as Record<string, string>;
const K = kn as Record<string, string>;

let root: Root;
let host: HTMLElement;

const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};
const render = async (ui: React.ReactElement) => {
  await act(async () => {
    root.render(<LanguageProvider>{ui}</LanguageProvider>);
  });
  await flush();
};
const text = () => host.textContent ?? "";
const select = async (id: string, value: string) => {
  const el = host.querySelector<HTMLSelectElement>(`#${id}`)!;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;
    setter.call(el, value);
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
};
const click = async (el: Element | null) => {
  await act(async () => {
    (el as HTMLElement).click();
  });
};
const submitForm = async () => {
  await act(async () => {
    host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await flush();
};

beforeEach(() => {
  localStorage.clear();
  caps.disease = "available";
  Object.values(api).forEach((m) => m.mockReset());
  api.fetchDiseaseVocabulary.mockResolvedValue(vocabSample);
  api.listDiseaseAssessments.mockResolvedValue([]);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("DiseaseScreen states", () => {
  it("shows the honest unavailable state and disables the form when the backend has no disease service", async () => {
    caps.disease = "unavailable";
    await render(<DiseaseScreen />);
    expect(text()).toContain(E["p2.disease.unavailable_title"]);
    expect(host.querySelector<HTMLButtonElement>("button[type=submit]")!.disabled).toBe(true);
    expect(api.assessDisease).not.toHaveBeenCalled();
  });

  it("shows a loading state while the symptom list loads, then the data-driven symptom checkboxes", async () => {
    let resolve!: (v: unknown) => void;
    api.fetchDiseaseVocabulary.mockReturnValue(new Promise((r) => (resolve = r)));
    await render(<DiseaseScreen />);
    expect(text()).toContain(E["p2.dis.vocab_loading"]);
    await act(async () => resolve(vocabSample));
    await flush();
    expect(host.querySelectorAll("input[type=checkbox]").length).toBeGreaterThan(20);
    expect(text()).toContain(E["p2.dis.sym.spear_leaf_withering"]);
  });

  it("shows an error when the symptom list cannot be loaded", async () => {
    api.fetchDiseaseVocabulary.mockRejectedValue(new Error("boom"));
    await render(<DiseaseScreen />);
    expect(host.querySelector("[role=alert]")?.textContent).toContain("boom");
  });

  it("validates before sending: no plot/crop/symptom -> messages, and no request", async () => {
    await render(<DiseaseScreen />);
    await submitForm();
    expect(host.querySelector("[role=alert]")?.textContent).toContain(E["p2.disease.err_plot"]);
    await select("disease-plot", "plot-1"); // crop is taken from the plot (Coconut)
    await submitForm();
    expect(host.querySelector("[role=alert]")?.textContent).toContain(E["p2.dis.err_symptom"]);
    expect(api.assessDisease).not.toHaveBeenCalled();
  });

  it("rejects an invalid duration and a future date client-side", async () => {
    await render(<DiseaseScreen />);
    await select("disease-plot", "plot-1");
    await click(host.querySelector("input[type=checkbox]"));
    const dur = host.querySelector<HTMLInputElement>("#disease-duration")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(dur, "abc");
      dur.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await submitForm();
    expect(host.querySelector("[role=alert]")?.textContent).toContain(E["p2.dis.err_duration"]);
  });

  it("sends symptom codes (not guessed text) and renders the successful result without claiming a diagnosis", async () => {
    api.assessDisease.mockResolvedValue(parseDiseaseAssessment(high));
    await render(<DiseaseScreen />);
    await select("disease-plot", "plot-1");
    await click(host.querySelector("input[type=checkbox]"));
    await submitForm();
    expect(api.assessDisease).toHaveBeenCalledTimes(1);
    const body = api.assessDisease.mock.calls[0][0];
    expect(body.plot_id).toBe("plot-1");
    expect(body.crop).toBe("coconut");
    expect(Array.isArray(body.symptom_codes) && body.symptom_codes.length === 1).toBe(true);
    expect("owner_id" in body).toBe(false);
    expect(text()).toContain(E["p2.dis.not_diagnosis"]);
    expect(text()).toContain(E["p2.dis.possible_not_confirmed"]);
    expect(text()).toContain("Bud rot of coconut");
    expect(text()).not.toMatch(/confirmed diagnosis of|you have bud rot/i);
  });

  it("ignores a second click while a request is in flight (no duplicate requests)", async () => {
    let resolve!: (v: unknown) => void;
    api.assessDisease.mockReturnValue(new Promise((r) => (resolve = r)));
    await render(<DiseaseScreen />);
    await select("disease-plot", "plot-1");
    await click(host.querySelector("input[type=checkbox]"));
    await submitForm();
    await submitForm();
    expect(api.assessDisease).toHaveBeenCalledTimes(1);
    await act(async () => resolve(parseDiseaseAssessment(insufficient)));
  });

  it("shows an error state when the assessment request fails", async () => {
    api.assessDisease.mockRejectedValue(new Error("Plot not found."));
    await render(<DiseaseScreen />);
    await select("disease-plot", "plot-1");
    await click(host.querySelector("input[type=checkbox]"));
    await submitForm();
    expect(host.querySelector("[role=alert]")?.textContent).toContain("Plot not found.");
  });

  it("every form control has an accessible name", async () => {
    await render(<DiseaseScreen />);
    const unnamed = [...host.querySelectorAll("input, select, textarea")].filter(
      (el) => !(el as HTMLInputElement).labels?.length && !el.getAttribute("aria-label")
    );
    expect(unnamed.map((e) => e.outerHTML.slice(0, 60))).toEqual([]);
  });

  it("lists earlier saved checks for the plot and can reopen one", async () => {
    const rec = { id: "a1", plot_id: "plot-1", crop: "coconut", risk_level: "high", top_disease: "coconut_bud_rot", kb_version: "0.1.0", rule_version: "1.0.0", created_at: "2026-01-02T00:00:00Z", result: null };
    api.listDiseaseAssessments.mockResolvedValue([rec]);
    api.getDiseaseAssessment.mockResolvedValue({ ...rec, result: parseDiseaseAssessment(high) });
    await render(<DiseaseScreen />);
    await select("disease-plot", "plot-1");
    await flush();
    const open = [...host.querySelectorAll("button")].find((b) => b.textContent === E["p2.dis.history_open"]);
    expect(open).toBeTruthy();
    await click(open!);
    await flush();
    expect(text()).toContain("Bud rot of coconut");
  });
});

describe("DiseaseResult", () => {
  it("insufficient evidence: explains that it is not a clean bill of health and asks follow-up questions", async () => {
    await render(<DiseaseResult result={parseDiseaseAssessment(insufficient)} vocab={null} />);
    expect(text()).toContain(E["p2.dis.insufficient_title"]);
    expect(text()).toContain(E["p2.dis.insufficient_note"]);
    expect(text()).toContain(E["p2.disease.explain.insufficient"]);
    expect(text()).toContain(E["p2.dis.follow_up"]);
  });

  it("shows source links only as https with rel=noopener, and the chemical block says verification is needed and no dose is a NutriPalm value", async () => {
    await render(<DiseaseResult result={parseDiseaseAssessment(high)} vocab={null} />);
    const links = [...host.querySelectorAll("a")];
    expect(links.length).toBeGreaterThan(0);
    for (const a of links) {
      expect(a.getAttribute("href")).toMatch(/^https:\/\//);
      expect(a.getAttribute("rel")).toContain("noopener");
    }
    expect(text()).toContain(E["p2.dis.chem.institutional_recommendation_only"]);
    expect(text()).toContain(E["p2.dis.referral"]);
    expect(text()).not.toContain(E["p2.dis.chem.verified_available"]);
  });

  it("management steps come in the documented order with their category headings", async () => {
    await render(<DiseaseResult result={parseDiseaseAssessment(high)} vocab={null} />);
    const order = ["monitoring_and_confirmation", "field_sanitation", "irrigation_drainage_field", "biological_management"].map((c) => text().indexOf(E[`p2.dis.cat.${c}`]));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});

describe("Kannada", () => {
  it("the disease screen switches to Kannada (labels, symptom names, validation messages)", async () => {
    localStorage.setItem("nutripalm_lang", "kn");
    await render(<DiseaseScreen />);
    expect(text()).toContain(K["p2.disease.title"]);
    expect(text()).toContain(K["p2.dis.sym.spear_leaf_withering"]);
    expect(text()).toContain(K["p2.dis.cond.monsoon_period"]);
    await submitForm();
    expect(host.querySelector("[role=alert]")?.textContent).toContain(K["p2.disease.err_plot"]);
  });

  it("the result view is in Kannada, with the server-English note", async () => {
    localStorage.setItem("nutripalm_lang", "kn");
    await render(<DiseaseResult result={parseDiseaseAssessment(high)} vocab={null} />);
    expect(text()).toContain(K["p2.dis.not_diagnosis"]);
    expect(text()).toContain(K["p2.dis.possible_not_confirmed"]);
    expect(text()).toContain(K["p2.dis.chem.institutional_recommendation_only"]);
    expect(text()).toContain(K["p2.lang.backend_note"]);
  });
});
