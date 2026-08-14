"""
Domain-level exceptions.

Routers catch these and translate them into proper HTTP responses. Services
and repositories should raise these instead of generic Exception so callers
can react appropriately (validation vs. not-found vs. ownership vs. config).
"""
from __future__ import annotations


class NutriPalmError(Exception):
    """Base class for all domain errors in the AI/recommendation backend."""


class ValidationFailed(NutriPalmError):
    """Input data failed domain validation (bad area, bad crop, etc.)."""


class PlotNotFound(NutriPalmError):
    """The referenced plot_id does not exist."""


class SoilReportNotFound(NutriPalmError):
    """The referenced soil_report_id does not exist."""


class RecommendationNotFound(NutriPalmError):
    """The referenced recommendation_id does not exist."""


class NotAuthorized(NutriPalmError):
    """The authenticated user does not own the requested resource."""


class UnsupportedCrop(NutriPalmError):
    """The crop is not present in the crop-rules catalog."""


class RepositoryNotConfigured(NutriPalmError):
    """
    Raised when a repository that depends on another team's module (Plot,
    Soil Report) cannot resolve real data because Supabase / that module's
    schema is not yet available.

    This is intentionally NOT silently swallowed or replaced with fake data.
    See backend/docs/integration_contract.md.
    """
