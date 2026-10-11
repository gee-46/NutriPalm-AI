"""Risk-assessment engine: rule table, boundaries, independence of crops, missing data, determinism."""
from __future__ import annotations

import json

import pytest

from app.disease.assessment import RULE_VERSION, Observation, assess, base_level, lower
from app.disease.schemas import Crop, RiskLevel, TriState
from app.disease.vocabulary import normalize_crop, normalize_parts, normalize_stage, normalize_symptoms
from tests.disease.factories import VOCAB, disease, make_kb
from app.disease.schemas import Vocabulary

CH, RP = "first_or_characteristic", "reported"
H, M, L, I = RiskLevel.HIGH, RiskLevel.MODERATE, RiskLevel.LOW, RiskLevel.INSUFFICIENT_EVIDENCE
Y = TriState.YES


def obs(crop=Crop.COCONUT, symptoms=(), **kw):
    return Observation(crop=crop, symptom_codes=list(symptoms), **kw)


# ------------------------------------------------------------------ the documented rule table
@pytest.mark.parametrize(
    "f,r,c,expected",
    [
        (0, 0, 0, I), (0, 0, 3, I),          # no matched symptom -> nothing, whatever the conditions
        (0, 1, 0, L),                         # exactly one non-characteristic symptom
        (0, 1, 1, M), (0, 2, 0, M),           # symptom + support, or two listed symptoms
        (1, 0, 0, M),                         # one characteristic symptom alone
        (1, 0, 1, H), (1, 1, 0, H),           # characteristic + (support or second symptom)
        (2, 0, 0, H), (3, 4, 5, H),
    ],
)
def test_rule_table_boundaries(f, r, c, expected):
    assert base_level(f, r, c) is expected


def test_each_contradiction_lowers_one_step_and_floors_at_insufficient():
    assert lower(H, 1) is M and lower(H, 2) is L and lower(H, 3) is I and lower(H, 9) is I and lower(L, 1) is I


# ------------------------------------------------------------------ candidate evaluation through the engine
def kb_with(*diseases, **kw):
    return make_kb(diseases=list(diseases), **kw)


def test_characteristic_symptom_alone_is_moderate_and_confirmed_condition_makes_it_high():
    d = disease(symptoms=(("spear_leaf_withering", CH),), conditions=("high_rainfall_area",))
    kb = kb_with(d)
    r1 = assess(kb, obs(symptoms=["spear_leaf_withering"]))
    assert r1.risk_level is M
    r2 = assess(kb, obs(symptoms=["spear_leaf_withering"], context={"high_rainfall_area": Y}))
    assert r2.risk_level is H and r2.candidates[0].supportive_conditions == ["high_rainfall_area"]


def test_condition_answered_no_or_unknown_never_supports():
    d = disease(symptoms=(("spear_leaf_withering", CH),), conditions=("high_rainfall_area",))
    kb = kb_with(d)
    for answer in (TriState.NO, TriState.UNKNOWN):
        assert assess(kb, obs(symptoms=["spear_leaf_withering"], context={"high_rainfall_area": answer})).risk_level is M


def test_single_listed_symptom_is_low_and_never_higher_without_support():
    d = disease(symptoms=(("nut_shedding", RP), ("nut_rotting", RP)))
    kb = kb_with(d)
    assert assess(kb, obs(symptoms=["nut_shedding"])).risk_level is L
    assert assess(kb, obs(symptoms=["nut_shedding", "nut_rotting"])).risk_level is M


def test_symptoms_that_match_nothing_give_insufficient_evidence_not_a_guess():
    kb = kb_with(disease())
    r = assess(kb, obs(symptoms=["barren_nuts"]))
    assert r.risk_level is I and r.candidates == []
    assert "do not match" in r.risk_explanation and "does not rule out" in r.risk_explanation


def test_no_symptoms_is_insufficient_and_asks_for_them():
    r = assess(kb_with(disease()), obs())
    assert r.risk_level is I
    assert any("symptom" in m.lower() for m in r.missing_inputs) and r.follow_up_questions


def test_crop_without_usable_knowledge_is_insufficient_and_says_it_is_not_a_clean_bill_of_health():
    kb = kb_with(disease(crop="coconut"))
    r = assess(kb, obs(crop=Crop.ARECANUT, symptoms=["spear_leaf_withering"]))
    assert r.risk_level is I and "No source-verified disease knowledge" in r.risk_explanation and "not a statement that the crop is healthy" in r.risk_explanation


def test_unverified_records_are_withheld_and_counted():
    kb = kb_with(disease("good"), disease("draft", verified=False))
    r = assess(kb, obs(symptoms=["spear_leaf_withering"]))
    assert [c.disease_id for c in r.candidates] == ["good"]
    assert any("not source-verified and were not used" in l for l in r.limitations)


