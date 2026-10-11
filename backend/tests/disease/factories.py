"""
TEST FIXTURES ONLY.

Every disease, source, symptom link and product built here is synthetic scaffolding for exercising
the rule engine. NOTHING in this module is agronomic knowledge and none of it ships with the
application (the real, source-verified knowledge base lives in app/disease/data).
"""
from __future__ import annotations

import copy
import json
from pathlib import Path

from app.disease.knowledge_base import KnowledgeBase, build_knowledge_base

DATA = Path(__file__).resolve().parents[2] / "app" / "disease" / "data"
VOCAB = json.loads((DATA / "vocabulary.json").read_text(encoding="utf-8"))

SRC = "test_source"
Q = "TEST FIXTURE quote that is long enough to pass the minimum length"


def source(crops=("arecanut", "coconut"), verified=True, **over):
    s = {
        "id": SRC, "institution": "TEST Institute", "title": "TEST FIXTURE document", "authors": [],
        "publication": "test", "publication_date": "2000-01", "url": "https://example.test/doc.pdf",
        "document_type": "bulletin", "tier": 1, "geographic_scope": ["Testland"], "target_crops": list(crops),
        "retrieved_on": "2026-01-01",
        "verification": {"status": "quotes_verified" if verified else "unverified", "pages": 10},
    }
    s.update(over)
    return s


def evidence(eid, verified=True, page=1, source_id=SRC):
    return {"id": eid, "source_id": source_id, "page": page, "locator": "test", "quote": Q, "paraphrase": "TEST FIXTURE paraphrase", "verified": verified}


def disease(did="d1", crop="coconut", symptoms=(("spear_leaf_withering", "first_or_characteristic"),), conditions=(), stages=(),
            any_stage=False, region=None, excluded=(), verified=True, status=None, products=(), management=None, expert=None):
    ev_ids = ["e1"]
    d = {
        "id": did, "name": f"Test disease {did}", "local_names": [], "scientific_names": [], "crops": [crop], "category": "test category",
        "affected_parts": ["crown"],
        "symptoms": [{"code": c, "specificity": sp, "evidence_ids": ev_ids} for c, sp in symptoms],
        "excluded_symptoms": [{"code": c, "specificity": "reported", "evidence_ids": ev_ids} for c in excluded],
        "risk_conditions": [{"code": c, "evidence_ids": ev_ids} for c in conditions],
        "crop_stages": [{"stage": s, "evidence_ids": ev_ids} for s in stages],
        "any_stage_evidence_ids": ev_ids if any_stage else [],
        "management": management if management is not None else [
            {"id": "m_monitor", "category": "monitoring_and_confirmation", "text": "TEST monitor guidance text", "crops": [crop], "evidence_ids": ev_ids},
            {"id": "m_bio", "category": "biological_management", "text": "TEST biological guidance text", "crops": [crop], "evidence_ids": ev_ids},
            {"id": "m_prev", "category": "preventive_practices", "text": "TEST preventive guidance text", "crops": [crop], "evidence_ids": ev_ids},
        ],
        "chemical_product_ids": list(products), "evidence": [evidence("e1", verified=verified)],
        "record_version": "1.0.0", "status": status or ("source_verified" if verified else "draft"),
    }
    if region:
        d["geographic_applicability"] = {"regions": list(region), "evidence_ids": ev_ids}
    if expert:
        d["expert_review"] = expert
    return d


def chemical(pid="p1", status="institutional_recommendation", crops=("coconut",), diseases=("d1",), **over):
    c = {
        "id": pid, "product_name": "TEST product", "active_ingredient": "TEST ingredient", "target_disease_ids": list(diseases),
        "target_crops": list(crops), "status": status, "evidence": [evidence("pe1")], "record_version": "1.0.0", "review_status": "pending",
    }
    if status == "institutional_recommendation":
        c["reported_use"] = [{"crops": list(crops), "disease_ids": list(diseases), "concentration": "TEST 1%", "application_method": "TEST spray", "timing": "TEST timing", "evidence_ids": ["pe1"]}]
    if status == "label_verified":
        c["review_status"] = "approved"
        c["label"] = {
            "registration_reference": "TEST-REG-1", "label_reference": "TEST-LABEL-1", "application_method": "TEST method", "rate_value": 2.5, "rate_unit": "ml/L",
            "timing": "TEST timing", "safety_instructions": ["TEST safety"], "verified_on": "2026-01-01", "valid_until": "2099-01-01", "verifier": "Test Reviewer",
        }
    c.update(over)
    return c


def raw(diseases=None, chemicals=None, sources=None, vocab=None):
    version = "9.9.9"
    return dict(
        vocabulary=copy.deepcopy(vocab or VOCAB),
        sources={"kb_version": version, "sources": sources if sources is not None else [source()]},
        diseases={"kb_version": version, "diseases": diseases if diseases is not None else [disease()]},
        chemicals={"kb_version": version, "chemicals": chemicals or []},
    )


def make_kb(diseases=None, chemicals=None, sources=None) -> KnowledgeBase:
    return build_knowledge_base(**raw(diseases, chemicals, sources))
