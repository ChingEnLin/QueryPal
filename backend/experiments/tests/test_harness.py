"""Tests for the harness — driven against an in-memory httpx.MockTransport so
no real backend is needed."""

from __future__ import annotations

import json
from pathlib import Path

import httpx
import pytest

from backend.experiments.harness import RunConfig, run_one


_GROUND_TRUTH = {
    "collection": "hitl_eval",
    "database": "hitl_test",
    "cosmos_account": "acct",
    "doc_count": 1000,
    "seed": 42,
    "defects": [
        {"field": "email", "category": "null_rate",
         "affected_count": 120, "total": 1000, "notes": ""},
        {"field": "username", "category": "duplicates",
         "affected_count": 30, "total": 1000, "notes": ""},
    ],
    "near_miss_fields": ["phone"],
}


def _make_config(tmp_path: Path, arm: str) -> RunConfig:
    return RunConfig(
        arm=arm,  # type: ignore[arg-type]
        runs=1,
        seeds=[42],
        cosmos_account="acct",
        database="hitl_test",
        collection="hitl_eval",
        api_base_url="http://fake",
        bearer_token="fake-token",
        results_dir=tmp_path / "results",
        # Speed up the test polls.
        poll_interval_s=0.0,
    )


def _stub_report(*, with_confidence: bool, with_pending: bool = False) -> dict:
    findings = [
        {
            "id": "f-email-1",
            "field": "email", "category": "null_rate",
            "severity": "warning", "summary": "...", "description": "...",
            "evidence": "...", "affected": 120, "total": 1000, "affected_pct": 12.0,
            "diff": "new", "trace": "",
            "user_label": None,
            "confidence": 0.95 if with_confidence else None,
            "confidence_reason": None,
            "status": "published" if with_confidence else "published",
        },
        {
            "id": "f-junk-1",
            "field": "address.city", "category": "null_rate",  # FP target
            "severity": "info", "summary": "...", "description": "...",
            "evidence": "...", "affected": 3, "total": 1000, "affected_pct": 0.3,
            "diff": "new", "trace": "",
            "user_label": None,
            "confidence": 0.90 if with_confidence else None,
            "confidence_reason": None,
            "status": "published" if with_confidence else "published",
        },
    ]
    counts = {"critical": 0, "warning": 1, "info": 1, "dismissed": 0}
    if with_pending:
        counts["pending_review"] = 1
    return {
        "report_id": "report-xyz",
        "collection": "hitl_eval",
        "database": "hitl_test",
        "cosmos_account": "acct",
        "run_at": "2026-05-18T00:00:00+00:00",
        "duration_seconds": 1.2,
        "documents_sampled": 200,
        "collection_size": 1000,
        "iterations": 6,
        "total_tokens": 12345,
        "model": "gemini-2.5-flash",
        "profile": "fast",
        "quality_score": 100,
        "counts": counts,
        "diff": {"new": 2, "resolved": 0, "regressed": 0},
        "findings": findings,
        "created_by": "alice@example.com",
        "history": None,
    }


def _stub_job_done(report: dict) -> dict:
    return {
        "job_id": "job-1",
        "status": "done",
        "started_at": "2026-05-18T00:00:00+00:00",
        "finished_at": "2026-05-18T00:00:05+00:00",
        "collection": "hitl_eval",
        "database": "hitl_test",
        "profile": "fast",
        "report": report,
        "error": None,
    }


def _transport_factory(*, arm: str, with_pending: bool = False, captured: list | None = None) -> httpx.MockTransport:
    """Build a MockTransport that simulates the QueryPal backend for this arm."""
    report = _stub_report(with_confidence=(arm == "B"), with_pending=with_pending)
    job_done = _stub_job_done(report)
    pending_escalation = {
        "finding_id": "f-pending-1",
        "report_id": report["report_id"],
        "collection": "hitl_eval",
        "database": "hitl_test",
        "cosmos_account": "acct",
        "field": "email", "category": "null_rate",  # TP target
        "severity": "warning", "description": "...", "hypothesis": "...",
        "evidence_query": "...", "affected_count": 120, "affected_pct": 0.12,
        "confidence": 0.6, "confidence_reason": "borderline",
        "sample_values": [], "created_at": None, "escalated_at": None,
    }
    captured = captured if captured is not None else []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append((request.method, request.url.path, request.url.query.decode() if request.url.query else ""))
        path = request.url.path
        if request.method == "POST" and path == "/argus/run":
            return httpx.Response(202, json={"job_id": "job-1", "status": "queued"})
        if request.method == "GET" and path.startswith("/argus/runs/"):
            return httpx.Response(200, json=job_done)
        if request.method == "POST" and "/argus/findings/" in path and path.endswith("/rate"):
            body = json.loads(request.content)
            return httpx.Response(200, json={"user_label": body["label"]})
        if request.method == "GET" and path == "/argus/escalations":
            return httpx.Response(200, json={"escalations": [pending_escalation] if with_pending else []})
        if request.method == "POST" and "/argus/escalations/" in path and path.endswith("/resolve"):
            body = json.loads(request.content)
            return httpx.Response(200, json={"verdict": body["verdict"]})
        return httpx.Response(404, json={"detail": f"unmocked: {request.method} {path}"})

    return httpx.MockTransport(handler)


