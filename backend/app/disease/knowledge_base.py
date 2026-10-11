"""
knowledge_base.py

Loads and validates the versioned disease knowledge base (JSON files under data/).

Design notes
------------
* The knowledge base is read-only catalogue data shipped with the application and reviewed through
  pull requests (diff-able, versioned by `kb_version` and each record's `record_version`). It is not
  user data, so it carries no owner_id and is not stored in per-user tables.
* A record is *usable* for an assessment only if every evidence quote it cites has been machine-verified
  against the cited source (scripts/verify_disease_sources.py) and the record is at least
  `source_verified`. Draft or unverifiable records are loaded (so they can be reviewed) but never used.
* Nothing here invents agronomic content. Loading fails loudly on dangling references, unknown symptom
  codes, unsupported crop/source combinations and chemical records that claim more than they can prove.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Optional

from pydantic import ValidationError

from app.disease.schemas import (
    ChemicalProduct,
    ChemicalStatus,
    Crop,
    DiseaseRecord,
    EvidenceItem,
    EvidenceOut,
    RecordStatus,
    SourceDocument,
    VerificationStatus,
    Vocabulary,
)

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent / "data"


class KnowledgeBaseError(Exception):
    """The knowledge base is structurally invalid (never silently repaired)."""


@dataclass
class KnowledgeBase:
    kb_version: str
    vocabulary: Vocabulary
    sources: dict[str, SourceDocument]
    diseases: dict[str, DiseaseRecord]
    chemicals: dict[str, ChemicalProduct]
    issues: list[str] = field(default_factory=list)

    # ---- queries -----------------------------------------------------------------

    def is_usable(self, disease: DiseaseRecord) -> bool:
        """Source-verified evidence only; see module docstring."""
        if disease.status not in (RecordStatus.SOURCE_VERIFIED, RecordStatus.EXPERT_REVIEWED):
            return False
        for e in disease.evidence:
            src = self.sources.get(e.source_id)
            if not e.verified or src is None or src.verification.status is not VerificationStatus.QUOTES_VERIFIED:
                return False
        if disease.status is RecordStatus.EXPERT_REVIEWED and disease.expert_review.status != "approved":
            return False
        return True

    def diseases_for_crop(self, crop: Crop, usable_only: bool = True) -> list[DiseaseRecord]:
        out = [d for d in self.diseases.values() if crop in d.crops]
        if usable_only:
            out = [d for d in out if self.is_usable(d)]
        return sorted(out, key=lambda d: d.id)

    def unusable_count(self, crop: Crop) -> int:
        return len([d for d in self.diseases.values() if crop in d.crops and not self.is_usable(d)])

    def supported_crops(self) -> list[str]:
        return sorted(self.vocabulary.crops.keys())

    def expert_review_status(self, diseases: list[DiseaseRecord]) -> str:
        if diseases and all(d.expert_review.status == "approved" for d in diseases):
            return "approved"
        return "pending"

    def evidence_out(self, item: EvidenceItem) -> EvidenceOut:
        src = self.sources[item.source_id]
        return EvidenceOut(
            description=item.paraphrase,
            source=f"{src.institution} — {src.title} ({src.publication_date}), p. {item.page}",
            evidence_id=item.id,
            source_id=src.id,
            url=src.url,
            page=item.page,
            quote=item.quote,
        )

    def symptom_label(self, code: str) -> str:
        for s in self.vocabulary.symptoms:
            if s.code == code:
                return s.label_en
        return code

    def condition_label(self, code: str) -> str:
        for c in self.vocabulary.conditions:
            if c.code == code:
                return c.label_en
        return code


# --------------------------------------------------------------------------- loading


def _read(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise KnowledgeBaseError(f"cannot read {path.name}: {exc}") from exc


def build_knowledge_base(
    *,
    vocabulary: dict,
    sources: dict,
    diseases: dict,
    chemicals: dict,
    today: Optional[date] = None,
) -> KnowledgeBase:
    """Validate raw dictionaries and return a KnowledgeBase. Raises KnowledgeBaseError on any structural problem."""
    errors: list[str] = []
    try:
        vocab = Vocabulary.model_validate(vocabulary)
    except ValidationError as exc:
        raise KnowledgeBaseError(f"vocabulary invalid: {exc}") from exc

    versions = {sources.get("kb_version"), diseases.get("kb_version"), chemicals.get("kb_version")}
    if len(versions) != 1 or None in versions:
        raise KnowledgeBaseError(f"kb_version must be identical in sources/diseases/chemicals, got {sorted(map(str, versions))}")
    kb_version = versions.pop()

    src_map: dict[str, SourceDocument] = {}
    for raw in sources.get("sources", []):
        try:
            s = SourceDocument.model_validate(raw)
        except ValidationError as exc:
            errors.append(f"source {raw.get('id')}: {exc.errors()[0]['msg']} at {exc.errors()[0]['loc']}")
            continue
        if s.id in src_map:
            errors.append(f"duplicate source id {s.id}")
        src_map[s.id] = s

    symptom_codes = {s.code for s in vocab.symptoms}
    condition_codes = {c.code for c in vocab.conditions}
    stage_codes = {s.code for s in vocab.stages}
    crop_codes = set(vocab.crops)

    def check_evidence(owner: str, items: list[EvidenceItem], allowed_crops: list[Crop]) -> None:
        for e in items:
            src = src_map.get(e.source_id)
            if src is None:
                errors.append(f"{owner}: evidence {e.id} cites unknown source {e.source_id}")
                continue
            if src.verification.pages and e.page > src.verification.pages:
                errors.append(f"{owner}: evidence {e.id} cites page {e.page} but the source has {src.verification.pages} pages")
            if allowed_crops and not (set(allowed_crops) & set(src.target_crops)):
                errors.append(f"{owner}: evidence {e.id} comes from a source about {[c.value for c in src.target_crops]}, not {[c.value for c in allowed_crops]}")
            if e.verified and src.verification.status is not VerificationStatus.QUOTES_VERIFIED:
                errors.append(f"{owner}: evidence {e.id} is marked verified but its source is not")

    disease_map: dict[str, DiseaseRecord] = {}
    for raw in diseases.get("diseases", []):
        try:
            d = DiseaseRecord.model_validate(raw)
        except ValidationError as exc:
            first = exc.errors()[0]
            errors.append(f"disease {raw.get('id')}: {first['msg']} at {'.'.join(map(str, first['loc']))}")
            continue
        if d.id in disease_map:
            errors.append(f"duplicate disease id {d.id}")
        disease_map[d.id] = d
        if any(c.value not in crop_codes for c in d.crops):
            errors.append(f"disease {d.id}: crop not in vocabulary")
        for s in d.symptoms + d.excluded_symptoms:
            if s.code not in symptom_codes:
                errors.append(f"disease {d.id}: unknown symptom code {s.code}")
        for c in d.risk_conditions:
            if c.code not in condition_codes:
                errors.append(f"disease {d.id}: unknown condition code {c.code}")
        for st in d.crop_stages:
            if st.stage not in stage_codes:
                errors.append(f"disease {d.id}: unknown stage {st.stage}")
        check_evidence(f"disease {d.id}", d.evidence, d.crops)
        if d.status in (RecordStatus.SOURCE_VERIFIED, RecordStatus.EXPERT_REVIEWED) and not all(e.verified for e in d.evidence):
            errors.append(f"disease {d.id}: status {d.status.value} but not every evidence quote is verified")
        if d.status is RecordStatus.EXPERT_REVIEWED and (d.expert_review.status != "approved" or not d.expert_review.reviewer or not d.expert_review.reviewed_on):
            errors.append(f"disease {d.id}: expert_reviewed requires an approved review with reviewer and date")

    chem_map: dict[str, ChemicalProduct] = {}
    for raw in chemicals.get("chemicals", []):
        try:
            c = ChemicalProduct.model_validate(raw)
        except ValidationError as exc:
            first = exc.errors()[0]
            errors.append(f"chemical {raw.get('id')}: {first['msg']} at {'.'.join(map(str, first['loc']))}")
            continue
        if c.id in chem_map:
            errors.append(f"duplicate chemical id {c.id}")
        chem_map[c.id] = c
        for did in c.target_disease_ids:
            if did not in disease_map and not any(did == r.get("id") for r in diseases.get("diseases", [])):
                errors.append(f"chemical {c.id}: unknown target disease {did}")
        check_evidence(f"chemical {c.id}", c.evidence, c.target_crops)
        if c.status is ChemicalStatus.LABEL_VERIFIED and c.label and c.label.valid_until and c.label.valid_until < (today or date.today()):
            logger.warning("chemical %s label verification expired on %s", c.id, c.label.valid_until)

    for d in disease_map.values():
        for pid in d.chemical_product_ids:
            prod = chem_map.get(pid)
            if prod is None:
                errors.append(f"disease {d.id}: unknown chemical product {pid}")
            elif d.id not in prod.target_disease_ids:
                errors.append(f"disease {d.id} lists product {pid} which does not list the disease as a target")

    if errors:
        raise KnowledgeBaseError("knowledge base invalid:\n  - " + "\n  - ".join(errors))

    kb = KnowledgeBase(kb_version=str(kb_version), vocabulary=vocab, sources=src_map, diseases=disease_map, chemicals=chem_map)
    for d in disease_map.values():
        if not kb.is_usable(d):
            kb.issues.append(f"{d.id}: not usable (status={d.status.value}; unverified evidence or source)")
    return kb


def load_knowledge_base(data_dir: Path = DATA_DIR) -> KnowledgeBase:
    return build_knowledge_base(
        vocabulary=_read(data_dir / "vocabulary.json"),
        sources=_read(data_dir / "sources.json"),
        diseases=_read(data_dir / "diseases.json"),
        chemicals=_read(data_dir / "chemicals.json"),
    )


_CACHE: Optional[KnowledgeBase] = None


def get_knowledge_base() -> KnowledgeBase:
    """Process-wide cached knowledge base (the files are static for the life of the process)."""
    global _CACHE
    if _CACHE is None:
        _CACHE = load_knowledge_base()
    return _CACHE
