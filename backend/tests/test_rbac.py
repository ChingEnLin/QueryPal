import base64
import json

from services.azure_auth import extract_claims_from_token, extract_email_from_token


def make_jwt(claims: dict) -> str:
    payload = base64.urlsafe_b64encode(json.dumps(claims).encode()).rstrip(b"=").decode()
    return f"header.{payload}.sig"


def test_extract_claims_reads_email_and_roles():
    token = make_jwt({"preferred_username": "a@b.com", "roles": ["Analyst"]})
    claims = extract_claims_from_token(token)
    assert claims.email == "a@b.com"
    assert claims.roles == ["Analyst"]


def test_extract_claims_missing_roles_defaults_empty():
    token = make_jwt({"email": "a@b.com"})
    claims = extract_claims_from_token(token)
    assert claims.email == "a@b.com"
    assert claims.roles == []


def test_extract_email_from_token_still_works():
    token = make_jwt({"upn": "c@d.com"})
    assert extract_email_from_token(token) == "c@d.com"


def test_extract_claims_malformed_token():
    claims = extract_claims_from_token("not-a-jwt")
    assert claims.email is None
    assert claims.roles == []
