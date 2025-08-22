from os import environ as env
import msal
from typing import Optional

TENANT_ID = env.get("AZURE_TENANT_ID")
CLIENT_ID = env.get("AZURE_CLIENT_ID")
CLIENT_SECRET = env.get("AZURE_CLIENT_SECRET")
ARM_SCOPE = env.get("ARM_SCOPE")

_app: Optional[msal.ConfidentialClientApplication] = None


def _get_msal_app() -> msal.ConfidentialClientApplication:
    """Get or create the MSAL app instance."""
    global _app
    if _app is None:
        if not all([TENANT_ID, CLIENT_ID, CLIENT_SECRET]):
            raise ValueError("Azure credentials not properly configured")
        _app = msal.ConfidentialClientApplication(
            client_id=CLIENT_ID,
            client_credential=CLIENT_SECRET,
            authority=f"https://login.microsoftonline.com/{TENANT_ID}",
        )
    return _app


def exchange_token_obo(user_token: str) -> str:
    """Exchange user token for access token using On-Behalf-Of flow."""
    app = _get_msal_app()
    result = app.acquire_token_on_behalf_of(
        user_assertion=user_token, scopes=[ARM_SCOPE]
    )
    if "access_token" not in result:
        raise Exception(f"OBO token exchange failed: {result}")
    return result["access_token"]
