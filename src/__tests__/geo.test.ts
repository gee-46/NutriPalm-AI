// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";

vi.stubEnv("VITE_SUPABASE_URL", "");
vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
vi.spyOn(console, "error").mockImplementation(() => {});

const SQUARE = {
  type: "Polygon" as const,
  coordinates: [[[78.0, 17.0], [78.2, 17.0], [78.2, 17.2], [78.0, 17.2], [78.0, 17.0]]],
};

describe("polygonCentroid", () => {
  it("returns the centroid in WGS84 [lng, lat] order", async () => {
    const { polygonCentroid } = await import("../data/plots");
    const c = polygonCentroid(SQUARE);
    expect(c).not.toBeNull();
    expect(c!.lng).toBeCloseTo(78.1, 6);
    expect(c!.lat).toBeCloseTo(17.1, 6);
  });

  it("is NOT the first vertex (regression: plots used to store the first vertex)", async () => {
    const { polygonCentroid } = await import("../data/plots");
    const c = polygonCentroid(SQUARE)!;
    expect(c.lng).not.toBe(SQUARE.coordinates[0][0][0]);
    expect(c.lat).not.toBe(SQUARE.coordinates[0][0][1]);
  });

  it.each([undefined, null, { type: "Polygon", coordinates: [] }, { type: "Polygon", coordinates: [[[1, 1], [2, 2]]] }])(
    "returns null for unusable geometry %#",
    async (geo) => {
      const { polygonCentroid } = await import("../data/plots");
      expect(polygonCentroid(geo as never)).toBeNull();
    }
  );
});

describe("rowToFarmer", () => {
  it("never invents health, yield or recommendation data", async () => {
    const { rowToFarmer } = await import("../data/farmers");
    const f = rowToFarmer({
      id: "f1", owner_id: "u1", name: "A", village: null, district: null, contact: null,
      email: null, crop: null, area: null, status: null, created_at: "2026-07-01T00:00:00Z",
    });
    expect(f.soilHealth).toBeNull();
    expect(f.yield).toBeNull();
    expect(f.digitalTwin).toBeNull();
    expect(f.lastRecommendation).toBeNull();
    expect(f.lastInspection).toBeNull();
    expect(f.status).toBe("Active");
  });
});

describe("crop baselines", () => {
  it("does not judge unknown crops against oil palm", async () => {
    const { getCropBaseline } = await import("../constants/cropBaselines");
    expect(getCropBaseline("Cocoa")).toBeNull();
    expect(getCropBaseline(undefined)).toBeNull();
    expect(getCropBaseline("Oil Palm")).not.toBeNull();
  });
});

describe("crop baseline name matching", () => {
  it("maps Coconut Palm to coconut (not oil palm) and Cocoa to nothing", async () => {
    const { getCropBaseline, CROP_BASELINES } = await import("../constants/cropBaselines");
    expect(getCropBaseline("Coconut Palm")).toBe(CROP_BASELINES.coconut);
    expect(getCropBaseline("Oil Palm")).toBe(CROP_BASELINES.oil_palm);
    expect(getCropBaseline("oil_palm")).toBe(CROP_BASELINES.oil_palm);
    expect(getCropBaseline("Cocoa")).toBeNull();
  });
});
