from os import environ as env
import msal

TENANT_ID = env.get("AZURE_TENANT_ID")
CLIENT_ID = env.get("AZURE_CLIENT_ID")
CLIENT_SECRET = env.get("AZURE_CLIENT_SECRET")
ARM_SCOPE = env.get("ARM_SCOPE")

app = msal.ConfidentialClientApplication(
    client_id=CLIENT_ID,
    client_credential=CLIENT_SECRET,
    authority=f"https://login.microsoftonline.com/{TENANT_ID}"
)

def exchange_token_obo(user_token: str) -> str:
    result = app.acquire_token_on_behalf_of(user_assertion=user_token, scopes=[ARM_SCOPE])
    if "access_token" not in result:
        raise Exception(f"OBO token exchange failed: {result}")
    return result["access_token"]