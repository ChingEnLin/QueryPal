from bson import ObjectId
from fastapi import APIRouter, Header, Body, HTTPException
import re
from models.data_documents import (
    DataDocumentsRequest,
    DataDocumentsResponse,
    DataDocumentsQueryResponse,
    FindByIdRequest,
    FindByIdResponse,
    UpdateDocumentRequest,
    SingleDocumentRequest,
    InsertDocumentRequest,
    DeleteDocumentRequest,
    DocumentHistoryRequest,
    DocumentHistoryResponse,
    DocumentHistoryEntry,
)
from services.data_documents_service import (
    find_document_by_id,
    fetch_documents,
    build_mongo_query,
    generate_mongo_query_string,
    update_document,
    get_single_document,
    insert_document,
    delete_document,
    get_document_history,
)
from services.user_queries_service import get_user_id_from_token
from services.azure_auth import exchange_token_obo
from services.azure_cosmos_resources import get_connection_string

router = APIRouter()


@router.post("/documents", response_model=DataDocumentsResponse)
def get_documents(
    body: DataDocumentsRequest = Body(...), authorization: str = Header(...)
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
        filters=[f.model_dump() for f in body.filters] if body.filters else None,
    )


@router.post("/documents/query_code", response_model=DataDocumentsQueryResponse)
def get_documents_query_code(
    body: DataDocumentsRequest = Body(...), authorization: str = Header(...)
):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")
    user_token = authorization.replace("Bearer ", "")
    access_token = exchange_token_obo(user_token)
    connection_string = get_connection_string(body.account_id, access_token)

    # Needs to initialize MongoClient briefly to access find_one if 'all' keys are used in the algorithm
    from pymongo import MongoClient

    client = MongoClient(connection_string)
    db = client[body.database_name]
    collection = db[body.collection_name]

    query = build_mongo_query(
        collection=collection,
        filter=body.filter.model_dump() if body.filter else None,
        filters=[f.model_dump() for f in body.filters] if body.filters else None,
    )

    query_str = generate_mongo_query_string(body.collection_name, query)
    return DataDocumentsQueryResponse(query_code=query_str)


@router.put("/documents", response_model=dict)
def put_update_document(
    body: UpdateDocumentRequest = Body(...), authorization: str = Header(...)
):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")
    user_token = authorization.replace("Bearer ", "")
    access_token = exchange_token_obo(user_token)
    connection_string = get_connection_string(body.account_id, access_token)
    user_id = get_user_id_from_token(authorization.replace("Bearer ", ""))
    updated_doc = update_document(
        connection_string=connection_string,
        database_name=body.database_name,
        collection_name=body.collection,
        document_id=body.id,
        content=body.content,
        user_email=user_id,
    )
    if updated_doc:
        # Convert ObjectId to $oid format for JSON compatibility
        if "_id" in updated_doc and isinstance(updated_doc["_id"], ObjectId):
            updated_doc["_id"] = {"$oid": str(updated_doc["_id"])}
        return updated_doc
    raise HTTPException(
        status_code=404,
        detail=f"Document with ID '{body.id}' not found or not updated.",
    )


@router.post("/find_by_id", response_model=FindByIdResponse)
def find_by_id(body: FindByIdRequest = Body(...), authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")
    user_token = authorization.replace("Bearer ", "")
    access_token = exchange_token_obo(user_token)
    connection_string = get_connection_string(body.account_id, access_token)
    doc, collection_name = find_document_by_id(
        connection_string=connection_string,
        database_name=body.database_name,
        collection_names=", ".join(body.collection_names),
        document_id=body.document_id,
        key_context=body.key_context,
    )
    if doc:
        # Convert ObjectId to $oid format for JSON compatibility
        if "_id" in doc and isinstance(doc["_id"], ObjectId):
            doc["_id"] = {"$oid": str(doc["_id"])}
        return FindByIdResponse(document=doc, collectionName=collection_name)
    raise HTTPException(
        status_code=404,
        detail=f"Document with ID '{body.document_id}' not found in any of the provided collections.",
    )


@router.post("/document", response_model=dict)
def single_document(
    body: SingleDocumentRequest = Body(...), authorization: str = Header(...)
):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")
    user_token = authorization.replace("Bearer ", "")
    access_token = exchange_token_obo(user_token)
    connection_string = get_connection_string(body.account_id, access_token)
    doc = get_single_document(
        connection_string=connection_string,
        database_name=body.database_name,
        collection_name=body.collection_name,
        document_id=body.document_id,
    )
    if doc:
        if "_id" in doc and isinstance(doc["_id"], ObjectId):
            doc["_id"] = {"$oid": str(doc["_id"])}
        return doc
    raise HTTPException(
        status_code=404, detail=f"Document with ID '{body.document_id}' not found."
    )


@router.post("/insert_document", response_model=dict)
def insert_document_route(
    body: InsertDocumentRequest = Body(...), authorization: str = Header(...)
):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")
    user_token = authorization.replace("Bearer ", "")
    access_token = exchange_token_obo(user_token)
    connection_string = get_connection_string(body.account_id, access_token)
    user_id = get_user_id_from_token(authorization.replace("Bearer ", ""))
    inserted_doc = insert_document(
        connection_string=connection_string,
        database_name=body.database_name,
        collection_name=body.collection_name,
        document=body.document,
        user_email=user_id,
    )
    if inserted_doc:
        if "_id" in inserted_doc and isinstance(inserted_doc["_id"], ObjectId):
            inserted_doc["_id"] = {"$oid": str(inserted_doc["_id"])}
        return inserted_doc
    raise HTTPException(status_code=500, detail="Failed to insert document.")


# Delete document endpoint
@router.post("/delete_document", response_model=dict)
def delete_document_route(
    body: DeleteDocumentRequest = Body(...), authorization: str = Header(...)
):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")
    user_token = authorization.replace("Bearer ", "")
    access_token = exchange_token_obo(user_token)
    connection_string = get_connection_string(body.account_id, access_token)
    user_id = get_user_id_from_token(authorization.replace("Bearer ", ""))
    success = delete_document(
        connection_string=connection_string,
        database_name=body.database_name,
        collection_name=body.collection_name,
        document_id=body.document_id,
        user_email=user_id,
    )
    if success:
        return {"success": True}
    raise HTTPException(
        status_code=404,
        detail=f"Document with ID '{body.document_id}' not found or could not be deleted.",
    )


@router.post("/document_history", response_model=DocumentHistoryResponse)
def get_document_history_route(
    body: DocumentHistoryRequest = Body(...), authorization: str = Header(...)
):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")

    user_token = authorization.replace("Bearer ", "")
    access_token = exchange_token_obo(user_token)
    connection_string = get_connection_string(body.account_id, access_token)

    # Extract account name from connection string for database_name format
    match = re.search(r"//([^:@]+)", connection_string)
    account_name = match.group(1) if match else "unknown"
    account_database = f"{account_name}.{body.database_name}"

    try:
        history_entries, total_count = get_document_history(
            database_name=account_database,
            collection_name=body.collection_name,
            document_id=body.document_id,
        )

        # Convert to DocumentHistoryEntry objects
        entries = [
            DocumentHistoryEntry(
                id=entry["id"],
                user_email=entry["user_email"],
                operation=entry["operation"],
                timestamp_utc=entry["timestamp_utc"],
                diff_data=entry["diff_data"],
                database_name=entry["database_name"],
                collection_name=entry["collection_name"],
            )
            for entry in history_entries
        ]

        return DocumentHistoryResponse(
            document_id=body.document_id,
            history_entries=entries,
            total_entries=total_count,
        )

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve document history: {str(e)}"
        )
