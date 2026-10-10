export const MOCK_SOIL_PROFILES = {
  IDEAL_COCONUT: {
    ph: 6.5,
    ec: 1.0,
    organicCarbon: 1.2,
    nitrogen: 70,
    phosphorus: 20,
    potassium: 120
  },
  HOSTILE_ACIDIC: {
    ph: 4.0, // Too acidic
    ec: 3.5, // Too saline
    organicCarbon: 0.2, // Too low
    nitrogen: 20,
    phosphorus: 5,
    potassium: 30
  },
  INCOMPLETE: {
    ph: 6.0,
    // missing EC, organicCarbon, etc.
    nitrogen: 50
  }
};

export const MOCK_CROP_REQUIREMENTS = {
  Coconut: {
    ph_min: 5.2,
    ph_max: 8.0,
    ec_max: 2.0,
    organic_carbon_min: 0.5,
    n_min: 50,
    p_min: 10,
    k_min: 100,
    temperature_min: 27.0,
    temperature_max: 32.0,
    annual_rainfall_min: 2000,
    annual_rainfall_max: 3000
  },
  Arecanut: {
    ph_min: 5.0,
    ph_max: 8.0,
    ec_max: 1.5,
    organic_carbon_min: 0.5,
    n_min: 100,
    p_min: 40,
    k_min: 140,
    temperature_min: 14.0,
    temperature_max: 36.0,
    annual_rainfall_min: 2500,
    annual_rainfall_max: 4000
  }
};
