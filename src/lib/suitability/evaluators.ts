export interface SoilData {
  ph?: number | null;
  ec?: number | null;
  organicCarbon?: number | null;
  nitrogen?: number | null;
  phosphorus?: number | null;
  potassium?: number | null;
}

export interface ClimateData {
  temperature?: number | null;
  annualRainfall?: number | null;
}

export interface PlotData {
  acreage?: number | null;
  irrigationAvailable?: boolean | null;
  waterSource?: string | null;
  elevation?: number | null;
  region?: string | null;
}

export interface CropReqs {
  ph_min: number;
  ph_max: number;
  ec_max: number;
  organic_carbon_min: number;
  n_min: number;
  p_min: number;
  k_min: number;
  temperature_min: number;
  temperature_max: number;
  annual_rainfall_min: number;
  annual_rainfall_max: number;
}

export interface EvaluationResult {
  status: "success" | "insufficient_data";
  score: number; // 0-100
  limitations: string[];
  strengths: string[];
  missingFields?: string[];
}

export function evaluateSoilSuitability(soil: SoilData, reqs: CropReqs): EvaluationResult {
  const missing: string[] = [];
  if (soil.ph == null) missing.push("ph");
  if (soil.ec == null) missing.push("ec");
  if (soil.organicCarbon == null) missing.push("organicCarbon");
  if (soil.nitrogen == null) missing.push("nitrogen");
  if (soil.phosphorus == null) missing.push("phosphorus");
  if (soil.potassium == null) missing.push("potassium");

  if (missing.length > 0) {
    return { status: "insufficient_data", score: 0, limitations: [], strengths: [], missingFields: missing };
  }

  let score = 100;
  const limitations: string[] = [];
  const strengths: string[] = [];

  // pH
  if (soil.ph! >= reqs.ph_min && soil.ph! <= reqs.ph_max) {
    strengths.push("Soil pH is in the optimal range.");
  } else {
    score -= 20;
    limitations.push(`Soil pH (${soil.ph}) is outside the optimal range (${reqs.ph_min}-${reqs.ph_max}).`);
  }

  // EC
  if (soil.ec! <= reqs.ec_max) {
    strengths.push("Soil salinity (EC) is acceptable.");
  } else {
    score -= 20;
    limitations.push(`Soil salinity (${soil.ec}) exceeds maximum tolerance (${reqs.ec_max}).`);
  }

  // Organic Carbon
  if (soil.organicCarbon! >= reqs.organic_carbon_min) {
    strengths.push("Good organic carbon levels.");
  } else {
    score -= 15;
    limitations.push(`Low organic carbon (${soil.organicCarbon}% vs min ${reqs.organic_carbon_min}%).`);
  }

  // NPK
  if (soil.nitrogen! >= reqs.n_min && soil.phosphorus! >= reqs.p_min && soil.potassium! >= reqs.k_min) {
    strengths.push("Sufficient macronutrients (NPK) available.");
  } else {
    score -= 20;
    limitations.push("Suboptimal macronutrient levels (NPK deficit).");
  }

  return { status: "success", score: Math.max(0, score), limitations, strengths };
}

export function evaluateClimateSuitability(climate: ClimateData, reqs: CropReqs): EvaluationResult {
  const missing: string[] = [];
  if (climate.temperature == null) missing.push("temperature");
  if (climate.annualRainfall == null) missing.push("annualRainfall");

  if (missing.length > 0) {
    return { status: "insufficient_data", score: 0, limitations: [], strengths: [], missingFields: missing };
  }

  let score = 100;
  const limitations: string[] = [];
  const strengths: string[] = [];

  if (climate.temperature! >= reqs.temperature_min && climate.temperature! <= reqs.temperature_max) {
    strengths.push("Temperature is well suited for cultivation.");
  } else {
    score -= 30;
    limitations.push(`Temperature (${climate.temperature}°C) is outside optimal range (${reqs.temperature_min}-${reqs.temperature_max}°C).`);
  }

  if (climate.annualRainfall! >= reqs.annual_rainfall_min && climate.annualRainfall! <= reqs.annual_rainfall_max) {
    strengths.push("Annual rainfall is optimal.");
  } else if (climate.annualRainfall! < reqs.annual_rainfall_min) {
    score -= 20;
    limitations.push(`Annual rainfall (${climate.annualRainfall}mm) is below the minimum requirement (${reqs.annual_rainfall_min}mm). Supplemental irrigation is critical.`);
  } else {
    score -= 10;
    limitations.push(`High annual rainfall (${climate.annualRainfall}mm). Ensure proper drainage.`);
  }

  return { status: "success", score: Math.max(0, score), limitations, strengths };
}

export function evaluateWaterSuitability(plot: PlotData, reqs: CropReqs): EvaluationResult {
  const missing: string[] = [];
  if (plot.irrigationAvailable == null) missing.push("irrigationAvailable");

  if (missing.length > 0) {
    return { status: "insufficient_data", score: 0, limitations: [], strengths: [], missingFields: missing };
  }

  let score = 100;
  const limitations: string[] = [];
  const strengths: string[] = [];

  if (plot.irrigationAvailable) {
    strengths.push(`Reliable irrigation is available via ${plot.waterSource || 'local source'}.`);
  } else {
    score -= 40;
    limitations.push("No irrigation available. Crop will be entirely rain-fed, posing high moisture stress risk during dry spells.");
  }

  return { status: "success", score: Math.max(0, score), limitations, strengths };
}

export function evaluateRegionalSuitability(plot: PlotData, reqs: CropReqs): EvaluationResult {
  const missing: string[] = [];
  if (plot.elevation == null) missing.push("elevation");

  if (missing.length > 0) {
    return { status: "insufficient_data", score: 0, limitations: [], strengths: [], missingFields: missing };
  }

  let score = 100;
  const limitations: string[] = [];
  const strengths: string[] = [];

  // Coconut typically grown < 600m MSL, Arecanut < 1000m MSL
  const maxElevation = reqs.ph_min === 5.2 ? 600 : 1000; // hacky check based on crop reqs differences

  if (plot.elevation! > maxElevation) {
    score -= 50;
    limitations.push(`Elevation (${plot.elevation}m) exceeds recommended threshold (${maxElevation}m).`);
  } else {
    strengths.push("Elevation is within safe limits for the crop.");
  }

  return { status: "success", score: Math.max(0, score), limitations, strengths };
}

export function evaluateFarmConditionSuitability(plot: PlotData): EvaluationResult {
  const missing: string[] = [];
  if (plot.acreage == null) missing.push("acreage");

  if (missing.length > 0) {
    return { status: "insufficient_data", score: 0, limitations: [], strengths: [], missingFields: missing };
  }

  let score = 100;
  const limitations: string[] = [];
  const strengths: string[] = [];

  if (plot.acreage! < 0.5) {
    score -= 10;
    limitations.push("Plot acreage is very small, which may affect commercial viability.");
  } else {
    strengths.push("Plot size is viable for commercial cultivation.");
  }

  return { status: "success", score: Math.max(0, score), limitations, strengths };
}
