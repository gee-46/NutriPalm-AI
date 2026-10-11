"""Knowledge-base schema, validation and the invariants of the SHIPPED data."""
from __future__ import annotations

import copy

import pytest

from app.disease.knowledge_base import KnowledgeBaseError, build_knowledge_base, load_knowledge_base
from app.disease.provenance import normalise, quote_in_text
from app.disease.schemas import ChemicalStatus, Crop, RecordStatus
from tests.disease.factories import SRC, chemical, disease, evidence, make_kb, raw, source


# ------------------------------------------------------------------ valid / invalid records
def test_valid_record_loads_and_is_usable():
    kb = make_kb()
    d = kb.diseases["d1"]
    assert kb.is_usable(d)
    assert kb.diseases_for_crop(Crop.COCONUT) == [d]
    assert kb.diseases_for_crop(Crop.ARECANUT) == []  # crops are independent


def test_unverified_evidence_makes_a_record_unusable_but_loadable():
    kb = make_kb(diseases=[disease(verified=False)])
    assert not kb.is_usable(kb.diseases["d1"])
    assert kb.diseases_for_crop(Crop.COCONUT) == []
    assert kb.diseases_for_crop(Crop.COCONUT, usable_only=False)
    assert kb.unusable_count(Crop.COCONUT) == 1


def test_unverified_source_cannot_back_verified_evidence():
    with pytest.raises(KnowledgeBaseError, match="marked verified but its source is not"):
        make_kb(sources=[source(verified=False)])
    # with unverified evidence the record loads but is never used
    kb = make_kb(diseases=[disease(verified=False)], sources=[source(verified=False)])
    assert not kb.is_usable(kb.diseases["d1"])


def test_source_verified_status_requires_every_quote_verified():
    d = disease()
    d["evidence"][0]["verified"] = False
    with pytest.raises(KnowledgeBaseError, match="not every evidence quote is verified"):
        build_knowledge_base(**raw(diseases=[d]))


@pytest.mark.parametrize(
    "mutation,message",
    [
        (lambda s: s.pop("institution"), "institution"),
        (lambda s: s.update(url="http://insecure.example/x.pdf"), "url"),
        (lambda s: s.update(tier=9), "tier"),
        (lambda s: s.update(document_type="blog"), "document_type"),
        (lambda s: s.pop("retrieved_on"), "retrieved_on"),
        (lambda s: s.update(target_crops=[]), "target_crops"),
    ],
)
def test_malformed_or_missing_source_metadata_is_rejected(mutation, message):
    s = source()
    mutation(s)
    with pytest.raises(KnowledgeBaseError, match=message):
        build_knowledge_base(**raw(sources=[s]))


def test_evidence_must_cite_a_known_source():
    d = disease()
    d["evidence"][0]["source_id"] = "ghost_source"
    with pytest.raises(KnowledgeBaseError, match="unknown source"):
        build_knowledge_base(**raw(diseases=[d]))


def test_unsupported_crop_source_combination_is_rejected():
    # an arecanut-only source cannot back a coconut record
    with pytest.raises(KnowledgeBaseError, match="comes from a source about"):
        build_knowledge_base(**raw(sources=[source(crops=("arecanut",))], diseases=[disease(crop="coconut")]))


def test_evidence_page_beyond_the_document_is_rejected():
    d = disease()
    d["evidence"][0]["page"] = 99
    with pytest.raises(KnowledgeBaseError, match="page 99"):
        build_knowledge_base(**raw(diseases=[d]))


def test_short_or_missing_quote_is_rejected():
    d = disease()
    d["evidence"][0]["quote"] = "too short"
    with pytest.raises(KnowledgeBaseError, match="quote"):
        build_knowledge_base(**raw(diseases=[d]))


def test_unknown_symptom_condition_and_stage_codes_are_rejected():
    for kwargs, msg in (
        (dict(symptoms=(("made_up_symptom", "reported"),)), "unknown symptom code"),
        (dict(conditions=("made_up_condition",)), "unknown condition code"),
        (dict(stages=("made_up_stage",)), "unknown stage"),
    ):
        with pytest.raises(KnowledgeBaseError, match=msg):
            build_knowledge_base(**raw(diseases=[disease(**kwargs)]))


