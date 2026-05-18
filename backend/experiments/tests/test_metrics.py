"""Tests for the per-run + aggregate metrics helpers."""

from __future__ import annotations

import pytest

from backend.experiments.metrics import (
    aggregate,
    brier_score,
    compute_run_metrics,
    precision_recall_f1,
    reliability_buckets,
)


def test_precision_recall_f1_basic() -> None:
    p, r, f = precision_recall_f1(tp=3, fp=1, total_seeded=5)
    assert p == 0.75   # 3 / (3+1)
    assert r == 0.6    # 3 / 5
    # F1 = 2 * 0.75 * 0.6 / (0.75 + 0.6) = 0.667
    assert f == pytest.approx(0.6667, abs=1e-3)


def test_precision_recall_f1_handles_zero_division() -> None:
    p, r, f = precision_recall_f1(tp=0, fp=0, total_seeded=5)
    assert p == 0.0 and r == 0.0 and f == 0.0


def _snap(arm: str, findings: list[dict], escalations: list[dict] | None = None, conf_findings: bool = False) -> dict:
    return {
        "arm": arm, "seed": 42, "run_index": 0,
        "report_id": "r1",
        "tokens": 1000, "iterations": 5,
        "findings": findings,
        "escalations": escalations or [],
        "oracle_seconds": 8.0,
    }


def test_compute_run_metrics_counts_resolved_escalations_as_tp() -> None:
    snap = _snap(
        "B",
        findings=[
            {"field": "email", "category": "null_rate",
             "confidence": 0.95, "oracle_label": "tp"},
            {"field": "address.city", "category": "null_rate",
             "confidence": 0.92, "oracle_label": "fp"},
        ],
        escalations=[
            {"field": "username", "category": "duplicates",
             "confidence": 0.6, "oracle_label": "tp", "resolution_verdict": "tp"},
            # Resolved-FP doesn't add to TP NOR to FP — the human filtered it out.
            {"field": "middle_name", "category": "null_rate",
             "confidence": 0.5, "oracle_label": "fp", "resolution_verdict": "fp"},
        ],
    )
    m = compute_run_metrics(snap, total_seeded=3)
    # Published TPs (1) + resolved-TP escalations (1) = 2 TP
    assert m.tp == 2
    # Published FPs only — resolved-FP escalations were filtered by the human gate.
    assert m.fp == 1
    # Two unique (field, category) covered: (email, null_rate) + (username, duplicates)
    assert m.recall == pytest.approx(2 / 3, abs=1e-4)
    # precision = 2 / (2 + 1) = 0.667
    assert m.precision == pytest.approx(0.667, abs=1e-3)
    # pending_count counts every escalation surfaced, including resolved-FP
    assert m.pending_count == 2


def test_brier_score_handles_calibrated_vs_collapsed_distributions() -> None:
    # Perfectly calibrated — conf = observed → Brier = 0
    calibrated = _snap("B", findings=[
        {"field": "x", "category": "y", "confidence": 1.0, "oracle_label": "tp"},
        {"field": "x", "category": "z", "confidence": 0.0, "oracle_label": "fp"},
    ])
    assert brier_score(calibrated) == 0.0

    # Wildly over-confident — every finding at 0.95, half are FP.
    collapsed = _snap("B", findings=[
        {"field": "x", "category": "y", "confidence": 0.95, "oracle_label": "tp"},
        {"field": "x", "category": "y", "confidence": 0.95, "oracle_label": "fp"},
    ])
    # MSE = ((0.95-1)^2 + (0.95-0)^2) / 2 = (0.0025 + 0.9025) / 2 = 0.4525
    assert brier_score(collapsed) == pytest.approx(0.4525, abs=1e-4)


def test_brier_returns_none_for_arm_without_confidence() -> None:
    snap = _snap("control", findings=[
        {"field": "x", "category": "y", "oracle_label": "tp"},  # no confidence
    ])
    assert brier_score(snap) is None


def test_aggregate_groups_by_run() -> None:
    m1 = compute_run_metrics(
        _snap("A", findings=[{"field": "email", "category": "null_rate", "oracle_label": "tp"}]),
        total_seeded=2,
    )
    m2 = compute_run_metrics(
        _snap("A", findings=[
            {"field": "email", "category": "null_rate", "oracle_label": "tp"},
            {"field": "username", "category": "duplicates", "oracle_label": "tp"},
        ]),
        total_seeded=2,
    )
    agg = aggregate([m1, m2])
    assert agg["count"] == 2
    # m1.recall = 0.5; m2.recall = 1.0
    assert agg["recall"]["min"] == 0.5
    assert agg["recall"]["max"] == 1.0
    assert agg["recall"]["mean"] == 0.75


def test_reliability_buckets_bins_findings_by_confidence() -> None:
    snaps = [
        _snap("B", findings=[
            {"field": "x", "category": "y", "confidence": 0.05, "oracle_label": "fp"},
            {"field": "x", "category": "y", "confidence": 0.15, "oracle_label": "fp"},
            {"field": "x", "category": "y", "confidence": 0.95, "oracle_label": "tp"},
            {"field": "x", "category": "y", "confidence": 0.95, "oracle_label": "tp"},
        ]),
    ]
    buckets = reliability_buckets(snaps, n_buckets=10)
    # Buckets only show populated bins. We expect [0.0, 0.1), [0.1, 0.2), [0.9, 1.0).
    spans = [(b["bucket_low"], b["bucket_high"], b["count"]) for b in buckets]
    assert (0.0, 0.1, 1) in spans
    assert (0.1, 0.2, 1) in spans
    assert (0.9, 1.0, 2) in spans
    high_bucket = next(b for b in buckets if b["bucket_low"] == 0.9)
    assert high_bucket["observed_precision"] == 1.0


def test_reliability_buckets_empty_when_no_confidence() -> None:
    snaps = [_snap("control", findings=[
        {"field": "x", "category": "y", "oracle_label": "tp"},
    ])]
    assert reliability_buckets(snaps) == []
