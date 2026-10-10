import pytest
from app.schemas.suitability import CropRequirement, SoilData, ClimateData, WaterData, LocationData, FarmConditions
from app.services.suitability_engine import calculate_suitability

@pytest.fixture
def base_crop():
    return CropRequirement(
        crop_name="Coconut",
        ph_min=5.2,
        ph_max=8.0,
        ec_max=2.0,
        organic_carbon_min=0.5,
        temperature_min=27.0,
        temperature_max=32.0,
        annual_rainfall_min=2000.0,
        annual_rainfall_max=3000.0,
        water_needs_mm_per_day=150.0
    )

@pytest.fixture
def perfect_soil():
    return SoilData(
        ph=6.5,
        ec=1.0,
        organic_carbon_percent=1.2,
        n_kg_ha=100.0,
        p_kg_ha=40.0,
        k_kg_ha=150.0
    )

@pytest.fixture
def perfect_climate():
    return ClimateData(
        avg_temperature_c=28.5,
        avg_annual_rainfall_mm=2500.0,
        current_temperature_c=29.0,
        current_humidity_pct=75.0
    )

@pytest.fixture
def perfect_water():
    return WaterData(
        irrigation_availability=True,
        reliability="high",
        condition="irrigated"
    )

@pytest.fixture
def standard_location():
    return LocationData(latitude=12.9716, longitude=77.5946, region="Karnataka")

@pytest.fixture
def standard_farm():
    return FarmConditions(land_area_ha=2.5)

def test_perfect_conditions(base_crop, perfect_soil, perfect_climate, perfect_water, standard_location, standard_farm):
    """Should score > 80% (High Suitability) when all inputs are perfect."""
    result = calculate_suitability(
        crop=base_crop,
        soil=perfect_soil,
        climate=perfect_climate,
        water=perfect_water,
        location=standard_location,
        farm=standard_farm
    )
    
    assert result["crop_name"] == "Coconut"
    assert result["category"] == "High Suitability"
    assert result["raw_score"] >= 80

def test_hard_constraint_failure(base_crop, perfect_soil, perfect_climate, perfect_water, standard_location, standard_farm):
    """A single extreme value (e.g., 45°C) should result in Low Suitability instantly."""
    extreme_climate = ClimateData(
        avg_temperature_c=45.0, # Exceeds max 32.0
        avg_annual_rainfall_mm=2500.0,
        current_temperature_c=45.0,
        current_humidity_pct=75.0
    )
    
    result = calculate_suitability(
        crop=base_crop,
        soil=perfect_soil,
        climate=extreme_climate,
        water=perfect_water,
        location=standard_location,
        farm=standard_farm
    )
    
    assert result["category"] == "Low Suitability"
    assert result["raw_score"] == 0
    assert any("above the maximum" in limit for limit in result["limitations"])

def test_missing_soil_parameters(perfect_climate, perfect_water, standard_location, standard_farm):
    """Passing None for optional crop requirements must not crash the engine and should still compute % correctly."""
    # A crop with minimal requirements
    minimal_crop = CropRequirement(
        crop_name="Minimal Crop",
        ph_min=None,
        ph_max=None,
        ec_max=None,
        organic_carbon_min=None,
        temperature_min=20.0,
        temperature_max=30.0,
        annual_rainfall_min=None,
        annual_rainfall_max=None
    )
    
    # Soil doesn't matter since the crop doesn't require any soil params
    minimal_soil = SoilData(
        ph=7.0, ec=0.5, organic_carbon_percent=1.0, n_kg_ha=0, p_kg_ha=0, k_kg_ha=0
    )
    
    result = calculate_suitability(
        crop=minimal_crop,
        soil=minimal_soil,
        climate=perfect_climate,
        water=perfect_water,
        location=standard_location,
        farm=standard_farm
    )
    
    # Even though soil params are missing, it should handle the 0 denominator check properly
    # Soil max will be 0, which should fallback to 100% soil_pct.
    assert result["raw_score"] > 0
    assert result["category"] in ["High Suitability", "Moderate Suitability"]
