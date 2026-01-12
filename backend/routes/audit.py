from fastapi import APIRouter, Header, Body, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from services.audit_service import process_audit_question
from services.azure_auth import exchange_token_obo
from services.gemini_service import VisualizationConfig, AuditSummaryResponse

router = APIRouter()

class AuditQueryRequest(BaseModel):
    question: str

class AuditQueryResponse(BaseModel):
    sql_query: str
    results: List[Dict[str, Any]]
    summary: str
    visualization: Optional[VisualizationConfig] = None

@router.post("/query", response_model=AuditQueryResponse)
def query_audit_log(
    body: AuditQueryRequest = Body(...), 
    authorization: str = Header(...)
):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")
    
    # We might want to validate the token here even if we don't use it for the pg connection directly yet
    # user_token = authorization.replace("Bearer ", "")
    # access_token = exchange_token_obo(user_token) 
    
    response = process_audit_question(body.question)
    return AuditQueryResponse(**response)
