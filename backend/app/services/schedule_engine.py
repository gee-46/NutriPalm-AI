"""
schedule_engine.py

Fertilizer recommendation from a PUBLISHED DOSE SCHEDULE (rule_kind "published_schedule", see rule_provenance.py).

Where the numbers come from
---------------------------
Every number that reaches a farmer here is either (a) copied from the cited source's table by the rule record (grams of N,
P2O5 and K2O per palm per year, by palm age) or (b) arithmetic on it that is written out below. Nothing is estimated,
interpolated, extrapolated or adjusted.

The calculation (all unit conversions are explicit, none is implicit)
---------------------------------------------------------------------
    age_year        = whole years since the planting date + 1            (the record's `age_basis` states this convention)
    per palm        = the schedule band containing age_year              (g N, g P2O5 or P, g K2O or K per palm per year)
    plot total (kg) = per palm (g) x palm count / 1000
    per hectare     = plot total / plot area in hectares
    products        = dosage_calculator.plan_from_requirements(...)      (labelled grades, P2O5/K2O <-> P/K via the catalog,
                                                                          DAP nitrogen credited before urea, MOP for potash)

It refuses (returns `Blocked`) instead of guessing when an input the rule needs is missing: the planting date, the palm count,
a state when the rule is region-bound, or an age the schedule does not cover.

What it deliberately does NOT do: change the dose from the soil-test numbers (no source we hold gives such a rule - the record
must say `soil_test_adjustment: "none"`), apply efficiency losses, or split/time applications beyond text quoted from the source.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

from app.schemas.inputs import PlotInput
from app.services import dosage_calculator, fertilizer_catalog
from app.services.dosage_calculator import DosagePlan
from app.services.fertilizer_catalog import NutrientBasis
from app.services.rule_provenance import KIND_SCHEDULE, VerifiedRule


@dataclass(frozen=True)
class BlockReason:
    code: str
    message: str


@dataclass(frozen=True)
class Blocked:
    reasons: list[BlockReason]
    required: list[str]


@dataclass(frozen=True)
class ScheduleExplanation:
    summary: str
    identified_issues: list[str]
    recommended_actions: list[str]
    warnings: list[str]
    expected_benefit: str | None = None

    def model_dump(self) -> dict:  # same call the API layer makes on its own models
        return {
            "summary": self.summary,
            "identified_issues": self.identified_issues,
            "recommended_actions": self.recommended_actions,
            "expected_benefit": self.expected_benefit,
            "warnings": self.warnings,
        }


@dataclass(frozen=True)
class ScheduleRecommendation:
    """Same attribute names the persistence layer reads from the deficit model's result."""

    plot_id: str
    soil_report_id: str
    owner_id: str
    crop: str
    dosage_plan: DosagePlan
    explanation: ScheduleExplanation
    detail: dict
    analysis: None = None
    yield_prediction: None = None
    roi: None = None


def _norm(text: str) -> str:
    return " ".join((text or "").casefold().split())


def age_year_on(planting_date: date, today: date) -> int:
    """Year of the palm's life on `today`: 1 during the first 12 months after planting, 2 during the next, ..."""
    completed = today.year - planting_date.year - ((today.month, today.day) < (planting_date.month, planting_date.day))
    return completed + 1


def _band_for(rule: VerifiedRule, age_year: int) -> dict | None:
    for band in rule.schedule:
        hi = band["age_year_to"]
        if band["age_year_from"] <= age_year and (hi is None or age_year <= hi):
            return band
    return None


def _band_label(band: dict) -> str:
    lo, hi = band["age_year_from"], band["age_year_to"]
    return f"year {lo}" if hi == lo else (f"year {lo} onwards" if hi is None else f"years {lo}-{hi}")


def _covered(rule: VerifiedRule) -> str:
    last = rule.schedule[-1]
    return f"year 1 to {'any age' if last['age_year_to'] is None else 'year ' + str(last['age_year_to'])}"


def check_inputs(plot: PlotInput, rule: VerifiedRule, today: date) -> Blocked | int:
    """The palm's age year, or the reasons a recommendation cannot be given."""
    reasons: list[BlockReason] = []
    required: list[str] = []

    if rule.applicable_states is not None:
        if not (plot.state or "").strip():
            reasons.append(BlockReason(
                "state_not_recorded",
                f"The rule for {rule.crop} applies only to {', '.join(rule.applicable_states)}, and the plot has no state recorded.",
            ))
            required.append("Record the state of the plot.")
        elif _norm(plot.state) not in {_norm(s) for s in rule.applicable_states}:
            reasons.append(BlockReason(
                "region_not_covered",
                f"The source covers {', '.join(rule.applicable_states)}; this plot is in {plot.state}. "
                "No dose is given outside the region the source covers.",
            ))
            required.append(f"A cited rule that covers {plot.state}.")

    if plot.plant_count is None:
        reasons.append(BlockReason(
            "plant_count_missing",
            "The source states doses per palm, so the number of palms in the plot is needed. It is not recorded, and it is not estimated from the area.",
        ))
        required.append("Record the number of palms on the plot.")

    age_year: int | None = None
    if plot.planting_date is None:
        reasons.append(BlockReason(
            "planting_date_missing",
            "The source states doses by palm age, so the planting date is needed. It is not recorded.",
        ))
        required.append("Record the planting date of the palms.")
    elif plot.planting_date > today:
        reasons.append(BlockReason(
            "planting_date_in_future", f"The recorded planting date ({plot.planting_date.isoformat()}) is in the future."))
        required.append("Correct the planting date.")
    else:
        age_year = age_year_on(plot.planting_date, today)
        if _band_for(rule, age_year) is None:
            reasons.append(BlockReason(
                "age_outside_schedule",
                f"The palms are in year {age_year}; the source's schedule covers {_covered(rule)} only.",
            ))
            required.append("A cited rule for this palm age.")

    if reasons:
        return Blocked(reasons=reasons, required=required)
    assert age_year is not None
    return age_year


