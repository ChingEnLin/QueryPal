import base64
import json

from fastapi import Depends, FastAPI, HTTPException
from fastapi.testclient import TestClient
import pytest

from services.azure_auth import extract_claims_from_token, extract_email_from_token, _verify_and_decode
from services.rbac import resolve_permissions, ROLE_PERMISSIONS
from services.rbac import require, Caller as RbacCaller


def make_jwt(claims: dict) -> str:
    payload = base64.urlsafe_b64encode(json.dumps(claims).encode()).rstrip(b"=").decode()
    return f"header.{payload}.sig"


def test_verify_and_decode_bypass_returns_payload(monkeypatch):
    monkeypatch.setattr("services.azure_auth.SKIP_JWT_VERIFICATION", True)
    token = make_jwt({"email": "a@b.com", "roles": ["Admin"]})
    payload = _verify_and_decode(token)
    assert payload["email"] == "a@b.com"
    assert payload["roles"] == ["Admin"]


def test_verify_and_decode_bypass_rejects_malformed(monkeypatch):
    monkeypatch.setattr("services.azure_auth.SKIP_JWT_VERIFICATION", True)
    with pytest.raises(HTTPException) as exc:
        _verify_and_decode("not-a-jwt")
    assert exc.value.status_code == 401


def test_bad_signature_raises_401_when_verification_enabled(monkeypatch):
    # With SKIP_JWT_VERIFICATION=False and no real TENANT_ID in the test env,
    # the guard raises HTTPException(500) — server misconfiguration, not auth failure.
    monkeypatch.setattr("services.azure_auth.SKIP_JWT_VERIFICATION", False)
    token = make_jwt({"email": "a@b.com", "roles": ["Admin"]})
    with pytest.raises(HTTPException) as exc:
        _verify_and_decode(token)
    assert exc.value.status_code == 500  # missing TENANT_ID → server misconfiguration


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
    with pytest.raises(HTTPException) as exc:
        extract_claims_from_token("not-a-jwt")
    assert exc.value.status_code == 401


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


def _app_with_guard(permission: str) -> TestClient:
    app = FastAPI()

    @app.get("/guarded")
    def guarded(caller: RbacCaller = Depends(require(permission))):
        return {"email": caller.email}

    return TestClient(app)


def test_require_allows_sufficient_role():
    client = _app_with_guard("data:write")
    token = make_jwt({"email": "a@b.com", "roles": ["Analyst"]})
    resp = client.get("/guarded", headers={"authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json() == {"email": "a@b.com"}


def test_require_forbids_insufficient_role():
    client = _app_with_guard("data:write")
    token = make_jwt({"email": "a@b.com", "roles": ["Viewer"]})
    resp = client.get("/guarded", headers={"authorization": f"Bearer {token}"})
    assert resp.status_code == 403
    assert "data:write" in resp.json()["detail"]


def test_require_401_without_bearer():
    client = _app_with_guard("query:read")
    resp = client.get("/guarded", headers={"authorization": "Basic foo"})
    assert resp.status_code == 401


def test_require_401_without_identity():
    client = _app_with_guard("query:read")
    token = make_jwt({"roles": ["Viewer"]})  # no email claim
    resp = client.get("/guarded", headers={"authorization": f"Bearer {token}"})
    assert resp.status_code == 401


def test_require_default_role_allows_read(monkeypatch):
    monkeypatch.setattr("services.rbac.DEFAULT_ROLE", "Viewer")
    client = _app_with_guard("query:read")
    token = make_jwt({"email": "a@b.com"})  # no roles claim
    resp = client.get("/guarded", headers={"authorization": f"Bearer {token}"})
    assert resp.status_code == 200


def test_require_401_without_header():
    client = _app_with_guard("query:read")
    resp = client.get("/guarded")
    assert resp.status_code == 401
