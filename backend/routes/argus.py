from __future__ import annotations

import logging
from typing import Any, Literal

from fastapi import APIRouter, Header, HTTPException
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
from services.azure_auth import exchange_token_obo
from services.azure_cosmos_resources import get_connection_string

logger = logging.getLogger(__name__)
router = APIRouter()

Profile = Literal["fast", "balanced", "thorough"]

_PROFILES = {
    "fast": PROFILE_FAST,
    "balanced": PROFILE_BALANCED,
    "thorough": PROFILE_THOROUGH,
}

# Maps QueryArgus's 4-level severity to the design's 3-level UI bucket.
_SEVERITY_UI = {
    "critical": "critical",
    "high": "warning",
    "medium": "info",
    "low": "info",
}


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
    """Slice run_trace down to actions that touched this finding's field.

    Heuristic: include any action whose action_input mentions the field path,
    plus the write_finding action that produced this finding (if present).
    Lines are formatted as ``iter N · action`` followed by the reasoning.
    """
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
) -> dict[str, Any]:
    new_keys = {(f.field, f.category) for f in report.new_findings}
    regressed = set(report.regressed_fields)

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
        "diff": {
            "new": len(report.new_findings),
            "resolved": len(report.resolved_findings),
            "regressed": len(report.regressed_fields),
        },
        "findings": findings,
        "history": None,  # populated once ReportStore is wired
    }


@router.post("/run")
async def run_audit(req: AuditRequest, authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")

    user_token = authorization.replace("Bearer ", "")
    try:
        access_token = exchange_token_obo(user_token)
        connection_string = get_connection_string(req.account_id, access_token)
    except Exception as exc:
        logger.exception(
            "argus auth/connection-string failed account=%s", req.account_id
        )
        raise HTTPException(status_code=502, detail=f"Azure auth failed: {exc}")

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
    agent = ArgusAgent.with_defaults(config=config, llm=llm)

    logger.info(
        "argus run start collection=%s database=%s profile=%s",
        req.collection,
        req.database,
        req.profile,
    )
    try:
        report = await run_in_threadpool(agent.run, connection, req.collection)
    except Exception as exc:
        logger.exception("argus run failed collection=%s", req.collection)
        return JSONResponse(status_code=500, content={"detail": str(exc)})

    logger.info(
        "argus run done collection=%s findings=%d duration=%.2fs",
        req.collection,
        len(report.findings),
        report.duration_seconds,
    )
    return JSONResponse(
        content=_serialize_report(report, model=config.llm_model, profile=req.profile)
    )
