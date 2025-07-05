import requests

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
            results.append({
                "name": acct["name"],
                "id": acct["id"],
                "location": acct.get("location"),
                "subscriptionId": sub_id
            })
    return results