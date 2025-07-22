from pymongo import MongoClient
from models.data_documents import DataDocumentsRequest, DataDocumentsResponse
from services.azure_cosmos_resources import get_connection_string
from bson import ObjectId
import re

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
