"""
Fixture data for tests ONLY.

Nothing in app/ imports from this module. Production code must never depend
on these values - see NO DEMO DATA requirement in the project brief.
"""
from __future__ import annotations

from app.schemas.inputs import PlotInput, SoilTestInput


def deficient_oil_palm_plot() -> PlotInput:
    return PlotInput(
        plot_id="test-plot-1",
        owner_id="test-owner-1",
        crop="oil_palm",
        area=2.0,
        area_unit="hectare",
    )


def deficient_oil_palm_soil() -> SoilTestInput:
    return SoilTestInput(
        soil_report_id="test-soil-1",
        plot_id="test-plot-1",
        owner_id="test-owner-1",
        nitrogen_kg_ha=140.0,   # well below target (280)
        phosphorus_kg_ha=20.0,  # below target (45)
        potassium_kg_ha=325.0,  # within 5% tolerance of target (340) -> adequate
        organic_carbon_percent=0.9,
        ph=5.5,
    )


def healthy_rice_plot() -> PlotInput:
    return PlotInput(
        plot_id="test-plot-2",
        owner_id="test-owner-2",
        crop="rice",
        area=1.0,
        area_unit="hectare",
    )


def healthy_rice_soil() -> SoilTestInput:
    return SoilTestInput(
        soil_report_id="test-soil-2",
        plot_id="test-plot-2",
        owner_id="test-owner-2",
        nitrogen_kg_ha=120.0,
        phosphorus_kg_ha=26.0,
        potassium_kg_ha=60.0,
        organic_carbon_percent=0.6,
        ph=6.2,
    )


def acidic_low_oc_maize_soil() -> SoilTestInput:
    return SoilTestInput(
        soil_report_id="test-soil-3",
        plot_id="test-plot-3",
        owner_id="test-owner-3",
        nitrogen_kg_ha=150.0,
        phosphorus_kg_ha=35.0,
        potassium_kg_ha=60.0,
        organic_carbon_percent=0.2,  # below maize minimum (0.5)
        ph=4.8,  # below maize minimum (5.8)
    )


def maize_plot() -> PlotInput:
    return PlotInput(
        plot_id="test-plot-3",
        owner_id="test-owner-3",
        crop="maize",
        area=3.0,
        area_unit="acre",
    )