def test_control_arm_records_findings_without_rating(tmp_path: Path) -> None:
    captured: list = []
    transport = _transport_factory(arm="control", captured=captured)
    config = _make_config(tmp_path, "control")
    with httpx.Client(transport=transport) as client:
        out = run_one(client, config, seed=42, run_index=0, ground_truth=_GROUND_TRUTH)
    snap = json.loads(out.read_text())
    assert snap["status"] == "done"
    assert len(snap["findings"]) == 2
    # control must NOT call the rate endpoint.
    assert not any("/rate" in path for _method, path, _q in captured)
    # Oracle labels are still computed for metrics.
    by_field = {f["field"]: f["oracle_label"] for f in snap["findings"]}
    assert by_field["email"] == "tp"
    assert by_field["address.city"] == "fp"


def test_a_arm_posts_a_rating_per_finding(tmp_path: Path) -> None:
    captured: list = []
    transport = _transport_factory(arm="A", captured=captured)
    config = _make_config(tmp_path, "A")
    with httpx.Client(transport=transport) as client:
        run_one(client, config, seed=42, run_index=0, ground_truth=_GROUND_TRUTH)
    rate_calls = [(p, q) for m, p, q in captured if m == "POST" and "/rate" in p]
    # Two findings → two rate calls.
    assert len(rate_calls) == 2


def test_b_arm_resolves_pending_escalations_for_this_report_only(tmp_path: Path) -> None:
    captured: list = []
    transport = _transport_factory(arm="B", with_pending=True, captured=captured)
    config = _make_config(tmp_path, "B")
    with httpx.Client(transport=transport) as client:
        out = run_one(client, config, seed=42, run_index=0, ground_truth=_GROUND_TRUTH)
    resolve_calls = [(p, q) for m, p, q in captured if m == "POST" and "/resolve" in p]
    assert len(resolve_calls) == 1, f"expected one resolve call, got {resolve_calls}"
    snap = json.loads(out.read_text())
    assert len(snap["escalations"]) == 1
    assert snap["escalations"][0]["oracle_label"] == "tp"
    assert snap["escalations"][0]["resolution_verdict"] == "tp"


def test_snapshot_carries_oracle_seconds_and_tokens(tmp_path: Path) -> None:
    transport = _transport_factory(arm="A")
    config = _make_config(tmp_path, "A")
    with httpx.Client(transport=transport) as client:
        out = run_one(client, config, seed=42, run_index=0, ground_truth=_GROUND_TRUTH)
    snap = json.loads(out.read_text())
    assert snap["tokens"] == 12345
    # 2 findings × 4000ms oracle latency = 8.0s
    assert snap["oracle_seconds"] == pytest.approx(8.0)


def test_b_request_body_includes_escalation_overrides(tmp_path: Path) -> None:
    """B's POST /argus/run must carry config_overrides telling the backend to use the gate."""
    captured: list = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST" and request.url.path == "/argus/run":
            captured.append(json.loads(request.content))
            return httpx.Response(202, json={"job_id": "job-1", "status": "queued"})
        if request.method == "GET" and request.url.path.startswith("/argus/runs/"):
            return httpx.Response(200, json=_stub_job_done(_stub_report(with_confidence=True)))
        if request.method == "GET" and request.url.path == "/argus/escalations":
            return httpx.Response(200, json={"escalations": []})
        return httpx.Response(404)

    transport = httpx.MockTransport(handler)
    config = _make_config(tmp_path, "B")
    with httpx.Client(transport=transport) as client:
        run_one(client, config, seed=42, run_index=0, ground_truth=_GROUND_TRUTH)
    assert captured, "no /argus/run POST captured"
    body = captured[0]
    assert body["config_overrides"]["finding_evaluator"] == "escalation"
    assert body["config_overrides"]["escalation_high_threshold"] == 0.96


def test_harness_error_path_writes_a_failed_snapshot(tmp_path: Path) -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"detail": "backend died"})

    transport = httpx.MockTransport(handler)
    config = _make_config(tmp_path, "control")
    with httpx.Client(transport=transport) as client:
        out = run_one(client, config, seed=42, run_index=0, ground_truth=_GROUND_TRUTH)
    snap = json.loads(out.read_text())
    assert snap["status"] == "harness_error"
    assert "error" in snap
