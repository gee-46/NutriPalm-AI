/**
 * Crop reference values shown in the UI (soil benchmark card, Digital Twin soil panel, pH range labels).
 *
 * SINGLE SOURCE OF TRUTH: backend/app/services/crop_rules.py -- the table the recommendation engine
 * actually uses. These values are a mirror of it so the screens never contradict the recommendations.
 * `src/__tests__/cropBaselines.test.ts` parses the Python file and fails if the two drift apart.
 *
 * They are V1 DEFAULT engineering assumptions, not an agronomist-validated model.
 *
 * A nutrient value is "adequate" within +/-5% of its target (same band as the backend analyser).
 * A crop that is not in the backend catalog has NO reference (getCropBaseline returns null) rather
 * than borrowing another crop's numbers.
 */

export interface NutrientTarget {
  target: number;
  unit: string;
  /** lower edge of the adequate band */
  min: number;
  /** upper edge of the adequate band (Infinity = no upper bound) */
  max: number;
}

export interface CropBenchmark {
  nitrogen: NutrientTarget;       // kg/ha
  phosphorus: NutrientTarget;     // kg/ha
  potassium: NutrientTarget;      // kg/ha
  organic_carbon: NutrientTarget; // %
  ph: NutrientTarget;             // pH scale
}

/** Mirrors backend `_ADEQUATE_TOLERANCE_FRACTION` in nutrient_analyzer.py. */
export const ADEQUATE_TOLERANCE_FRACTION = 0.05;

const band = (target: number): NutrientTarget => ({
  target,
  unit: 'kg/ha',
  min: Number((target * (1 - ADEQUATE_TOLERANCE_FRACTION)).toFixed(4)),
  max: Number((target * (1 + ADEQUATE_TOLERANCE_FRACTION)).toFixed(4)),
});
const atLeast = (min: number, unit: string): NutrientTarget => ({ target: min, unit, min, max: Number.POSITIVE_INFINITY });
const range = (min: number, max: number): NutrientTarget => ({ target: Number(((min + max) / 2).toFixed(4)), unit: 'pH', min, max });

export const CROP_BASELINES: Record<string, CropBenchmark> = {
  oil_palm: {
    nitrogen: band(280),
    phosphorus: band(45),
    potassium: band(340),
    organic_carbon: atLeast(0.75, '%'),
    ph: range(4.5, 6.5)
  },
  rice: {
    nitrogen: band(120),
    phosphorus: band(26),
    potassium: band(60),
    organic_carbon: atLeast(0.5, '%'),
    ph: range(5.5, 7)
  },
  maize: {
    nitrogen: band(150),
    phosphorus: band(35),
    potassium: band(60),
    organic_carbon: atLeast(0.5, '%'),
    ph: range(5.8, 7.2)
  },
  sugarcane: {
    nitrogen: band(250),
    phosphorus: band(50),
    potassium: band(120),
    organic_carbon: atLeast(0.6, '%'),
    ph: range(6, 7.5)
  },
  banana: {
    nitrogen: band(200),
    phosphorus: band(40),
    potassium: band(300),
    organic_carbon: atLeast(0.6, '%'),
    ph: range(5.5, 7)
  },
  coconut: {
    nitrogen: band(170),
    phosphorus: band(32),
    potassium: band(280),
    organic_carbon: atLeast(0.5, '%'),
    ph: range(5.2, 8)
  }
};

/** Display names of the crops the recommendation engine supports. */
export const SUPPORTED_CROP_NAMES = ['Oil Palm', 'Rice', 'Maize', 'Sugarcane', 'Banana', 'Coconut'];

/** Same normalisation as the backend (`crop_rules.get_crop_requirement`): lower-case, spaces -> "_". */
export function normalizeCropKey(cropType?: string): string {
  return (cropType || '').trim().toLowerCase().replace(/\s+/g, '_');
}

/** Reference values for a supported crop, or null (unknown crops are never judged against another crop). */
export function getCropBaseline(cropType?: string): CropBenchmark | null {
  return CROP_BASELINES[normalizeCropKey(cropType)] ?? null;
}
