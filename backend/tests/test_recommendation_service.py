import pytest

from app.exceptions import ValidationFailed
from app.services import recommendation_service
from tests.fixtures.sample_data import (
    deficient_oil_palm_plot,
    deficient_oil_palm_soil,
    healthy_rice_plot,
    healthy_rice_soil,
)
from app.schemas.inputs import PlotInput, SoilTestInput


def test_build_recommendation_end_to_end():
    result = recommendation_service.build_recommendation(
        deficient_oil_palm_plot(), deficient_oil_palm_soil()
    )

    assert result.crop == "oil_palm"
    assert result.plot_id == "test-plot-1"
    assert result.soil_report_id == "test-soil-1"
    assert result.dosage_plan.total_fertilizer_cost_inr() > 0
    assert result.roi.fertilizer_cost > 0
    assert result.explanation.summary != ""


def test_build_recommendation_healthy_plot():
    result = recommendation_service.build_recommendation(healthy_rice_plot(), healthy_rice_soil())

    assert result.dosage_plan.dosages == []
    assert result.roi.roi_percentage is None


def test_build_recommendation_rejects_mismatched_plot_ids():
    plot = deficient_oil_palm_plot()
    soil = SoilTestInput(
        soil_report_id="s",
        plot_id="different-plot-id",
        owner_id=plot.owner_id,
        nitrogen_kg_ha=100,
        phosphorus_kg_ha=20,
        potassium_kg_ha=200,
        organic_carbon_percent=0.8,
        ph=5.5,
    )
    with pytest.raises(ValidationFailed):
        recommendation_service.build_recommendation(plot, soil)


def test_build_recommendation_rejects_mismatched_owner():
    plot = deficient_oil_palm_plot()
    soil = deficient_oil_palm_soil().model_copy(update={"owner_id": "someone-else"})
    with pytest.raises(ValidationFailed):
        recommendation_service.build_recommendation(plot, soil)


def test_build_recommendation_respects_area_unit_conversion():
    plot_acres = PlotInput(
        plot_id="p-acre", owner_id="o-acre", crop="oil_palm", area=4.9421, area_unit="acre"
    )
    soil = deficient_oil_palm_soil().model_copy(
        update={"plot_id": "p-acre", "owner_id": "o-acre"}
    )
    result_acre = recommendation_service.build_recommendation(plot_acres, soil)

    plot_ha = PlotInput(
        plot_id="p-acre", owner_id="o-acre", crop="oil_palm", area=2.0, area_unit="hectare"
    )
    result_ha = recommendation_service.build_recommendation(plot_ha, soil)

    # 4.9421 acres ~= 2.0 hectares, so totals should be very close
    assert result_acre.dosage_plan.total_fertilizer_kg() == pytest.approx(
        result_ha.dosage_plan.total_fertilizer_kg(), rel=1e-2
    )
