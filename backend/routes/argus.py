from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from queryargus.agent.loop import ArgusAgent
from queryargus.llm.gemini import GeminiClient
from queryargus.models.config import (
    PROFILE_BALANCED,
    PROFILE_FAST,
    PROFILE_THOROUGH,
    ArgusConfig,
)
from queryargus.models.connection import CosmosConnection
from queryargus.models.finding import Finding
from queryargus.models.report import AuditReport
from queryargus.observability.cost import CostTracker
from queryargus.observability.logging_observer import StructuredLogObserver
from services.argus_live_events import LiveEventBuffer
from services.argus_profiles_service import (
    ProfileNameConflict,
    create_profile,
    delete_profile,
    get_profile_for_user,
    list_profiles,
)
from services.argus_store import (
    fetch_report_created_by,
    fetch_run_summaries,
    get_report_store,
    set_finding_rating,
    set_report_created_by,
)
from services.azure_auth import exchange_token_obo
from services.rbac import Caller, require
from services.azure_cosmos_resources import (
    get_connection_string,
    list_cosmos_resources,
)

logger = logging.getLogger(__name__)
router = APIRouter()

Profile = Literal["fast", "balanced", "thorough"]
JobStatus = Literal["queued", "running", "done", "error"]

# Upstream PROFILE_THOROUGH ships with judge_provider="openai"/judge_model="gpt-4o".
# Only Gemini is wired up end-to-end in our deployment, so swap the default to
# gemini-2.5-pro. Inline config_overrides from the UI still take precedence.
_PROFILE_THOROUGH_GEMINI = PROFILE_THOROUGH.model_copy(
    update={"judge_provider": "gemini", "judge_model": "gemini-2.5-pro"},
)

_PROFILES = {
    "fast": PROFILE_FAST,
    "balanced": PROFILE_BALANCED,
    "thorough": _PROFILE_THOROUGH_GEMINI,
}

_SEVERITY_UI = {
    "critical": "critical",
    "high": "warning",
    "medium": "info",
    "low": "info",
}

_JOBS: dict[str, dict[str, Any]] = {}
_MAX_JOBS = 50

# StructuredLogObserver carries no per-run state besides the current run_id
# (re-set in on_run_start), so a module-level singleton is safe across requests.
# CostTracker must be constructed per-request — it accumulates token buckets.
_LOG_OBSERVER = StructuredLogObserver()


class AuditRequest(BaseModel):
    account_id: str
    database: str
    collection: str
    max_iterations: int = 20
    profile: Profile = "fast"
    # Tier 2 overrides — merged onto ArgusConfig before the run.
    # Unknown keys raise 400 via Pydantic's extra="forbid" on ArgusConfig.
    argus_overrides: Optional[dict[str, Any]] = None
    # Tier 3 — merged onto EvaluatorConfig. Wired here so the request
    # contract is stable across phases even before the UI exposes it.
    config_overrides: Optional[dict[str, Any]] = None
    # Tier 4 — saved profile id. When set, the profile's overrides are
    # resolved server-side; inline overrides above take precedence so the
    # user can tweak a saved profile for a one-off run.
    saved_profile_id: Optional[str] = None


def _summary(description: str) -> str:
    first = description.strip().split("\n", 1)[0]
    period = first.find(". ")
    return first[: period + 1] if period != -1 else first


def _finding_trace(report: AuditReport, finding: Finding) -> str:
    """One JSON object per relevant agent step (JSONL).

    The frontend parses each line and renders a structured block. Falls back
    gracefully to plain-text display if a line fails to parse.
    """
    field = finding.field
    lines: list[str] = []
    for i, action in enumerate(report.run_trace, start=1):
        inp_repr = repr(action.action_input)
        is_write = action.action == "write_finding" and field in inp_repr
        if field not in inp_repr and not is_write:
            continue
        entry: dict[str, Any] = {
            "iter": i,
            "action": action.action,
            "reason": action.reasoning,
        }
        if is_write:
            entry["gate"] = "PASS"
        lines.append(json.dumps(entry, ensure_ascii=False, default=str))
    return "\n".join(lines)


