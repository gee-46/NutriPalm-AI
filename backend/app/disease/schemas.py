"""
schemas.py

Typed models for the Disease Intelligence module.

Three families live here and are kept apart on purpose:

  1. Knowledge-base records (SourceDocument, EvidenceItem, DiseaseRecord, ChemicalProduct):
     curated, versioned, source-attributed catalogue data. They are NOT user data.
  2. API request/response models (AssessmentRequest, AssessmentResponse, ...).
  3. Persistence rows (stored with the owner's id; see repository.py).

Everything an assessment says must be traceable: observed input -> matched rule -> evidence
item -> source document (with page and a verbatim, machine-verified quote).
"""
from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# --------------------------------------------------------------------------- enums


class Crop(str, Enum):
    ARECANUT = "arecanut"
    COCONUT = "coconut"


class RiskLevel(str, Enum):
    """See docs/DISEASE_INTELLIGENCE.md for the exact definitions."""

    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"


class Specificity(str, Enum):
    """How the *source* describes a symptom (never invented by NutriPalm)."""

    FIRST_OR_CHARACTERISTIC = "first_or_characteristic"  # source says first / initial / characteristic
    REPORTED = "reported"  # source lists it among the symptoms


class VerificationStatus(str, Enum):
    UNVERIFIED = "unverified"
    QUOTES_VERIFIED = "quotes_verified"
    FAILED = "failed"


class RecordStatus(str, Enum):
    DRAFT = "draft"
    SOURCE_VERIFIED = "source_verified"  # every cited quote was found in the cited source
    EXPERT_REVIEWED = "expert_reviewed"  # a named person with domain expertise approved it


class ManagementCategory(str, Enum):
    """Decision hierarchy, in the order guidance is presented."""

    MONITORING = "monitoring_and_confirmation"
    PREVENTIVE = "preventive_practices"
    CULTURAL = "cultural_management"
    SANITATION = "field_sanitation"
    FIELD = "irrigation_drainage_field"
    BIOLOGICAL = "biological_management"
    CHEMICAL = "chemical_management"


MANAGEMENT_ORDER = [c.value for c in ManagementCategory]


class ChemicalStatus(str, Enum):
    LABEL_VERIFIED = "label_verified"  # registration + label checked; rate/units/method/timing complete
    INSTITUTIONAL_RECOMMENDATION = "institutional_recommendation"  # an authoritative institute recommends it; label NOT checked
    VERIFICATION_REQUIRED = "verification_required"  # no applicable authoritative evidence: no dosage may be shown


class TriState(str, Enum):
    YES = "yes"
    NO = "no"
    UNKNOWN = "unknown"


# --------------------------------------------------------------------------- knowledge base


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SourceVerification(_Strict):
    status: VerificationStatus = VerificationStatus.UNVERIFIED
    checked_at: Optional[datetime] = None
    sha256: Optional[str] = Field(default=None, pattern=r"^[0-9a-f]{64}$")
    pages: Optional[int] = None


class SourceDocument(_Strict):
    id: str = Field(pattern=r"^[a-z0-9_]+$")
    institution: str = Field(min_length=3)
    title: str = Field(min_length=3)
    authors: list[str] = Field(default_factory=list)
    publication: Optional[str] = None
    publication_date: str = Field(min_length=4, description="As printed on the document (e.g. '2022-11/12', '1989-08').")
    url: str = Field(pattern=r"^https://")
    document_type: Literal["extension_folder", "journal_article", "bulletin", "web_page", "label", "regulatory"]
    tier: int = Field(ge=1, le=7, description="Evidence priority: 1 ICAR-CPCRI ... 6 peer-reviewed ... 7 label/regulatory.")
    geographic_scope: list[str] = Field(default_factory=list)
    target_crops: list[Crop] = Field(min_length=1)
    retrieved_on: date
    verification: SourceVerification = Field(default_factory=SourceVerification)


class EvidenceItem(_Strict):
    id: str = Field(pattern=r"^[a-z0-9_]+$")
    source_id: str
    page: int = Field(ge=1, description="1-based page of the downloaded document (HTML pages use 1).")
    locator: str = Field(min_length=3, description="Section / figure / paragraph pointer.")
    quote: str = Field(min_length=25, max_length=600, description="Verbatim text from the page; machine-checked.")
    paraphrase: str = Field(min_length=10, max_length=400)
    verified: bool = False  # set only by scripts/verify_disease_sources.py


