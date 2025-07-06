import pymongo

def execute_mongo_query(generated_code: str, connection_string: str):
    # DANGER ZONE: Avoid eval() in production unless sandboxed
    client = pymongo.MongoClient(connection_string)
    db = client.get_database()
    locals_dict = {"db": db}
    try:
        result = eval(generated_code, {"__builtins__": {}}, locals_dict)
        if hasattr(result, "limit"):
            return list(result.limit(10))
        return result
    except Exception as e:
        return {"error": str(e)}