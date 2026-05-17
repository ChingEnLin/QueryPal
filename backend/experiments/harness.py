"""Orchestrate the HITL experiment for one arm × N runs × M seeds.

For each (arm, seed) pair this module:

    for i in range(runs):
        report = trigger an audit run via the existing /argus/run endpoint
        wait for the job to finish, fetch the report
        for each finding: call oracle.rate_finding
        post the verdict to the arm-appropriate endpoint
            arm = control          -> skip
            arm = A (postreview)   -> POST /argus/findings/{report}/{idx}/rate
            arm = B (escalate)     -> POST /argus/escalations/{report}/{idx}/resolve
        snapshot the per-run metrics to results/<arm>/seed_<n>/run_<i>.json

The harness drives the backend over HTTP — it does NOT import the
QueryArgus agent directly. That way the same harness works for all three
arms with no conditional imports; the arm's storage + planner-prompt
changes are baked into the submodule SHA pinned by each arm branch.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

Arm = Literal["control", "A", "B"]


@dataclass(frozen=True)
class RunConfig:
    arm: Arm
    runs: int
    seeds: list[int]
    cosmos_account: str
    database: str
    collection: str
    api_base_url: str
    bearer_token: str
    results_dir: Path


def run_one(config: RunConfig, seed: int, run_index: int) -> Path:
    """Execute a single audit run, label its findings, persist metrics.

    Returns the path of the per-run JSON snapshot written.
    """
    raise NotImplementedError("scaffolding — implement after oracle.py is functional")


def run_arm(config: RunConfig) -> None:
    """Run all (seed, run_index) pairs for a single arm sequentially."""
    raise NotImplementedError("scaffolding — implement after run_one is functional")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run one arm of the HITL experiment.")
    parser.add_argument("--arm", choices=["control", "A", "B"], required=True)
    parser.add_argument("--runs", type=int, default=5)
    parser.add_argument(
        "--seeds",
        type=lambda s: [int(x) for x in s.split(",")],
        default=[42, 43, 44],
        help="comma-separated list of integer seeds",
    )
    parser.add_argument("--cosmos-account", required=True)
    parser.add_argument("--database", required=True)
    parser.add_argument("--collection", required=True)
    parser.add_argument("--api-base-url", default="http://localhost:8000")
    parser.add_argument("--bearer-token", required=True)
    parser.add_argument(
        "--results-dir",
        type=Path,
        default=Path(__file__).resolve().parent.parent.parent / "results",
    )
    args = parser.parse_args(argv)

    config = RunConfig(
        arm=args.arm,
        runs=args.runs,
        seeds=args.seeds,
        cosmos_account=args.cosmos_account,
        database=args.database,
        collection=args.collection,
        api_base_url=args.api_base_url,
        bearer_token=args.bearer_token,
        results_dir=args.results_dir,
    )
    run_arm(config)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
