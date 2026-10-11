"""
export_disease_contract_samples.py

Writes real backend output for fixed example inputs to src/__tests__/fixtures/, so the frontend
contract tests parse exactly what the backend produces. A backend test (tests/disease/test_contract_samples.py)
fails when these files are stale, so the two sides cannot drift apart.

    python scripts/export_disease_contract_samples.py

The inputs are EXAMPLES for testing the contract, not real observations of any farm.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.disease.knowledge_base import load_knowledge_base  # noqa: E402
from app.disease.repository import PlotContext  # noqa: E402
from app.disease.schemas import AssessmentRequest  # noqa: E402
from app.disease.service import DiseaseService  # noqa: E402

OUT = ROOT.parent / "src" / "__tests__" / "fixtures"
FIXED_TIME = "2026-01-01T00:00:00+00:00"

EXAMPLES = {
    "disease-assessment.high.sample.json": dict(plot_id="p1", crop="coconut", crop_stage="adult", symptom_codes=["spear_leaf_withering", "spindle_pulls_out"], context={"high_rainfall_area": "yes"}),
    "disease-assessment.arecanut.sample.json": dict(plot_id="p2", crop="arecanut", symptom_codes=["nut_water_soaked_lesions", "nuts_lose_lustre"], context={"monsoon_period": "yes"}),
    "disease-assessment.insufficient.sample.json": dict(plot_id="p1", crop="coconut"),
}


class _Plots:
    def get_plot_context(self, plot_id):
        return {"p1": PlotContext("p1", "u", "coconut", "Karnataka", None), "p2": PlotContext("p2", "u", "arecanut", "Karnataka", None)}[plot_id]


class _Store:
    def save(self, owner_id, request, result, top):
        return {"id": "00000000-0000-0000-0000-000000000001"}


def build() -> dict[str, dict]:
    svc = DiseaseService(load_knowledge_base(), _Plots(), _Store())
    out: dict[str, dict] = {}
    for name, req in EXAMPLES.items():
        data = svc.assess("u", AssessmentRequest(**req)).model_dump(mode="json")
        data["assessed_at"] = FIXED_TIME
        out[name] = data
    out["disease-vocabulary.sample.json"] = svc.vocabulary()
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, data in build().items():
        (OUT / name).write_text(json.dumps(data, indent=2, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")
        print("wrote", name)


if __name__ == "__main__":
    main()
