"""
assessment.py

Deterministic, explainable disease-risk assessment.

This is a RULE ENGINE over source-verified knowledge-base records. It is not a machine-learning model and
produces no probability or confidence number. Same input + same knowledge base => same output.

Evidence strands for one candidate disease (all taken from the record, never from code):
    F  symptoms the farmer reported that the source calls "first / initial / characteristic" for the disease
    R  symptoms the farmer reported that the source merely lists for the disease
    C  supportive conditions the farmer confirmed (yes) that the source associates with the disease
    X  contradictions: a reported symptom the source lists against the disease, a crop stage the source does
       not cover, or a region the source does not report the disease from

Risk level for the candidate (documented in docs/DISEASE_INTELLIGENCE.md):
    high      F >= 1  and  (F + R >= 2  or  C >= 1)
    moderate  F >= 1, or R >= 2, or (R == 1 and C >= 1)
    low       R == 1 and C == 0
    insufficient_evidence   nothing matched
Each contradiction (X) lowers the level by one step. The overall result is the best candidate's level.
A "high" result means the observations are strongly consistent with the disease. It is not a diagnosis.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from app.disease.knowledge_base import KnowledgeBase
from app.disease.schemas import (
    CandidateOut,
    Crop,
    DiseaseRecord,
    RiskLevel,
    Specificity,
    TriState,
)

RULE_VERSION = "1.0.0"

DISCLAIMER = (
    "This is a screening result from a rule-based tool, not a diagnosis. A high risk level means your observations "
    "match what the cited sources describe; it does not prove the disease is present. Have the palm checked by a "
    "qualified agricultural officer or your local Krishi Vigyan Kendra (KVK) before taking action."
)

_ORDER = [RiskLevel.INSUFFICIENT_EVIDENCE, RiskLevel.LOW, RiskLevel.MODERATE, RiskLevel.HIGH]


def _rank(level: RiskLevel) -> int:
    return _ORDER.index(level)


def lower(level: RiskLevel, steps: int) -> RiskLevel:
    return _ORDER[max(0, _rank(level) - steps)]


def base_level(f: int, r: int, c: int) -> RiskLevel:
    """The documented rule table (before contradictions)."""
    if f >= 1 and (f + r >= 2 or c >= 1):
        return RiskLevel.HIGH
    if f >= 1 or r >= 2 or (r == 1 and c >= 1):
        return RiskLevel.MODERATE
    if r == 1:
        return RiskLevel.LOW
    return RiskLevel.INSUFFICIENT_EVIDENCE


@dataclass
class Observation:
    crop: Crop
    stage: Optional[str] = None
    stage_text_unrecognised: Optional[str] = None
    symptom_codes: list[str] = field(default_factory=list)
    unrecognised_symptom_text: list[str] = field(default_factory=list)
    parts: list[str] = field(default_factory=list)
    context: dict[str, TriState] = field(default_factory=dict)
    state: Optional[str] = None  # the PLOT's state, read server-side (never client-supplied)
    district: Optional[str] = None
    severity: Optional[str] = None
    duration_days: Optional[int] = None
    weather_supplied: bool = False


@dataclass
class EngineResult:
    risk_level: RiskLevel
    risk_explanation: str
    candidates: list[CandidateOut]
    records: dict[str, DiseaseRecord]
    inputs_used: list[str]
    inputs_not_used: list[str]
    limitations: list[str]
    missing_inputs: list[str]
    follow_up_questions: list[str]
    next_steps: list[str]


def _norm(s: str) -> str:
    return " ".join(s.casefold().split())


def _region_matches(record: DiseaseRecord, state: str) -> bool:
    assert record.geographic_applicability is not None
    s = _norm(state)
    return any(_norm(r) == s or _norm(r) in s or s in _norm(r) for r in record.geographic_applicability.regions)


def evaluate_candidate(kb: KnowledgeBase, d: DiseaseRecord, obs: Observation) -> Optional[tuple]:
    """Return (candidate-data tuple) or None when no reported symptom matches the record."""
    observed = set(obs.symptom_codes)
    matched = [s for s in d.symptoms if s.code in observed]
    if not matched:
        return None
    f = sum(1 for s in matched if s.specificity is Specificity.FIRST_OR_CHARACTERISTIC)
    r = len(matched) - f
    supportive = [c for c in d.risk_conditions if obs.context.get(c.code) is TriState.YES]
    contradictions: list[str] = []
    for s in d.excluded_symptoms:
        if s.code in observed:
            contradictions.append(f"Reported '{kb.symptom_label(s.code)}', which the source lists against this disease.")
    if obs.stage and d.crop_stages and obs.stage not in {st.stage for st in d.crop_stages} and not d.any_stage_evidence_ids:
        contradictions.append("The sources describe this disease for other crop stages than the one you selected.")
    region_note: Optional[str] = None
    if d.geographic_applicability:
        ga = d.geographic_applicability
        if obs.state is None:
            region_note = f"The source reports this disease from {', '.join(ga.regions)} only; your plot's state is not recorded, so this could not be compared."
        elif not _region_matches(d, obs.state):
            region_note = f"The source reports this disease from {', '.join(ga.regions)}; your plot is in {obs.state}."
            contradictions.append(region_note)
        else:
            region_note = ga.note
    level = lower(base_level(f, r, len(supportive)), len(contradictions))
    return matched, f, r, supportive, contradictions, level, region_note


def assess(kb: KnowledgeBase, obs: Observation) -> EngineResult:
    vocab = kb.vocabulary
    usable = kb.diseases_for_crop(obs.crop, usable_only=True)
    withheld = kb.unusable_count(obs.crop)

    inputs_used: list[str] = [f"Crop: {obs.crop.value}"]
    inputs_not_used: list[str] = []
    limitations: list[str] = [
        "Disease records are screened only against source-verified evidence; they have not been reviewed by a plant pathologist.",
        DISCLAIMER,
    ]
    missing: list[str] = []

    if obs.stage:
        inputs_used.append(f"Crop stage: {obs.stage}")
    elif obs.stage_text_unrecognised:
        inputs_not_used.append(f"Crop stage '{obs.stage_text_unrecognised}' is not one of: {', '.join(s.code for s in vocab.stages)}")
        missing.append("A recognised crop stage (seedling, young palm or adult palm).")
    else:
        missing.append("Crop stage.")
    if obs.symptom_codes:
        inputs_used.append("Symptoms: " + ", ".join(kb.symptom_label(c) for c in obs.symptom_codes))
    if obs.parts:
        inputs_used.append("Affected parts: " + ", ".join(obs.parts))
    answered = {k: v for k, v in obs.context.items() if v is not TriState.UNKNOWN}
    if answered:
        inputs_used.append("Field conditions answered: " + ", ".join(f"{kb.condition_label(k)} = {v.value}" for k, v in sorted(answered.items())))
    if obs.severity:
        inputs_used.append(f"Reported severity: {obs.severity} (recorded; it does not change the risk category)")
    if obs.duration_days is not None:
        inputs_used.append(f"Reported duration: {obs.duration_days} day(s) (recorded; it does not change the risk category)")
    if obs.state:
        inputs_used.append(f"Plot state: {obs.state}")
    if obs.weather_supplied:
        inputs_not_used.append(
            "Weather values were supplied, but the knowledge base holds no source-verified weather thresholds for these diseases, so they did not change the result."
        )
    if obs.unrecognised_symptom_text:
        inputs_not_used.append("Text not matched to a known symptom: " + "; ".join(obs.unrecognised_symptom_text))
    if withheld:
        limitations.append(f"{withheld} disease record(s) for this crop exist but are not source-verified and were not used.")
    if not obs.symptom_codes:
        missing.append("At least one observed symptom.")

    scored = []
    for d in usable:
        ev = evaluate_candidate(kb, d, obs)
        if ev is not None:
            scored.append((d, ev))

    def sort_key(item):
        d, (matched, f, r, supportive, contradictions, level, _) = item
        return (-_rank(level), -f, -(f + r), -len(supportive), d.id)

    scored.sort(key=sort_key)
    candidates: list[CandidateOut] = []
    records: dict[str, DiseaseRecord] = {}
    dropped_by_contradiction = 0
    for d, (matched, f, r, supportive, contradictions, level, region_note) in scored:
        if level is RiskLevel.INSUFFICIENT_EVIDENCE:
            dropped_by_contradiction += 1
            continue
        factors = [
            f"Reported symptom: {kb.symptom_label(s.code)} — the source describes it as "
            f"{'a first or characteristic symptom' if s.specificity is Specificity.FIRST_OR_CHARACTERISTIC else 'a reported symptom'}."
            for s in matched
        ] + [f"Supportive condition you confirmed: {kb.condition_label(c.code)}." for c in supportive]
        ev_ids: list[str] = []
        for link in [*matched, *supportive]:
            for eid in link.evidence_ids:
                if eid not in ev_ids:
                    ev_ids.append(eid)
        ev_by_id = {e.id: e for e in d.evidence}
        records[d.id] = d
        candidates.append(
            CandidateOut(
                rank=len(candidates) + 1,
                disease_id=d.id,
                disease_name=d.name,
                scientific_names=[n.name for n in d.scientific_names],
                risk_level=level,
                matched_symptoms=[s.code for s in matched],
                first_or_characteristic_matches=f,
                supportive_conditions=[c.code for c in supportive],
                contradicting_observations=contradictions,
                contributing_factors=factors,
                evidence=[kb.evidence_out(ev_by_id[i]) for i in ev_ids],
                region_note=region_note,
            )
        )
    if dropped_by_contradiction:
        limitations.append(f"{dropped_by_contradiction} possible disease(s) were set aside because the sources list your observations against them.")
    if len([c for c in candidates if c.risk_level in (RiskLevel.MODERATE, RiskLevel.HIGH)]) > 1:
        limitations.append("More than one disease fits your observations; they are listed in ranked order and cannot be separated without examination.")

    # ---- overall result ------------------------------------------------------------------
    if not usable:
        level = RiskLevel.INSUFFICIENT_EVIDENCE
        explanation = (
            "No source-verified disease knowledge is available for this crop yet, so no risk can be assessed. "
            "This is not a statement that the crop is healthy."
        )
    elif not obs.symptom_codes:
        level = RiskLevel.INSUFFICIENT_EVIDENCE
        explanation = "No symptom was provided (or none could be matched to a known symptom), so there is nothing to assess."
    elif not candidates:
        level = RiskLevel.INSUFFICIENT_EVIDENCE
        explanation = (
            "The symptoms you reported do not match any disease in the verified knowledge base for this crop. "
            "That does not rule out a disease or another problem; it only means this tool cannot assess it."
        )
    else:
        level = candidates[0].risk_level
        top = candidates[0]
        explanation = (
            f"Risk is {level.value}. The best-matching disease is '{top.disease_name}': you reported "
            f"{len(top.matched_symptoms)} symptom(s) that the cited sources associate with it "
            f"({top.first_or_characteristic_matches} described as first or characteristic) and confirmed "
            f"{len(top.supportive_conditions)} supportive condition(s)"
            + (f", with {len(top.contradicting_observations)} contradiction(s) lowering the level" if top.contradicting_observations else "")
            + ". This is a screening result, not a diagnosis."
        )

    # ---- what is missing / what to ask next ---------------------------------------------
    follow_ups: list[str] = []
    for c in candidates[:2]:
        d = records[c.disease_id]
        for s in d.symptoms:
            if s.specificity is Specificity.FIRST_OR_CHARACTERISTIC and s.code not in obs.symptom_codes:
                q = f"Do you also see: {kb.symptom_label(s.code)}? (described by the source as a first or characteristic symptom of {d.name})"
                if q not in follow_ups:
                    follow_ups.append(q)
        for cond in d.risk_conditions:
            if obs.context.get(cond.code, TriState.UNKNOWN) is TriState.UNKNOWN:
                q = f"Is this true: {kb.condition_label(cond.code)}? (the source links it to {d.name})"
                if q not in follow_ups:
                    follow_ups.append(q)
                lbl = f"Field condition: {kb.condition_label(cond.code)}."
                if lbl not in missing:
                    missing.append(lbl)
    if not candidates and usable and obs.symptom_codes:
        follow_ups.append("Describe the symptoms again using the symptom list, or ask an agricultural officer to examine the palm.")
    if not obs.symptom_codes and usable:
        follow_ups.append("Which symptoms do you see on the leaves, crown, trunk, nuts or roots?")

    next_steps = ["Have the palm examined by a qualified agricultural officer or your local KVK to confirm or rule out the disease."]
    if level in (RiskLevel.MODERATE, RiskLevel.HIGH):
        next_steps.append("Arrange this confirmation soon; do not wait for the next assessment.")
        next_steps.append("Do not apply any pesticide on the basis of this result alone.")
    elif level is RiskLevel.INSUFFICIENT_EVIDENCE:
        next_steps.append("Add the missing observations above and assess again, or seek an expert opinion if the problem continues.")

    return EngineResult(
        risk_level=level,
        risk_explanation=explanation,
        candidates=candidates,
        records=records,
        inputs_used=inputs_used,
        inputs_not_used=inputs_not_used,
        limitations=limitations,
        missing_inputs=missing,
        follow_up_questions=follow_ups[:6],
        next_steps=next_steps,
    )
