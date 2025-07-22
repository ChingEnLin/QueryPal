from bson import ObjectId
from fastapi import APIRouter, Header, Body, HTTPException
from models.data_documents import (
    DataDocumentsRequest,
    DataDocumentsResponse,
    FindByIdRequest,
    FindByIdResponse
)
from services.data_documents_service import find_document_by_id, fetch_documents
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
        filter=body.filter.model_dump() if body.filter else None,
    )


@router.post("/find_by_id", response_model=FindByIdResponse)
def find_by_id(
    body: FindByIdRequest = Body(...),
    authorization: str = Header(...)
):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")
    user_token = authorization.replace("Bearer ", "")
    access_token = exchange_token_obo(user_token)
    connection_string = get_connection_string(body.account_id, access_token)
    doc, collection_name = find_document_by_id(
        connection_string=connection_string,
        database_name=body.database_name,
        collection_names=', '.join(body.collection_names),
        document_id=body.document_id,
        key_context=body.key_context
    )
    if doc:
        # Convert ObjectId to $oid format for JSON compatibility
        if '_id' in doc and isinstance(doc['_id'], ObjectId):
            doc['_id'] = {'$oid': str(doc['_id'])}
        return FindByIdResponse(document=doc, collectionName=collection_name)
    raise HTTPException(status_code=404, detail=f"Document with ID '{body.document_id}' not found in any of the provided collections.")
