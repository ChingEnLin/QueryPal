from fastapi import APIRouter, Body, Depends
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from services.audit_service import (
    process_audit_question,
    get_recent_activity,
    get_audit_events,
)
from services.gemini_service import VisualizationConfig
from services.rbac import require, Caller

router = APIRouter()


class AuditQueryRequest(BaseModel):
    question: str
    model: str = "gemini-2.5-flash"


class AuditQueryResponse(BaseModel):
    sql_query: str
    results: List[Dict[str, Any]]
    summary: str
    visualization: Optional[VisualizationConfig] = None


class RecentActivityItem(BaseModel):
    database_name: str
    collection_name: str
    operation: str
    document_id: str
    user_email: str
    timestamp_utc: str


class AuditEventItem(BaseModel):
    user_email: str
    operation: str
    database_name: str
    collection_name: str
    document_id: Optional[str] = None
    diff_data: Optional[Any] = None
    timestamp_utc: str


@router.get("/events", response_model=List[AuditEventItem])
def audit_events(
    days: int = 90,
    limit: int = 1000,
    account: Optional[str] = None,
    caller: Caller = Depends(require("audit:read")),
):
    return get_audit_events(
        days=min(days, 365), limit=min(limit, 5000), account=account
    )


@router.get("/events/mine", response_model=List[AuditEventItem])
def my_audit_events(
    days: int = 90,
    limit: int = 1000,
    account: Optional[str] = None,
    caller: Caller = Depends(require("self:manage")),
):
    return get_audit_events(
        days=min(days, 365),
        limit=min(limit, 1000),
        account=account,
        user_email=caller.email,
    )


@router.post("/query", response_model=AuditQueryResponse)
def query_audit_log(
    body: AuditQueryRequest = Body(...),
    caller: Caller = Depends(require("audit:read")),
):
    response = process_audit_question(body.question, model=body.model)
    return AuditQueryResponse(**response)


@router.get("/recent", response_model=List[RecentActivityItem])
def recent_activity(
    limit: int = 10,
    caller: Caller = Depends(require("self:manage")),
):
    return get_recent_activity(user_email=caller.email, limit=min(limit, 50))
