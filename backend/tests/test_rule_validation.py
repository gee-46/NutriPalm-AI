"""A rule record is activated only if it is complete, approved, traceable, unit-correct, consistent and unambiguous."""
import copy
import json
import math
from datetime import date

import pytest

from app.services import crop_rules, rule_provenance as rp

TODAY = date(2026, 10, 30)


def valid_record(crop="oil_palm"):
    """Structurally complete. Its text is a placeholder: it exercises the validator, it is NOT agronomic content."""
    req = crop_rules.get_crop_requirement(crop)
    return {
        "crop": crop,
        "rule_version": "t-1",
        "status": "approved",
        "test_fixture": True,
        "applicable_stage": "PLACEHOLDER stage",
        "region": "PLACEHOLDER region",
        "units": {"nutrient_targets": "kg/ha", "organic_carbon": "%"},
        "soil_test_basis": {"phosphorus": req.p_basis.value, "potassium": req.k_basis.value},
        "assumptions": ["PLACEHOLDER assumption"],
        "source": {
            "id": "ph", "title": "PLACEHOLDER title", "publisher": "PLACEHOLDER publisher", "edition": "1st",
            "year": 2020, "locator": "Table 1, p. 1", "quote": "PLACEHOLDER quotation of at least twenty characters",
        },
        "reviewed_by": {"name": "Placeholder Reviewer", "role": "agronomist"},
        "reviewed_on": "2026-10-01",
        "product_grades_verified": {"urea": "ref", "dap": "ref", "mop": "ref"},
        "targets": {k: getattr(req, k) for k in rp._TARGET_KEYS},
    }


def problems(record, **kw):
    return rp.validate_record(record, today=TODAY, allow_test_fixture=True, **kw)


def mutated(path, value):
    rec = valid_record()
    node = rec
    *head, last = path.split(".")
    for h in head:
        node = node[h]
    if value is rp:  # sentinel: delete
        del node[last]
    else:
        node[last] = value
    return rec


def test_a_complete_consistent_approved_record_is_activatable():
    assert problems(valid_record()) == []


@pytest.mark.parametrize("crop", crop_rules.list_supported_crops())
def test_every_catalog_crop_can_in_principle_be_activated(crop):
    assert problems(valid_record(crop)) == []


# ------------------------------------------------------------------ missing / incomplete
@pytest.mark.parametrize(
    "path,needle",
    [
        ("source.id", "source.id"), ("source.title", "source.title"), ("source.publisher", "source.publisher"),
        ("source.edition", "source.edition"), ("source.locator", "source.locator"), ("source.quote", "source.quote"),
        ("applicable_stage", "applicable_stage"), ("region", "region"), ("rule_version", "rule_version"),
        ("assumptions", "assumptions"), ("units", "units"), ("soil_test_basis", "soil_test_basis"),
        ("product_grades_verified", "product_grades_verified"), ("reviewed_by", "reviewed_by"), ("reviewed_on", "reviewed_on"),
        ("targets.n_target_kg_ha", "targets.n_target_kg_ha"), ("targets.ph_max", "targets.ph_max"), ("source", "source"),
    ],
)
def test_missing_pieces_block_activation(path, needle):
    out = problems(mutated(path, rp))
    assert any(needle in p for p in out), out


@pytest.mark.parametrize("path", ["source.title", "source.locator", "applicable_stage", "region", "source.publisher"])
def test_blank_or_whitespace_text_counts_as_missing(path):
    assert problems(mutated(path, "   "))


def test_the_citation_must_actually_quote_something():
    assert any("quote" in p for p in problems(mutated("source.quote", "n/a")))


@pytest.mark.parametrize("year", ["2020", 2020.5, None, 1850, 2999, True])
def test_source_year_must_be_a_real_year(year):
    assert any("source.year" in p for p in problems(mutated("source.year", year)))


def test_source_url_if_present_must_be_http():
    assert any("source.url" in p for p in problems(mutated("source.url", "ftp://x")))
    assert problems(mutated("source.url", "https://example.org/doc.pdf")) == []


def test_reviewer_needs_name_and_role_and_a_real_past_date():
    assert any("reviewed_by" in p for p in problems(mutated("reviewed_by", {"name": "A"})))
    assert any("reviewed_by" in p for p in problems(mutated("reviewed_by", "A. Person, agronomist")))
    assert any("future" in p for p in problems(mutated("reviewed_on", "2026-10-31")))
    assert any("YYYY-MM-DD" in p for p in problems(mutated("reviewed_on", "31/10/2026")))


@pytest.mark.parametrize("status", ["pending_review", "draft", "", None, "APPROVED"])
def test_only_approved_status_activates(status):
    assert any("not 'approved'" in p for p in problems(mutated("status", status)))


def test_assumptions_must_be_nonempty_statements():
    assert problems(mutated("assumptions", []))
    assert problems(mutated("assumptions", [""]))
    assert problems(mutated("assumptions", "one string"))


def test_the_reviewer_must_have_checked_every_product_grade_the_engine_uses():
    for code in ("urea", "dap", "mop"):
        rec = valid_record()
        del rec["product_grades_verified"][code]
        assert any(code in p for p in problems(rec))


# ------------------------------------------------------------------ unit-incompatible / contradictory
@pytest.mark.parametrize(
    "units",
    [
        {"nutrient_targets": "g/palm", "organic_carbon": "%"},
        {"nutrient_targets": "kg/ha", "organic_carbon": "g/kg"},
        {"nutrient_targets": "kg P2O5/ha", "organic_carbon": "%"},
        {"nutrient_targets": "kg/ha"},
    ],
)
def test_units_the_engine_does_not_convert_are_refused(units):
    assert any("units must be" in p for p in problems(mutated("units", units)))


