"""
disease.py (router)

    GET  /api/disease/vocabulary          symptoms / stages / field conditions the assessment understands
    POST /api/disease/assess              run and save an assessment for one of the caller's plots
    GET  /api/disease/assessments         the caller's saved assessments (optionally for one plot)
    GET  /api/disease/assessments/{id}    one saved assessment

Every route requires a verified Supabase bearer token. A plot or assessment that does not exist and one
that belongs to someone else produce the SAME 404, so ownership cannot be probed.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.dependencies import AuthenticatedUser, get_current_user
from app.disease.knowledge_base import KnowledgeBase, KnowledgeBaseError, get_knowledge_base
from app.disease.repository import (
    AssessmentRepository,
    PlotContextRepository,
    get_assessment_repository,
    get_plot_context_repository,
)
from app.disease.schemas import AssessmentRecord, AssessmentRequest, AssessmentResponse
from app.disease.service import DiseaseService
from app.exceptions import DiseaseAssessmentNotFound, NotAuthorized, PlotNotFound, RepositoryNotConfigured, ValidationFailed

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/disease", tags=["disease"])


def get_kb_dependency() -> KnowledgeBase:
    try:
        return get_knowledge_base()
    except KnowledgeBaseError as exc:
        logger.error("disease.knowledge_base.invalid: %s", exc)
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "The disease knowledge base is unavailable.") from exc


def get_disease_service(
    kb: KnowledgeBase = Depends(get_kb_dependency),
    plots: PlotContextRepository = Depends(get_plot_context_repository),
    assessments: AssessmentRepository = Depends(get_assessment_repository),
) -> DiseaseService:
    return DiseaseService(kb, plots, assessments)


_NOT_CONFIGURED = HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "The database is not configured.")


@router.get("/vocabulary")
def get_vocabulary(
    _user: AuthenticatedUser = Depends(get_current_user),
    service: DiseaseService = Depends(get_disease_service),
) -> dict:
    return service.vocabulary()


@router.post("/assess", response_model=AssessmentResponse, status_code=status.HTTP_201_CREATED)
def assess_disease(
    request: AssessmentRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    service: DiseaseService = Depends(get_disease_service),
) -> AssessmentResponse:
    try:
        return service.assess(current_user.user_id, request)
    except PlotNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Plot not found.") from exc
    except ValidationFailed as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    except RepositoryNotConfigured as exc:
        raise _NOT_CONFIGURED from exc


@router.get("/assessments", response_model=list[AssessmentRecord])
def list_assessments(
    plot_id: Optional[str] = Query(default=None, max_length=64),
    current_user: AuthenticatedUser = Depends(get_current_user),
    service: DiseaseService = Depends(get_disease_service),
) -> list[AssessmentRecord]:
    try:
        return service.list_history(current_user.user_id, plot_id)
    except RepositoryNotConfigured as exc:
        raise _NOT_CONFIGURED from exc


@router.get("/assessments/{assessment_id}", response_model=AssessmentRecord)
def get_assessment(
    assessment_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
    service: DiseaseService = Depends(get_disease_service),
) -> AssessmentRecord:
    try:
        return service.get_history_item(current_user.user_id, assessment_id)
    except (DiseaseAssessmentNotFound, NotAuthorized) as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assessment not found.") from exc
    except RepositoryNotConfigured as exc:
        raise _NOT_CONFIGURED from exc
