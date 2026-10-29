import { describe, expect, it } from "vitest";
import en from "../translation/translations/en.json";

const SOURCES = import.meta.glob(["../**/*.ts", "../**/*.tsx", "!../__tests__/**"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const FILES = Object.keys(SOURCES);

describe("product scope: OCR + fertilizer recommendation and the Digital Twin", () => {
  it("has no screen, hook or contract files for removed features", () => {
    for (const gone of ["DiseaseScreen", "DiseaseResult", "CropSuitabilityScreen", "AnalyticsScreen", "WeatherAdvisoryScreen", "useFarmerAnalytics", "useBackendCapabilities", "phase2/contracts", "phase2/capabilities", "DashboardPreview"]) {
      expect(FILES.filter((f) => f.includes(gone)), gone).toEqual([]);
    }
  });

  it("does not link or route to removed features", () => {
    const shell = SOURCES["../components/PrototypeApp.tsx"];
    for (const name of ["Disease Intelligence", "Crop Suitability", "Analytics", '"Weather"']) {
      expect(shell, name).not.toContain(name);
    }
    for (const [file, src] of Object.entries(SOURCES)) {
      expect(src, file).not.toMatch(/onNavigate\(\s*["'](Disease Intelligence|Crop Suitability|Analytics|Weather)["']/);
    }
  });

  it("never calls the removed backend endpoints", () => {
    for (const [file, src] of Object.entries(SOURCES)) {
      expect(src, file).not.toMatch(/\/api\/(disease|crop-suitability|chat|rag)/);
    }
  });

  it("keeps the navigation to the retained features", () => {
    const shell = SOURCES["../components/PrototypeApp.tsx"];
    for (const name of ["Dashboard", "Farmers", "Farm Plots", "Soil Reports", "Digital Twin", "Recommendations", "History", "Settings"]) {
      expect(shell, name).toContain(`name: "${name}"`);
    }
  });

  it("the public landing page makes no claim about, and shows no mock numbers for, removed features", () => {
    expect(SOURCES["../components/Features.tsx"]).not.toContain("features.analytics_dashboard");
    expect(SOURCES["../App.tsx"]).not.toContain("DashboardPreview");
    expect(SOURCES["../components/Navbar.tsx"]).not.toContain("Console Preview");
  });

  it("no longer offers to load a sample soil report into a real plot", () => {
    expect(SOURCES["../components/prototype/SoilReportScreen.tsx"]).not.toMatch(/sample-soil-report/);
  });

  it("does not describe removed features as active product copy in the retained screens", () => {
    const dashboard = SOURCES["../components/prototype/DashboardScreen.tsx"];
    expect(dashboard).not.toMatch(/disease|suitab/i);
    expect(typeof (en as Record<string, string>)["p3.rec.insufficient_title"]).toBe("string");
  });
});
