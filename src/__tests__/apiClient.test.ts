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