def test_dangling_evidence_reference_inside_a_record_is_rejected():
    d = disease()
    d["symptoms"][0]["evidence_ids"] = ["nope"]
    with pytest.raises(KnowledgeBaseError, match="unknown evidence"):
        build_knowledge_base(**raw(diseases=[d]))


def test_duplicate_disease_ids_and_duplicate_symptoms_are_rejected():
    with pytest.raises(KnowledgeBaseError, match="duplicate disease id"):
        build_knowledge_base(**raw(diseases=[disease("d1"), disease("d1")]))
    with pytest.raises(KnowledgeBaseError, match="duplicate symptom"):
        build_knowledge_base(**raw(diseases=[disease(symptoms=(("nut_shedding", "reported"), ("nut_shedding", "reported")))]))


def test_version_mismatch_between_files_is_rejected():
    r = raw()
    r["chemicals"]["kb_version"] = "1.0.0"
    with pytest.raises(KnowledgeBaseError, match="kb_version"):
        build_knowledge_base(**r)


def test_expert_reviewed_status_needs_an_approved_named_review():
    d = disease(status="expert_reviewed")
    with pytest.raises(KnowledgeBaseError, match="expert_reviewed requires"):
        build_knowledge_base(**raw(diseases=[d]))
    ok = disease(status="expert_reviewed", expert={"status": "approved", "reviewer": "Dr Test", "reviewed_on": "2026-02-02"})
    kb = build_knowledge_base(**raw(diseases=[ok]))
    assert kb.is_usable(kb.diseases["d1"]) and kb.expert_review_status([kb.diseases["d1"]]) == "approved"


# ------------------------------------------------------------------ chemical records
def test_chemical_records_missing_label_details_are_rejected():
    c = chemical(status="label_verified")
    del c["label"]
    with pytest.raises(KnowledgeBaseError, match="label"):
        build_knowledge_base(**raw(chemicals=[c], diseases=[disease(products=("p1",))]))


@pytest.mark.parametrize("field", ["registration_reference", "label_reference", "application_method", "timing", "safety_instructions", "rate_unit", "verifier"])
def test_label_verified_requires_each_label_field(field):
    c = chemical(status="label_verified")
    c["label"][field] = [] if field == "safety_instructions" else ""
    with pytest.raises(KnowledgeBaseError):
        build_knowledge_base(**raw(chemicals=[c], diseases=[disease(products=("p1",))]))


def test_label_verified_requires_positive_rate_and_approval():
    c = chemical(status="label_verified")
    c["label"]["rate_value"] = 0
    with pytest.raises(KnowledgeBaseError):
        build_knowledge_base(**raw(chemicals=[c], diseases=[disease(products=("p1",))]))
    c = chemical(status="label_verified", review_status="pending")
    with pytest.raises(KnowledgeBaseError, match="approved"):
        build_knowledge_base(**raw(chemicals=[c], diseases=[disease(products=("p1",))]))


def test_institutional_recommendation_cannot_claim_label_details():
    c = chemical()
    c["label"] = chemical(status="label_verified")["label"]
    with pytest.raises(KnowledgeBaseError, match="must not carry label"):
        build_knowledge_base(**raw(chemicals=[c], diseases=[disease(products=("p1",))]))


def test_reported_use_must_name_only_target_crops():
    c = chemical(crops=("coconut",))
    c["reported_use"][0]["crops"] = ["arecanut"]
    with pytest.raises(KnowledgeBaseError, match="target_crops"):
        build_knowledge_base(**raw(chemicals=[c], diseases=[disease(products=("p1",))]))


def test_disease_cannot_list_a_product_that_does_not_target_it():
    with pytest.raises(KnowledgeBaseError, match="does not list the disease"):
        build_knowledge_base(**raw(chemicals=[chemical(diseases=("other",))], diseases=[disease(products=("p1",)), disease("other")]))


