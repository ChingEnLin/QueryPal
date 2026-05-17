"""Metrics computed from harness per-run JSON snapshots.

Pure functions over the report shape that ``harness.py`` writes. Reading
this module is the easiest way to understand what each per-run snapshot
must contain.

A per-run snapshot is expected to look like::

    {
      "arm": "A",
      "seed": 42,
      "run_index": 0,
      "report_id": "...",
      "started_at": "...",
      "finished_at": "...",
      "tokens": 12345,
      "findings": [
        {
          "field": "...",
          "category": "...",
          "severity": "...",
          "confidence": 0.87,           # arm B only
          "status": "published",        # arm B only
          "oracle_label": "tp"          # arm A or B
        },
        ...
      ],
      "oracle_seconds": 47.0,
    }
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class RunMetrics:
    arm: str
    seed: int
    run_index: int
    precision: float
    recall: float
    f1: float
    tokens: int
    oracle_seconds: float
    brier: float | None  # arm B only; None elsewhere


def compute_run_metrics(snapshot: dict[str, Any], total_seeded: int) -> RunMetrics:
    """Per-run precision / recall / F1 / Brier (B-only) from one snapshot."""
    raise NotImplementedError("scaffolding — implement after harness writes its first real snapshot")


def brier_score(snapshot: dict[str, Any]) -> float | None:
    """Calibration: mean squared error between self-confidence and oracle outcome.

    Returns ``None`` when the snapshot has no confidence fields (i.e. not arm B).
    """
    raise NotImplementedError("scaffolding — implement after the B branch emits per-finding confidence")
