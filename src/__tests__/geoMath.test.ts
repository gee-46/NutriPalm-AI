// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { computeDistanceMeters, computePolygonPerimeterMeters, squareMetresToAcres } from "../lib/geo";

const ONE_DEGREE_LAT_M = 111_195; // ~ mean Earth radius * pi/180

describe("geo math", () => {
  it("measures one degree of latitude as ~111 km", () => {
    const d = computeDistanceMeters(17, 78, 18, 78);
    expect(Math.abs(d - ONE_DEGREE_LAT_M)).toBeLessThan(300);
  });

  it("is symmetric and zero for identical points", () => {
    expect(computeDistanceMeters(17.1, 78.2, 17.1, 78.2)).toBe(0);
    expect(computeDistanceMeters(17, 78, 17.2, 78.3)).toBeCloseTo(computeDistanceMeters(17.2, 78.3, 17, 78), 6);
  });

  it("computes the perimeter of a ~1 km square boundary", () => {
    const d = 0.009; // ~1 km in latitude
    const poly = {
      type: "Polygon" as const,
      coordinates: [[[78, 17], [78 + d, 17], [78 + d, 17 + d], [78, 17 + d], [78, 17]]],
    };
    const p = computePolygonPerimeterMeters(poly);
    expect(p).toBeGreaterThan(3800);
    expect(p).toBeLessThan(4100);
  });

  it("converts square metres to acres", () => {
    expect(squareMetresToAcres(4046.8564224)).toBeCloseTo(1, 6);
  });
});
