"""Orchestrate the HITL experiment for one arm × N runs × M seeds.

The harness drives the QueryPal backend over HTTP (not by importing the
agent in-process), so the same code works on all three arm branches with
zero conditional imports — the branch's pinned submodule SHA and merged
backend code decide whether the rating / escalation endpoints exist.

Per-arm dispatch:
==============================================================================
arm        action after each run
==============================================================================
control    persist the run snapshot; no human in the loop
A          oracle-label each finding; POST /argus/findings/{r}/{f}/rate
B          oracle-label each *published* finding (for metrics); fetch the
           run's pending escalations from /argus/escalations, oracle-resolve
           each via POST /argus/escalations/{r}/{f}/resolve
==============================================================================

Each run writes a JSON snapshot to::

    results/<arm>/seed_<n>/run_<i>.json

documented in ``metrics.py``.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal

import httpx

from backend.experiments import oracle

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
    # Arm B knobs — only consulted when arm='B'. Defaults pulled from the
    # smoke-test calibration finding (Gemini 2.5 Flash collapses to ~0.95,
    # so the gate has to publish at >=0.96 to capture them all).
    escalation_high_threshold: float = 0.96
    escalation_low_threshold: float = 0.40
    escalation_cap: int = 25
    # Polling
    poll_interval_s: float = 3.0
    poll_timeout_s: float = 600.0


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _build_run_request(config: RunConfig) -> dict[str, Any]:
    body: dict[str, Any] = {
        "account_id": config.cosmos_account,
        "database": config.database,
        "collection": config.collection,
        "profile": "fast",
        "max_iterations": 20,
    }
    if config.arm == "B":
        body["config_overrides"] = {
            "finding_evaluator": "escalation",
            "escalation_high_threshold": config.escalation_high_threshold,
            "escalation_low_threshold": config.escalation_low_threshold,
            "escalation_cap": config.escalation_cap,
        }
    # Arm A and control: no overrides — postreview already wires up the
    # planner-side verdict consumption, no per-run flag needed.
    return body


def _start_run(client: httpx.Client, config: RunConfig) -> str:
    body = _build_run_request(config)
    r = client.post(
        f"{config.api_base_url}/argus/run",
        json=body,
        headers=_auth_headers(config.bearer_token),
        timeout=30.0,
    )
    r.raise_for_status()
    return r.json()["job_id"]


def _poll_run(client: httpx.Client, config: RunConfig, job_id: str) -> dict[str, Any]:
    deadline = time.time() + config.poll_timeout_s
    while time.time() < deadline:
        r = client.get(
            f"{config.api_base_url}/argus/runs/{job_id}",
            timeout=30.0,
        )
        r.raise_for_status()
        job = r.json()
        if job["status"] in ("done", "error"):
            return job
        time.sleep(config.poll_interval_s)
    raise TimeoutError(f"job {job_id} did not reach a terminal state in {config.poll_timeout_s}s")


def _post_rating(client: httpx.Client, config: RunConfig, report_id: str, finding_id: str, label: str) -> None:
    r = client.post(
        f"{config.api_base_url}/argus/findings/{report_id}/{finding_id}/rate",
        json={"label": label},
        headers=_auth_headers(config.bearer_token),
        timeout=30.0,
    )
    # 404 is tolerated — the finding may have been re-IDed between
    # /argus/run's report and the rate call. Record but don't crash.
    if r.status_code not in (200, 404):
        r.raise_for_status()


def _get_escalations(client: httpx.Client, config: RunConfig, report_id: str) -> list[dict[str, Any]]:
    r = client.get(
        f"{config.api_base_url}/argus/escalations",
        headers=_auth_headers(config.bearer_token),
        timeout=30.0,
    )
    r.raise_for_status()
    rows: list[dict[str, Any]] = r.json().get("escalations", [])
    # Scope to this run — /argus/escalations returns every pending row across
    # the caller's accessible accounts, which is a superset.
    return [e for e in rows if e.get("report_id") == report_id]


def _resolve_escalation(
    client: httpx.Client, config: RunConfig, report_id: str, finding_id: str, verdict: str,
) -> None:
    r = client.post(
        f"{config.api_base_url}/argus/escalations/{report_id}/{finding_id}/resolve",
        json={"verdict": verdict},
        headers=_auth_headers(config.bearer_token),
        timeout=30.0,
    )
    if r.status_code not in (200, 404):
        r.raise_for_status()


# ---------------------------------------------------------------------------
# Per-run orchestration
# ---------------------------------------------------------------------------

def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _snapshot_path(config: RunConfig, seed: int, run_index: int) -> Path:
    return config.results_dir / config.arm / f"seed_{seed}" / f"run_{run_index:02d}.json"


def run_one(
    client: httpx.Client,
    config: RunConfig,
    seed: int,
    run_index: int,
    ground_truth: dict[str, Any],
) -> Path:
    """Execute a single audit run, label its findings, persist metrics."""
    snapshot: dict[str, Any] = {
        "arm": config.arm,
        "seed": seed,
        "run_index": run_index,
        "collection": config.collection,
        "database": config.database,
        "cosmos_account": config.cosmos_account,
        "started_at": _now_iso(),
        "request": _build_run_request(config),
    }
    out_path = _snapshot_path(config, seed, run_index)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        job_id = _start_run(client, config)
        snapshot["job_id"] = job_id
        job = _poll_run(client, config, job_id)
        snapshot["finished_at"] = _now_iso()
        snapshot["status"] = job["status"]

        if job["status"] == "error":
            snapshot["error"] = job.get("error")
            _write_snapshot(out_path, snapshot)
            return out_path

        report = job["report"]
        snapshot["report_id"] = report["report_id"]
        snapshot["tokens"] = report["total_tokens"]
        snapshot["iterations"] = report["iterations"]
        snapshot["quality_score"] = report.get("quality_score")
        snapshot["counts"] = report.get("counts", {})

        oracle_seconds = 0.0

        # 1. Label every published finding via the oracle (for metrics).
        labelled_findings: list[dict[str, Any]] = []
        for f in report.get("findings", []):
            verdict = oracle.rate_finding(f, ground_truth=ground_truth)
            oracle_seconds += verdict.latency_ms / 1000.0
            labelled = {
                **f,
                "oracle_label": verdict.label,
                "oracle_reason": verdict.reason,
            }
            labelled_findings.append(labelled)
            # Arm A only: persist the verdict so the NEXT run sees it via
            # UserVerdictHistory.
            if config.arm == "A":
                _post_rating(client, config, report["report_id"], f["id"], verdict.label)
        snapshot["findings"] = labelled_findings

        # 2. Arm B: also process the escalation queue for this report.
        escalations_labelled: list[dict[str, Any]] = []
        if config.arm == "B":
            pending = _get_escalations(client, config, report["report_id"])
            for e in pending:
                verdict = oracle.rate_finding(
                    {"field": e["field"], "category": e["category"]},
                    ground_truth=ground_truth,
                )
                oracle_seconds += verdict.latency_ms / 1000.0
                # Map oracle label to resolution verdict: tp/fp pass-through.
                # The oracle doesn't emit 'unsure' today so 'need_info' never fires.
                resolve_verdict = verdict.label if verdict.label in ("tp", "fp") else "need_info"
                _resolve_escalation(
                    client, config, e["report_id"], e["finding_id"], resolve_verdict,
                )
                escalations_labelled.append({
                    **e,
                    "oracle_label": verdict.label,
                    "oracle_reason": verdict.reason,
                    "resolution_verdict": resolve_verdict,
                })
        snapshot["escalations"] = escalations_labelled

        snapshot["oracle_seconds"] = round(oracle_seconds, 2)
    except Exception as exc:
        snapshot["finished_at"] = snapshot.get("finished_at", _now_iso())
        snapshot["status"] = "harness_error"
        snapshot["error"] = f"{type(exc).__name__}: {exc}"

    _write_snapshot(out_path, snapshot)
    return out_path


def _write_snapshot(path: Path, snapshot: dict[str, Any]) -> None:
    path.write_text(json.dumps(snapshot, indent=2, default=str), encoding="utf-8")


def run_arm(config: RunConfig) -> None:
    """Run all (seed, run_index) pairs for a single arm sequentially."""
    ground_truth = oracle.load_ground_truth()
    if ground_truth.get("collection") != config.collection or ground_truth.get("database") != config.database:
        print(
            f"WARNING: ground_truth.json was generated for "
            f"{ground_truth.get('database')}/{ground_truth.get('collection')} "
            f"but you're running against {config.database}/{config.collection}. "
            "Re-seed via seed_fixture.py to align.",
            file=sys.stderr,
        )

    with httpx.Client() as client:
        for seed in config.seeds:
            for run_index in range(config.runs):
                start = time.time()
                out = run_one(client, config, seed, run_index, ground_truth)
                elapsed = time.time() - start
                print(
                    f"[{config.arm} seed={seed} run={run_index}] wrote {out.name} "
                    f"in {elapsed:.1f}s"
                )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run one arm of the HITL experiment.")
    parser.add_argument("--arm", choices=["control", "A", "B"], required=True)
    parser.add_argument("--runs", type=int, default=5)
    parser.add_argument(
        "--seeds",
        type=lambda s: [int(x) for x in s.split(",")],
        default=[42, 43, 44],
        help="comma-separated list of integer seeds (labels each run batch)",
    )
    parser.add_argument(
        "--cosmos-account",
        default=("local" if os.getenv("LOCAL_MONGO_URI") else None),
        help="ARM resource id of the Cosmos account. In local mode (backend "
             "running with LOCAL_MONGO_URI set), defaults to 'local' — the "
             "sentinel the backend recognises.",
    )
    parser.add_argument("--database", required=True)
    parser.add_argument("--collection", required=True)
    parser.add_argument("--api-base-url", default="http://localhost:8000")
    parser.add_argument(
        "--bearer-token",
        default=("local-mode" if os.getenv("LOCAL_MONGO_URI") else None),
        help="MSAL access token. Grab from the browser devtools' network tab "
             "on any /argus/runs request, or via msalInstance.acquireTokenSilent. "
             "In local mode, any non-empty string works — the backend ignores it.",
    )
    parser.add_argument(
        "--results-dir",
        type=Path,
        default=Path(__file__).resolve().parent.parent.parent / "results",
    )
    parser.add_argument(
        "--escalation-high-threshold", type=float, default=0.96,
        help="Arm B: confidence >= this publishes. Default tuned for Gemini 2.5 Flash.",
    )
    parser.add_argument("--escalation-low-threshold", type=float, default=0.40)
    parser.add_argument("--escalation-cap", type=int, default=25)
    args = parser.parse_args(argv)
    if not args.cosmos_account:
        parser.error("--cosmos-account is required (or set LOCAL_MONGO_URI for local mode)")
    if not args.bearer_token:
        parser.error("--bearer-token is required (or set LOCAL_MONGO_URI for local mode)")

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
        escalation_high_threshold=args.escalation_high_threshold,
        escalation_low_threshold=args.escalation_low_threshold,
        escalation_cap=args.escalation_cap,
    )
    run_arm(config)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
