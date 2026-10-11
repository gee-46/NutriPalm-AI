"""
treatment.py

Evidence-supported management guidance for ONE disease candidate. Kept apart from the assessment
engine: management is guidance attached to a *suspected* disease, never a statement that the disease
is confirmed.

Decision hierarchy (always presented in this order):
    1 monitoring and confirmation  2 preventive practices  3 cultural management  4 field sanitation
    5 irrigation / drainage / field  6 biological management  7 chemical management (only if verified)

Chemical safety rules (enforced in code and tested):
  * A product is shown with a usable dose only when status == label_verified, its label verification has
    not expired, its registered target crops include THIS crop and its target diseases include THIS
    disease. Approval for another crop or disease is never carried over.
  * An institutional_recommendation is reproduced as "reported by <institute>" text only (concentration,
    method, timing exactly as in the source); actionable is False and no per-palm quantity is computed.
  * Everything else is `verification_required`: the product may be named, but no dose, rate, interval
    or mixture is returned.
  * NutriPalm never calculates a pesticide dose.
"""
from __future__ import annotations

from datetime import date
from typing import Optional

from app.disease.knowledge_base import KnowledgeBase
from app.disease.schemas import (
    MANAGEMENT_ORDER,
    ChemicalOut,
    ChemicalProduct,
    ChemicalStatus,
    Crop,
    DiseaseRecord,
    ManagementOut,
    ReportedUse,
    TreatmentOut,
)

TREATMENT_RULE_VERSION = "1.0.0"

REFERRAL = (
    "Confirm the disease and any chemical use with a qualified agricultural officer or your local Krishi Vigyan Kendra (KVK). "
    "Follow the product label and local regulations; NutriPalm does not set pesticide doses."
)


def _reported_text(use: ReportedUse, source_label: str) -> str:
    parts = []
    if use.concentration:
        parts.append(f"concentration {use.concentration}")
    if use.application_method:
        parts.append(use.application_method)
    if use.timing:
        parts.append(use.timing)
    if use.frequency:
        parts.append(use.frequency)
    if use.other_conditions:
        parts.append(use.other_conditions)
    return f"{source_label} reports: " + "; ".join(parts) + "."


def _chemical_entry(kb: KnowledgeBase, p: ChemicalProduct, disease: DiseaseRecord, crop: Crop, today: date) -> ChemicalOut:
    base = dict(product_id=p.id, product_name=p.product_name, active_ingredient=p.active_ingredient)
    crop_ok = crop in p.target_crops
    disease_ok = disease.id in p.target_disease_ids
    evidence = [kb.evidence_out(e) for e in p.evidence]

    if p.status is ChemicalStatus.LABEL_VERIFIED and p.label and crop_ok and disease_ok:
        expired = p.label.valid_until is not None and p.label.valid_until < today
        if not expired and p.review_status == "approved":
            return ChemicalOut(
                **base,
                status=p.status,
                actionable=True,
                label_summary={
                    "registration_reference": p.label.registration_reference,
                    "label_reference": p.label.label_reference,
                    "application_method": p.label.application_method,
                    "rate": f"{p.label.rate_value:g} {p.label.rate_unit}",
                    "timing": p.label.timing,
                    "safety_instructions": p.label.safety_instructions,
                    "restrictions": p.label.restrictions,
                    "verified_on": p.label.verified_on.isoformat(),
                    "valid_until": p.label.valid_until.isoformat() if p.label.valid_until else None,
                },
                message="Label-verified for this crop and disease. Use exactly as the label states.",
                evidence=evidence,
            )
        return ChemicalOut(**base, status=ChemicalStatus.VERIFICATION_REQUIRED, actionable=False, message="The label verification for this product has expired or is not approved; no dose is shown until it is re-verified.", evidence=evidence)

    if p.status is ChemicalStatus.INSTITUTIONAL_RECOMMENDATION and crop_ok and disease_ok:
        uses = [u for u in p.reported_use if crop in u.crops and disease.id in u.disease_ids]
        if uses:
            ev_by_id = {e.id: e for e in p.evidence}
            lines, ev_out = [], []
            for u in uses:
                first = ev_by_id[u.evidence_ids[0]]
                src = kb.sources[first.source_id]
                lines.append(_reported_text(u, src.institution.split(",")[0]))
                ev_out += [kb.evidence_out(ev_by_id[i]) for i in u.evidence_ids]
            return ChemicalOut(
                **base,
                status=p.status,
                actionable=False,
                reported_recommendation=" ".join(lines),
                message="Recommended by the cited institute but NOT label-verified by NutriPalm. Treat this as information to discuss with an agricultural officer, not as a dose.",
                evidence=ev_out,
            )

    why = []
    if not crop_ok:
        why.append(f"no source names {crop.value} as a target crop for it")
    if not disease_ok:
        why.append("it is not listed for this disease")
    if p.status is ChemicalStatus.VERIFICATION_REQUIRED:
        why.append("its label and crop applicability have not been verified")
    return ChemicalOut(
        **base,
        status=ChemicalStatus.VERIFICATION_REQUIRED,
        actionable=False,
        message="Verification required before any use: " + ("; ".join(why) if why else "applicability could not be established") + ". No dose is shown.",
        evidence=evidence,
    )


def build_treatment(kb: KnowledgeBase, disease: DiseaseRecord, crop: Crop, today: Optional[date] = None) -> TreatmentOut:
    today = today or date.today()
    ev_by_id = {e.id: e for e in disease.evidence}
    steps = [
        ManagementOut(id=m.id, category=m.category.value, text=m.text, evidence=[kb.evidence_out(ev_by_id[i]) for i in m.evidence_ids])
        for m in disease.management
        if crop in m.crops
    ]
    steps.sort(key=lambda s: (MANAGEMENT_ORDER.index(s.category), s.id))

    chem = [_chemical_entry(kb, kb.chemicals[pid], disease, crop, today) for pid in disease.chemical_product_ids if pid in kb.chemicals]
    if not chem:
        status = "not_applicable"
    elif any(c.actionable for c in chem):
        status = "verified_available"
    elif any(c.status is ChemicalStatus.INSTITUTIONAL_RECOMMENDATION for c in chem):
        status = "institutional_recommendation_only"
    else:
        status = "verification_required"
    return TreatmentOut(
        disease_id=disease.id,
        rule_version=TREATMENT_RULE_VERSION,
        steps=steps,
        chemical_status=status,
        chemical_management=chem,
        referral=REFERRAL,
    )
