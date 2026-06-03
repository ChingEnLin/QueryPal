import base64
import json

from services.azure_auth import extract_claims_from_token, extract_email_from_token
from services.rbac import resolve_permissions, ROLE_PERMISSIONS


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


def test_viewer_permissions():
    assert resolve_permissions(["Viewer"]) == {"query:read", "self:manage"}


def test_analyst_includes_viewer_plus_writes():
    perms = resolve_permissions(["Analyst"])
    assert {"query:read", "self:manage", "data:write", "argus:write"} <= perms
    assert "audit:read" not in perms


def test_admin_has_everything():
    perms = resolve_permissions(["Admin"])
    assert "audit:read" in perms
    assert "system:admin" in perms
    assert "data:write" in perms


def test_unknown_role_grants_nothing():
    assert resolve_permissions(["Nonsense"]) == set()


def test_empty_roles_use_default(monkeypatch):
    monkeypatch.setattr("services.rbac.DEFAULT_ROLE", "Viewer")
    assert resolve_permissions([]) == {"query:read", "self:manage"}


def test_empty_default_grants_nothing(monkeypatch):
    monkeypatch.setattr("services.rbac.DEFAULT_ROLE", "")
    assert resolve_permissions([]) == set()
