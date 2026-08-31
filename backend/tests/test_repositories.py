from __future__ import annotations

from app.repositories.plot_repository import _row_to_plot_input
from app.schemas.inputs import PlotInput

def test_row_to_plot_input_normalizes_acres_to_acre():
    row = {
        "id": "test-plot-uuid",
        "owner_id": "test-owner-uuid",
        "crop": "oil_palm",
        "area": 12.5,
        "area_unit": "acres",
    }
    plot = _row_to_plot_input(row)
    assert isinstance(plot, PlotInput)
    assert plot.area_unit == "acre"

def test_row_to_plot_input_preserves_standard_units():
    for unit in ["acre", "hectare", "square_meter"]:
        row = {
            "id": "test-plot-uuid",
            "owner_id": "test-owner-uuid",
            "crop": "oil_palm",
            "area": 12.5,
            "area_unit": unit,
        }
        plot = _row_to_plot_input(row)
        assert plot.area_unit == unit