def test_p_and_k_basis_must_be_stated_valid_and_equal_to_what_the_engine_uses():
    assert any("soil_test_basis" in p for p in problems(mutated("soil_test_basis", {"phosphorus": "elemental"})))
    assert any("soil_test_basis" in p for p in problems(mutated("soil_test_basis", {"phosphorus": "P", "potassium": "K"})))
    other = {"phosphorus": "oxide", "potassium": "elemental"}
    out = problems(mutated("soil_test_basis", other))
    assert any("differs from the basis the engine uses" in p and "2.3x" in p for p in out)


def test_cited_numbers_must_equal_the_numbers_the_engine_will_use():
    out = problems(mutated("targets.p_target_kg_ha", 46.0))
    assert any("differs from crop_rules.py" in p for p in out)


@pytest.mark.parametrize("bad", [0, -5, math.nan, math.inf, True, "280", None])
def test_targets_must_be_finite_positive_numbers(bad):
    assert any("finite number greater than 0" in p for p in problems(mutated("targets.n_target_kg_ha", bad)))


def test_implausible_targets_are_flagged_even_before_the_catalog_comparison():
    out = problems(mutated("targets.n_target_kg_ha", 5000))
    assert any("plausibility" in p for p in out)
    assert any("organic_carbon_min_percent" in p for p in problems(mutated("targets.organic_carbon_min_percent", 40)))


def test_contradictory_ph_range_is_refused():
    rec = mutated("targets.ph_min", 7.5)
    rec["targets"]["ph_max"] = 5.0
    assert any("ph_min < ph_max" in p for p in problems(rec))
    assert any("ph_min < ph_max" in p for p in problems(mutated("targets.ph_max", 15.0)))


def test_unsupported_crops_are_refused():
    for crop in ("cocoa", "arecanut", "", None):
        rec = valid_record()
        rec["crop"] = crop
        assert any("not in the engine's crop catalog" in p for p in problems(rec))


def test_a_record_that_is_not_an_object_is_refused():
    assert rp.validate_record("nope") == ["record is not an object"]
    assert rp.validate_record(None) == ["record is not an object"]


# ------------------------------------------------------------------ fixtures never reach production
def test_test_fixture_records_are_refused_outside_development():
    assert any("test_fixture" in p for p in rp.validate_record(valid_record(), today=TODAY, allow_test_fixture=False))


# ------------------------------------------------------------------ loading
def write_pack(tmp_path, records):
    path = tmp_path / "pack.json"
    path.write_text(json.dumps({"pack_version": "t", "rules": records}), encoding="utf-8")
    return path


def test_a_valid_record_becomes_an_active_rule_with_its_full_citation(tmp_path):
    pack = rp.load_pack(write_pack(tmp_path, [valid_record()]), allow_test_fixture=True, today=TODAY)
    rule = pack["oil_palm"]
    c = rule.citation()
    assert c["source"]["locator"] == "Table 1, p. 1" and c["reviewed_by"] == "Placeholder Reviewer, agronomist"
    assert c["applicable_stage"] == "PLACEHOLDER stage" and c["soil_test_basis"] == {"phosphorus": "elemental", "potassium": "elemental"}
    assert rule.assumptions == ("PLACEHOLDER assumption",)


def test_invalid_pending_and_fixture_records_are_never_activated(tmp_path):
    pending = valid_record("rice"); pending["status"] = "pending_review"
    broken = valid_record("maize"); broken["source"]["quote"] = ""
    path = write_pack(tmp_path, [valid_record(), pending, broken])
    assert set(rp.load_pack(path, allow_test_fixture=True, today=TODAY)) == {"oil_palm"}
    assert rp.load_pack(path, allow_test_fixture=False, today=TODAY) == {}  # production: fixtures refused


def test_two_records_for_one_crop_disable_that_crop(tmp_path):
    other = copy.deepcopy(valid_record()); other["rule_version"] = "t-2"
    assert rp.load_pack(write_pack(tmp_path, [valid_record(), other]), allow_test_fixture=True, today=TODAY) == {}


def test_unreadable_or_malformed_packs_activate_nothing(tmp_path):
    bad = tmp_path / "bad.json"; bad.write_text("{not json", encoding="utf-8")
    assert rp.load_pack(bad) == {}
    assert rp.load_pack(tmp_path / "missing.json") == {}
    weird = tmp_path / "weird.json"; weird.write_text(json.dumps({"rules": "oops"}), encoding="utf-8")
    assert rp.load_pack(weird) == {}


def test_shipped_pack_is_empty_and_pending_candidates_are_not_loadable_as_rules():
    assert rp.load_pack() == {}
    assert rp.load_records() == []
    candidates = list((rp.DEFAULT_PACK_PATH.parent / "candidate_rules").glob("*.json"))
    assert candidates, "candidate records are kept separately from the active pack"
    for path in candidates:
        data = json.loads(path.read_text(encoding="utf-8"))
        assert data["status"] == "pending_review"
        # a candidate dropped into the active pack would still be refused
        for rec in data.get("rule_records", []):
            assert rp.validate_record(rec, today=TODAY, allow_test_fixture=True)


def test_command_line_check_reports_problems(tmp_path, capsys):
    ok = write_pack(tmp_path, [valid_record()])
    assert rp._main(["x", "check", str(ok)]) == 1  # test_fixture refused without development mode
    bad_rec = valid_record(); bad_rec.pop("test_fixture"); bad_rec["status"] = "draft"
    assert rp._main(["x", "check", str(write_pack(tmp_path, [bad_rec]))]) == 1
    assert "not 'approved'" in capsys.readouterr().out
