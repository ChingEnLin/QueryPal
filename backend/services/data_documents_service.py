
from typing import Tuple, Optional
from pymongo import MongoClient
from models.data_documents import DataDocumentsRequest, DataDocumentsResponse
from models.schemas import CollectionContext
from services.gemini_service import generate_query_from_prompt
from bson import ObjectId
import re
from cachetools import TTLCache, cached

# Caches: 10 min TTL, 100 max entries
_fetch_documents_cache = TTLCache(maxsize=100, ttl=600)
_find_by_id_cache = TTLCache(maxsize=100, ttl=600)

ALL_DOCUMENTS_CACHES = [
    _fetch_documents_cache,
    _find_by_id_cache
]

@cached(_fetch_documents_cache)
def fetch_documents(connection_string: str, database_name: str, collection_name: str, page: int, limit: int, filter: dict = None) -> DataDocumentsResponse:
    client = MongoClient(connection_string)
    db = client[database_name]
    collection = db[collection_name]

    query = {}
    if filter and filter.get("key") and filter.get("value"):
        key = filter["key"]
        value = filter["value"]
        if key == "all":
            sample_doc = collection.find_one()
            if sample_doc:
                or_clauses = []
                for k, v in sample_doc.items():
                    if isinstance(v, str):
                        or_clauses.append({k: {"$regex": re.escape(value), "$options": "i"}})
                if or_clauses:
                    query = {"$or": or_clauses}
        else:
            # If key contains '_id', treat value as ObjectId
            if '_id' in key:
                try:
                    query = {'_id': ObjectId(value)}
                except Exception:
                    # fallback to string match if not a valid ObjectId
                    query = {key: value}
            else:
                # Support dot notation for nested fields
                query = {key: {"$regex": re.escape(value), "$options": "i"}}
    total_documents = collection.count_documents(query)
    total_pages = max(1, (total_documents + limit - 1) // limit)
    skip = (page - 1) * limit
    cursor = collection.find(query).skip(skip).limit(limit)
    documents = []
    for doc in cursor:
        doc["_id"] = str(doc["_id"])
        documents.append(doc)
    return DataDocumentsResponse(
        documents=documents,
        currentPage=page,
        totalPages=total_pages,
        totalDocuments=total_documents
    )

@cached(_find_by_id_cache)
def find_document_by_id(connection_string: str, database_name: str, collection_names:str, document_id: str, key_context: str = None) -> Tuple[Optional[dict], Optional[str]]:
    """
    Uses Gemini API to select the most likely collection for the document_id, then queries only that collection.
    Falls back to iterating if Gemini fails.
    """
    client = MongoClient(connection_string)
    db = client[database_name]
    user_input = f"Given the key context '{key_context}', which collection is most likely to contain a document with _id '{document_id}'? Return only the collection name from: {collection_names}."
    try:
        gen_code = generate_query_from_prompt(
            user_input=user_input,
            collections=collection_names,
            database=database_name
        )
        code_str = gen_code.generated_code
        likely_collection = None
        # Try to extract collection name from 'db["collection"]'
        match = re.search(r'db\["([\w-]+)"\]', code_str)
        if match:
            likely_collection = match.group(1)
        else:
            # If no db[] pattern, maybe the code is just the collection name
            likely_collection = code_str.strip()
        if likely_collection in collection_names:
            collection = db[likely_collection]
            doc = collection.find_one({'_id': ObjectId(document_id)})
            if doc:
                return doc, likely_collection
    except Exception:
        pass
    for collection_name in collection_names.split(', '):
        collection = db[collection_name]
        doc = collection.find_one({'_id': ObjectId(document_id)})
        if doc:
            return doc, collection_name
    return None, None