def _compute_diff(
    current: AuditReport, previous: Optional[AuditReport]
) -> tuple[set[tuple[str, str]], set[str], dict[str, int]]:
    """Return (new_keys, regressed_fields, counts) by comparing against ``previous``.

    When ``previous`` is None we fall back to the report's own diff fields (zero
    when no prior run existed at agent runtime).
    """
    if previous is None:
        new_keys = {(f.field, f.category) for f in current.new_findings}
        regressed = set(current.regressed_fields)
        counts = {
            "new": len(current.new_findings),
            "resolved": len(current.resolved_findings),
            "regressed": len(current.regressed_fields),
        }
        return new_keys, regressed, counts

    severity_order = {"low": 0, "medium": 1, "high": 2, "critical": 3}
    prev_by_key = {(f.field, f.category): f for f in previous.findings}
    curr_by_key = {(f.field, f.category): f for f in current.findings}
    new_keys = set(curr_by_key) - set(prev_by_key)
    resolved = set(prev_by_key) - set(curr_by_key)
    regressed: set[str] = set()
    for key, f in curr_by_key.items():
        prev = prev_by_key.get(key)
        if prev is None:
            continue
        if severity_order.get(f.severity.value, 0) > severity_order.get(
            prev.severity.value, 0
        ):
            regressed.add(f.field)
    counts = {
        "new": len(new_keys),
        "resolved": len(resolved),
        "regressed": len(regressed),
    }
    return new_keys, regressed, counts


def _serialize_finding(
    finding: Finding,
    report: AuditReport,
    new_keys: set[tuple[str, str]],
    regressed: set[str],
) -> dict[str, Any]:
    severity_ui = _SEVERITY_UI.get(finding.severity.value, "info")
    diff: str
    if (finding.field, finding.category) in new_keys:
        diff = "new"
    elif finding.field in regressed:
        diff = "regressed"
    else:
        diff = "existing"
    total = report.collection_size or report.documents_sampled or finding.affected_count
    return {
        "id": str(finding.id),
        "severity": severity_ui,
        "field": finding.field,
        "category": finding.category,
        "summary": _summary(finding.description),
        "description": finding.description,
        "evidence": finding.evidence_query,
        "affected": finding.affected_count,
        "total": total,
        "affected_pct": round(finding.affected_pct * 100, 1),
        "diff": diff,
        "trace": _finding_trace(report, finding),
        # Arm A — surface the current verdict so the UI can render the
        # rating buttons in the correct state. None when unrated.
        "user_label": finding.user_label,
    }


def _serialize_report(
    report: AuditReport,
    *,
    model: str,
    profile: Profile,
    previous: Optional[AuditReport] = None,
    created_by: Optional[str] = None,
) -> dict[str, Any]:
    new_keys, regressed, diff_counts = _compute_diff(report, previous)
    findings = [
        _serialize_finding(f, report, new_keys, regressed) for f in report.findings
    ]
    counts = {
        "critical": sum(1 for f in findings if f["severity"] == "critical"),
        "warning": sum(1 for f in findings if f["severity"] == "warning"),
        "info": sum(1 for f in findings if f["severity"] == "info"),
        "dismissed": len(report.dismissed_findings),
    }
    quality = (
        round(report.overall_quality_score * 100)
        if report.overall_quality_score is not None
        else None
    )
    run_eval = None
    if report.run_evaluation is not None:
        run_eval = {
            "verdict": str(report.run_evaluation.verdict),
            "score": report.run_evaluation.score,
            "reason": report.run_evaluation.reason,
            "critique": report.run_evaluation.critique,
            "evaluated_by": report.run_evaluation.evaluated_by,
        }
    return {
        "report_id": str(report.id),
        "collection": report.collection,
        "database": report.database,
        "cosmos_account": report.cosmos_account,
        "run_at": report.run_at.isoformat(),
        "duration_seconds": report.duration_seconds,
        "documents_sampled": report.documents_sampled,
        "collection_size": report.collection_size,
        "iterations": len(report.run_trace),
        "total_tokens": report.total_input_tokens + report.total_output_tokens,
        "model": model,
        "profile": profile,
        "quality_score": quality,
        "run_evaluation": run_eval,
        "counts": counts,
        "diff": diff_counts,
        "findings": findings,
        "cost": (
            report.cost.model_dump(mode="json") if report.cost is not None else None
        ),
        "created_by": created_by,
        "history": None,
    }


