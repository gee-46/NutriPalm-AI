"""The agronomist checklist shows exactly the numbers the engine uses; nothing in it claims approval."""
import importlib.util
from pathlib import Path

import pytest

from app.services import crop_rules

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "generate_rule_review_sheets.py"
spec = importlib.util.spec_from_file_location("gen_sheets", SCRIPT)
gen = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gen)


def test_committed_checklist_matches_the_catalog():
    if not gen.DOC.exists():
        pytest.skip("docs/AGRONOMIST_REVIEW_CHECKLIST.md is kept locally")
    text = gen.DOC.read_text(encoding="utf-8")
    block = text[text.index(gen.BEGIN): text.index(gen.END) + len(gen.END)]
    assert block == gen.render(), "run: cd backend && python scripts/generate_rule_review_sheets.py --write"


@pytest.mark.parametrize("crop", crop_rules.list_supported_crops())
def test_every_crop_is_listed_with_its_real_numbers_and_marked_not_approved(crop):
    r = crop_rules.get_crop_requirement(crop)
    block = gen.render()
    assert f"`{crop}`) — status: **NOT APPROVED**" in block
    assert f"| N target (kg/ha) | {r.n_target_kg_ha:g} |" in block
    assert f"{r.ph_min:g} – {r.ph_max:g}" in block


def test_no_crop_is_approved_anywhere_in_the_checklist():
    if not gen.DOC.exists():
        pytest.skip("docs/AGRONOMIST_REVIEW_CHECKLIST.md is kept locally")
    text = gen.DOC.read_text(encoding="utf-8")
    assert "status: **APPROVED**" not in text
    assert "no crop rule is approved" in text
