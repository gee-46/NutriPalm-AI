"""Treatment engine: hierarchy, evidence, and the chemical-safety rules."""
from __future__ import annotations

from datetime import date

import pytest

from app.disease.knowledge_base import load_knowledge_base
from app.disease.schemas import ChemicalStatus, Crop
from app.disease.treatment import REFERRAL, build_treatment
from tests.disease.factories import chemical, disease, make_kb

TODAY = date(2026, 6, 1)


def treat(kb, did="d1", crop=Crop.COCONUT, today=TODAY):
    return build_treatment(kb, kb.diseases[did], crop, today)


def kb_with_product(**chem_over):
    p = chemical(**chem_over)
    return make_kb(diseases=[disease(products=(p["id"],))], chemicals=[p])


# ------------------------------------------------------------------ hierarchy and evidence
def test_management_is_ordered_by_the_decision_hierarchy_and_every_step_carries_evidence():
    t = treat(make_kb())
    order = [s.category for s in t.steps]
    assert order == ["monitoring_and_confirmation", "preventive_practices", "biological_management"]
    assert all(s.evidence and s.evidence[0].url.startswith("https://") and s.evidence[0].quote for s in t.steps)
    assert t.referral == REFERRAL and "qualified agricultural officer" in t.referral


def test_steps_for_other_crops_are_not_included():
    d = disease()
    d["management"][1]["crops"] = ["coconut"]
    kb = make_kb(diseases=[d])
    assert [s.id for s in build_treatment(kb, kb.diseases["d1"], Crop.ARECANUT).steps] == []


def test_a_disease_without_products_has_no_chemical_section():
    t = treat(make_kb())
    assert t.chemical_status == "not_applicable" and t.chemical_management == []


# ------------------------------------------------------------------ chemicals: verified and applicable
def test_label_verified_product_for_the_right_crop_and_disease_is_actionable_with_label_values_only():
    t = treat(kb_with_product(status="label_verified"))
    c = t.chemical_management[0]
    assert t.chemical_status == "verified_available" and c.actionable and c.status is ChemicalStatus.LABEL_VERIFIED
    assert c.label_summary["rate"] == "2.5 ml/L" and c.label_summary["registration_reference"] == "TEST-REG-1"
    assert c.label_summary["safety_instructions"] == ["TEST safety"]


def test_expired_label_verification_removes_the_dose():
    c = treat(kb_with_product(status="label_verified"), today=date(2100, 1, 1)).chemical_management[0]
    assert not c.actionable and c.label_summary is None and c.status is ChemicalStatus.VERIFICATION_REQUIRED
    assert "expired" in c.message


def test_crop_registration_mismatch_never_carries_over():
    kb = make_kb(diseases=[disease(crop="coconut", products=("p1",)), disease("a1", crop="arecanut", products=("p1",))],
                 chemicals=[chemical(status="label_verified", crops=("coconut",), diseases=("d1", "a1"))])
    ok = build_treatment(kb, kb.diseases["d1"], Crop.COCONUT).chemical_management[0]
    bad = build_treatment(kb, kb.diseases["a1"], Crop.ARECANUT).chemical_management[0]
    assert ok.actionable
    assert not bad.actionable and bad.label_summary is None and "arecanut" in bad.message and "No dose is shown" in bad.message


def test_product_for_a_different_disease_is_not_applied():
    kb = make_kb(diseases=[disease("d1", products=("p1",)), disease("d2")], chemicals=[chemical(status="label_verified", diseases=("d1",))])
    assert treat(kb, "d2").chemical_management == []  # d2 does not list the product at all


# ------------------------------------------------------------------ chemicals: institutional only / unverified
def test_institutional_recommendation_is_reproduced_as_reported_text_and_is_never_actionable():
    t = treat(kb_with_product(status="institutional_recommendation"))
    c = t.chemical_management[0]
    assert t.chemical_status == "institutional_recommendation_only"
    assert not c.actionable and c.label_summary is None
    assert "TEST 1%" in c.reported_recommendation and "TEST spray" in c.reported_recommendation and "TEST timing" in c.reported_recommendation
    assert "NOT label-verified" in c.message
    assert "per palm" not in c.reported_recommendation.lower()  # no quantity is computed


