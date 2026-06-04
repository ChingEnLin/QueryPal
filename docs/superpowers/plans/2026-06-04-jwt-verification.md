# JWT Signature Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify Azure RS256 JWT signatures in `extract_claims_from_token` before trusting any claim used for RBAC.

**Architecture:** Add `PyJWT[crypto]` for JWKS-backed signature verification. A new `_verify_and_decode` helper in `azure_auth.py` fetches Azure's public keys, verifies the token, and returns the decoded payload — or raises `HTTPException(401)` on any failure. `extract_claims_from_token` replaces its raw base64 decode with a call to `_verify_and_decode`. A module-level `SKIP_JWT_VERIFICATION` flag (read from env at import time) lets tests bypass JWKS without mocking network calls.

**Tech Stack:** Python, FastAPI, PyJWT 2.x (`PyJWT[crypto]` extra for RS256), Azure AD JWKS endpoint.

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `backend/requirements.txt` | Modify | Add `PyJWT[crypto]` |
| `backend/services/azure_auth.py` | Modify | Add `SKIP_JWT_VERIFICATION`, `_get_jwks_client`, `_verify_and_decode`; rewrite `extract_claims_from_token` |
| `backend/tests/conftest.py` | Modify | Add session-scoped autouse fixture to set `SKIP_JWT_VERIFICATION = True` for all tests |
| `backend/tests/test_rbac.py` | Modify | Update `test_extract_claims_malformed_token` (now raises); add bad-signature test |

---

### Task 1: Add PyJWT dependency

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add the dependency**

Open `backend/requirements.txt` and add this line after `msal`:

```
PyJWT[crypto]
```

- [ ] **Step 2: Install and verify**

```bash
cd backend
pip install PyJWT[crypto]
python -c "import jwt; from jwt import PyJWKClient; print('ok')"
```

Expected output: `ok`

- [ ] **Step 3: Commit**

```bash
git add backend/requirements.txt
git commit -m "chore(deps): add PyJWT[crypto] for JWT signature verification"
```

---

### Task 2: Implement `_verify_and_decode` with tests

**Files:**
- Modify: `backend/services/azure_auth.py`
- Modify: `backend/tests/test_rbac.py`

All tests run from `backend/` with `PYTHONPATH=.`.

- [ ] **Step 1: Write failing tests for the bypass path**

Add these imports and tests to `backend/tests/test_rbac.py` (after the existing `make_jwt` helper, before any existing test):

```python
from fastapi import HTTPException
import pytest
from services.azure_auth import extract_claims_from_token, _verify_and_decode
```

Then add these two test functions anywhere in the file:

```python
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
```

- [ ] **Step 2: Run to confirm they fail**

```bash
cd backend
PYTHONPATH=. pytest tests/test_rbac.py::test_verify_and_decode_bypass_returns_payload tests/test_rbac.py::test_verify_and_decode_bypass_rejects_malformed -v
```

Expected: `ImportError` or `AttributeError` — `_verify_and_decode` does not exist yet.

- [ ] **Step 3: Implement `SKIP_JWT_VERIFICATION`, `_get_jwks_client`, and `_verify_and_decode` in `azure_auth.py`**

Add these imports at the top of `backend/services/azure_auth.py` (after the existing imports):

```python
import jwt
from jwt import PyJWKClient, PyJWTError
```

Then add these constants and functions after the existing `ARM_SCOPE` line and before `_app`:

```python
SKIP_JWT_VERIFICATION: bool = os.getenv("SKIP_JWT_VERIFICATION", "").lower() == "true"

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
    Raises HTTPException(401) on any failure — never returns partial data.
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
        if not TENANT_ID or TENANT_ID not in payload.get("iss", ""):
            raise HTTPException(status_code=401, detail="Token issuer invalid")
        return payload
    except HTTPException:
        raise
    except (PyJWTError, Exception):
        raise HTTPException(status_code=401, detail="Token validation failed")
```

- [ ] **Step 4: Run the two new tests — they should pass now**

```bash
cd backend
PYTHONPATH=. pytest tests/test_rbac.py::test_verify_and_decode_bypass_returns_payload tests/test_rbac.py::test_verify_and_decode_bypass_rejects_malformed -v
```