def build(
    plot: PlotInput,
    soil_report_id: str,
    rule: VerifiedRule,
    *,
    today: date,
    price_overrides: dict[str, float] | None = None,
) -> ScheduleRecommendation | Blocked:
    if rule.kind != KIND_SCHEDULE:
        raise ValueError("schedule_engine.build needs a published_schedule rule")

    checked = check_inputs(plot, rule, today)
    if isinstance(checked, Blocked):
        return checked
    age_year = checked
    band = _band_for(rule, age_year)
    assert band is not None and plot.plant_count is not None

    area_ha = plot.area_in_hectares()
    palms = plot.plant_count
    p_basis = NutrientBasis(rule.nutrient_basis["phosphorus"])
    k_basis = NutrientBasis(rule.nutrient_basis["potassium"])
    per_palm_g = {"n": float(band["n_g"]), "p": float(band["p_g"]), "k": float(band["k_g"])}

    plot_total_kg = {k: v * palms / 1000.0 for k, v in per_palm_g.items()}
    required_kg_ha = {k: v / area_ha for k, v in plot_total_kg.items()}

    plan = dosage_calculator.plan_from_requirements(
        crop=rule.crop,
        area_ha=area_ha,
        n_kg_ha=required_kg_ha["n"],
        p_kg_ha=required_kg_ha["p"],
        k_kg_ha=required_kg_ha["k"],
        price_overrides=price_overrides,
        p_basis=p_basis,
        k_basis=k_basis,
    )

    products_per_palm_g = {d.product_code: round(d.quantity_kg_total * 1000.0 / palms, 1) for d in plan.dosages}
    dap = next((d for d in plan.dosages if d.nutrient == "p"), None)
    n_from_dap = (
        dap.quantity_kg_per_ha * fertilizer_catalog.get_product(dap.product_code).fraction("n") if dap is not None else 0.0
    )

    label = {"n": "N", "p": "P2O5" if p_basis == NutrientBasis.OXIDE else "P", "k": "K2O" if k_basis == NutrientBasis.OXIDE else "K"}
    dose_text = ", ".join(f"{per_palm_g[k]:g} g {label[k]}" for k in ("n", "p", "k"))
    src = rule.source
    summary = (
        f"The published schedule ({src['publisher']}, {src['title']}, {src['year']}, {src['locator']}) gives {dose_text} per palm per year "
        f"for {_band_label(band)}. For {palms} palms on {area_ha:.3g} ha this is "
        + ", ".join(f"{plot_total_kg[k]:.1f} kg {label[k]}" for k in ("n", "p", "k"))
        + " in total."
    )
    actions = [
        f"{d.product_display_name}: {d.quantity_kg_total:.1f} kg for the plot ({products_per_palm_g[d.product_code]:g} g per palm per year)."
        for d in plan.dosages
    ]
    if rule.timing_note:
        actions.append(f"Timing and placement as stated by the source: {rule.timing_note}")
    warnings = [
        "The soil-test values are recorded with this recommendation but do not change the dose: no soil-test adjustment rule is installed.",
        "The source says rates may need modifying from soil and leaf analysis; that is for an agronomist to judge for this plot.",
    ]
    if n_from_dap > 0:
        warnings.append(
            f"DAP also supplies {n_from_dap:.1f} kg N per ha, which is subtracted before the urea quantity is calculated."
        )

    detail = {
        "age_year": age_year,
        "age_band": {k: band[k] for k in ("age_year_from", "age_year_to")},
        "planting_date": plot.planting_date.isoformat() if plot.planting_date else None,
        "plant_count": palms,
        "palms_per_ha": round(palms / area_ha, 2),
        "per_palm_g_per_year": per_palm_g,
        "nutrient_basis": {"n": "elemental", "p": p_basis.value, "k": k_basis.value},
        "plot_total_kg": {k: round(v, 3) for k, v in plot_total_kg.items()},
        "required_kg_per_ha": {k: round(v, 3) for k, v in required_kg_ha.items()},
        "n_credited_from_dap_kg_per_ha": round(n_from_dap, 3),
        "products_g_per_palm_per_year": products_per_palm_g,
        "timing_note": rule.timing_note or None,
    }

    return ScheduleRecommendation(
        plot_id=plot.plot_id,
        soil_report_id=soil_report_id,
        owner_id=plot.owner_id,
        crop=rule.crop,
        dosage_plan=plan,
        explanation=ScheduleExplanation(
            summary=summary, identified_issues=[], recommended_actions=actions, warnings=warnings
        ),
        detail=detail,
    )
