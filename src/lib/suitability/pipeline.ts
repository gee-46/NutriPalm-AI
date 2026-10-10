import {
  evaluateSoilSuitability,
  evaluateClimateSuitability,
  evaluateWaterSuitability,
  evaluateRegionalSuitability,
  evaluateFarmConditionSuitability,
  type SoilData,
  type ClimateData,
  type PlotData,
  type CropReqs,
  type EvaluationResult
} from "./evaluators";

export interface CropSuitabilityResult {
  crop: "Arecanut" | "Coconut";
  suitabilityLevel: "High" | "Medium" | "Low";
  overallScore: number; // 0 - 100
  limitingFactors: string[];
  strengths: string[];
  farmerExplanation: string;
  evaluatedAt: string;
  dataConfidence: "Complete" | "Partial (Estimated Climate)" | "Insufficient Data";
}

export function generateFarmerExplanation(strengths: string[], limitations: string[]): string {
  if (limitations.length === 0) {
    return "This plot is highly suitable for cultivation. " + strengths.join(" ");
  } else if (strengths.length === 0) {
    return "This plot has significant challenges. " + limitations.join(" ");
  } else {
    return `The plot has good potential (${strengths[0]}), but requires attention to certain factors: ${limitations.join("; ")}.`;
  }
}

export function runSuitabilityPipeline(
  crop: "Arecanut" | "Coconut",
  soil: SoilData,
  climate: ClimateData,
  plot: PlotData,
  reqs: CropReqs
): CropSuitabilityResult {
  const soilEval = evaluateSoilSuitability(soil, reqs);
  const climateEval = evaluateClimateSuitability(climate, reqs);
  const waterEval = evaluateWaterSuitability(plot, reqs);
  const regionalEval = evaluateRegionalSuitability(plot, reqs);
  const farmEval = evaluateFarmConditionSuitability(plot);

  const evals = [soilEval, climateEval, waterEval, regionalEval, farmEval];
  const insufficientCount = evals.filter((e) => e.status === "insufficient_data").length;

  let dataConfidence: "Complete" | "Partial (Estimated Climate)" | "Insufficient Data" = "Complete";
  if (insufficientCount >= 3) {
    dataConfidence = "Insufficient Data";
  } else if (insufficientCount > 0) {
    dataConfidence = "Partial (Estimated Climate)";
  }

  // Weighting scheme
  // Soil: 35%, Climate: 25%, Water: 20%, Regional: 10%, Farm: 10%
  let overallScore = 0;
  if (dataConfidence !== "Insufficient Data") {
    overallScore =
      (soilEval.score * 0.35) +
      (climateEval.score * 0.25) +
      (waterEval.score * 0.20) +
      (regionalEval.score * 0.10) +
      (farmEval.score * 0.10);
  }

  const allLimitations = [
    ...(soilEval.limitations || []),
    ...(climateEval.limitations || []),
    ...(waterEval.limitations || []),
    ...(regionalEval.limitations || []),
    ...(farmEval.limitations || [])
  ];

  const allStrengths = [
    ...(soilEval.strengths || []),
    ...(climateEval.strengths || []),
    ...(waterEval.strengths || []),
    ...(regionalEval.strengths || []),
    ...(farmEval.strengths || [])
  ];

  let suitabilityLevel: "High" | "Medium" | "Low" = "Low";
  if (overallScore >= 75) {
    suitabilityLevel = "High";
  } else if (overallScore >= 50) {
    suitabilityLevel = "Medium";
  }

  return {
    crop,
    suitabilityLevel,
    overallScore: Math.round(overallScore),
    limitingFactors: allLimitations,
    strengths: allStrengths,
    farmerExplanation: generateFarmerExplanation(allStrengths, allLimitations),
    evaluatedAt: new Date().toISOString(),
    dataConfidence
  };
}
