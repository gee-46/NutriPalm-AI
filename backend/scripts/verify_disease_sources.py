"""
verify_disease_sources.py

Re-downloads every source document cited by the disease knowledge base and checks that each
evidence quote really appears on the cited page. With --write it records the outcome in the data
files (evidence.verified, source.verification, record status, last_verified).

    python scripts/verify_disease_sources.py            # report only
    python scripts/verify_disease_sources.py --write    # also update data/*.json

This is MECHANICAL verification: "the quote is on that page of that document". It is not expert
review and says nothing about whether the guidance is right for a particular farm. A record that
passes becomes `source_verified`; only a named reviewer can make it `expert_reviewed`.

Exit code 1 if any quote or source cannot be verified.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime, timezone
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.disease.provenance import html_page_variants, pdf_page_variants, quote_in_text, sha256_bytes  # noqa: E402

DATA = Path(__file__).resolve().parents[1] / "app" / "disease" / "data"
UA = "Mozilla/5.0 (NutriPalm evidence verifier)"


def fetch(url: str) -> bytes:
    with httpx.Client(follow_redirects=True, timeout=60.0, headers={"User-Agent": UA}) as client:
        r = client.get(url)
        r.raise_for_status()
        return r.content


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true", help="record results in the data files")
    ap.add_argument("--offline", metavar="DIR", help="use DIR/<source_id>.bin instead of downloading (for tests / air-gapped review)")
    args = ap.parse_args()

    sources = json.loads((DATA / "sources.json").read_text(encoding="utf-8"))
    diseases = json.loads((DATA / "diseases.json").read_text(encoding="utf-8"))
    chemicals = json.loads((DATA / "chemicals.json").read_text(encoding="utf-8"))

    pages_by_source: dict[str, list[list[str]]] = {}
    ok_sources: dict[str, bool] = {}
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    failures = 0

    for s in sources["sources"]:
        sid = s["id"]
        try:
            data = (Path(args.offline) / f"{sid}.bin").read_bytes() if args.offline else fetch(s["url"])
            digest = sha256_bytes(data)
            is_pdf = data[:4] == b"%PDF"
            pages = pdf_page_variants(data) if is_pdf else html_page_variants(data)
        except Exception as exc:  # network, parse, missing file: the source is NOT verified
            print(f"SOURCE FAIL {sid}: {type(exc).__name__}: {exc}")
            ok_sources[sid] = False
            failures += 1
            if args.write:
                s["verification"].update({"status": "failed", "checked_at": now})
            continue
        pages_by_source[sid] = pages
        known = s["verification"].get("sha256")
        changed = bool(known) and known != digest
        print(f"SOURCE ok   {sid}: {len(pages)} page(s), sha256={digest[:12]}…{'  (CONTENT CHANGED since last verification)' if changed else ''}")
        ok_sources[sid] = True
        if args.write:
            s["verification"].update({"status": "quotes_verified" if not changed else "failed", "checked_at": now, "sha256": digest, "pages": len(pages)})
        if changed:
            ok_sources[sid] = False
            failures += 1

    def check_items(owner: str, items: list[dict]) -> bool:
        all_ok = True
        for e in items:
            pages = pages_by_source.get(e["source_id"])
            ok = False
            if pages and 1 <= e["page"] <= len(pages):
                ok = quote_in_text(e["quote"], pages[e["page"] - 1])
            e["verified"] = bool(ok and ok_sources.get(e["source_id"]))
            if not e["verified"]:
                all_ok = False
                print(f"  QUOTE FAIL {owner}/{e['id']} (p.{e['page']}): {e['quote'][:80]}…")
        return all_ok

    for d in diseases["diseases"]:
        good = check_items(d["id"], d["evidence"])
        print(f"{'PASS' if good else 'FAIL'} disease {d['id']}: {len(d['evidence'])} evidence item(s)")
        if not good:
            failures += 1
        if args.write:
            d["status"] = "source_verified" if good and d.get("status") != "expert_reviewed" else ("expert_reviewed" if good else "draft")
            d["last_verified"] = date.today().isoformat() if good else None
    for c in chemicals["chemicals"]:
        good = check_items(c["id"], c["evidence"])
        print(f"{'PASS' if good else 'FAIL'} chemical {c['id']}: {len(c['evidence'])} evidence item(s)")
        if not good:
            failures += 1

    if args.write:
        for name, payload in (("sources", sources), ("diseases", diseases), ("chemicals", chemicals)):
            (DATA / f"{name}.json").write_text(json.dumps(payload, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
        print("data files updated")
    print("RESULT:", "all quotes verified" if failures == 0 else f"{failures} failure(s)")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
