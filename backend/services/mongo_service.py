import datetime as _datetime

from bson import ObjectId

SCHEMA_FETCH_FAILED = "Could not fetch schema summary."
import pymongo
from pymongo.results import (
    UpdateResult,
    InsertOneResult,
    InsertManyResult,
    DeleteResult,
)


def _iso_date(value: str) -> _datetime.datetime:
    """mongosh-style ISODate() shim.

    The LLM instinctively reaches for `ISODate("...")` (mongosh/JS syntax). The
    real executor here is Python `eval()` against PyMongo, so we provide a shim
    that turns the string into a timezone-aware datetime PyMongo understands.
    """
    return _datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))


def _build_query_scope(db):
    """Globals exposed to the eval'd query string.

    Note: queries are evaluated as a single Python *expression*, so they must
    not contain `import` statements. `datetime` is provided here so that
    `datetime.datetime(2025, 1, 1)` resolves without an import.
    """
    return {
        "db": db,
        "ObjectId": ObjectId,
        "datetime": _datetime,
        "ISODate": _iso_date,
    }


def execute_mongo_query(connection_string: str, database: str, query: str):
    client = pymongo.MongoClient(connection_string)
    db = client[database]
    try:
        # Evaluate the query string in a sandboxed scope. See _build_query_scope.
        query_result = eval(query, _build_query_scope(db))
    except Exception as e:
        # Return the exception to be handled by the endpoint
        return {"error": str(e), "exception_type": type(e).__name__}
    # Convert cursor to list if it's a cursor object
    if hasattr(query_result, "to_list"):
        return query_result.to_list()
    elif hasattr(query_result, "batch_size"):
        return list(query_result)
    else:
        return query_result


def _convert_object_ids(value):
    # Recursively stringify ObjectIds inside nested dicts/lists so FastAPI can
    # serialize $lookup-joined documents (which carry nested _id ObjectIds).
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, dict):
        return {k: _convert_object_ids(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_convert_object_ids(v) for v in value]
    return value


def transform_mongo_result(result):
    if isinstance(result, list):
        return _convert_object_ids(result)
    elif isinstance(result, dict):
        return _convert_object_ids(result)
    elif isinstance(result, InsertOneResult):
        return {"inserted_id": str(result.inserted_id)}
    elif isinstance(result, InsertManyResult):
        return {"inserted_ids": [str(_id) for _id in result.inserted_ids]}
    elif isinstance(result, UpdateResult):
        return {
            "matched_count": result.matched_count,
            "modified_count": result.modified_count,
            "upserted_id": str(result.upserted_id) if result.upserted_id else None,
        }
    elif isinstance(result, DeleteResult):
        return {"deleted_count": result.deleted_count}
    return result


def get_database_schema_summary(
    account_id: str,
    database: str,
    access_token: str,
    collection_filter: list[str] = None,
) -> str:
    from services.azure_cosmos_resources import get_connection_string

    try:
        connection_string = get_connection_string(account_id, access_token)
        client = pymongo.MongoClient(connection_string)
        db = client[database]
        summary = []

        # Determine which collections to scan
        if collection_filter:
            target_collections = collection_filter
        else:
            target_collections = db.list_collection_names()

        for collection_name in target_collections:
            # Skip system collections if scanning all (if explicit filter, try to fetch)
            if not collection_filter and collection_name.startswith("system."):
                continue

            doc = db[collection_name].find_one()
            doc_str = str(doc) if doc else "No documents found"
            summary.append(f"Collection: {collection_name}\nSample Document: {doc_str}")

        return "\n\n".join(summary)
    except Exception as e:
        print(f"Error fetching schema summary: {e}")
        return SCHEMA_FETCH_FAILED
