// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/supabaseClient", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "tok" } } }) } },
}));

import { ApiError, confirmExtraction, createRecommendation, uploadSoilReport } from "../lib/apiClient";

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("API errors keep structured details", () => {
  it("exposes the code and per-field problems of a 422", async () => {
    fetchMock.mockReturnValue(json(422, { detail: { code: "extraction_not_confirmable", problems: { potassium: "missing" } } }));
    const err = await confirmExtraction("e1", { corrections: {}, confirmed: [] }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(422);
    expect(err.code).toBe("extraction_not_confirmable");
    expect(err.problems).toEqual({ potassium: "missing" });
    expect(err.message).not.toContain("[object Object]");
  });

  it("uses a plain string detail as the message", async () => {
    fetchMock.mockReturnValue(json(415, { detail: "Unsupported file type" }));
    const err = await uploadSoilReport("p1", new File(["x"], "r.txt")).catch((e) => e);
    expect(err.message).toBe("Unsupported file type");
  });

  it("falls back to a readable message for a non-JSON failure", async () => {
    fetchMock.mockReturnValue(Promise.resolve(new Response("<html>bad gateway</html>", { status: 502 })));
    const err = await createRecommendation({ plot_id: "p", soil_report_id: "s" }).catch((e) => e);
    expect(err.message).toBe("Failed to generate recommendation");
  });
});

describe("requests", () => {
  it("sends the bearer token and never an owner id when confirming", async () => {
    fetchMock.mockReturnValue(json(200, { status: "completed" }));
    await confirmExtraction("e 1", { corrections: { ph: { value: 6.8, unit: null } }, confirmed: ["nitrogen"] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/soil-reports/extractions/e%201/confirm");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body)).toEqual({ corrections: { ph: { value: 6.8, unit: null } }, confirmed: ["nitrogen"] });
  });

  it("returns an insufficient_data answer as data, not as an error", async () => {
    fetchMock.mockReturnValue(json(200, { state: "insufficient_data", reasons: [{ code: "no_verified_rule", message: "m" }], required: ["r"] }));
    const out = await createRecommendation({ plot_id: "p", soil_report_id: "s" });
    expect(out.state).toBe("insufficient_data");
  });

  it("posts a recommendation request without any price or owner field", async () => {
    fetchMock.mockReturnValue(json(201, { state: "generated" }));
    await createRecommendation({ plot_id: "p", soil_report_id: "s" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ plot_id: "p", soil_report_id: "s" });
  });
});

describe("failures a person can act on", () => {
  it("reports an unreachable server as a clear network error, never as success or as 'Failed to fetch'", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const err = await uploadSoilReport("p1", new File(["x"], "r.pdf")).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("network_error");
    expect(err.status).toBe(0);
    expect(err.message).toMatch(/Could not reach the NutriPalm server/);
    expect(err.message).not.toMatch(/Failed to fetch/);
  });

  it("an HTML page returned with a 200 (wrong API address) is a clear error, not 'Unexpected token <'", async () => {
    fetchMock.mockReturnValue(Promise.resolve(new Response("<!doctype html><html></html>", { status: 200, headers: { "Content-Type": "text/html" } })));
    const err = await uploadSoilReport("p1", new File(["x"], "r.pdf")).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("bad_response");
    expect(err.message).toMatch(/VITE_API_BASE_URL/);
  });

  it("an expired session says so (401) for upload, recommendations and history", async () => {
    fetchMock.mockImplementation(() => json(401, { detail: "Invalid token" }));
    const { listRecommendations } = await import("../lib/apiClient");
    for (const call of [
      () => uploadSoilReport("p1", new File(["x"], "r.pdf")),
      () => createRecommendation({ plot_id: "p", soil_report_id: "s" }),
      () => listRecommendations(),
    ]) {
      const err = await call().catch((e) => e);
      expect(err.code).toBe("session_expired");
      expect(err.message).toBe("Your session has expired. Please sign in again.");
    }
  });

  it("FastAPI validation errors (a list) become readable text, and structured details never print as [object Object]", async () => {
    fetchMock.mockReturnValue(json(422, { detail: [{ msg: "field required", loc: ["body", "plot_id"] }] }));
    const err = await createRecommendation({ plot_id: "", soil_report_id: "s" }).catch((e) => e);
    expect(err.message).toBe("field required");
    fetchMock.mockReturnValue(json(500, { detail: { code: "boom", message: "Something specific" } }));
    const { listRecommendations } = await import("../lib/apiClient");
    const err2 = await listRecommendations().catch((e) => e);
    expect(err2.message).toBe("Something specific");
    expect(err2.code).toBe("boom");
  });

  it("uploads with FormData and lets the browser set the multipart boundary", async () => {
    fetchMock.mockReturnValue(json(200, { status: "completed" }));
    await uploadSoilReport("p1", new File(["x"], "r.pdf"));
    const init = fetchMock.mock.calls[0][1];
    expect(init.body).toBeInstanceOf(FormData);
    expect(Object.keys(init.headers).map((k) => k.toLowerCase())).not.toContain("content-type");
    expect(init.headers.Authorization).toBe("Bearer tok");
  });
});

describe("a production build that points at localhost", () => {
  it("is reported before any request is made", async () => {
    vi.resetModules();
    vi.stubEnv("PROD", true);
    vi.stubEnv("VITE_API_BASE_URL", "http://localhost:8000");
    vi.stubGlobal("location", { hostname: "app.example.org" }); // a real visitor, not a developer on localhost
    const mod = await import("../lib/apiClient");
    expect(mod.apiBaseProblem()).toMatch(/local server \(localhost\)/);
    const err = await mod.createRecommendation({ plot_id: "p", soil_report_id: "s" }).catch((e: unknown) => e);
    expect((err as { code: string }).code).toBe("api_base_misconfigured");
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("is not reported for a real API address", async () => {
    vi.resetModules();
    vi.stubEnv("PROD", true);
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.org");
    const mod = await import("../lib/apiClient");
    expect(mod.apiBaseProblem()).toBeNull();
    vi.unstubAllEnvs();
  });
});
