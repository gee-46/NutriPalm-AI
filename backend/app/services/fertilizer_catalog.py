"""
fertilizer_catalog.py

Catalog of fertilizer products and the unit handling needed to turn "kg of nutrient" into "kg of product".

THE UNIT CONVENTION (this was wrong before; see docs/OCR_AND_FERTILIZER_PIPELINE.md section 3.3)
------------------------------------------------------------------------------------------------
Fertilizer LABELS (the "N-P-K" grade, e.g. DAP 18-46-0) state nitrogen as elemental N, but phosphorus as
phosphate (P2O5) and potassium as potash (K2O). Soil-test values and crop nutrient targets, however, may be
expressed either as the element (P, K) or in the oxide form, depending on the laboratory and the source
document. The two are not interchangeable:

    P  = P2O5 x 0.4364      (2 x 30.974 / (2 x 30.974 + 5 x 15.999))
    K  = K2O  x 0.8302      (2 x 39.098 / (2 x 39.098 + 15.999))

So 100 kg of DAP (46% P2O5) carries 46 kg P2O5 = 20.1 kg of elemental P; dividing an elemental-P deficit by 0.46
under-doses by a factor of 2.29. The factors are derived below from standard atomic weights (IUPAC) and agree
with the commonly published 0.436 / 0.830 (e.g. Eurofins Agro "Phosphorus (P) versus phosphate (P2O5)",
Cropaia agricultural conversion tables; checked 2026-10-30). They are stoichiometry, not agronomy.

Therefore every conversion here takes an explicit NutrientBasis ("elemental" or "oxide"); there is no default
that silently assumes one. Which basis a crop target and a soil test use is a property of the cited rule
(rule_provenance.py requires it) and of the laboratory report.

Product grades are the labelled grades. For urea, DAP, MOP and SSP the minimum guaranteed content printed in Schedule I,
Part A of the Fertiliser (Control) Order 1985 was read in a consolidated copy on 2026-10-30 (see `_FCO_EVIDENCE`); that copy's
amendment level is unknown (it refers to amendments up to at least 2003), so a reviewer must still confirm the figures
against the CURRENT Schedule I before a rule is approved (docs/AGRONOMIST_REVIEW_CHECKLIST.md). NPK 19:19:19 was not
confirmed (its entry could not be read unambiguously) and stays "secondary sources only". Prices are placeholders, never market data.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from app.exceptions import ValidationFailed

# Standard atomic weights (IUPAC, conventional values), g/mol.
_ATOMIC_WEIGHT = {"P": 30.973762, "K": 39.0983, "O": 15.999}

#: kg of elemental P per kg of P2O5
P_PER_P2O5: float = (2 * _ATOMIC_WEIGHT["P"]) / (2 * _ATOMIC_WEIGHT["P"] + 5 * _ATOMIC_WEIGHT["O"])
#: kg of elemental K per kg of K2O
K_PER_K2O: float = (2 * _ATOMIC_WEIGHT["K"]) / (2 * _ATOMIC_WEIGHT["K"] + _ATOMIC_WEIGHT["O"])


class NutrientBasis(str, Enum):
    """How a phosphorus / potassium quantity is expressed."""

    ELEMENTAL = "elemental"  # kg of P or K
    OXIDE = "oxide"  # kg of P2O5 or K2O


def to_elemental(nutrient: str, amount: float, basis: NutrientBasis) -> float:
    """Express `amount` (kg of nutrient on `basis`) as kg of the element. N is always elemental."""
    n = _check_nutrient(nutrient)
    if n == "n" or basis == NutrientBasis.ELEMENTAL:
        return amount
    return amount * (P_PER_P2O5 if n == "p" else K_PER_K2O)


def to_oxide(nutrient: str, amount: float, basis: NutrientBasis) -> float:
    """Express `amount` (kg of nutrient on `basis`) as kg of P2O5 / K2O. N has no oxide form."""
    n = _check_nutrient(nutrient)
    if n == "n":
        raise ValidationFailed("Nitrogen has no oxide basis; it is always expressed as elemental N.")
    if basis == NutrientBasis.OXIDE:
        return amount
    return amount / (P_PER_P2O5 if n == "p" else K_PER_K2O)


def _check_nutrient(nutrient: str) -> str:
    key = (nutrient or "").strip().lower()
    if key not in ("n", "p", "k"):
        raise ValidationFailed(f"Unknown nutrient '{nutrient}', expected one of n/p/k")
    return key


@dataclass(frozen=True)
class FertilizerProduct:
    code: str
    display_name: str
    # Labelled grade, percent by weight, exactly as printed: N as N, phosphate as P2O5, potash as K2O.
    grade_n_pct: float
    grade_p2o5_pct: float
    grade_k2o_pct: float
    default_price_per_kg_inr: float
    grade_source: str

    def fraction(self, nutrient: str, basis: NutrientBasis = NutrientBasis.ELEMENTAL) -> float:
        """
        Kg of `nutrient` per kg of product, on the requested basis.

        There is deliberately no default for P and K at the call sites that matter (dosage_calculator
        passes the crop rule's basis); the default here only serves display helpers.
        """
        n = _check_nutrient(nutrient)
        if n == "n":
            return self.grade_n_pct / 100.0
        oxide = (self.grade_p2o5_pct if n == "p" else self.grade_k2o_pct) / 100.0
        return oxide if basis == NutrientBasis.OXIDE else oxide * (P_PER_P2O5 if n == "p" else K_PER_K2O)

    # Elemental fractions, kept for readability in tests and display code.
    @property
    def n_fraction(self) -> float:
        return self.fraction("n")

    @property
    def p_fraction(self) -> float:
        return self.fraction("p", NutrientBasis.ELEMENTAL)

    @property
    def k_fraction(self) -> float:
        return self.fraction("k", NutrientBasis.ELEMENTAL)


_GRADE_SOURCE_SECONDARY = (
    "nominal labelled grade; secondary sources only (not checked against the Fertiliser (Control) Order schedule)"
)

_FCO_COPY = (
    "Fertiliser (Control) Order 1985, G.S.R. 758(E) of 25 Sep 1985, consolidated copy of unknown amendment date "
    "(read 2026-10-30; not confirmed against the current Schedule I)"
)

#: What was actually read, per product, in the FCO copy above. Minimum guaranteed content, percent by weight.
_FCO_EVIDENCE: dict[str, str] = {
    "urea": f"{_FCO_COPY}: Schedule I Part A, 1(a) no. 2 'Urea (46% N)': total nitrogen (dry basis) 46.00 minimum",
    "dap": (
        f"{_FCO_COPY}: Schedule I Part A, 1(d) no. 2 'Diammonium Phosphate (18-46-0)': total nitrogen 18.0 minimum; "
        "neutral ammonium citrate soluble phosphate (as P2O5) 46.0 minimum (water soluble 41.0 minimum)"
    ),
    "mop": (
        f"{_FCO_COPY}: Schedule I Part A, 1(c) no. 1 'Potassium Chloride (Muriate of Potash)': water soluble potash "
        "(as K2O) 60.0 minimum"
    ),
    "ssp": (
        f"{_FCO_COPY}: Schedule I Part A, 1(b) no. 1 'Single Superphosphate (16% P2O5, powdered)': water soluble "
        "phosphate (as P2O5) 16.0 minimum"
    ),
}

_FERTILIZER_CATALOG: dict[str, FertilizerProduct] = {
    "urea": FertilizerProduct(
        code="urea",
        display_name="Urea",
        grade_n_pct=46.0,
        grade_p2o5_pct=0.0,
        grade_k2o_pct=0.0,
        default_price_per_kg_inr=6.5,
        grade_source=_FCO_EVIDENCE["urea"],
    ),
    "dap": FertilizerProduct(
        code="dap",
        display_name="Di-Ammonium Phosphate (DAP)",
        grade_n_pct=18.0,
        grade_p2o5_pct=46.0,
        grade_k2o_pct=0.0,
        default_price_per_kg_inr=27.0,
        grade_source=_FCO_EVIDENCE["dap"],
    ),
    "mop": FertilizerProduct(
        code="mop",
        display_name="Muriate of Potash (MOP)",
        grade_n_pct=0.0,
        grade_p2o5_pct=0.0,
        grade_k2o_pct=60.0,
        default_price_per_kg_inr=17.5,
        grade_source=_FCO_EVIDENCE["mop"],
    ),
    "ssp": FertilizerProduct(
        code="ssp",
        display_name="Single Super Phosphate (SSP)",
        grade_n_pct=0.0,
        grade_p2o5_pct=16.0,
        grade_k2o_pct=0.0,
        default_price_per_kg_inr=9.0,
        grade_source=_FCO_EVIDENCE["ssp"],
    ),
    "npk_complex_19_19_19": FertilizerProduct(
        code="npk_complex_19_19_19",
        display_name="NPK Complex 19:19:19",
        grade_n_pct=19.0,
        grade_p2o5_pct=19.0,
        grade_k2o_pct=19.0,
        default_price_per_kg_inr=28.0,
        grade_source=_GRADE_SOURCE_SECONDARY,
    ),
    # "organic_compost" was removed: its nutrient percentages were invented (real compost varies several-fold
    # by feedstock) and no source existed for them.
}

# Which single product is used, per nutrient, to correct a straight deficiency in the simple
# single-nutrient-product dosage strategy. (A blended/least-cost mix optimizer is out of scope.)
_PRIMARY_SOURCE_BY_NUTRIENT: dict[str, str] = {
    "n": "urea",
    "p": "dap",
    "k": "mop",
}


def list_products() -> list[str]:
    return sorted(_FERTILIZER_CATALOG.keys())


def primary_product_codes() -> tuple[str, ...]:
    return tuple(_PRIMARY_SOURCE_BY_NUTRIENT.values())


def get_product(code: str) -> FertilizerProduct:
    key = (code or "").strip().lower()
    product = _FERTILIZER_CATALOG.get(key)
    if product is None:
        raise ValidationFailed(
            f"Unknown fertilizer product '{code}'. Known products: {', '.join(list_products())}"
        )
    return product


def get_primary_source_for_nutrient(nutrient: str) -> FertilizerProduct:
    """nutrient must be one of 'n', 'p', 'k'. Returns the product used to correct a deficiency of it."""
    key = (nutrient or "").strip().lower()
    if key not in _PRIMARY_SOURCE_BY_NUTRIENT:
        raise ValidationFailed(f"Unknown nutrient '{nutrient}', expected one of n/p/k")
    return get_product(_PRIMARY_SOURCE_BY_NUTRIENT[key])