def test_arecanut_and_coconut_are_assessed_independently():
    kb = kb_with(
        disease("coco", crop="coconut", symptoms=(("spear_leaf_withering", CH),)),
        disease("areca", crop="arecanut", symptoms=(("nut_shedding", CH),)),
    )
    c = assess(kb, obs(crop=Crop.COCONUT, symptoms=["spear_leaf_withering", "nut_shedding"]))
    a = assess(kb, obs(crop=Crop.ARECANUT, symptoms=["spear_leaf_withering", "nut_shedding"]))
    assert [x.disease_id for x in c.candidates] == ["coco"]
    assert [x.disease_id for x in a.candidates] == ["areca"]


# ------------------------------------------------------------------ contradictions, stage, region
def test_excluded_symptom_lowers_the_level_and_is_reported():
    d = disease(symptoms=(("spear_leaf_withering", CH), ("nut_shedding", RP)), excluded=("barren_nuts",))
    kb = kb_with(d)
    plain = assess(kb, obs(symptoms=["spear_leaf_withering", "nut_shedding"]))
    contra = assess(kb, obs(symptoms=["spear_leaf_withering", "nut_shedding", "barren_nuts"]))
    assert plain.risk_level is H and contra.risk_level is M
    assert contra.candidates[0].contradicting_observations


def test_stage_outside_the_described_stages_is_a_contradiction_unless_any_stage_is_evidenced():
    kb = kb_with(disease(symptoms=(("spear_leaf_withering", CH), ("nut_shedding", RP)), stages=("seedling",)))
    assert assess(kb, obs(symptoms=["spear_leaf_withering", "nut_shedding"], stage="seedling")).risk_level is H
    assert assess(kb, obs(symptoms=["spear_leaf_withering", "nut_shedding"], stage="adult_palm")).risk_level is M
    assert assess(kb, obs(symptoms=["spear_leaf_withering", "nut_shedding"], stage=None)).risk_level is H  # unknown stage: no penalty
    kb_any = kb_with(disease(symptoms=(("spear_leaf_withering", CH), ("nut_shedding", RP)), stages=("seedling",), any_stage=True))
    assert assess(kb_any, obs(symptoms=["spear_leaf_withering", "nut_shedding"], stage="adult_palm")).risk_level is H


def test_region_outside_the_reported_regions_lowers_the_level_but_unknown_region_does_not():
    d = disease(symptoms=(("spear_leaf_withering", CH), ("nut_shedding", RP)), region=("Tamil Nadu",))
    kb = kb_with(d)
    syms = ["spear_leaf_withering", "nut_shedding"]
    assert assess(kb, obs(symptoms=syms, state="Tamil Nadu")).risk_level is H
    out = assess(kb, obs(symptoms=syms, state="Karnataka"))
    assert out.risk_level is M and "Tamil Nadu" in out.candidates[0].region_note
    unknown = assess(kb, obs(symptoms=syms, state=None))
    assert unknown.risk_level is H and "not recorded" in unknown.candidates[0].region_note


def test_candidate_set_aside_by_contradictions_is_mentioned_not_silently_dropped():
    d = disease(symptoms=(("nut_shedding", RP),), excluded=("barren_nuts",))
    r = assess(kb_with(d), obs(symptoms=["nut_shedding", "barren_nuts"]))
    assert r.candidates == [] and r.risk_level is I
    assert any("set aside" in l for l in r.limitations)


# ------------------------------------------------------------------ ranking / several candidates
def test_multiple_candidates_are_ranked_deterministically_and_flagged_as_ambiguous():
    a = disease("a_disease", symptoms=(("spear_leaf_withering", CH),))
    b = disease("b_disease", symptoms=(("spear_leaf_withering", CH),))
    c = disease("c_disease", symptoms=(("spear_leaf_withering", RP),))
    r = assess(kb_with(c, b, a), obs(symptoms=["spear_leaf_withering"]))
    assert [x.disease_id for x in r.candidates] == ["a_disease", "b_disease", "c_disease"]  # level, then id
    assert [x.rank for x in r.candidates] == [1, 2, 3]
    assert any("More than one disease fits" in l for l in r.limitations)
    assert r.risk_level is M


def test_better_evidence_outranks_more_matching_listed_symptoms():
    strong = disease("strong", symptoms=(("spear_leaf_withering", CH), ("nut_shedding", RP)))
    weak = disease("weak", symptoms=(("spear_leaf_withering", RP), ("nut_shedding", RP)))
    r = assess(kb_with(weak, strong), obs(symptoms=["spear_leaf_withering", "nut_shedding"]))
    assert [x.disease_id for x in r.candidates] == ["strong", "weak"]


def test_a_confirmed_diagnosis_is_never_claimed():
    r = assess(kb_with(disease(symptoms=(("spear_leaf_withering", CH), ("nut_shedding", RP)))), obs(symptoms=["spear_leaf_withering", "nut_shedding"]))
    assert r.risk_level is H
    assert all(c.is_confirmed_diagnosis is False for c in r.candidates)
    assert any("not a diagnosis" in l for l in r.limitations) and "screening result, not a diagnosis" in r.risk_explanation


# ------------------------------------------------------------------ inputs: used / not used / missing
def test_weather_is_reported_as_not_used_because_no_verified_threshold_exists():
    r = assess(kb_with(disease()), obs(symptoms=["spear_leaf_withering"], weather_supplied=True))
    assert any("did not change the result" in s for s in r.inputs_not_used)


