from pymongo import MongoClient
from models.data_documents import DataDocumentsRequest, DataDocumentsResponse
from services.azure_cosmos_resources import get_connection_string
from bson import ObjectId
import re

def fetch_documents(connection_string: str, database_name: str, collection_name: str, page: int, limit: int, search_term: str) -> DataDocumentsResponse:
    client = MongoClient(connection_string)
    db = client[database_name]
    collection = db[collection_name]

    query = {}
    if search_term:
        # Search across all string fields in the first document
        sample_doc = collection.find_one()
        if sample_doc:
            or_clauses = []
            for k, v in sample_doc.items():
                if isinstance(v, str):
                    or_clauses.append({k: {"$regex": re.escape(search_term), "$options": "i"}})
            if or_clauses:
                query = {"$or": or_clauses}
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
