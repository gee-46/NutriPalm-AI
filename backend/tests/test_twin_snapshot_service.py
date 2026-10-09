"""TwinSnapshotService must not mislabel real data as synthetic or invent values."""
from __future__ import annotations

import pytest

from app.services.twin_snapshot_service import TwinSnapshotService
from tests.test_live_twin import FakeSupabase


class _CapturingQuery:
    def __init__(self, table, rows, sink):
        self.table, self.rows, self.sink = table, rows, sink
        self._upsert = None

    def __getattr__(self, name):
        def chain(*args, **kwargs):
            if name == "upsert":
                self._upsert = args[0]
            return self
        return chain

    def execute(self):
        if self._upsert is not None:
            self.sink.append(self._upsert)

        class R:
            pass

        r = R()
        r.data = self.rows.get(self.table)
        return r


class _Client:
    def __init__(self, rows):
        self.rows = rows
        self.upserts: list[dict] = []

    def table(self, name):
        return _CapturingQuery(name, self.rows, self.upserts)


def _service(rows):
    svc = TwinSnapshotService.__new__(TwinSnapshotService)
    svc.client = _Client(rows)
    import pytz

    svc.ist_tz = pytz.timezone("Asia/Kolkata")
    return svc


PLOT = "11111111-1111-1111-1111-111111111111"


def _run(rows):
    from uuid import UUID

    svc = _service(rows)
    svc.aggregate_for_plot(UUID(PLOT))
    return svc.client.upserts[-1]


def test_real_inputs_produce_non_synthetic_snapshot():
    snap = _run({
        "ndvi_readings": [{"ndvi_mean": 0.61, "is_synthetic": False}],
        "weather_observations": {"temperature_c": 30, "humidity_pct": 70, "rainfall_mm": 1, "is_synthetic": False},
        "soil_reports": [],
    })
    assert snap["is_synthetic"] is False
    assert snap["ndvi"] == 0.61
    assert isinstance(snap["data_completeness"], dict)  # JSON-serialisable


def test_synthetic_input_marks_snapshot_synthetic():
    snap = _run({
        "ndvi_readings": [{"ndvi_mean": 0.5, "is_synthetic": True}],
        "weather_observations": {},
        "soil_reports": [],
    })
    assert snap["is_synthetic"] is True


def test_zero_ndvi_is_kept_as_real_value():
    snap = _run({
        "ndvi_readings": [{"ndvi_mean": 0.0, "is_synthetic": False}],
        "weather_observations": {},
        "soil_reports": [],
    })
    assert snap["ndvi"] == 0.0
    assert snap["data_completeness"]["ndvi"] is True


def test_no_inputs_leave_values_missing_not_invented():
    snap = _run({"ndvi_readings": [], "weather_observations": {}, "soil_reports": []})
    assert snap["ndvi"] is None
    assert snap["temperature_c"] is None
    assert snap["data_completeness"] == {"ndvi": False, "weather": False, "soil": False}