def test_unknown_product_and_unknown_target_disease_are_rejected():
    with pytest.raises(KnowledgeBaseError, match="unknown chemical product"):
        build_knowledge_base(**raw(diseases=[disease(products=("ghost",))]))
    with pytest.raises(KnowledgeBaseError, match="unknown target disease"):
        build_knowledge_base(**raw(chemicals=[chemical(diseases=("ghost",))]))


# ------------------------------------------------------------------ provenance helpers
def test_quote_matching_tolerates_layout_noise_but_not_changed_words():
    page = "Prophylactic spraying with 1 % Bordeaux mixture gives sat-\nisfactory control of the disease."
    assert quote_in_text("Prophylactic spraying with 1 % Bordeaux mixture gives satisfactory control", [page])
    assert not quote_in_text("Prophylactic spraying with 2 % Bordeaux mixture gives satisfactory control", [page])


def test_short_quotes_never_verify():
    assert not quote_in_text("Bordeaux", ["Bordeaux mixture is used"])


def test_normalise_flattens_dashes_quotes_and_whitespace():
    assert normalise("A–B   “C”\nD") == 'a-b "c" d'


# ------------------------------------------------------------------ SHIPPED data invariants
def test_shipped_knowledge_base_loads_and_every_usable_record_is_fully_verified():
    kb = load_knowledge_base()
    assert kb.diseases and kb.sources and kb.chemicals
    for d in kb.diseases.values():
        if kb.is_usable(d):
            assert all(e.verified for e in d.evidence)
            assert d.last_verified is not None
            assert d.status in (RecordStatus.SOURCE_VERIFIED, RecordStatus.EXPERT_REVIEWED)


def test_shipped_data_covers_both_launch_crops_independently():
    kb = load_knowledge_base()
    coconut = {d.id for d in kb.diseases_for_crop(Crop.COCONUT)}
    areca = {d.id for d in kb.diseases_for_crop(Crop.ARECANUT)}
    assert coconut and areca and not (coconut & areca)
    assert all(Crop.COCONUT in d.crops and Crop.ARECANUT not in d.crops for d in kb.diseases.values() if d.id in coconut)


def test_shipped_evidence_is_attributed_to_authoritative_sources_with_stable_urls():
    kb = load_knowledge_base()
    for s in kb.sources.values():
        assert s.url.startswith("https://") and s.tier <= 3
        assert s.verification.sha256 and s.verification.status.value == "quotes_verified"
    for d in kb.diseases.values():
        for e in d.evidence:
            assert e.source_id in kb.sources and e.page >= 1 and len(e.quote) >= 25


def test_shipped_data_contains_no_label_verified_product_because_none_was_verified():
    """No registration/label has been checked against CIB&RC or a product label, so none may claim it."""
    kb = load_knowledge_base()
    assert all(c.status is not ChemicalStatus.LABEL_VERIFIED for c in kb.chemicals.values())
    assert all(c.label is None for c in kb.chemicals.values())


def test_shipped_chemical_records_never_claim_a_crop_their_evidence_does_not_name():
    kb = load_knowledge_base()
    hexa = kb.chemicals["hexaconazole_5ec"]
    assert hexa.status is ChemicalStatus.VERIFICATION_REQUIRED and hexa.target_crops == [] and not hexa.reported_use
    mandi = kb.chemicals["mandipropamid_23_4_sc"]
    assert mandi.target_crops == [Crop.ARECANUT] and mandi.target_disease_ids == ["areca_fruit_rot"]


def test_shipped_arecanut_ganoderma_symptoms_are_never_marked_characteristic():
    """The source only says arecanut shows 'similar' symptoms, so none may be promoted to characteristic."""
    kb = load_knowledge_base()
    d = kb.diseases["areca_ganoderma_basal_stem_rot"]
    assert all(s.specificity.value == "reported" for s in d.symptoms)


def test_a_failed_source_check_invalidates_dependent_records():
    r = raw()
    r["sources"]["sources"][0]["verification"]["status"] = "failed"
    with pytest.raises(KnowledgeBaseError, match="marked verified but its source is not"):
        build_knowledge_base(**r)