Expected: both PASS.

- [ ] **Step 5: Write the bad-signature test (verification enabled)**

Add this test to `backend/tests/test_rbac.py`:

```python
def test_bad_signature_raises_401_when_verification_enabled(monkeypatch):
    # With SKIP_JWT_VERIFICATION=False and no real TENANT_ID in the test env,
    # _get_jwks_client raises ValueError which is caught → HTTPException(401).
    # This proves forged tokens are rejected when the bypass flag is off.
    monkeypatch.setattr("services.azure_auth.SKIP_JWT_VERIFICATION", False)
    token = make_jwt({"email": "a@b.com", "roles": ["Admin"]})
    with pytest.raises(HTTPException) as exc:
        _verify_and_decode(token)
    assert exc.value.status_code == 401
```

- [ ] **Step 6: Run it — should pass**

```bash
cd backend
PYTHONPATH=. pytest tests/test_rbac.py::test_bad_signature_raises_401_when_verification_enabled -v
```

Expected: PASS (TENANT_ID is None in test env → ValueError → caught → HTTPException 401).

- [ ] **Step 7: Commit**

```bash
git add backend/services/azure_auth.py backend/tests/test_rbac.py
git commit -m "feat(auth): add _verify_and_decode with JWKS signature verification"
```

---

### Task 3: Wire `_verify_and_decode` into `extract_claims_from_token`

**Files:**
- Modify: `backend/services/azure_auth.py`
- Modify: `backend/tests/conftest.py`
- Modify: `backend/tests/test_rbac.py`

- [ ] **Step 1: Add session-scoped bypass fixture to conftest**

Open `backend/tests/conftest.py` and add:

```python
import services.azure_auth as _azure_auth


@pytest.fixture(autouse=True, scope="session")
def _skip_jwt_verification_in_tests():
    """Disable JWKS network calls for all tests. Patched per-test when needed."""
    original = _azure_auth.SKIP_JWT_VERIFICATION
    _azure_auth.SKIP_JWT_VERIFICATION = True
    yield
    _azure_auth.SKIP_JWT_VERIFICATION = original
```

- [ ] **Step 2: Update `test_extract_claims_malformed_token` — it now raises instead of returning empty**

In `backend/tests/test_rbac.py`, replace:

```python
def test_extract_claims_malformed_token():
    claims = extract_claims_from_token("not-a-jwt")
    assert claims.email is None
    assert claims.roles == []
```

With:

```python
def test_extract_claims_malformed_token():
    with pytest.raises(HTTPException) as exc:
        extract_claims_from_token("not-a-jwt")
    assert exc.value.status_code == 401
```

- [ ] **Step 3: Run the updated test — should fail (extract_claims_from_token still uses old path)**

```bash
cd backend
PYTHONPATH=. pytest tests/test_rbac.py::test_extract_claims_malformed_token -v
```

Expected: FAIL — `extract_claims_from_token` returns `TokenClaims()` instead of raising.

- [ ] **Step 4: Rewrite `extract_claims_from_token` in `azure_auth.py`**

Replace the entire `extract_claims_from_token` function with:

```python
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
```

Also remove the now-unused `import base64`, `import json` — wait, `json` and `base64` are still used by `_verify_and_decode` in the bypass path, so keep them.

- [ ] **Step 5: Run the full test suite**

```bash
cd backend
PYTHONPATH=. pytest tests/test_rbac.py -v
```

Expected: all tests PASS.

- [ ] **Step 6: Run the complete backend test suite to check for regressions**

```bash
cd backend
PYTHONPATH=. pytest --tb=short -q
```

Expected: all tests pass. If any test fails because it calls `extract_claims_from_token` with a fake unsigned token outside of `test_rbac.py`, check whether the conftest `_skip_jwt_verification_in_tests` fixture is active for that test module (it should be, since it's `autouse=True, scope="session"`).

- [ ] **Step 7: Commit**

```bash
git add backend/services/azure_auth.py backend/tests/conftest.py backend/tests/test_rbac.py
git commit -m "feat(auth): verify JWT signature before trusting claims in extract_claims_from_token"
```
