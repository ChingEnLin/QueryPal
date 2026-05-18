"""End-to-end tests for summarize.py — writes fake snapshots, reads them back,
asserts the markdown + JSON outputs."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from backend.experiments.summarize import _snapshot_for_json, summarize


@pytest.fixture
def results_dir_with_data(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    # Plant a ground_truth.json the summarizer can find.
    gt = {
        "collection": "hitl_eval", "database": "hitl_test", "cosmos_account": "acct",
        "doc_count": 1000, "seed": 42,
        "defects": [
            {"field": "email", "category": "null_rate",
             "affected_count": 120, "total": 1000, "notes": ""},
            {"field": "username", "category": "duplicates",
             "affected_count": 30, "total": 1000, "notes": ""},
        ],
        "near_miss_fields": ["phone"],
    }
    gt_path = tmp_path / "ground_truth.json"
    gt_path.write_text(json.dumps(gt), encoding="utf-8")
    # Point the oracle at our temp ground truth.
    monkeypatch.setattr(
        "backend.experiments.oracle._default_ground_truth_path",
        lambda: gt_path,
    )

    def _snap(arm: str, seed: int, run: int, findings: list[dict], escalations: list[dict] | None = None) -> dict:
        return {
            "arm": arm, "seed": seed, "run_index": run,
            "report_id": f"r-{arm}-{seed}-{run}",
            "tokens": 1000, "iterations": 5,
            "findings": findings,
            "escalations": escalations or [],
            "oracle_seconds": 8.0,
        }

    runs = [
        # control — finds 1 of 2 defects per run
        ("control", 42, 0, [{"field": "email", "category": "null_rate", "oracle_label": "tp"}]),
        ("control", 43, 0, [{"field": "email", "category": "null_rate", "oracle_label": "tp"}]),
        # A — also finds 1 on run 0, improves to both on run 1 (verdict learning)
        ("A", 42, 0, [{"field": "email", "category": "null_rate", "oracle_label": "tp"}]),
        ("A", 42, 1, [
            {"field": "email", "category": "null_rate", "oracle_label": "tp"},
            {"field": "username", "category": "duplicates", "oracle_label": "tp"},
        ]),
        # B — collapsed confidence, surfaces 1 TP published + 1 TP via escalation
        ("B", 42, 0,
         [{"field": "email", "category": "null_rate", "confidence": 0.95, "oracle_label": "tp"}],
         [{"field": "username", "category": "duplicates", "confidence": 0.6,
           "oracle_label": "tp", "resolution_verdict": "tp"}]),
    ]
    results = tmp_path / "results"
    for arm, seed, run, findings, *rest in runs:
        escalations = rest[0] if rest else []
        snap = _snap(arm, seed, run, findings, escalations)
        out = results / arm / f"seed_{seed}" / f"run_{run:02d}.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(snap), encoding="utf-8")
    return results


def test_summarize_returns_markdown_with_per_arm_section(results_dir_with_data: Path) -> None:
    md = summarize(results_dir_with_data)
    assert "# HITL experiment results" in md
    assert "## Per-arm aggregate" in md
    # All 3 arms present.
    assert "| control |" in md
    assert "| A |" in md
    assert "| B |" in md


def test_summarize_includes_reliability_curve_only_when_b_has_confidence(
    results_dir_with_data: Path,
) -> None:
    md = summarize(results_dir_with_data)
    assert "Arm B reliability curve" in md
    # 0.9–1.0 bucket should show the published finding at conf=0.95
    assert "[0.9, 1.0)" in md


def test_snapshot_for_json_aggregates_per_arm(results_dir_with_data: Path) -> None:
    payload = _snapshot_for_json(results_dir_with_data)
    assert payload["fixture"]["collection"] == "hitl_eval"
    assert set(payload["arms"].keys()) == {"control", "A", "B"}
    # Arm A's last run found both defects → that run has recall 1.0
    a_runs = payload["arms"]["A"]["runs"]
    assert max(r["recall"] for r in a_runs) == 1.0


def test_summarize_empty_dir_returns_explanatory_message(tmp_path: Path) -> None:
    md = summarize(tmp_path / "no-such-dir")
    assert "No snapshots found" in md