def _evict_old_jobs() -> None:
    if len(_JOBS) <= _MAX_JOBS:
        return
    terminal = [
        (jid, j) for jid, j in _JOBS.items() if j["status"] in ("done", "error")
    ]
    terminal.sort(key=lambda kv: kv[1].get("finished_at") or kv[1]["started_at"])
    for jid, _ in terminal[: len(_JOBS) - _MAX_JOBS]:
        _JOBS.pop(jid, None)


def _queue_has_capacity() -> bool:
    """True when a new job can be accepted after eviction. Protects against a
    stuck queue where every slot is held by a running job and no terminal jobs
    can be evicted."""
    _evict_old_jobs()
    return len(_JOBS) < _MAX_JOBS


def _accessible_account_ids(access_token: str) -> list[str]:
    """Cosmos accounts (full ARM resource IDs) visible to the caller."""
    try:
        resources = list_cosmos_resources(access_token)
    except Exception:
        logger.exception("failed to list cosmos resources for caller")
        return []
    return [r["id"] for r in resources if r.get("id")]


async def _execute_job(
    job_id: str, req: AuditRequest, user_token: str, caller_email: Optional[str]
) -> None:
    job = _JOBS[job_id]
    job["status"] = "running"
    try:
        access_token = await run_in_threadpool(exchange_token_obo, user_token)
        connection_string = await run_in_threadpool(
            get_connection_string, req.account_id, access_token
        )
    except Exception as exc:
        logger.exception(
            "argus auth/connection-string failed account=%s", req.account_id
        )
        job["status"] = "error"
        job["error"] = f"Azure auth failed: {exc}"
        job["finished_at"] = datetime.now(timezone.utc).isoformat()
        return

    store = get_report_store()

    # Resolve saved profile (Tier 4): inline overrides win, so a user can tweak
    # a saved profile for a single run without mutating the stored profile.
    saved_evaluator: dict[str, Any] = {}
    saved_argus: dict[str, Any] = {}
    if req.saved_profile_id and caller_email:
        profile_row = await run_in_threadpool(
            get_profile_for_user,
            profile_id=req.saved_profile_id,
            user_email=caller_email,
        )
        if profile_row is None:
            job["status"] = "error"
            job["error"] = "Saved profile not found"
            job["finished_at"] = datetime.now(timezone.utc).isoformat()
            return
        saved_evaluator = profile_row.get("evaluator_overrides") or {}
        saved_argus = profile_row.get("argus_overrides") or {}

    try:
        connection = CosmosConnection.from_connection_string(
            connection_string=connection_string,
            cosmos_account=req.account_id,
            database=req.database,
        )
        evaluation = _PROFILES[req.profile]
        merged_eval = {**saved_evaluator, **(req.config_overrides or {})}
        merged_argus = {**saved_argus, **(req.argus_overrides or {})}
        if merged_eval:
            try:
                evaluation = evaluation.model_copy(update=merged_eval)
                # Re-validate so threshold ranges + Literal fields are enforced.
                evaluation = evaluation.__class__(**evaluation.model_dump())
            except Exception as exc:
                job["status"] = "error"
                job["error"] = f"Invalid evaluator override: {exc}"
                job["finished_at"] = datetime.now(timezone.utc).isoformat()
                return
        argus_kwargs: dict[str, Any] = {
            "max_iterations": req.max_iterations,
            "evaluation": evaluation,
        }
        if merged_argus:
            argus_kwargs.update(merged_argus)
        try:
            config = ArgusConfig(**argus_kwargs)
        except Exception as exc:
            job["status"] = "error"
            job["error"] = f"Invalid argus override: {exc}"
            job["finished_at"] = datetime.now(timezone.utc).isoformat()
            return
        llm = GeminiClient(model=config.llm_model)
        # Build a judge client when the evaluator config asks for a judge or
        # composite gate. Only Gemini is wired up end-to-end in our deployment;
        # `judge_provider` is validated by Pydantic but we ignore non-gemini
        # values here and fall through to GeminiClient.
        judge_llm = None
        judge_model_name = None
        eval_cfg = config.evaluation
        needs_judge = any(
            getattr(eval_cfg, gate) in ("judge", "composite")
            for gate in ("action_evaluator", "finding_evaluator", "run_evaluator")
        )
        if needs_judge:
            # Always route the judge through Gemini in our deployment. If the
            # config carries a non-gemini model (e.g. upstream's gpt-4o default
            # leaking through a stale saved profile), force a sane gemini model.
            jm = eval_cfg.judge_model or ""
            if not jm or "gemini" not in jm.lower():
                judge_model_name = "gemini-2.5-pro"
            else:
                judge_model_name = jm
            judge_llm = GeminiClient(model=judge_model_name)
        live = LiveEventBuffer()
        job["live"] = live
        agent = ArgusAgent.from_config(
            config=config,
            llm=llm,
            judge_llm=judge_llm,
            judge_model_name=judge_model_name,
            observers=[_LOG_OBSERVER, CostTracker(), live],
        )

        history = None
        previous: Optional[AuditReport] = None
        if store is not None:
            try:
                history = await run_in_threadpool(
                    store.load_history,
                    collection=req.collection,
                    database=req.database,
                    limit=5,
                )
                previous = await run_in_threadpool(
                    store.get_previous,
                    collection=req.collection,
                    database=req.database,
                )
            except Exception:
                logger.exception(
                    "failed to load history for collection=%s", req.collection
                )

        logger.info(
            "argus run start job=%s collection=%s profile=%s",
            job_id,
            req.collection,
            req.profile,
        )
        report = await run_in_threadpool(
            agent.run, connection, req.collection, history=history
        )
    except Exception as exc:
        logger.exception(
            "argus run failed job=%s collection=%s", job_id, req.collection
        )
        job["status"] = "error"
        job["error"] = str(exc)
        job["finished_at"] = datetime.now(timezone.utc).isoformat()
        return

    logger.info(
        "argus run done job=%s collection=%s findings=%d duration=%.2fs",
        job_id,
        req.collection,
        len(report.findings),
        report.duration_seconds,
    )

    # Apply diff against prior run before persisting so raw_report carries
    # previous_run_id/new_findings/resolved_findings. Upstream's CLI does this
    # in cli/main.py; the agent itself does not.
    if previous is not None:
        report = report.diff_against(previous)

    if store is not None:
        try:
            await run_in_threadpool(store.save, report)
            if caller_email:
                await run_in_threadpool(
                    set_report_created_by, str(report.id), caller_email
                )
        except Exception:
            logger.exception("failed to persist argus report id=%s", report.id)

    job["status"] = "done"
    job["report"] = _serialize_report(
        report,
        model=config.llm_model,
        profile=req.profile,
        previous=previous,
        created_by=caller_email,
    )
    job["finished_at"] = datetime.now(timezone.utc).isoformat()


