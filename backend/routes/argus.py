from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Literal, Optional

from fastapi import APIRouter, Header, HTTPException, Query
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
from services.argus_store import (
    fetch_report_created_by,
    fetch_run_summaries,
    get_report_store,
    set_report_created_by,
)
from services.azure_auth import exchange_token_obo, extract_email_from_token
from services.azure_cosmos_resources import (
    get_connection_string,
    list_cosmos_resources,
)

logger = logging.getLogger(__name__)
router = APIRouter()

Profile = Literal["fast", "balanced", "thorough"]
JobStatus = Literal["queued", "running", "done", "error"]

_PROFILES = {
    "fast": PROFILE_FAST,
    "balanced": PROFILE_BALANCED,
    "thorough": PROFILE_THOROUGH,
}

_SEVERITY_UI = {
    "critical": "critical",
    "high": "warning",
    "medium": "info",
    "low": "info",
}

_JOBS: dict[str, dict[str, Any]] = {}
_MAX_JOBS = 50


class AuditRequest(BaseModel):
    account_id: str
    database: str
    collection: str
    max_iterations: int = 20
    profile: Profile = "fast"


def _summary(description: str) -> str:
    first = description.strip().split("\n", 1)[0]
    period = first.find(". ")
    return first[: period + 1] if period != -1 else first


def _finding_trace(report: AuditReport, finding: Finding) -> str:
    field = finding.field
    lines: list[str] = []
    for i, action in enumerate(report.run_trace, start=1):
        inp_repr = repr(action.action_input)
        is_write = action.action == "write_finding" and field in inp_repr
        if field not in inp_repr and not is_write:
            continue
        lines.append(f"iter {i} · {action.action}")
        lines.append(f"reason: {action.reasoning}")
        if is_write:
            lines.append("finding gate: PASS")
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
        "counts": counts,
        "diff": diff_counts,
        "findings": findings,
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
    try:
        connection = CosmosConnection.from_connection_string(
            connection_string=connection_string,
            cosmos_account=req.account_id,
            database=req.database,
        )
        config = ArgusConfig(
            max_iterations=req.max_iterations,
            evaluation=_PROFILES[req.profile],
        )
        llm = GeminiClient(model=config.llm_model)
        agent = ArgusAgent.from_config(config=config, llm=llm)

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
async def run_audit(req: AuditRequest, authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")

    user_token = authorization.replace("Bearer ", "")
    caller_email = extract_email_from_token(user_token)
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
    _evict_old_jobs()
    asyncio.create_task(_execute_job(job_id, req, user_token, caller_email))
    return JSONResponse(
        status_code=202,
        content={"job_id": job_id, "status": "queued"},
    )


@router.get("/runs/{job_id}")
async def get_run(job_id: str):
    job = _JOBS.get(job_id)
    if job is None:
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


@router.get("/runs")
async def list_runs(
    authorization: str = Header(...),
    account_id: Optional[str] = Query(default=None),
    database: Optional[str] = Query(default=None),
    collection: Optional[str] = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")
    user_token = authorization.replace("Bearer ", "")
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
async def get_report(report_id: str, authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")
    user_token = authorization.replace("Bearer ", "")
    store = get_report_store()
    if store is None:
        raise HTTPException(status_code=404, detail="Report not found")
    try:
        report_uuid = uuid.UUID(report_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Report not found")

    report = await run_in_threadpool(store.get, report_uuid)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")

    try:
        access_token = await run_in_threadpool(exchange_token_obo, user_token)
    except Exception as exc:
        logger.exception("argus get_report auth failed")
        raise HTTPException(status_code=502, detail=f"Azure auth failed: {exc}")

    accessible = await run_in_threadpool(_accessible_account_ids, access_token)
    if report.cosmos_account not in accessible:
        # 404, not 403 — don't leak existence of reports the caller cannot see
        raise HTTPException(status_code=404, detail="Report not found")

    previous = await run_in_threadpool(
        store.get_previous,
        collection=report.collection,
        database=report.database,
        before=report.run_at,
    )
    created_by = await run_in_threadpool(fetch_report_created_by, str(report.id))
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
