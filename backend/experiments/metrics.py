"""Metrics computed from harness per-run JSON snapshots.

Pure functions over the snapshot shape written by ``harness.py``. Reading
this module is the easiest way to understand what each per-run snapshot
must contain.

A per-run snapshot looks like::

    {
      "arm": "A" | "B" | "control",
      "seed": 42,
      "run_index": 0,
      "report_id": "...",
      "started_at": "...",
      "finished_at": "...",
      "tokens": 12345,
      "iterations": 18,
      "quality_score": 100,
      "counts": {"critical": 0, "warning": 7, "info": 2, "dismissed": 0, "pending_review": 0},
      "findings": [
        {"field": "...", "category": "...", "severity": "...",
         "confidence": 0.95,                # arm B only (may be None on A/control)
         "status": "published",             # arm B only
         "oracle_label": "tp" | "fp",
         "oracle_reason": "..."},
        ...
      ],
      "escalations": [                       # arm B only
        {"field": "...", "category": "...",
         "confidence": 0.6, "oracle_label": "tp", "resolution_verdict": "tp"},
        ...
      ],
      "oracle_seconds": 47.0
    }
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class RunMetrics:
    arm: str
    seed: int
    run_index: int
    # Headline quality numbers — defined on the oracle-labelled finding set.
    tp: int
    fp: int
    precision: float           # tp / (tp + fp)
    recall: float              # tp / total_seeded_categories
    f1: float
    # Cost
    tokens: int
    oracle_seconds: float
    # Arm B specific (None on others)
    brier: float | None
    pending_count: int

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _safe_div(num: float, den: float) -> float:
    return num / den if den > 0 else 0.0


def precision_recall_f1(tp: int, fp: int, total_seeded: int) -> tuple[float, float, float]:
    p = _safe_div(tp, tp + fp)
    # Recall over UNIQUE seeded categories captured — if the agent emits two
    # variants of the same (field, category) and both TP, that's still one
    # category covered. Computed in compute_run_metrics with the de-duped set.
    r = _safe_div(tp, total_seeded)
    f1 = 0.0 if (p + r) == 0 else 2 * p * r / (p + r)
    return round(p, 4), round(r, 4), round(f1, 4)


def brier_score(snapshot: dict[str, Any]) -> float | None:
    """Calibration: mean squared error between agent's self-confidence and oracle outcome.

    Considers both published findings (oracle says TP/FP) and resolved
    escalations (oracle's resolution_verdict was TP/FP). Returns ``None``
    when no confidence values are recorded — i.e. control / A arms.
    """
    pairs: list[tuple[float, int]] = []  # (predicted_prob, observed 0/1)
    for f in snapshot.get("findings", []):
        conf = f.get("confidence")
        if conf is None:
            continue
        observed = 1 if f.get("oracle_label") == "tp" else 0
        pairs.append((float(conf), observed))
    for e in snapshot.get("escalations", []):
        conf = e.get("confidence")
        if conf is None:
            continue
        observed = 1 if e.get("oracle_label") == "tp" else 0
        pairs.append((float(conf), observed))
    if not pairs:
        return None
    return round(sum((p - o) ** 2 for p, o in pairs) / len(pairs), 4)


def compute_run_metrics(snapshot: dict[str, Any], total_seeded: int) -> RunMetrics:
    """Per-run precision / recall / F1 / Brier (B-only) from one snapshot.

    A finding counts toward TP/FP via its ``oracle_label``. An *escalation*
    that the human resolved as TP also counts toward TP (arm B's whole
    point is that the human filters borderline cases — successful
    resolutions are still wins).
    """
    findings = snapshot.get("findings", [])
    escalations_resolved_tp = [
        e for e in snapshot.get("escalations", [])
        if e.get("resolution_verdict") == "tp"
    ]

    tp = sum(1 for f in findings if f.get("oracle_label") == "tp")
    fp = sum(1 for f in findings if f.get("oracle_label") == "fp")
    # Resolved-TP escalations count as TP findings recovered through the
    # human gate. They do NOT add FP burden — the human filtered the FP
    # escalations out before they reached the published set.
    tp += len(escalations_resolved_tp)

    # Recall: unique (field, category) seeded defects covered by any TP
    # (either a published TP or a resolved-TP escalation).
    covered_keys: set[tuple[str, str]] = set()
    for f in findings:
        if f.get("oracle_label") == "tp":
            covered_keys.add((f["field"], f["category"]))
    for e in escalations_resolved_tp:
        covered_keys.add((e["field"], e["category"]))
    recall_tp = len(covered_keys)
    precision, _, _ = precision_recall_f1(tp, fp, total_seeded)
    # Use the de-duped covered count for recall.
    recall = round(_safe_div(recall_tp, total_seeded), 4)
    f1 = 0.0 if (precision + recall) == 0 else round(2 * precision * recall / (precision + recall), 4)

    return RunMetrics(
        arm=str(snapshot.get("arm", "?")),
        seed=int(snapshot.get("seed", -1)),
        run_index=int(snapshot.get("run_index", -1)),
        tp=tp,
        fp=fp,
        precision=precision,
        recall=recall,
        f1=f1,
        tokens=int(snapshot.get("tokens", 0)),
        oracle_seconds=float(snapshot.get("oracle_seconds", 0.0)),
        brier=brier_score(snapshot),
        pending_count=len(snapshot.get("escalations", [])),
    )


def aggregate(metrics: list[RunMetrics]) -> dict[str, Any]:
    """Mean / min / max across a set of per-run metrics (one arm × one seed bucket)."""
    if not metrics:
        return {"count": 0}

    def _stat(values: list[float]) -> dict[str, float]:
        return {
            "mean": round(sum(values) / len(values), 4),
            "min": round(min(values), 4),
            "max": round(max(values), 4),
        }

    return {
        "count": len(metrics),
        "precision": _stat([m.precision for m in metrics]),
        "recall": _stat([m.recall for m in metrics]),
        "f1": _stat([m.f1 for m in metrics]),
        "tokens": _stat([float(m.tokens) for m in metrics]),
        "oracle_seconds": _stat([m.oracle_seconds for m in metrics]),
        "brier": _stat([m.brier for m in metrics if m.brier is not None]) if any(m.brier is not None for m in metrics) else None,
        "pending_count": _stat([float(m.pending_count) for m in metrics]),
    }


def reliability_buckets(snapshots: list[dict[str, Any]], n_buckets: int = 10) -> list[dict[str, Any]]:
    """Calibration curve: for each confidence bucket, observed precision.

    Bins on the agent's reported confidence; each bin reports the count of
    findings/escalations that fell in it and what fraction the oracle
    actually labelled TP. Returns a list of buckets ordered by ascending
    confidence; useful for plotting the predicted-vs-observed line.

    Returns an empty list when no confidence values exist (control / A).
    """
    pairs: list[tuple[float, int]] = []
    for snap in snapshots:
        for f in snap.get("findings", []):
            conf = f.get("confidence")
            if conf is None:
                continue
            pairs.append((float(conf), 1 if f.get("oracle_label") == "tp" else 0))
        for e in snap.get("escalations", []):
            conf = e.get("confidence")
            if conf is None:
                continue
            pairs.append((float(conf), 1 if e.get("oracle_label") == "tp" else 0))
    if not pairs:
        return []

    width = 1.0 / n_buckets
    buckets: list[list[tuple[float, int]]] = [[] for _ in range(n_buckets)]
    for p, o in pairs:
        idx = min(n_buckets - 1, max(0, math.floor(p / width)))
        buckets[idx].append((p, o))
    out: list[dict[str, Any]] = []
    for i, bucket in enumerate(buckets):
        if not bucket:
            continue
        mean_conf = sum(p for p, _ in bucket) / len(bucket)
        observed_tp = sum(o for _, o in bucket) / len(bucket)
        out.append({
            "bucket_low": round(i * width, 3),
            "bucket_high": round((i + 1) * width, 3),
            "count": len(bucket),
            "mean_confidence": round(mean_conf, 4),
            "observed_precision": round(observed_tp, 4),
        })
    return out


def load_snapshots(results_dir: Path) -> list[dict[str, Any]]:
    """Walk ``results_dir`` and parse every ``run_*.json`` snapshot."""
    import json
    snaps: list[dict[str, Any]] = []
    for path in sorted(results_dir.rglob("run_*.json")):
        snaps.append(json.loads(path.read_text(encoding="utf-8")))
    return snaps