@router.post("/run")
async def run_audit(
    req: AuditRequest,
    authorization: str = Header(...),
    caller: Caller = Depends(require("argus:write")),
):
    user_token = authorization[7:]
    caller_email = caller.email
    if not _queue_has_capacity():
        raise HTTPException(
            status_code=429,
            detail="Audit queue is full; please retry shortly.",
        )
    job_id = uuid.uuid4().hex
    _JOBS[job_id] = {
        "status": "queued",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "finished_at": None,
        "report": None,
        "error": None,
        "collection": req.collection,
        "database": req.database,
        "profile": req.profile,
        "created_by": caller_email,
    }
    asyncio.create_task(_execute_job(job_id, req, user_token, caller_email))
    return JSONResponse(
        status_code=202,
        content={"job_id": job_id, "status": "queued"},
    )


@router.get("/runs/{job_id}")
async def get_run(
    job_id: str,
    caller: Caller = Depends(require("query:read")),
):
    caller_email = caller.email
    job = _JOBS.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    # Scope job-status reads to the caller who created the job. Returning 404
    # (not 403) avoids leaking job existence to other tenants.
    if job.get("created_by") and job["created_by"] != caller_email:
        raise HTTPException(status_code=404, detail="Job not found")
    return JSONResponse(
        content={
            "job_id": job_id,
            "status": job["status"],
            "started_at": job["started_at"],
            "finished_at": job["finished_at"],
            "collection": job["collection"],
            "database": job["database"],
            "profile": job["profile"],
            "report": job["report"],
            "error": job["error"],
        }
    )


