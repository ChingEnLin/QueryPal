from fastapi import APIRouter, Header, Body, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from services.audit_service import process_audit_question, get_recent_activity
from services.gemini_service import VisualizationConfig
from services.user_queries_service import get_user_id_from_token

router = APIRouter()


class AuditQueryRequest(BaseModel):
    question: str


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


@router.post("/query", response_model=AuditQueryResponse)
def query_audit_log(
    body: AuditQueryRequest = Body(...), authorization: str = Header(...)
):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")

    response = process_audit_question(body.question)
    return AuditQueryResponse(**response)


@router.get("/recent", response_model=List[RecentActivityItem])
def recent_activity(authorization: str = Header(...), limit: int = 10):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")
    user_email = get_user_id_from_token(authorization.replace("Bearer ", ""))
    return get_recent_activity(user_email=user_email, limit=min(limit, 50))
