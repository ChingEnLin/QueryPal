"""Rule-based simulated rater for the HITL experiment.

Replaces a live human reviewer with a deterministic oracle that consults
``ground_truth.json`` (produced by ``seed_fixture.py``). A finding is
labelled ``tp`` if its ``(field, category)`` pair matches a seeded defect,
``fp`` otherwise. A small simulated latency is reported so the harness can
account for "human-seconds per run" across arms.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

Label = Literal["tp", "fp", "unsure"]


@dataclass(frozen=True)
class Verdict:
    label: Label
    latency_ms: int
    reason: str


def _default_ground_truth_path() -> Path:
    return Path(__file__).resolve().parent / "ground_truth.json"


def load_ground_truth(path: Path | None = None) -> dict[str, Any]:
    src = path or _default_ground_truth_path()
    return json.loads(src.read_text(encoding="utf-8"))


def rate_finding(
    finding: dict[str, Any],
    *,
    ground_truth: dict[str, Any] | None = None,
    simulated_latency_ms: int = 4000,
) -> Verdict:
    """Label a finding by matching its (field, category) against the ground truth.

    ``finding`` must expose ``field`` and ``category`` keys — both arms
    serialise findings with these fields today via QueryArgus.
    """
    raise NotImplementedError(
        "scaffolding — implement after seed_fixture is generating ground truth"
    )