@router.get("/runs/{job_id}/events")
async def get_run_events(
    job_id: str,
    cursor: int = Query(default=0, ge=0),
    caller: Caller = Depends(require("query:read")),
):
    """Live event snapshot for a still-running job.

    `cursor` is the value returned in the previous poll's `next_cursor`. The
    response also carries rolled-up aggregates (current_iter, findings_count,
    running token totals, last_action / last_tool) so the UI can render
    progress without re-folding the event stream.

    Reuses the same caller-scoping rule as `get_run`: cross-tenant attempts
    return 404, not 403, to avoid leaking job existence.
    """
    caller_email = caller.email
    job = _JOBS.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.get("created_by") and job["created_by"] != caller_email:
        raise HTTPException(status_code=404, detail="Job not found")
    live: Optional[LiveEventBuffer] = job.get("live")
    if live is None:
        # Run hasn't reached the observer-attach point yet (still waiting on
        # Azure auth / connection-string), or job pre-dates this feature.
        return JSONResponse(content={"events": [], "next_cursor": 0, "aggregates": {}})
    return JSONResponse(content=live.snapshot(since=cursor))


@router.get("/runs")
async def list_runs(
    authorization: str = Header(...),
    account_id: Optional[str] = Query(default=None),
    database: Optional[str] = Query(default=None),
    collection: Optional[str] = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    caller: Caller = Depends(require("query:read")),
):
    user_token = authorization[7:]
    try:
        access_token = await run_in_threadpool(exchange_token_obo, user_token)
    except Exception as exc:
        logger.exception("argus list_runs auth failed")
        raise HTTPException(status_code=502, detail=f"Azure auth failed: {exc}")

    accessible = await run_in_threadpool(_accessible_account_ids, access_token)
    if account_id is not None:
        accessible = [a for a in accessible if a == account_id]
    if not accessible:
        return JSONResponse(content={"runs": []})
    rows = await run_in_threadpool(
        fetch_run_summaries,
        cosmos_accounts=accessible,
        database=database,
        collection=collection,
        limit=limit,
    )
    return JSONResponse(content={"runs": rows})


