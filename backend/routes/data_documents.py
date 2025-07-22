from fastapi import APIRouter, Header, Body, HTTPException
from models.data_documents import DataDocumentsRequest, DataDocumentsResponse
from services.data_documents_service import fetch_documents
from services.azure_auth import exchange_token_obo
from services.azure_cosmos_resources import get_connection_string

router = APIRouter()

@router.post("/documents", response_model=DataDocumentsResponse)
def get_documents(
    body: DataDocumentsRequest = Body(...),
    authorization: str = Header(...)
):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")
    user_token = authorization.replace("Bearer ", "")
    access_token = exchange_token_obo(user_token)
    connection_string = get_connection_string(body.account_id, access_token)
    return fetch_documents(
        connection_string=connection_string,
        database_name=body.database_name,
        collection_name=body.collection_name,
        page=body.page,
        limit=body.limit,
        filter=body.filter.dict() if body.filter else None,
    )
