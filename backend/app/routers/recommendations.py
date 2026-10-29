"""
routers/recommendations.py

POST /api/recommendations
    Generate + persist a recommendation.

GET /api/recommendations
    List the caller's own recommendations.

GET /api/recommendations/{id}
    Fetch one of the caller's own recommendations.

Every endpoint requires a verified Supabase auth token.
owner_id is never taken from client input.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse

from app.dependencies import AuthenticatedUser, get_current_user
from app.rate_limit import limit_heavy
from app.exceptions import (
    NotAuthorized,
    PlotNotFound,
    RecommendationNotFound,
    RepositoryNotConfigured,
    SoilReportNotFound,
    UnsupportedCrop,
    ValidationFailed,
)
from app.repositories.plot_repository import (
    PlotRepository,
    get_plot_repository,
)
from app.repositories.recommendation_repository import (
    RecommendationRepository,
    get_recommendation_repository,
)
from app.repositories.soil_report_repository import (
    SoilReportRepository,
    get_soil_report_repository,
)
from app.schemas.api import (
    InsufficientDataResponse,
    InsufficientReason,
    RecommendationProvenance,
    RecommendationRecordOut,
    RecommendationRequest,
    RecommendationResponse,
    row_to_record,
    to_response,
    to_schedule_response,
)
from app.services import crop_rules, recommendation_service, schedule_engine
from app.services.rule_provenance import (
    ENGINE_VERSION,
    KIND_SCHEDULE,
    VerifiedRule,
    get_rule_pack,
    verified_rule_for,
)

logger = logging.getLogger("nutripalm.recommendations")

router = APIRouter(
    prefix="/api/recommendations",
    tags=["recommendations"],
)


@router.post(
    "",
    response_model=RecommendationResponse | InsufficientDataResponse,
    status_code=status.HTTP_201_CREATED,
    responses={200: {"model": InsufficientDataResponse}},
)
def create_recommendation(
    request: RecommendationRequest,
    current_user: AuthenticatedUser = Depends(limit_heavy),
    plot_repo: PlotRepository = Depends(get_plot_repository),
    soil_repo: SoilReportRepository = Depends(get_soil_report_repository),
    rec_repo: RecommendationRepository = Depends(
        get_recommendation_repository
    ),
    rule_pack: dict[str, VerifiedRule] = Depends(get_rule_pack),
):

    # ---------------------------------------------------------
    # Fetch plot
    # ---------------------------------------------------------
    try:
        plot = plot_repo.get_plot(request.plot_id)
    except PlotNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plot not found.",
        ) from exc
    except RepositoryNotConfigured as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Plot data source is not yet configured "
                "(BLOCKED BY TEAMMATE CONTRACT - see "
                "integration_contract.md)."
            ),
        ) from exc

    # ---------------------------------------------------------
    # Verify plot ownership
    # ---------------------------------------------------------
    if plot.owner_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plot not found.",
        )

    # ---------------------------------------------------------
    # Fetch soil report
    # ---------------------------------------------------------
    try:
        soil = soil_repo.get_soil_report(
            request.soil_report_id
        )
    except SoilReportNotFound:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Soil report not found.",
        )
    except RepositoryNotConfigured as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Soil report data source is not yet configured "
                "(BLOCKED BY TEAMMATE CONTRACT - see "
                "integration_contract.md)."
            ),
        ) from exc

    # ---------------------------------------------------------
    # Verify soil report ownership
    # ---------------------------------------------------------
    if soil.owner_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Soil report not found.",
        )

    # ---------------------------------------------------------
    # Verify soil report belongs to selected plot
    # ---------------------------------------------------------
    if soil.plot_id != plot.plot_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Soil report not found.",
        )

    # ---------------------------------------------------------
    # Only values that were read clearly or confirmed/corrected by the
    # owner may drive advice (see soil_extraction_service.py).
    # ---------------------------------------------------------
    if not soil.verification_status:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "soil_report_not_verified",
                "message": (
                    "This soil report did not come through the verified upload "
                    "workflow. Upload the report again and confirm the values."
                ),
            },
        )

    generated_at = datetime.now(timezone.utc).isoformat()

    # ---------------------------------------------------------
    # Is there an authoritative rule for this crop? If not, say so --
    # never fall back to the engineering defaults in crop_rules.py.
    # ---------------------------------------------------------
    reasons: list[InsufficientReason] = []
    rule = None
    if not (plot.crop or "").strip():
        reasons.append(InsufficientReason(
            code="crop_not_set", message="The plot has no crop set."))
    else:
        try:
            crop_rules.get_crop_requirement(plot.crop)
        except UnsupportedCrop:
            reasons.append(InsufficientReason(
                code="unsupported_crop",
                message=(
                    f"'{plot.crop}' is not a crop the engine has rules for "
                    f"({', '.join(crop_rules.list_supported_crops())})."
                ),
            ))
        else:
            rule = verified_rule_for(rule_pack, plot.crop)
            if rule is None:
                reasons.append(InsufficientReason(
                    code="no_verified_rule",
                    message=(
                        f"No agronomist-verified, cited nutrient rule is installed for "
                        f"'{plot.crop}'. Fertilizer quantities are not given without one."
                    ),
                ))

    if rule is None:
        required = ["A cited, agronomist-reviewed nutrient rule for this crop (see docs/OCR_AND_FERTILIZER_PIPELINE.md)."]
        if any(r.code == "crop_not_set" for r in reasons):
            required.insert(0, "Set the crop on the plot.")
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=InsufficientDataResponse(
                plot_id=plot.plot_id,
                soil_report_id=soil.soil_report_id,
                crop=plot.crop or None,
                engine_version=ENGINE_VERSION,
                generated_at=generated_at,
                reasons=reasons,
                required=required,
            ).model_dump(),
        )

    if rule.kind == KIND_SCHEDULE:
        return _schedule_recommendation(
            plot=plot,
            soil=soil,
            rule=rule,
            request=request,
            generated_at=generated_at,
            current_user=current_user,
            rec_repo=rec_repo,
        )

    # ---------------------------------------------------------
    # Build recommendation
    # ---------------------------------------------------------
    include_economics = rule.covers_yield_and_economics
    price = request.crop_price_per_ton_inr
    if price is None and not include_economics:
        # Revenue/ROI are not part of this response (their baselines are unsourced), so a
        # crop price would be an input nothing uses. The ROI computed here is discarded.
        price = 0.0

    try:
        result = recommendation_service.build_recommendation(
            plot,
            soil,
            crop_price_per_ton_inr=price,
            fertilizer_price_overrides=(
                request.fertilizer_price_overrides
            ),
        )
    except UnsupportedCrop as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except ValidationFailed as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    priced = set((request.fertilizer_price_overrides or {}).keys())
    provenance = RecommendationProvenance(
        crop=result.crop,
        area_ha=round(plot.area_in_hectares(), 4),
        soil_report_id=soil.soil_report_id,
        soil_verification_status=soil.verification_status,
        soil_values_used={
            "nitrogen_kg_ha": soil.nitrogen_kg_ha,
            "phosphorus_kg_ha": soil.phosphorus_kg_ha,
            "potassium_kg_ha": soil.potassium_kg_ha,
            "organic_carbon_percent": soil.organic_carbon_percent,
            "ph": soil.ph,
        },
        rule=rule.citation(),
        assumptions=[
            "A nutrient deficit is the gap between the verified soil-test value and the cited per-crop target.",
            "One product per nutrient: DAP for phosphorus, urea for nitrogen not covered by DAP, MOP for potassium.",
            (
                f"Phosphorus and potassium targets and soil-test values are on the {rule.soil_test_basis.get('phosphorus')} / "
                f"{rule.soil_test_basis.get('potassium')} basis; product quantities convert from the labelled P2O5 / K2O "
                "grade using the stoichiometric factors (P = 0.4364 x P2O5, K = 0.8302 x K2O)."
                if rule.soil_test_basis
                else "The P/K basis of the targets is not recorded."
            ),
            f"The rule applies to: {rule.applicable_stage} ({rule.region}). The plot's own stage and region are not checked against it.",
            "Fertilizer quantities are not adjusted for application losses or soil buffering.",
            *rule.assumptions,
        ],
        not_considered=[
            "Crop age and growth stage",
            "Irrigation and rainfall",
            "Application timing and splitting",
            "Previous crop and organic inputs",
        ],
    )
    response = to_response(
        result,
        engine_version=ENGINE_VERSION,
        generated_at=generated_at,
        provenance=provenance,
        include_economics=include_economics,
        priced_products=priced,
    )

    # ---------------------------------------------------------
    # Persist recommendation (what is stored is exactly what is shown)
    # ---------------------------------------------------------
    try:
        saved_row = rec_repo.save(
            result,
            engine_version=ENGINE_VERSION,
            generated_at=generated_at,
            provenance=provenance.model_dump(),
            stored={
                "fertilizer_plan": [d.model_dump() for d in response.fertilizer_plan],
                "yield_prediction": response.yield_prediction.model_dump() if response.yield_prediction else {},
                "roi": response.roi.model_dump() if response.roi else {},
                "explanation": response.explanation.model_dump(),
            },
        )
    except RepositoryNotConfigured as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Recommendation database is not configured.",
        ) from exc

    logger.info(
        "recommendation.created",
        extra={
            "owner_id": current_user.user_id,
            "plot_id": plot.plot_id,
            "crop": plot.crop,
            "dosages_count": len(result.dosage_plan.dosages),
            "recommendation_id": saved_row.get("id"),
            "engine_version": ENGINE_VERSION,
            "rule_version": rule.rule_version,
        },
    )

    response.recommendation_id = saved_row.get("id")
    response.status = saved_row.get("status", "generated")
    response.created_at = saved_row.get("created_at")
    return response


def _schedule_recommendation(*, plot, soil, rule, request, generated_at, current_user, rec_repo):
    """Published-schedule rules: dose per palm by palm age, scaled by the plot's palm count (schedule_engine.py)."""
    today = datetime.now(timezone.utc).date()
    built = schedule_engine.build(
        plot,
        soil.soil_report_id,
        rule,
        today=today,
        price_overrides=request.fertilizer_price_overrides,
    )
    if isinstance(built, schedule_engine.Blocked):
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=InsufficientDataResponse(
                plot_id=plot.plot_id,
                soil_report_id=soil.soil_report_id,
                crop=plot.crop or None,
                engine_version=ENGINE_VERSION,
                generated_at=generated_at,
                reasons=[InsufficientReason(code=r.code, message=r.message) for r in built.reasons],
                required=built.required,
            ).model_dump(),
        )

    priced = set((request.fertilizer_price_overrides or {}).keys())
    d = built.detail
    basis = d["nutrient_basis"]
    provenance = RecommendationProvenance(
        crop=built.crop,
        area_ha=round(plot.area_in_hectares(), 4),
        soil_report_id=soil.soil_report_id,
        soil_verification_status=soil.verification_status,
        soil_values_used={
            "nitrogen_kg_ha": soil.nitrogen_kg_ha,
            "phosphorus_kg_ha": soil.phosphorus_kg_ha,
            "potassium_kg_ha": soil.potassium_kg_ha,
            "organic_carbon_percent": soil.organic_carbon_percent,
            "ph": soil.ph,
        },
        rule=rule.citation(),
        schedule=d,
        assumptions=[
            "The doses are the cited publication's schedule, unmodified: grams per palm per year by palm age.",
            f"Palm age: {rule.age_basis} The plot's planting date is {d['planting_date']}, giving year {d['age_year']}.",
            f"The plot's recorded palm count ({d['plant_count']}) is used; the area is used only to express quantities per hectare.",
            (
                f"The source states phosphorus as {basis['p']} and potassium as {basis['k']}; product quantities convert from the "
                "labelled P2O5 / K2O grade with the stoichiometric factors (P = 0.4364 x P2O5, K = 0.8302 x K2O) where needed."
            ),
            "One product per nutrient: DAP for phosphorus (its nitrogen is credited), urea for the remaining nitrogen, MOP for potassium.",
            f"The rule applies to: {rule.applicable_stage} ({rule.region}).",
            *rule.assumptions,
        ],
        not_considered=[
            "Soil-test values (recorded with the recommendation but not used to change the dose)",
            "Leaf analysis",
            "Organic manure or other nutrient sources already applied",
            "Variety, irrigation and expected yield",
            "Application losses",
        ],
    )
    response = to_schedule_response(
        built,
        engine_version=ENGINE_VERSION,
        generated_at=generated_at,
        provenance=provenance,
        priced_products=priced,
    )

    try:
        saved_row = rec_repo.save(
            built,
            engine_version=ENGINE_VERSION,
            generated_at=generated_at,
            provenance=provenance.model_dump(),
            stored={
                "fertilizer_plan": [x.model_dump() for x in response.fertilizer_plan],
                "yield_prediction": {},
                "roi": {},
                "explanation": response.explanation.model_dump(),
            },
        )
    except RepositoryNotConfigured as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Recommendation database is not configured.",
        ) from exc

    logger.info(
        "recommendation.created",
        extra={
            "owner_id": current_user.user_id,
            "plot_id": plot.plot_id,
            "crop": plot.crop,
            "dosages_count": len(built.dosage_plan.dosages),
            "recommendation_id": saved_row.get("id"),
            "engine_version": ENGINE_VERSION,
            "rule_version": rule.rule_version,
            "rule_kind": rule.kind,
        },
    )
    response.recommendation_id = saved_row.get("id")
    response.status = saved_row.get("status", "generated")
    response.created_at = saved_row.get("created_at")
    return response


@router.get(
    "",
    response_model=list[RecommendationRecordOut],
)
def list_recommendations(
    current_user: AuthenticatedUser = Depends(get_current_user),
    rec_repo: RecommendationRepository = Depends(
        get_recommendation_repository
    ),
) -> list[RecommendationRecordOut]:

    try:
        rows = rec_repo.list_for_owner(
            current_user.user_id
        )
    except RepositoryNotConfigured as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Recommendation database is not configured.",
        ) from exc

    return [
        row_to_record(row)
        for row in rows
    ]


@router.get(
    "/{recommendation_id}",
    response_model=RecommendationRecordOut,
)
def get_recommendation(
    recommendation_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
    rec_repo: RecommendationRepository = Depends(
        get_recommendation_repository
    ),
) -> RecommendationRecordOut:

    try:
        row = rec_repo.get_for_owner(
            recommendation_id,
            current_user.user_id,
        )
    except (RecommendationNotFound, NotAuthorized) as exc:
        # Use one fixed response for both missing and unauthorized
        # recommendations so ownership cannot be probed.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recommendation not found.",
        ) from exc
    except RepositoryNotConfigured as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Recommendation database is not configured.",
        ) from exc

    return row_to_record(row)
