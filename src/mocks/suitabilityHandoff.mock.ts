import type { CropSuitabilityResult } from "../lib/suitability/pipeline";
import { MOCK_CROP_REQUIREMENTS, MOCK_SOIL_PROFILES } from "./suitability.mock";
import { runSuitabilityPipeline } from "../lib/suitability/pipeline";
import { getClimateAdvisoryData } from "../lib/weather";

/**
 * Mock interface for Role A (UI) to bind to while backend wiring is completed.
 * Generates a deterministically mocked evaluation for a given plot ID.
 */
export async function getPlotCropSuitability(plotId: string): Promise<CropSuitabilityResult[]> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Determine mock state based on plotId to allow Role A to test different UI states
  let soilData = MOCK_SOIL_PROFILES.IDEAL_COCONUT;
  let acreage = 2.5;
  let irrigation = true;
  let elevation = 400;

  if (plotId === "plot-hostile") {
    soilData = MOCK_SOIL_PROFILES.HOSTILE_ACIDIC;
    irrigation = false;
  } else if (plotId === "plot-incomplete") {
    soilData = MOCK_SOIL_PROFILES.INCOMPLETE;
  }

  const climateResponse = await getClimateAdvisoryData(12.0, 76.0); // Mock coordinates
  const climateData = {
    temperature: climateResponse.data?.temperature,
    annualRainfall: 2800 // Mock annual rainfall
  };

  const plotData = {
    acreage,
    irrigationAvailable: irrigation,
    waterSource: irrigation ? "Borewell" : null,
    elevation,
    region: "Coastal"
  };

  const coconutResult = runSuitabilityPipeline(
    "Coconut",
    soilData,
    climateData,
    plotData,
    MOCK_CROP_REQUIREMENTS.Coconut
  );

  const arecanutResult = runSuitabilityPipeline(
    "Arecanut",
    soilData,
    climateData,
    plotData,
    MOCK_CROP_REQUIREMENTS.Arecanut
  );

  // Return ranked list
  return [coconutResult, arecanutResult].sort((a, b) => b.overallScore - a.overallScore);
}