@router.get("/reports/{report_id}")
async def get_report(
    report_id: str,
    authorization: str = Header(...),
    caller: Caller = Depends(require("query:read")),
):
    user_token = authorization[7:]
    store = get_report_store()
    if store is None:
        raise HTTPException(status_code=404, detail="Report not found")
    try:
        report_uuid = uuid.UUID(report_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Report not found")

    async def _resolve_access() -> list[str]:
        try:
            access_token = await run_in_threadpool(exchange_token_obo, user_token)
        except Exception as exc:
            logger.exception("argus get_report auth failed")
            raise HTTPException(status_code=502, detail=f"Azure auth failed: {exc}")
        return await run_in_threadpool(_accessible_account_ids, access_token)

    # Fan out the independent I/O: report lookup, created_by lookup, and the
    # auth + ARM resource list all run concurrently. Previous-report lookup
    # depends on `report` so it kicks off as soon as that returns.
    report_task = asyncio.create_task(run_in_threadpool(store.get, report_uuid))
    created_by_task = asyncio.create_task(
        run_in_threadpool(fetch_report_created_by, str(report_uuid))
    )
    accessible_task = asyncio.create_task(_resolve_access())

    report = await report_task
    if report is None:
        created_by_task.cancel()
        accessible_task.cancel()
        raise HTTPException(status_code=404, detail="Report not found")

    previous_task = asyncio.create_task(
        run_in_threadpool(
            store.get_previous,
            collection=report.collection,
            database=report.database,
            before=report.run_at,
        )
    )

    accessible = await accessible_task
    if report.cosmos_account not in accessible:
        previous_task.cancel()
        created_by_task.cancel()
        # 404, not 403 — don't leak existence of reports the caller cannot see
        raise HTTPException(status_code=404, detail="Report not found")

    previous, created_by = await asyncio.gather(previous_task, created_by_task)
    # Resolved profile/model are not persisted yet — fall back to the report's
    # own model field and an unknown profile marker until Phase 2 lands.
    return JSONResponse(
        content=_serialize_report(
            report,
            model="gemini-2.5-flash",
            profile="balanced",
            previous=previous,
            created_by=created_by,
        )
    )


# ---------------------------------------------------------------------------
# Tier 4 — saved custom profiles
# ---------------------------------------------------------------------------


class ProfileCreate(BaseModel):
    name: str
    base_profile: Profile
    evaluator_overrides: dict[str, Any] = {}
    argus_overrides: dict[str, Any] = {}


@router.get("/profiles")
async def list_saved_profiles(
    caller: Caller = Depends(require("self:manage")),
):
    email = caller.email
    rows = await run_in_threadpool(list_profiles, email)
    return JSONResponse(content={"profiles": rows})


@router.post("/profiles")
async def create_saved_profile(
    payload: ProfileCreate,
    caller: Caller = Depends(require("argus:write")),
):
    email = caller.email
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    try:
        row = await run_in_threadpool(
            create_profile,
            user_email=email,
            name=name,
            base_profile=payload.base_profile,
            evaluator_overrides=payload.evaluator_overrides,
            argus_overrides=payload.argus_overrides,
        )
    except ProfileNameConflict:
        raise HTTPException(
            status_code=409, detail="A profile with that name already exists"
        )
    if row is None:
        raise HTTPException(status_code=500, detail="Failed to create profile")
    return JSONResponse(status_code=201, content=row)


@router.delete("/profiles/{profile_id}")
async def delete_saved_profile(
    profile_id: str,
    caller: Caller = Depends(require("argus:write")),
):
    email = caller.email
    ok = await run_in_threadpool(
        delete_profile, profile_id=profile_id, user_email=email
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Profile not found")
    return JSONResponse(content={"deleted": True})


# ---------------------------------------------------------------------------
# Arm A — post-hoc finding rating
# ---------------------------------------------------------------------------


class FindingRating(BaseModel):
    label: Literal["tp", "fp"]


@router.post("/findings/{report_id}/{finding_id}/rate")
async def rate_finding(
    report_id: str,
    finding_id: str,
    payload: FindingRating,
    authorization: str = Header(...),
    caller: Caller = Depends(require("argus:write")),
):
    """Record a human verdict (TP / FP) on a single persisted finding.

    The verdict is scoped by the caller's Cosmos-account access (same OBO check
    as ``get_report``); cross-tenant attempts return 404 to avoid leaking
    existence. The label is also written into ``raw_report`` JSONB so the next
    ``GET /argus/reports/{id}`` reflects it without an extra join.
    """
    email = caller.email
    user_token = authorization[7:]
    store = get_report_store()
    if store is None:
        raise HTTPException(status_code=404, detail="Report not found")
    try:
        report_uuid = uuid.UUID(report_id)
        finding_uuid = uuid.UUID(finding_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Report not found")

    # Fan out report fetch and access-check; need both before touching storage.
    report_task = asyncio.create_task(run_in_threadpool(store.get, report_uuid))

    async def _resolve_access() -> list[str]:
        try:
            access_token = await run_in_threadpool(exchange_token_obo, user_token)
        except Exception as exc:
            logger.exception("argus rate_finding auth failed")
            raise HTTPException(status_code=502, detail=f"Azure auth failed: {exc}")
        return await run_in_threadpool(_accessible_account_ids, access_token)

    accessible_task = asyncio.create_task(_resolve_access())

    report = await report_task
    if report is None:
        accessible_task.cancel()
        raise HTTPException(status_code=404, detail="Report not found")

    accessible = await accessible_task
    if report.cosmos_account not in accessible:
        # 404, not 403 — symmetric with get_report's existence-leak guard.
        raise HTTPException(status_code=404, detail="Report not found")

    ok = await run_in_threadpool(
        set_finding_rating,
        report_id=str(report_uuid),
        finding_id=str(finding_uuid),
        label=payload.label,
        rated_by=email,
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Finding not found")
    return JSONResponse(
        content={
            "report_id": str(report_uuid),
            "finding_id": str(finding_uuid),
            "user_label": payload.label,
            "rated_by": email,
        }
    )
