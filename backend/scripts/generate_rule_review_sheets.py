"""
Renders the per-crop review sheets of docs/AGRONOMIST_REVIEW_CHECKLIST.md from the engine's actual catalog, so the sheet an
agronomist signs is exactly what the code would use.

    cd backend
    python scripts/generate_rule_review_sheets.py            # print
    python scripts/generate_rule_review_sheets.py --write    # replace the generated block in the checklist document

tests/test_rule_review_sheets.py fails if the committed document is out of date.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import crop_rules, fertilizer_catalog  # noqa: E402

DOC = Path(__file__).resolve().parents[2] / "docs" / "AGRONOMIST_REVIEW_CHECKLIST.md"
BEGIN, END = "<!-- BEGIN GENERATED: per-crop sheets -->", "<!-- END GENERATED -->"


def render() -> str:
    out = [BEGIN, "", "_Generated from `backend/app/services/crop_rules.py` and `fertilizer_catalog.py`. Do not edit by hand; run `python scripts/generate_rule_review_sheets.py --write`._", ""]
    out += ["### Fertilizer products the engine uses (grades are NOMINAL and unverified)", "",
            "| Product | N % | P₂O₅ % | K₂O % | elemental P % | elemental K % | Grade source recorded in code | Reviewer: grade confirmed against (document, clause)? |",
            "|---|---|---|---|---|---|---|---|"]
    for code in fertilizer_catalog.primary_product_codes():
        p = fertilizer_catalog.get_product(code)
        out.append(f"| {p.display_name} (`{code}`) | {p.grade_n_pct:g} | {p.grade_p2o5_pct:g} | {p.grade_k2o_pct:g} | {p.p_fraction * 100:.1f} | {p.k_fraction * 100:.1f} | {p.grade_source} | ☐ ______ |")
    out.append("")
    for crop in crop_rules.list_supported_crops():
        r = crop_rules.get_crop_requirement(crop)
        out += [
            f"### {r.display_name} (`{r.crop}`) — status: **NOT APPROVED** (no source, no reviewer)", "",
            "| Item | Value in the engine today | Source (publication, edition, year, page/table) | Applies to (stage, region) | Matches source? | Notes / change required |",
            "|---|---|---|---|---|---|",
            f"| N target (kg/ha) | {r.n_target_kg_ha:g} | ______ | ______ | ☐ yes ☐ no | |",
            f"| P target (kg/ha, basis: **{r.p_basis.value}**) | {r.p_target_kg_ha:g} | ______ | ______ | ☐ yes ☐ no | |",
            f"| K target (kg/ha, basis: **{r.k_basis.value}**) | {r.k_target_kg_ha:g} | ______ | ______ | ☐ yes ☐ no | |",
            f"| pH range | {r.ph_min:g} – {r.ph_max:g} | ______ | ______ | ☐ yes ☐ no | |",
            f"| Minimum organic carbon (%) | {r.organic_carbon_min_percent:g} | ______ | ______ | ☐ yes ☐ no | |",
            f"| Yield baseline (t/ha) — **not shown to users** | {r.optimal_yield_t_ha:g} | ______ | ______ | ☐ yes ☐ no ☐ leave omitted | |",
            f"| Max yield loss fraction — **not shown to users** | {r.max_yield_loss_fraction:g} | ______ | ______ | ☐ yes ☐ no ☐ leave omitted | |",
            "", "Reviewer: ____________ role: ____________ date (YYYY-MM-DD): ____________  Decision: ☐ approve as is ☐ approve with the changes above ☐ reject (keep `insufficient_data`)", "",
        ]
    out.append(END)
    return "\n".join(out)


if __name__ == "__main__":
    block = render()
    if "--write" in sys.argv:
        text = DOC.read_text(encoding="utf-8")
        a, b = text.index(BEGIN), text.index(END) + len(END)
        DOC.write_text(text[:a] + block + text[b:], encoding="utf-8")
        print("updated", DOC)
    else:
        print(block)