def test_severity_and_duration_are_recorded_but_do_not_move_the_category():
    kb = kb_with(disease())
    base = assess(kb, obs(symptoms=["spear_leaf_withering"]))
    sev = assess(kb, obs(symptoms=["spear_leaf_withering"], severity="severe", duration_days=400))
    assert base.risk_level is sev.risk_level
    assert any("severity" in s.lower() and "does not change" in s for s in sev.inputs_used)


def test_unrecognised_text_and_unrecognised_stage_are_surfaced():
    r = assess(kb_with(disease()), obs(symptoms=["spear_leaf_withering"], unrecognised_symptom_text=["purple spots"], stage_text_unrecognised="teenager"))
    assert any("purple spots" in s for s in r.inputs_not_used) and any("teenager" in s for s in r.inputs_not_used)
    assert any("crop stage" in m.lower() for m in r.missing_inputs)


def test_missing_conditions_become_follow_up_questions_for_the_top_candidates():
    d = disease(symptoms=(("spear_leaf_withering", CH),), conditions=("rhinoceros_beetle_damage",))
    r = assess(kb_with(d), obs(symptoms=["spear_leaf_withering"]))
    assert any("Rhinoceros beetle damage" in q for q in r.follow_up_questions)
    assert any("Field condition" in m for m in r.missing_inputs)


def test_follow_up_asks_for_unreported_characteristic_symptoms():
    d = disease(symptoms=(("spear_leaf_withering", CH), ("spindle_pulls_out", CH)))
    r = assess(kb_with(d), obs(symptoms=["spear_leaf_withering"]))
    assert any("Spindle comes out" in q for q in r.follow_up_questions)


# ------------------------------------------------------------------ honesty of the output
def test_output_has_no_probability_or_confidence_number_anywhere():
    r = assess(kb_with(disease(symptoms=(("spear_leaf_withering", CH), ("nut_shedding", RP)))), obs(symptoms=["spear_leaf_withering", "nut_shedding"]))
    blob = json.dumps([c.model_dump(mode="json") for c in r.candidates]).lower()
    for forbidden in ("probab", "confidence", "likelihood", "percent", "score"):
        assert forbidden not in blob
    assert not any("%" in c.disease_name for c in r.candidates)


def test_results_are_deterministic_and_independent_of_input_order():
    d1 = disease("d_one", symptoms=(("spear_leaf_withering", CH), ("nut_shedding", RP)))
    d2 = disease("d_two", symptoms=(("spear_leaf_withering", RP),))
    kb = kb_with(d1, d2)
    runs = [assess(kb, obs(symptoms=s)) for s in (["spear_leaf_withering", "nut_shedding"], ["nut_shedding", "spear_leaf_withering"])]
    dumps = [json.dumps({"l": r.risk_level.value, "c": [c.model_dump(mode="json") for c in r.candidates], "f": r.follow_up_questions}, sort_keys=True) for r in runs]
    assert dumps[0] == dumps[1]
    again = assess(kb, obs(symptoms=["spear_leaf_withering", "nut_shedding"]))
    assert json.dumps([c.model_dump(mode="json") for c in again.candidates], sort_keys=True) in dumps[0]


def test_rule_version_is_exposed():
    assert RULE_VERSION == "1.0.0"


# ------------------------------------------------------------------ normalisation
V = Vocabulary.model_validate(VOCAB)


@pytest.mark.parametrize("name,expected", [("Arecanut", Crop.ARECANUT), ("  areca NUT ", Crop.ARECANUT), ("betel nut", Crop.ARECANUT), ("ಅಡಿಕೆ", Crop.ARECANUT),
                                           ("coconut", Crop.COCONUT), ("Coconut Palm", Crop.COCONUT), ("ತೆಂಗು", Crop.COCONUT),
                                           ("oil palm", None), ("", None), ("palm", None), ("coconutt", None)])
def test_crop_normalisation(name, expected):
    assert normalize_crop(name, V) is expected


@pytest.mark.parametrize("text,expected", [("seedling", "seedling"), ("Nursery", "seedling"), ("young palm", "young_palm"), ("Pre-Bearing", "young_palm"),
                                           ("bearing", "adult_palm"), ("adult_palm", "adult_palm"), ("teenage", None), ("", None), (None, None), ("  ", None)])
def test_stage_normalisation(text, expected):
    assert normalize_stage(text, V) == expected


def test_symptom_codes_and_free_text_are_matched_literally_never_fuzzily():
    n = normalize_symptoms(["nut_shedding", "NUT_SHEDDING", "bogus_code"], ["nuts falling, white mould on nuts; something unknown"], V)
    assert n.codes == ["nut_shedding", "white_mycelium_on_nuts"]
    assert n.unknown_codes == ["bogus_code"] and n.unrecognised_text == ["something unknown"]
    assert normalize_symptoms([], ["spindel withering"], V).codes == []  # a typo is NOT guessed


def test_parts_are_validated():
    assert normalize_parts(["Leaves", "roots", "wings"], V) == (["leaves", "roots"], ["wings"])