def test_verification_required_product_is_named_without_any_dose():
    p = chemical(status="verification_required", crops=())
    kb = make_kb(diseases=[disease(products=("p1",))], chemicals=[p])
    t = treat(kb)
    c = t.chemical_management[0]
    assert t.chemical_status == "verification_required"
    assert not c.actionable and c.reported_recommendation is None and c.label_summary is None
    assert "No dose is shown" in c.message


def test_institutional_use_without_matching_crop_and_disease_falls_back_to_verification_required():
    kb = make_kb(diseases=[disease("d1", crop="coconut", products=("p1",))],
                 chemicals=[chemical(status="institutional_recommendation", crops=("coconut",), diseases=("d1",))])
    c = build_treatment(kb, kb.diseases["d1"], Crop.ARECANUT).chemical_management[0]
    assert not c.actionable and c.reported_recommendation is None and c.status is ChemicalStatus.VERIFICATION_REQUIRED


def test_invalid_concentration_or_units_cannot_be_loaded_at_all():
    from app.disease.knowledge_base import KnowledgeBaseError

    p = chemical(status="label_verified")
    p["label"]["rate_value"] = -1
    with pytest.raises(KnowledgeBaseError):
        make_kb(diseases=[disease(products=("p1",))], chemicals=[p])
    p = chemical(status="label_verified")
    p["label"]["rate_unit"] = ""
    with pytest.raises(KnowledgeBaseError):
        make_kb(diseases=[disease(products=("p1",))], chemicals=[p])


# ------------------------------------------------------------------ the SHIPPED data
def test_shipped_data_gives_no_actionable_chemical_for_any_disease_or_crop():
    kb = load_knowledge_base()
    for d in kb.diseases.values():
        for crop in d.crops:
            t = build_treatment(kb, d, crop)
            assert t.chemical_status != "verified_available", d.id
            for c in t.chemical_management:
                assert not c.actionable and c.label_summary is None, (d.id, c.product_id)


def test_shipped_mandipropamid_is_reported_only_for_arecanut_fruit_rot():
    kb = load_knowledge_base()
    fr = build_treatment(kb, kb.diseases["areca_fruit_rot"], Crop.ARECANUT)
    mandi = next(c for c in fr.chemical_management if c.product_id == "mandipropamid_23_4_sc")
    assert mandi.status is ChemicalStatus.INSTITUTIONAL_RECOMMENDATION and "0.5%" in mandi.reported_recommendation
    # it is not offered for the other arecanut or any coconut disease
    for did in ("areca_bud_crown_rot", "areca_ganoderma_basal_stem_rot", "coconut_bud_rot", "coconut_ganoderma_wilt"):
        d = kb.diseases[did]
        assert "mandipropamid_23_4_sc" not in d.chemical_product_ids


def test_shipped_ganoderma_chemical_is_verification_required_with_no_dose():
    kb = load_knowledge_base()
    for did, crop in (("coconut_ganoderma_wilt", Crop.COCONUT), ("areca_ganoderma_basal_stem_rot", Crop.ARECANUT)):
        t = build_treatment(kb, kb.diseases[did], crop)
        assert t.chemical_status == "verification_required"
        text = " ".join(c.message + (c.reported_recommendation or "") for c in t.chemical_management)
        assert "0.2%" not in text and "40 L" not in text and "5 mL" not in text


def test_shipped_bordeaux_text_is_reproduced_from_the_source_not_computed():
    kb = load_knowledge_base()
    t = build_treatment(kb, kb.diseases["coconut_bud_rot"], Crop.COCONUT)
    b = t.chemical_management[0]
    assert b.status is ChemicalStatus.INSTITUTIONAL_RECOMMENDATION and not b.actionable
    assert "1%" in b.reported_recommendation and "45 days" in b.reported_recommendation
    assert b.evidence and all(e.url and e.page for e in b.evidence)


def test_every_shipped_management_step_traces_to_a_source_quote():
    kb = load_knowledge_base()
    for d in kb.diseases.values():
        for crop in d.crops:
            for s in build_treatment(kb, d, crop).steps:
                assert s.evidence, (d.id, s.id)
                assert all(e.source_id in kb.sources and e.quote for e in s.evidence)
