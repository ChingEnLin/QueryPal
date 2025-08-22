from cachetools import TTLCache, cached
import requests
import pymongo
import bson

# Cache with max 100 entries and 10-minute TTL
_cosmos_list_cache = TTLCache(maxsize=5, ttl=3600)
_connection_string_cache = TTLCache(maxsize=5, ttl=3600)
_database_info_cache = TTLCache(maxsize=50, ttl=3600)
_collection_info_cache = TTLCache(maxsize=100, ttl=3600)

ALL_CACHES = [
    _connection_string_cache,
    _cosmos_list_cache,
    _database_info_cache,
    _collection_info_cache,
]


@cached(_cosmos_list_cache)
def list_cosmos_resources(access_token: str):
    url = "https://management.azure.com/subscriptions?api-version=2020-01-01"
    headers = {"Authorization": f"Bearer {access_token}"}
    subs = requests.get(url, headers=headers).json()

    results = []
    for sub in subs.get("value", []):
        sub_id = sub["subscriptionId"]
        rg_url = f"https://management.azure.com/subscriptions/{sub_id}/resources?api-version=2021-04-01&$filter=resourceType eq 'Microsoft.DocumentDB/databaseAccounts'"
        accounts = requests.get(rg_url, headers=headers).json()
        for acct in accounts.get("value", []):
            results.append({"name": acct["name"], "id": acct["id"]})
    return results


@cached(_connection_string_cache)
def get_connection_string(account_id: str, access_token: str) -> str:
    url = f"https://management.azure.com/{account_id}/listConnectionStrings?api-version=2023-03-15"
    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.post(url, headers=headers, timeout=10)
    if response.status_code != 200:
        raise requests.HTTPError(
            f"Failed to fetch connection string: {response.status_code} {response.text}"
        )
    conn_data = response.json()
    return conn_data["connectionStrings"][0]["connectionString"]


@cached(_database_info_cache)
def get_cosmosdb_info_from_conn_str(connection_string: str):
    client = pymongo.MongoClient(connection_string)
    db_names = client.list_database_names()

    all_info = []
    for db_name in db_names:
        db = client[db_name]
        collection_names = db.list_collection_names()
        collections_info = []
        for name in collection_names:
            count = db[name].count_documents({})
            collections_info.append({"name": name, "count": count})

        all_info.append(
            {
                "name": db_name,
                "collections": collections_info,
                "totalDocuments": sum(c["count"] for c in collections_info),
                "size": None,  # Size not available directly
            }
        )

    return all_info


@cached(_collection_info_cache)
def get_collection_info_with_conn_str(
    connection_string: str, db_name: str, collection_name: str
):
    client = pymongo.MongoClient(connection_string)
    db = client[db_name]
    collection = db[collection_name]

    # Get stats (collstats not supported in Cosmos DB Mongo API)
    document_count = collection.estimated_document_count()
    avg_obj_size = None  # Will estimate from sample

    # Get indexes
    indexes = [index["name"] for index in collection.list_indexes()]

    # Get a sample document: sample a subset and pick the one with the most keys
    sample = {}
    max_keys = 0
    sizes = []
    # Dynamically determine sample size: up to 100 or 10% of collection, whichever is smaller
    if document_count > 0:
        sample_size = min(100, max(1, int(document_count * 0.1)))
        try:
            sample_docs = collection.aggregate([{"$sample": {"size": sample_size}}])
            for doc in sample_docs:
                sizes.append(len(bson.BSON.encode(doc)))
                num_keys = len(doc.keys())
                if num_keys > max_keys:
                    max_keys = num_keys
                    sample = doc
        except Exception:
            # Fallback: scan up to sample_size docs if $sample is not supported
            for i, doc in enumerate(collection.find({}, projection={"_id": False})):
                if i >= sample_size:
                    break
                sizes.append(len(bson.BSON.encode(doc)))
                num_keys = len(doc.keys())
                if num_keys > max_keys:
                    max_keys = num_keys
                    sample = doc
    if sizes:
        avg_obj_size = sum(sizes) / len(sizes)

    # Helper to convert binary types to Extended JSON (e.g. ObjectId, datetime)
    def convert_bson(value):
        if isinstance(value, bson.ObjectId):
            return {"$oid": str(value)}
        elif isinstance(value, (bson.Timestamp, bson.datetime.datetime)):
            return {"$date": value.isoformat() + "Z"}
        elif isinstance(value, dict):
            return {k: convert_bson(v) for k, v in value.items()}
        elif isinstance(value, list):
            return [convert_bson(v) for v in value]
        else:
            return value

    sample = convert_bson(sample)

    return {
        "name": collection_name,
        "documentCount": document_count,
        "averageDocumentSize": (
            f"{round(avg_obj_size / 1024, 2)} KB" if avg_obj_size else "N/A"
        ),
        "indexes": indexes,
        "sampleDocument": sample,
    }
