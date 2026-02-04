from bson import ObjectId
import pymongo
from pymongo.results import (
    UpdateResult,
    InsertOneResult,
    InsertManyResult,
    DeleteResult,
)


def execute_mongo_query(connection_string: str, database: str, query: str):
    client = pymongo.MongoClient(connection_string)
    db = client[database]
    try:
        # Evaluate the query string in the context of the db variable and ObjectId
        query_result = eval(query, {"db": db, "ObjectId": ObjectId})
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


def transform_mongo_result(result):
    # If result is a list of dicts, convert ObjectIds
    if isinstance(result, list):
        if result and isinstance(result[0], dict):
            for doc in result:
                for k, v in doc.items():
                    if isinstance(v, ObjectId):
                        doc[k] = str(v)
            return result
        else:
            # List of primitives (e.g., from distinct)
            return result
    elif isinstance(result, dict):
        for k, v in result.items():
            if isinstance(v, ObjectId):
                result[k] = str(v)
        return result
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


def get_database_schema_summary(account_id: str, database: str, access_token: str, collection_filter: list[str] = None) -> str:
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
        return "Could not fetch schema summary."