class SymptomLink(_Strict):
    code: str
    specificity: Specificity
    evidence_ids: list[str] = Field(min_length=1)


class ConditionLink(_Strict):
    code: str
    evidence_ids: list[str] = Field(min_length=1)


class StageLink(_Strict):
    stage: str
    evidence_ids: list[str] = Field(min_length=1)


class ManagementItem(_Strict):
    id: str = Field(pattern=r"^[a-z0-9_]+$")
    category: ManagementCategory
    text: str = Field(min_length=10, max_length=500, description="Accurate paraphrase of the cited guidance.")
    crops: list[Crop] = Field(min_length=1)
    evidence_ids: list[str] = Field(min_length=1)


class ScientificName(_Strict):
    name: str
    evidence_ids: list[str] = Field(min_length=1)


class GeographicApplicability(_Strict):
    regions: list[str] = Field(min_length=1, description="State names used for matching a plot's state.")
    note: Optional[str] = None
    evidence_ids: list[str] = Field(min_length=1)


class ExpertReview(_Strict):
    status: Literal["pending", "approved", "rejected"] = "pending"
    reviewer: Optional[str] = None
    reviewed_on: Optional[date] = None


class DiseaseRecord(_Strict):
    id: str = Field(pattern=r"^[a-z0-9_]+$")
    name: str
    local_names: list[str] = Field(default_factory=list)
    scientific_names: list[ScientificName] = Field(default_factory=list)
    crops: list[Crop] = Field(min_length=1)
    category: str = Field(min_length=3)
    affected_parts: list[str] = Field(min_length=1)
    symptoms: list[SymptomLink] = Field(min_length=1)
    excluded_symptoms: list[SymptomLink] = Field(default_factory=list, description="Observations the source says argue against this disease.")
    risk_conditions: list[ConditionLink] = Field(default_factory=list)
    crop_stages: list[StageLink] = Field(default_factory=list)
    any_stage_evidence_ids: list[str] = Field(default_factory=list, description="Evidence that the disease affects palms of any age.")
    geographic_applicability: Optional[GeographicApplicability] = None
    severity_notes: list[str] = Field(default_factory=list)
    management: list[ManagementItem] = Field(default_factory=list)
    chemical_product_ids: list[str] = Field(default_factory=list)
    evidence: list[EvidenceItem] = Field(min_length=1)
    record_version: str = Field(pattern=r"^\d+\.\d+\.\d+$")
    status: RecordStatus = RecordStatus.DRAFT
    expert_review: ExpertReview = Field(default_factory=ExpertReview)
    last_verified: Optional[date] = None

    @model_validator(mode="after")
    def _internal_references(self) -> "DiseaseRecord":
        ids = [e.id for e in self.evidence]
        if len(ids) != len(set(ids)):
            raise ValueError("duplicate evidence ids in disease record")
        known = set(ids)

        def check(owner: str, evidence_ids: list[str]) -> None:
            missing = [i for i in evidence_ids if i not in known]
            if missing:
                raise ValueError(f"{owner} cites unknown evidence {missing}")

        for s in self.symptoms + self.excluded_symptoms:
            check(f"symptom {s.code}", s.evidence_ids)
        for c in self.risk_conditions:
            check(f"condition {c.code}", c.evidence_ids)
        for st in self.crop_stages:
            check(f"stage {st.stage}", st.evidence_ids)
        for m in self.management:
            check(f"management {m.id}", m.evidence_ids)
            if not set(m.crops) <= set(self.crops):
                raise ValueError(f"management {m.id} targets a crop the disease record does not cover")
        for n in self.scientific_names:
            check(f"scientific name {n.name}", n.evidence_ids)
        check("any_stage_evidence_ids", self.any_stage_evidence_ids)
        if self.geographic_applicability:
            check("geographic_applicability", self.geographic_applicability.evidence_ids)
        codes = [s.code for s in self.symptoms]
        if len(codes) != len(set(codes)):
            raise ValueError("duplicate symptom codes in disease record")
        mids = [m.id for m in self.management]
        if len(mids) != len(set(mids)):
            raise ValueError("duplicate management ids in disease record")
        if set(codes) & {s.code for s in self.excluded_symptoms}:
            raise ValueError("a symptom cannot both support and exclude the same disease")
        return self


