"""
service.py

Orchestrates one disease assessment:

    validate input -> check plot ownership -> normalise -> rule engine -> treatment guidance -> persist

Business rules live in assessment.py / treatment.py (pure, independently tested); this module only
wires them to the authenticated user, the plot repository and persistence.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from app.disease.assessment import DISCLAIMER, RULE_VERSION, Observation, assess
from app.disease.knowledge_base import KnowledgeBase
from app.disease.repository import AssessmentRepository, PlotContextRepository
from app.disease.schemas import (
    AssessmentRecord,
    AssessmentRequest,
    AssessmentResponse,
    Crop,
    TriState,
)
from app.disease.treatment import build_treatment
from app.disease.vocabulary import normalize_crop, normalize_parts, normalize_stage, normalize_symptoms
from app.exceptions import (
    DiseaseAssessmentNotFound,
    NotAuthorized,
    PlotNotFound,
    RepositoryNotConfigured,
    ValidationFailed,
)

logger = logging.getLogger(__name__)

MAX_TREATMENT_CANDIDATES = 3


class DiseaseService:
    def __init__(self, kb: KnowledgeBase, plots: PlotContextRepository, assessments: AssessmentRepository):
        self.kb = kb
        self.plots = plots
        self.assessments = assessments

    # ------------------------------------------------------------------ vocabulary
    def vocabulary(self) -> dict:
        v = self.kb.vocabulary
        usable = {c: [d.id for d in self.kb.diseases_for_crop(Crop(c))] for c in v.crops}
        return {
            "version": v.version,
            "kb_version": self.kb.kb_version,
            "rule_version": RULE_VERSION,
            "crops": sorted(v.crops),
            "crops_with_verified_knowledge": sorted(c for c, ids in usable.items() if ids),
            "parts": [{"code": p.code, "label_en": p.label_en} for p in v.parts],
            "stages": [{"code": s.code, "label_en": s.label_en} for s in v.stages],
            "symptoms": [{"code": s.code, "label_en": s.label_en, "part": s.part} for s in v.symptoms],
            "conditions": [{"code": c.code, "label_en": c.label_en} for c in v.conditions],
        }

    # ------------------------------------------------------------------ assessment
    def assess(self, owner_id: str, req: AssessmentRequest) -> AssessmentResponse:
        vocab = self.kb.vocabulary
        crop = normalize_crop(req.crop, vocab)
        if crop is None:
            raise ValidationFailed(f"Unsupported crop '{req.crop}'. Supported crops: {', '.join(sorted(vocab.crops))}.")

        # Ownership first: nothing about the plot (or even whether it exists) is revealed to another user.
        ctx = self.plots.get_plot_context(req.plot_id)
        if ctx.owner_id != owner_id:
            raise PlotNotFound(f"Plot '{req.plot_id}' was not found.")
        if ctx.crop and ctx.crop.strip():
            # A plot recorded with a crop can only be assessed as that crop (an oil palm plot is not a coconut plot).
            plot_crop = normalize_crop(ctx.crop, vocab)
            if plot_crop is not crop:
                raise ValidationFailed(f"This plot is recorded as '{ctx.crop.strip()}'; it cannot be assessed as {crop.value}.")

        sym = normalize_symptoms(req.symptom_codes, req.symptoms, vocab)
        if sym.unknown_codes:
            raise ValidationFailed("Unknown symptom code(s): " + ", ".join(sym.unknown_codes))
        known_conditions = {c.code for c in vocab.conditions}
        bad_ctx = [k for k in req.context if k not in known_conditions]
        if bad_ctx:
            raise ValidationFailed("Unknown field-condition key(s): " + ", ".join(bad_ctx))
        parts, bad_parts = normalize_parts(req.affected_parts, vocab)
        stage = normalize_stage(req.crop_stage, vocab)

        obs = Observation(
            crop=crop,
            stage=stage,
            stage_text_unrecognised=req.crop_stage if (req.crop_stage and req.crop_stage.strip() and stage is None) else None,
            symptom_codes=sym.codes,
            unrecognised_symptom_text=sym.unrecognised_text,
            parts=parts,
            context=dict(req.context),
            state=ctx.state.strip() if ctx.state and ctx.state.strip() else None,
            district=ctx.district,
            severity=req.severity,
            duration_days=req.duration_days,
            weather_supplied=bool(req.weather and req.weather.model_dump(exclude_none=True, exclude={"source", "observed_at"})),
        )
        result = assess(self.kb, obs)
        if bad_parts:
            result.inputs_not_used.append("Plant part(s) not recognised: " + ", ".join(bad_parts))
        if req.observations and req.observations.strip():
            result.inputs_not_used.append("Free-text notes were saved with the assessment but are not used by the rules.")

        for cand in result.candidates[:MAX_TREATMENT_CANDIDATES]:
            treatment = build_treatment(self.kb, result.records[cand.disease_id], crop)
            cand.treatment = treatment
            cand.management = [s.text for s in treatment.steps if s.category != "monitoring_and_confirmation"]
            cand.precautions = [s.text for s in treatment.steps if s.category == "monitoring_and_confirmation"] + [treatment.referral]

        usable = self.kb.diseases_for_crop(crop)
        response = AssessmentResponse(
            plot_id=req.plot_id,
            crop=crop.value,
            risk_level=result.risk_level,
            risk_explanation=result.risk_explanation,
            candidates=result.candidates,
            observed={
                "kind": "farmer_reported",
                "crop_stage": stage,
                "symptoms": [{"code": c, "label": self.kb.symptom_label(c)} for c in sym.codes],
                "affected_parts": parts,
                "severity": req.severity,
                "duration_days": req.duration_days,
                "observation_date": req.observation_date.isoformat() if req.observation_date else None,
                "field_conditions": {k: v.value for k, v in req.context.items() if v is not TriState.UNKNOWN},
                "plot_state": obs.state,
            },
            inputs_used=result.inputs_used,
            inputs_not_used=result.inputs_not_used,
            limitations=result.limitations,
            missing_inputs=result.missing_inputs,
            follow_up_questions=result.follow_up_questions,
            next_steps=result.next_steps,
            kb_version=self.kb.kb_version,
            rule_version=RULE_VERSION,
            expert_review_status=self.kb.expert_review_status(usable),
            assessed_at=datetime.now(timezone.utc),
            disclaimer=DISCLAIMER,
        )

        top = result.candidates[0].disease_id if result.candidates else None
        try:
            saved = self.assessments.save(owner_id, req, response, top)
            response.assessment_id = str(saved.get("id")) if saved.get("id") else None
        except RepositoryNotConfigured:
            logger.warning("disease.assessment.not_persisted: database not configured")
            response.limitations.append("This assessment could not be saved to your history (the database is not configured).")
        except Exception:  # persistence must not hide a valid result, but it must be visible
            logger.exception("disease.assessment.persist_failed")
            response.limitations.append("This assessment could not be saved to your history.")

        logger.info(
            "disease.assessment.created",
            extra={"owner_id": owner_id, "plot_id": req.plot_id, "crop": crop.value, "risk": result.risk_level.value, "kb_version": self.kb.kb_version},
        )
        return response

    # ------------------------------------------------------------------ history
    @staticmethod
    def _record(row: dict, with_result: bool) -> AssessmentRecord:
        result = row.get("result")
        return AssessmentRecord(
            id=str(row["id"]),
            plot_id=str(row["plot_id"]),
            crop=row["crop"],
            risk_level=row["risk_level"],
            top_disease=row.get("top_disease_id"),
            kb_version=row["kb_version"],
            rule_version=row["rule_version"],
            created_at=row["created_at"],
            result=AssessmentResponse.model_validate(result) if with_result and result else None,
        )

    def list_history(self, owner_id: str, plot_id: Optional[str]) -> list[AssessmentRecord]:
        return [self._record(r, with_result=False) for r in self.assessments.list_for_owner(owner_id, plot_id)]

    def get_history_item(self, owner_id: str, assessment_id: str) -> AssessmentRecord:
        try:
            row = self.assessments.get_for_owner(assessment_id, owner_id)
        except (DiseaseAssessmentNotFound, NotAuthorized) as exc:
            raise DiseaseAssessmentNotFound("Assessment not found.") from exc
        return self._record(row, with_result=True)
