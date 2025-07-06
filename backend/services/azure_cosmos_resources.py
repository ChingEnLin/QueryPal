import requests
import pymongo

def list_cosmos_resources(access_token: str):
    """
    Lists all Azure Cosmos DB accounts across all subscriptions using the provided access token.
    Args:
        access_token (str): The Azure access token.
    Returns:
        list: A list of dictionaries containing Cosmos DB account names and IDs.
    Raises:
        requests.HTTPError: If the request to fetch subscriptions or accounts fails.
    """
    url = "https://management.azure.com/subscriptions?api-version=2020-01-01"
    headers = {"Authorization": f"Bearer {access_token}"}
    subs = requests.get(url, headers=headers).json()
    
    results = []
    for sub in subs.get("value", []):
        sub_id = sub["subscriptionId"]
        rg_url = f"https://management.azure.com/subscriptions/{sub_id}/resources?api-version=2021-04-01&$filter=resourceType eq 'Microsoft.DocumentDB/databaseAccounts'"
        accounts = requests.get(rg_url, headers=headers).json()
        for acct in accounts.get("value", []):
            results.append({
                "name": acct["name"],
                "id": acct["id"]
            })
    return results

def get_connection_string(account_id: str, access_token: str) -> str:
    url = f"https://management.azure.com/{account_id}/listConnectionStrings?api-version=2023-03-15"
    headers = {"Authorization": f"Bearer {access_token}"}
    response = requests.post(url, headers=headers, timeout=10)
    if response.status_code != 200:
        raise requests.HTTPError(f"Failed to fetch connection string: {response.status_code} {response.text}")
    conn_data = response.json()
    return conn_data["connectionStrings"][0]["connectionString"]

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

        all_info.append({
            "name": db_name,
            "collections": collections_info,
            "totalDocuments": sum(c["count"] for c in collections_info),
            "size": None  # Size not available directly
        })

    return all_info