from typing import Tuple, Optional
from pymongo import MongoClient
from bson import ObjectId
import re
import json
from cachetools import TTLCache, cached
from datetime import datetime, timezone
from models.data_documents import DataDocumentsResponse
from services.gemini_service import generate_query_from_prompt
from services.pg_connection import get_connection

# Caches: 10 min TTL, 100 max entries
_find_by_id_cache = TTLCache(maxsize=100, ttl=600)

ALL_DOCUMENTS_CACHES = [_find_by_id_cache]


def dict_diff(before, after):
    """
    Return a dict with only the changed keys and their new values (for update), or the full doc for insert/delete.
    """
    if before is None:
        return after
    if after is None:
        return before
    diff = {}
    for k in set(before.keys()).union(after.keys()):
        if before.get(k) != after.get(k):
            diff[k] = {"before": before.get(k), "after": after.get(k)}
    return diff


def log_write_operation(
    user_email: str,
    operation: str,
    database_name: str,
    collection_name: str,
    document_id: str = None,
    before_data: dict = None,
    after_data: dict = None,
):
    try:
        conn = get_connection()
        cur = conn.cursor()
        if operation == "update":
            diff_data = dict_diff(before_data, after_data)
        elif operation == "insert":
            diff_data = after_data
        elif operation == "delete":
            diff_data = before_data
        else:
            diff_data = None
        cur.execute(
            """
            INSERT INTO write_audit_log (
                user_email, operation, database_name, collection_name, document_id, diff_data, timestamp_utc
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
            (
                user_email,
                operation,
                database_name,
                collection_name,
                document_id,
                json_dumps_safe(diff_data),
                datetime.now(timezone.utc),
            ),
        )
        conn.commit()
        cur.close()
        conn.close()
    except Exception:
        pass


def json_dumps_safe(obj):
    import json

    try:
        return json.dumps(obj, default=str)
    except Exception:
        return None


def fetch_documents(
    connection_string: str,
    database_name: str,
    collection_name: str,
    page: int,
    limit: int,
    filter: dict = None,
) -> DataDocumentsResponse:
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
                        or_clauses.append(
                            {k: {"$regex": re.escape(value), "$options": "i"}}
                        )
                if or_clauses:
                    query = {"$or": or_clauses}
        else:
            # If key is '_id', treat value as ObjectId
            if key == "_id":
                try:
                    query = {"_id": ObjectId(value)}
                except Exception:
                    # fallback to string match if not a valid ObjectId
                    query = {key: value}
            else:
                # Support dot notation for nested fields
                if isinstance(value, str):
                    query = {key: {"$regex": re.escape(value), "$options": "i"}}
                else:
                    query = {key: value}
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
        totalDocuments=total_documents,
    )


@cached(_find_by_id_cache)
def find_document_by_id(
    connection_string: str,
    database_name: str,
    collection_names: str,
    document_id: str,
    key_context: str = None,
) -> Tuple[Optional[dict], Optional[str]]:
    """
    Uses Gemini API to select the most likely collection for the document_id, then queries only that collection.
    Falls back to iterating if Gemini fails.
    """
    client = MongoClient(connection_string)
    db = client[database_name]
    user_input = f"Given the key context '{key_context}', which collection is most likely to contain a document with _id '{document_id}'? Return only the collection name from: {collection_names}."
    try:
        gen_code = generate_query_from_prompt(
            user_input=user_input, collections=collection_names, database=database_name
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
            doc = collection.find_one({"_id": ObjectId(document_id)})
            if doc:
                return doc, likely_collection
    except Exception:
        pass
    for collection_name in collection_names.split(", "):
        collection = db[collection_name]
        doc = collection.find_one({"_id": ObjectId(document_id)})
        if doc:
            return doc, collection_name
    return None, None


def update_document(
    connection_string: str,
    database_name: str,
    collection_name: str,
    document_id: str,
    content: dict,
    user_email: str = "unknown",
) -> dict:
    client = MongoClient(connection_string)
    db = client[database_name]
    collection = db[collection_name]
    # Try to update the document by _id
    try:
        content.pop("_id", None)  # Remove _id if present in content
        # Convert ISO string datetimes to Python datetime objects
        for key in ["datetime_creation", "datetime_last_modified"]:
            if key in content and isinstance(content[key], str):
                try:
                    # Accept both with and without microseconds
                    content[key] = datetime.fromisoformat(
                        content[key].replace("Z", "+00:00")
                    )
                except Exception:
                    pass
        before_doc = collection.find_one({"_id": ObjectId(document_id)})
        result = collection.update_one(
            {"_id": ObjectId(document_id)}, {"$set": content}
        )
        if result.matched_count == 0:
            return None
        updated_doc = collection.find_one({"_id": ObjectId(document_id)})
        if updated_doc:
            updated_doc["_id"] = ObjectId(updated_doc["_id"])
        # Construct account name + database name for logging
        # Extract account name from connection string (e.g., "mongodb+srv://<account_name>@...")
        match = re.search(r"//([^:@]+)", connection_string)
        account_name = match.group(1) if match else "unknown"
        account_database = f"{account_name}.{database_name}"
        log_write_operation(
            user_email=user_email,
            operation="update",
            database_name=account_database,
            collection_name=collection_name,
            document_id=str(document_id),
            before_data=before_doc,
            after_data=updated_doc,
        )
        return updated_doc
    except Exception:
        return None


def get_single_document(
    connection_string: str, database_name: str, collection_name: str, document_id: str
) -> dict:
    client = MongoClient(connection_string)
    db = client[database_name]
    collection = db[collection_name]
    try:
        doc = collection.find_one({"_id": ObjectId(document_id)})
        return doc
    except Exception:
        return None


def insert_document(
    connection_string: str,
    database_name: str,
    collection_name: str,
    document: dict,
    user_email: str = "unknown",
) -> dict:
    client = MongoClient(connection_string)
    db = client[database_name]
    collection = db[collection_name]
    # Remove _id if present (let Mongo assign)
    document.pop("_id", None)
    # Assign or update datetime creation and last modified
    document["datetime_creation"] = datetime.now(timezone.utc)
    document["datetime_last_modified"] = datetime.now(timezone.utc)
    try:
        result = collection.insert_one(document)
        inserted_doc = collection.find_one({"_id": result.inserted_id})
        match = re.search(r"//([^:@]+)", connection_string)
        account_name = match.group(1) if match else "unknown"
        account_database = f"{account_name}.{database_name}"
        # Log the insert
        log_write_operation(
            user_email=user_email,
            operation="insert",
            database_name=account_database,
            collection_name=collection_name,
            document_id=(
                str(inserted_doc["_id"])
                if inserted_doc and "_id" in inserted_doc
                else None
            ),
            before_data=None,
            after_data=inserted_doc,
        )
        return inserted_doc
    except Exception:
        return None


def delete_document(
    connection_string: str,
    database_name: str,
    collection_name: str,
    document_id: str,
    user_email: str = "unknown",
) -> bool:
    client = MongoClient(connection_string)
    db = client[database_name]
    collection = db[collection_name]
    try:
        before_doc = collection.find_one({"_id": ObjectId(document_id)})
        result = collection.delete_one({"_id": ObjectId(document_id)})
        deleted = result.deleted_count > 0
        match = re.search(r"//([^:@]+)", connection_string)
        account_name = match.group(1) if match else "unknown"
        account_database = f"{account_name}.{database_name}"
        # Log the delete
        if deleted:
            log_write_operation(
                user_email=user_email,
                operation="delete",
                database_name=account_database,
                collection_name=collection_name,
                document_id=str(document_id),
                before_data=before_doc,
                after_data=None,
            )
        return deleted
    except Exception:
        return False


def get_document_history(
    database_name: str, collection_name: str, document_id: str, limit: int = 50
) -> tuple:
    """
    Retrieves the audit history for a specific document from the write_audit_log table.

    Args:
        database_name: The database name as stored in the audit log (format: account.database)
        collection_name: The collection name
        document_id: The document ID to get history for
        limit: Maximum number of history entries to return (default 50)

    Returns:
        tuple: (history_entries, total_count)
    """
    try:
        conn = get_connection()
        cur = conn.cursor()

        # Query to get document history ordered by timestamp (newest first)
        cur.execute(
            """
            SELECT user_email, operation, timestamp_utc, diff_data, database_name, collection_name
            FROM write_audit_log
            WHERE database_name = %s AND collection_name = %s AND document_id = %s
            ORDER BY timestamp_utc DESC
            LIMIT %s
        """,
            (database_name, collection_name, document_id, limit),
        )

        history_entries = []
        for row in cur.fetchall():
            user_email, operation, timestamp_utc, diff_data_json, db_name, coll_name = (
                row
            )

            # Generate a unique ID for this entry (using timestamp and operation)
            diff_data_str = (
                json.dumps(diff_data_json, sort_keys=True)
                if isinstance(diff_data_json, dict)
                else str(diff_data_json or "")
            )
            entry_id = f"{timestamp_utc.isoformat()}_{operation}_{hash(diff_data_str)}"

            history_entries.append(
                {
                    "id": entry_id,
                    "user_email": user_email,
                    "operation": operation,
                    "timestamp_utc": timestamp_utc.isoformat(),
                    "diff_data": diff_data_json,
                    "database_name": db_name,
                    "collection_name": coll_name,
                }
            )

        # Get total count for this document
        cur.execute(
            """
            SELECT COUNT(*) FROM write_audit_log
            WHERE database_name = %s AND collection_name = %s AND document_id = %s
        """,
            (database_name, collection_name, document_id),
        )

        total_count = cur.fetchone()[0]

        cur.close()
        conn.close()

        return history_entries, total_count

    except Exception as e:
        print(f"Error retrieving document history: {e}")
        return [], 0
