import base64
import json
from dataclasses import dataclass, field
from os import environ as env
import msal
from typing import Optional
import jwt
from jwt import PyJWKClient, PyJWTError
from fastapi import HTTPException

TENANT_ID = env.get("AZURE_TENANT_ID")
CLIENT_ID = env.get("AZURE_CLIENT_ID")
CLIENT_SECRET = env.get("AZURE_CLIENT_SECRET")
ARM_SCOPE = env.get("ARM_SCOPE")

SKIP_JWT_VERIFICATION: bool = env.get("SKIP_JWT_VERIFICATION", "").lower() == "true"

_jwks_client: Optional[PyJWKClient] = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        if not TENANT_ID:
            raise ValueError("AZURE_TENANT_ID not configured")
        _jwks_client = PyJWKClient(
            f"https://login.microsoftonline.com/{TENANT_ID}/discovery/v2.0/keys"
        )
    return _jwks_client


def _verify_and_decode(token: str) -> dict:
    """Verify JWT signature and return the decoded payload.

    When SKIP_JWT_VERIFICATION is True (dev/test), falls back to raw base64
    decode without signature check. In all other cases, verifies the RS256
    signature against Azure's JWKS and validates audience + tenant.
    Raises HTTPException(401) on all failures (auth or misconfiguration) —
    never returns partial data.
    """
    if SKIP_JWT_VERIFICATION:
        parts = token.split(".")
        if len(parts) < 2:
            raise HTTPException(status_code=401, detail="Invalid token format")
        try:
            padding = "=" * (-len(parts[1]) % 4)
            return json.loads(base64.urlsafe_b64decode(parts[1] + padding))
        except Exception:
            raise HTTPException(status_code=401, detail="Token validation failed")

    if not TENANT_ID:
        raise HTTPException(status_code=401, detail="Token validation failed")
    if not CLIENT_ID:
        raise HTTPException(status_code=401, detail="Token validation failed")

    try:
        client = _get_jwks_client()
        signing_key = client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=CLIENT_ID,
            options={"verify_iss": False},
        )
        if TENANT_ID not in payload.get("iss", ""):
            raise HTTPException(status_code=401, detail="Token issuer invalid")
        return payload
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Token validation failed")


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


@dataclass
class TokenClaims:
    email: Optional[str] = None
    roles: list[str] = field(default_factory=list)


def extract_claims_from_token(token: str) -> TokenClaims:
    """Verify JWT signature then extract caller email and Entra App Roles.

    Raises HTTPException(401) if the token is invalid or signature fails.
    """
    payload = _verify_and_decode(token)
    email = next(
        (
            str(payload[k])
            for k in ("preferred_username", "email", "upn", "unique_name")
            if k in payload
        ),
        None,
    )
    roles = payload.get("roles") or []
    if not isinstance(roles, list):
        roles = [str(roles)]
    return TokenClaims(email=email, roles=[str(r) for r in roles])


def extract_email_from_token(token: str) -> Optional[str]:
    """Backward-compatible helper returning just the caller email."""
    return extract_claims_from_token(token).email
