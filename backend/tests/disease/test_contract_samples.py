"""The committed frontend fixtures must equal what the backend produces today."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

import export_disease_contract_samples as exporter  # noqa: E402


def test_frontend_contract_fixtures_are_current():
    stale = []
    for name, data in exporter.build().items():
        committed = json.loads((exporter.OUT / name).read_text(encoding="utf-8"))
        if json.loads(json.dumps(data, sort_keys=True)) != committed:
            stale.append(name)
    assert not stale, f"regenerate with `python scripts/export_disease_contract_samples.py`: {stale}"
