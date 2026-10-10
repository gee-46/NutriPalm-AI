from app.schemas.suitability import CropRequirement, SoilData, ClimateData, WaterData, LocationData, FarmConditions

def calculate_suitability(
    crop: CropRequirement,
    soil: SoilData,
    climate: ClimateData,
    water: WaterData,
    location: LocationData,
    farm: FarmConditions
) -> dict:
    """
    Pure deterministic engine for calculating crop suitability.
    Enforces a pre-check of hard constraints, followed by a 5-pillar weighted score.
    """
    reasons = []
    limitations = []

    # ==========================================
    # 1. HARD CONSTRAINTS (The Pre-Check)
    # ==========================================
    failed_hard_constraint = False
    
    # pH Limits
    if crop.ph_min is not None and soil.ph < crop.ph_min:
        limitations.append(f"Soil pH ({soil.ph}) is strictly below the crop minimum ({crop.ph_min}).")
        failed_hard_constraint = True
    if crop.ph_max is not None and soil.ph > crop.ph_max:
        limitations.append(f"Soil pH ({soil.ph}) is strictly above the crop maximum ({crop.ph_max}).")
        failed_hard_constraint = True

    # Temperature Limits
    if crop.temperature_min is not None and climate.avg_temperature_c < crop.temperature_min:
        limitations.append(f"Average temperature ({climate.avg_temperature_c}°C) is strictly below the minimum ({crop.temperature_min}°C).")
        failed_hard_constraint = True
    if crop.temperature_max is not None and climate.avg_temperature_c > crop.temperature_max:
        limitations.append(f"Average temperature ({climate.avg_temperature_c}°C) is strictly above the maximum ({crop.temperature_max}°C).")
        failed_hard_constraint = True

    # If any hard limit failed, cap immediately to Low Suitability and bypass math
    if failed_hard_constraint:
        return {
            "crop_name": crop.crop_name,
            "category": "Low Suitability",
            "reasons": reasons,
            "limitations": limitations,
            "raw_score": 0
        }

    # ==========================================
    # 2. THE 5-PILLAR WEIGHTED MATH
    # ==========================================

    # --- Pillar 1: Soil Suitability (30%) ---
    soil_score = 0
    soil_max = 0
    
    if crop.ph_min is not None and crop.ph_max is not None:
        soil_max += 1
        soil_score += 1  # Already passed the hard constraint
        reasons.append(f"Soil pH ({soil.ph}) is within acceptable limits.")

    if crop.ec_max is not None:
        soil_max += 1
        if soil.ec <= crop.ec_max:
            soil_score += 1
            reasons.append("Soil salinity (EC) is acceptable.")
        else:
            limitations.append(f"Soil salinity (EC) exceeds recommended maximum ({crop.ec_max}).")
            
    if crop.organic_carbon_min is not None:
        soil_max += 1
        if soil.organic_carbon_percent >= crop.organic_carbon_min:
            soil_score += 1
            reasons.append("Good soil organic carbon levels.")
        else:
            limitations.append("Low organic carbon.")

    # Calculate percentage based *only* on provided optional values
    soil_pct = (soil_score / soil_max * 100) if soil_max > 0 else 100

    # --- Pillar 2: Climate Suitability (30%) ---
    climate_score = 0
    climate_max = 0
    
    if crop.temperature_min is not None and crop.temperature_max is not None:
        climate_max += 1
        climate_score += 1  # Already passed the hard constraint
        reasons.append(f"Average temperature ({climate.avg_temperature_c}°C) is highly suitable.")

    if crop.annual_rainfall_min is not None and crop.annual_rainfall_max is not None:
        climate_max += 1
        if crop.annual_rainfall_min <= climate.avg_annual_rainfall_mm <= crop.annual_rainfall_max:
            climate_score += 1
            reasons.append(f"Natural rainfall ({climate.avg_annual_rainfall_mm}mm) matches crop requirements.")
        else:
            limitations.append(f"Natural rainfall ({climate.avg_annual_rainfall_mm}mm) is outside optimal boundaries.")
            
    climate_pct = (climate_score / climate_max * 100) if climate_max > 0 else 100

    # --- Pillar 3: Water Suitability (20%) ---
    water_pct = 0
    if water.condition == "irrigated":
        if water.reliability == "high":
            water_pct = 100
            reasons.append("High reliability irrigation available.")
        elif water.reliability == "medium":
            water_pct = 75
            reasons.append("Medium reliability irrigation available.")
        else:
            water_pct = 50
            limitations.append("Irrigation is available but has low reliability.")
    else:
        # Rainfed
        if crop.annual_rainfall_min is not None and climate.avg_annual_rainfall_mm >= crop.annual_rainfall_min:
            water_pct = 80
            reasons.append("Rainfed system supported by adequate natural rainfall.")
        else:
            water_pct = 30
            limitations.append("Rainfed system but natural rainfall may be insufficient.")

    # --- Pillar 4: Regional Suitability (10%) ---
    # Fallback to 100% if crop region data is unavailable
    region_pct = 100
    reasons.append(f"Region '{location.region}' is presumed suitable.")

    # --- Pillar 5: Farm-Condition Suitability (10%) ---
    farm_pct = 0
    if farm.land_area_ha >= 1.0:
        farm_pct = 100
        reasons.append(f"Farm land area ({farm.land_area_ha} ha) is sufficient for commercial cultivation.")
    else:
        farm_pct = 60
        limitations.append(f"Small land area ({farm.land_area_ha} ha) might impact commercial scaling.")

    # ==========================================
    # 3. SCORE MAPPING
    # ==========================================
    final_score = (
        (soil_pct * 0.30) +
        (climate_pct * 0.30) +
        (water_pct * 0.20) +
        (region_pct * 0.10) +
        (farm_pct * 0.10)
    )

    if final_score >= 75:
        category = "High Suitability"
    elif final_score >= 50:
        category = "Moderate Suitability"
    else:
        category = "Low Suitability"

    return {
        "crop_name": crop.crop_name,
        "category": category,
        "reasons": reasons,
        "limitations": limitations,
        "raw_score": int(final_score)
    }
