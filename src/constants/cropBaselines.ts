export interface NutrientTarget {
  target: number;
  unit: string;
  min: number;
  max: number;
}

export interface CropBenchmark {
  nitrogen: NutrientTarget;       // kg/ha
  phosphorus: NutrientTarget;     // kg/ha
  potassium: NutrientTarget;      // kg/ha
  organic_carbon: NutrientTarget; // %
  ph: NutrientTarget;             // pH scale
}

export const CROP_BASELINES: Record<string, CropBenchmark> = {
  oil_palm: {
    nitrogen: { target: 250, unit: 'kg/ha', min: 200, max: 300 },
    phosphorus: { target: 20, unit: 'kg/ha', min: 15, max: 30 },
    potassium: { target: 300, unit: 'kg/ha', min: 250, max: 350 },
    organic_carbon: { target: 0.80, unit: '%', min: 0.50, max: 1.50 },
    ph: { target: 6.0, unit: 'pH', min: 5.5, max: 6.5 }
  },
  arecanut: {
    nitrogen: { target: 100, unit: 'kg/ha', min: 80, max: 120 },
    phosphorus: { target: 40, unit: 'kg/ha', min: 30, max: 50 },
    potassium: { target: 140, unit: 'kg/ha', min: 120, max: 160 },
    organic_carbon: { target: 1.00, unit: '%', min: 0.80, max: 2.00 },
    ph: { target: 6.2, unit: 'pH', min: 5.5, max: 7.0 }
  },
  coconut: {
    nitrogen: { target: 150, unit: 'kg/ha', min: 120, max: 180 },
    phosphorus: { target: 30, unit: 'kg/ha', min: 20, max: 40 },
    potassium: { target: 200, unit: 'kg/ha', min: 180, max: 240 },
    organic_carbon: { target: 0.75, unit: '%', min: 0.50, max: 1.20 },
    ph: { target: 6.5, unit: 'pH', min: 5.5, max: 7.5 }
  },
  rice: {
    nitrogen: { target: 120, unit: 'kg/ha', min: 100, max: 150 },
    phosphorus: { target: 25, unit: 'kg/ha', min: 20, max: 35 },
    potassium: { target: 100, unit: 'kg/ha', min: 80, max: 130 },
    organic_carbon: { target: 0.75, unit: '%', min: 0.50, max: 1.20 },
    ph: { target: 6.5, unit: 'pH', min: 5.5, max: 7.5 }
  },
  sugarcane: {
    nitrogen: { target: 250, unit: 'kg/ha', min: 200, max: 300 },
    phosphorus: { target: 35, unit: 'kg/ha', min: 25, max: 50 },
    potassium: { target: 180, unit: 'kg/ha', min: 150, max: 220 },
    organic_carbon: { target: 0.90, unit: '%', min: 0.60, max: 1.50 },
    ph: { target: 6.8, unit: 'pH', min: 6.0, max: 7.8 }
  }
};

/**
 * Normalizes crop names and retrieves corresponding agronomic benchmarks.
 * Falls back safely to oil_palm if the crop is unrecognized or undefined.
 */
export function getCropBaseline(cropType?: string): CropBenchmark {
  if (!cropType) return CROP_BASELINES.oil_palm;
  const normalized = cropType.toLowerCase().trim().replace(/[\s-]+/g, '_');
  
  if (CROP_BASELINES[normalized]) {
    return CROP_BASELINES[normalized];
  }
  
  // Fuzzy match common synonyms
  if (normalized.includes('palm')) return CROP_BASELINES.oil_palm;
  if (normalized.includes('areca') || normalized.includes('betel')) return CROP_BASELINES.arecanut;
  if (normalized.includes('coco')) return CROP_BASELINES.coconut;
  if (normalized.includes('paddy') || normalized.includes('rice')) return CROP_BASELINES.rice;
  if (normalized.includes('sugar') || normalized.includes('cane')) return CROP_BASELINES.sugarcane;
  
  return CROP_BASELINES.oil_palm;
}