class ReportedUse(_Strict):
    """What an authoritative source says about using the product (reproduced, never recalculated)."""

    crops: list[Crop] = Field(min_length=1)
    disease_ids: list[str] = Field(min_length=1)
    concentration: Optional[str] = None
    application_method: Optional[str] = None
    timing: Optional[str] = None
    frequency: Optional[str] = None
    other_conditions: Optional[str] = None
    evidence_ids: list[str] = Field(min_length=1)


class LabelDetails(_Strict):
    """Complete, label-supported usage. Required for status == label_verified."""

    registration_reference: str = Field(min_length=3)
    label_reference: str = Field(min_length=3)
    application_method: str = Field(min_length=3)
    rate_value: float = Field(gt=0)
    rate_unit: str = Field(min_length=1)
    timing: str = Field(min_length=3)
    safety_instructions: list[str] = Field(min_length=1)
    restrictions: list[str] = Field(default_factory=list)
    market: str = "India"
    verified_on: date
    valid_until: Optional[date] = None
    verifier: str = Field(min_length=2)


class ChemicalProduct(_Strict):
    id: str = Field(pattern=r"^[a-z0-9_]+$")
    product_name: str
    active_ingredient: str
    formulation: Optional[str] = None
    concentration: Optional[str] = None
    target_disease_ids: list[str] = Field(min_length=1)
    target_crops: list[Crop] = Field(default_factory=list)  # crops the evidence explicitly names; empty = unknown
    status: ChemicalStatus
    reported_use: list[ReportedUse] = Field(default_factory=list)
    label: Optional[LabelDetails] = None
    notes: Optional[str] = None
    evidence: list[EvidenceItem] = Field(default_factory=list)
    record_version: str = Field(pattern=r"^\d+\.\d+\.\d+$")
    review_status: Literal["pending", "approved", "rejected"] = "pending"

    @model_validator(mode="after")
    def _status_requirements(self) -> "ChemicalProduct":
        known = {e.id for e in self.evidence}
        for use in self.reported_use:
            missing = [i for i in use.evidence_ids if i not in known]
            if missing:
                raise ValueError(f"reported_use cites unknown evidence {missing}")
            if not set(use.crops) <= set(self.target_crops):
                raise ValueError("reported_use names a crop that target_crops does not include")
        if self.status is ChemicalStatus.LABEL_VERIFIED:
            if self.label is None:
                raise ValueError("label_verified products need complete label details")
            if self.review_status != "approved":
                raise ValueError("label_verified products need review_status=approved")
            if not self.target_crops:
                raise ValueError("label_verified products must name their registered target crops")
        if self.status is ChemicalStatus.INSTITUTIONAL_RECOMMENDATION:
            if not self.reported_use:
                raise ValueError("institutional_recommendation products need at least one reported_use with evidence")
            if self.label is not None:
                raise ValueError("institutional_recommendation products must not carry label details")
        if self.status is ChemicalStatus.VERIFICATION_REQUIRED and self.label is not None:
            raise ValueError("verification_required products must not carry label details")
        return self


class VocabItem(_Strict):
    code: str = Field(pattern=r"^[a-z0-9_]+$")
    label_en: str
    part: Optional[str] = None
    synonyms: list[str] = Field(default_factory=list)


class Vocabulary(_Strict):
    version: str
    parts: list[VocabItem]
    symptoms: list[VocabItem]
    stages: list[VocabItem]
    conditions: list[VocabItem]
    crops: dict[str, list[str]]  # crop code -> accepted names (normalised, lower-case)


# --------------------------------------------------------------------------- API


class WeatherObservation(_Strict):
    """Observed values supplied by the client. Never defaulted; every field optional."""

    source: Optional[str] = Field(default=None, max_length=80)
    observed_at: Optional[datetime] = None
    temperature_c: Optional[float] = Field(default=None, ge=-30, le=60)
    humidity_pct: Optional[float] = Field(default=None, ge=0, le=100)
    rainfall_mm_24h: Optional[float] = Field(default=None, ge=0, le=1500)
    rainfall_mm_7d: Optional[float] = Field(default=None, ge=0, le=5000)


class AssessmentRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")  # tolerate newer frontends; unknown fields are never used

    plot_id: str = Field(min_length=1, max_length=64)
    crop: str = Field(min_length=1, max_length=60)
    crop_stage: Optional[str] = Field(default=None, max_length=60)
    symptom_codes: list[Annotated[str, Field(max_length=60)]] = Field(default_factory=list, max_length=40)
    symptoms: Optional[list[Annotated[str, Field(max_length=400)]]] = Field(default=None, max_length=10)
    affected_parts: list[Annotated[str, Field(max_length=40)]] = Field(default_factory=list, max_length=10)
    observations: Optional[str] = Field(default=None, max_length=1000)
    observation_date: Optional[date] = None
    severity: Optional[Literal["mild", "moderate", "severe"]] = None
    duration_days: Optional[int] = Field(default=None, ge=0, le=3650)
    context: dict[str, TriState] = Field(default_factory=dict)
    weather: Optional[WeatherObservation] = None

    @field_validator("observation_date")
    @classmethod
    def _not_future(cls, v: Optional[date]) -> Optional[date]:
        if v is not None and v > date.today():
            raise ValueError("observation_date cannot be in the future")
        return v


class EvidenceOut(BaseModel):
    description: str
    source: str
    evidence_id: Optional[str] = None
    source_id: Optional[str] = None
    url: Optional[str] = None
    page: Optional[int] = None
    quote: Optional[str] = None


class ManagementOut(BaseModel):
    id: str
    category: str
    text: str
    evidence: list[EvidenceOut] = Field(default_factory=list)


class ChemicalOut(BaseModel):
    product_id: str
    product_name: str
    active_ingredient: str
    status: ChemicalStatus
    actionable: bool
    reported_recommendation: Optional[str] = None
    label_summary: Optional[dict] = None
    message: str
    evidence: list[EvidenceOut] = Field(default_factory=list)


class TreatmentOut(BaseModel):
    disease_id: str
    rule_version: str
    steps: list[ManagementOut] = Field(default_factory=list)
    chemical_status: Literal["not_applicable", "verification_required", "institutional_recommendation_only", "verified_available"]
    chemical_management: list[ChemicalOut] = Field(default_factory=list)
    referral: str


class CandidateOut(BaseModel):
    rank: int
    disease_id: str
    disease_name: str
    scientific_names: list[str] = Field(default_factory=list)
    risk_level: RiskLevel
    matched_symptoms: list[str] = Field(default_factory=list)
    first_or_characteristic_matches: int
    supportive_conditions: list[str] = Field(default_factory=list)
    contradicting_observations: list[str] = Field(default_factory=list)
    contributing_factors: list[str] = Field(default_factory=list)
    evidence: list[EvidenceOut] = Field(default_factory=list)
    management: list[str] = Field(default_factory=list)
    precautions: list[str] = Field(default_factory=list)
    treatment: Optional[TreatmentOut] = None
    region_note: Optional[str] = None
    is_confirmed_diagnosis: Literal[False] = False


class AssessmentResponse(BaseModel):
    assessment_id: Optional[str] = None
    plot_id: str
    crop: str
    risk_level: RiskLevel
    risk_explanation: str
    candidates: list[CandidateOut] = Field(default_factory=list)
    observed: dict
    inputs_used: list[str] = Field(default_factory=list)
    inputs_not_used: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    missing_inputs: list[str] = Field(default_factory=list)
    follow_up_questions: list[str] = Field(default_factory=list)
    next_steps: list[str] = Field(default_factory=list)
    kb_version: str
    rule_version: str
    expert_review_status: str
    assessed_at: datetime
    disclaimer: str


class AssessmentRecord(BaseModel):
    """List-view row of a saved assessment."""

    id: str
    plot_id: str
    crop: str
    risk_level: RiskLevel
    top_disease: Optional[str] = None
    kb_version: str
    rule_version: str
    created_at: datetime
    result: Optional[AssessmentResponse] = None

