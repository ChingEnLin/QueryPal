from bson import ObjectId
import pymongo

def execute_mongo_query(connection_string: str, database: str, query: str):
    client = pymongo.MongoClient(connection_string)
    db = client[database]
    # Evaluate the query string in the context of the db variable
    query_result = eval(query, {"db": db})
    # Convert cursor to list if it's a cursor object
    if hasattr(query_result, 'to_list'):
        return query_result.to_list()
    elif hasattr(query_result, 'batch_size'):
        return list(query_result)
    else:
        return query_result

def transform_mongo_result(result):
    if isinstance(result, list):
        for doc in result:
            for k, v in doc.items():
                if isinstance(v, ObjectId):
                    doc[k] = str(v)
    elif isinstance(result, dict):
        for k, v in result.items():
            if isinstance(v, ObjectId):
                result[k] = str(v)
    return result
