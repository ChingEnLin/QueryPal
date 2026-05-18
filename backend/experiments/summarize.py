"""Summarise per-run snapshots across all arms × seeds × runs.

Reads ``results/<arm>/seed_<n>/run_<i>.json`` produced by ``harness.py``
and emits a Markdown summary with:

- per-arm × per-run F1 / precision / recall table (mean ± seed range)
- token cost per arm
- simulated human-seconds per arm
- reliability curve (predicted-confidence-bucket vs observed-precision)
  for arm B
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from backend.experiments import metrics, oracle


def _by_arm_and_seed(snapshots: list[dict[str, Any]]) -> dict[str, dict[int, list[dict[str, Any]]]]:
    out: dict[str, dict[int, list[dict[str, Any]]]] = {}
    for s in snapshots:
        arm = str(s.get("arm", "?"))
        seed = int(s.get("seed", -1))
        out.setdefault(arm, {}).setdefault(seed, []).append(s)
    # Sort each seed bucket by run_index so the per-run table reads left-to-right.
    for arm in out:
        for seed in out[arm]:
            out[arm][seed].sort(key=lambda s: int(s.get("run_index", 0)))
    return out


def _md_table(headers: list[str], rows: list[list[str]]) -> str:
    sep = ["---"] * len(headers)
    body = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join(sep) + " |",
    ]
    for row in rows:
        body.append("| " + " | ".join(row) + " |")
    return "\n".join(body)


def summarize(results_dir: Path) -> str:
    snapshots = metrics.load_snapshots(results_dir)
    if not snapshots:
        return f"# HITL experiment results\n\nNo snapshots found under `{results_dir}`."

    try:
        ground_truth = oracle.load_ground_truth()
    except FileNotFoundError:
        return "# HITL experiment results\n\nground_truth.json missing — run seed_fixture.py first."
    total_seeded = len(ground_truth.get("defects", []))

    grouped = _by_arm_and_seed(snapshots)
    arms = sorted(grouped.keys())

    lines: list[str] = [
        "# HITL experiment results",
        "",
        f"- Fixture: `{ground_truth.get('database')}/{ground_truth.get('collection')}` "
        f"({ground_truth.get('doc_count')} docs, seed={ground_truth.get('seed')})",
        f"- Seeded defect categories: **{total_seeded}**",
        f"- Snapshots: {len(snapshots)}  across arms: {', '.join(arms)}",
        "",
    ]

    # ----- Per-arm aggregate (F1, precision, recall, tokens, oracle_seconds) ---
    lines.append("## Per-arm aggregate (mean across all runs and seeds)")
    lines.append("")
    rows: list[list[str]] = []
    for arm in arms:
        all_metrics = [
            metrics.compute_run_metrics(s, total_seeded)
            for seed_bucket in grouped[arm].values() for s in seed_bucket
        ]
        agg = metrics.aggregate(all_metrics)
        rows.append([
            arm,
            str(agg["count"]),
            f"{agg['precision']['mean']:.3f} ({agg['precision']['min']:.2f}-{agg['precision']['max']:.2f})",
            f"{agg['recall']['mean']:.3f} ({agg['recall']['min']:.2f}-{agg['recall']['max']:.2f})",
            f"{agg['f1']['mean']:.3f} ({agg['f1']['min']:.2f}-{agg['f1']['max']:.2f})",
            f"{int(agg['tokens']['mean']):,}",
            f"{agg['oracle_seconds']['mean']:.1f}s",
            f"{agg['brier']['mean']:.3f}" if agg["brier"] else "—",
            f"{agg['pending_count']['mean']:.1f}",
        ])
    lines.append(_md_table(
        ["arm", "n", "precision", "recall", "f1", "tokens/run", "oracle s/run", "Brier", "pending/run"],
        rows,
    ))
    lines.append("")

    # ----- Per-arm × per-run F1 trajectory --------------------------------------
    lines.append("## F1 trajectory per arm")
    lines.append("")
    lines.append(
        "Run index across the columns; cells are F1 averaged across seeds, with the "
        "per-seed range in parentheses. Track whether F1 *improves* across runs "
        "(the cross-run learning loop firing) vs *plateaus* (no learning)."
    )
    lines.append("")
    max_runs = max(
        (int(s.get("run_index", 0)) + 1 for s in snapshots),
        default=0,
    )
    headers = ["arm"] + [f"run {i}" for i in range(max_runs)]
    rows = []
    for arm in arms:
        # For each run_index, collect F1 across seeds.
        by_run: dict[int, list[float]] = {}
        for seed_bucket in grouped[arm].values():
            for snap in seed_bucket:
                run_metrics = metrics.compute_run_metrics(snap, total_seeded)
                by_run.setdefault(run_metrics.run_index, []).append(run_metrics.f1)
        cells = [arm]
        for i in range(max_runs):
            values = by_run.get(i, [])
            if not values:
                cells.append("—")
            elif len(values) == 1:
                cells.append(f"{values[0]:.2f}")
            else:
                cells.append(f"{sum(values)/len(values):.2f} ({min(values):.2f}-{max(values):.2f})")
        rows.append(cells)
    lines.append(_md_table(headers, rows))
    lines.append("")

    # ----- Reliability curve (arm B only) ---------------------------------------
    b_snaps = [s for s in snapshots if s.get("arm") == "B"]
    if b_snaps:
        buckets = metrics.reliability_buckets(b_snaps, n_buckets=10)
        if buckets:
            lines.append("## Arm B reliability curve (confidence calibration)")
            lines.append("")
            lines.append(
                "Each row is a confidence bucket. ``observed_precision`` should match "
                "``mean_confidence`` for a well-calibrated agent. A flat row at the high "
                "end (everything in one bucket) is the collapse failure mode we saw in "
                "smoke testing."
            )
            lines.append("")
            rows = [
                [
                    f"[{b['bucket_low']:.1f}, {b['bucket_high']:.1f})",
                    str(b["count"]),
                    f"{b['mean_confidence']:.3f}",
                    f"{b['observed_precision']:.3f}",
                ]
                for b in buckets
            ]
            lines.append(_md_table(["bucket", "count", "mean_confidence", "observed_precision"], rows))
            lines.append("")

    # ----- Verdict ------------------------------------------------------------
    lines.append("## Verdict heuristic")
    lines.append("")
    lines.append(
        "An arm 'wins' if its final-run F1 (mean across seeds) is ≥5 points higher than "
        "every other arm AND the per-seed ranges do not overlap with the next-best arm. "
        "Otherwise: report the trade-off space (e.g. precision-vs-recall, "
        "tokens-vs-quality) and call it inconclusive."
    )
    lines.append("")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Summarise HITL experiment results.")
    parser.add_argument(
        "results_dir",
        type=Path,
        help="path to the results/ directory produced by harness.py",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help="output Markdown path (default: <results_dir>/summary.md)",
    )
    args = parser.parse_args(argv)
    markdown = summarize(args.results_dir)
    out = args.output or (args.results_dir / "summary.md")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(markdown, encoding="utf-8")
    print(f"wrote {out}")
    # Also emit JSON snapshot for easier programmatic comparison.
    json_out = out.with_suffix(".json")
    json_out.write_text(json.dumps(_snapshot_for_json(args.results_dir), indent=2), encoding="utf-8")
    print(f"wrote {json_out}")
    return 0


def _snapshot_for_json(results_dir: Path) -> dict[str, Any]:
    """Machine-readable mirror of the markdown summary, for programmatic comparison."""
    snapshots = metrics.load_snapshots(results_dir)
    if not snapshots:
        return {"snapshots": 0}
    try:
        ground_truth = oracle.load_ground_truth()
    except FileNotFoundError:
        return {"snapshots": len(snapshots), "error": "ground_truth.json missing"}
    total_seeded = len(ground_truth.get("defects", []))
    grouped = _by_arm_and_seed(snapshots)
    out: dict[str, Any] = {
        "fixture": {
            "database": ground_truth.get("database"),
            "collection": ground_truth.get("collection"),
            "total_seeded_defects": total_seeded,
        },
        "arms": {},
    }
    for arm, seed_buckets in grouped.items():
        all_metrics = [
            metrics.compute_run_metrics(s, total_seeded)
            for snaps in seed_buckets.values() for s in snaps
        ]
        out["arms"][arm] = {
            "aggregate": metrics.aggregate(all_metrics),
            "runs": [m.to_dict() for m in all_metrics],
        }
    return out
