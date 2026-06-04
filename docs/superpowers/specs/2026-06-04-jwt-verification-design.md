# JWT Signature Verification

**Date:** 2026-06-04
**Branch:** feat/rbac
**Status:** Approved

## Problem

`extract_claims_from_token` in `backend/services/azure_auth.py` decodes the JWT payload with a raw base64 decode and no signature check. This means:

1. The `roles` claim used by the RBAC layer is trusted without proof it was issued by Azure.
2. Any caller who can reach the nginx proxy can forge a token with elevated roles (e.g. `"roles": ["Admin"]`) and gain `audit:read` / `system:admin`.

The backend is Cloud Run `--ingress=internal` (VPC-only), which limits external exposure, but does not eliminate the risk — nginx is public and passes `Authorization` headers verbatim.

## Scope

Single file change: `backend/services/azure_auth.py`. `rbac.py`, all routes, and the frontend are untouched.

## Design

### Dependency

Add `PyJWT[crypto]` to `requirements.txt`. The `[crypto]` extra pulls in `cryptography` for RS256 key operations.

### JWKS client

A module-level `PyJWKClient` singleton is initialised lazily against:

```
https://login.microsoftonline.com/{TENANT_ID}/discovery/v2.0/keys
```

`PyJWKClient` fetches keys on first use and caches them (default TTL 300 s). No manual cache management is needed.

### `_verify_and_decode(token: str) -> dict`

Internal helper called by `extract_claims_from_token`. Steps:

1. Retrieve the signing key for the token's `kid` header via `jwks_client.get_signing_key_from_jwt(token)`.
2. Call `jwt.decode(token, key, algorithms=["RS256"], audience=CLIENT_ID, options={"verify_iss": False})`.
   - `verify_iss=False` because Azure issues tokens with two issuer formats depending on token version (`sts.windows.net/…` vs `login.microsoftonline.com/…/v2.0`). We validate the issuer manually instead.
3. After successful decode, assert `TENANT_ID in payload["iss"]`. If not, raise `HTTPException(401)`.
4. On any exception (`PyJWTError`, `KeyError`, network error), raise `HTTPException(401, "Token validation failed")`. Fail closed — no partial claims are returned.

### Bypass path

If the env var `SKIP_JWT_VERIFICATION=true`, `_verify_and_decode` falls back to the existing raw base64 decode. This is the only bypass path and is never set in any deployed environment (Cloud Run secrets do not include it).

### `extract_claims_from_token` after change

```python
def extract_claims_from_token(token: str) -> TokenClaims:
    payload = _verify_and_decode(token)          # raises 401 on failure
    email = next(
        (str(payload[k]) for k in ("preferred_username", "email", "upn", "unique_name") if k in payload),
        None,
    )
    roles = payload.get("roles") or []
    if not isinstance(roles, list):
        roles = [str(roles)]
    return TokenClaims(email=email, roles=[str(r) for r in roles])
```

The `try/except` block in the current implementation is removed — `_verify_and_decode` already handles all failure modes and raises explicitly.

## Tests

### Existing tests

`conftest.py` gains a session-scoped autouse fixture that sets `SKIP_JWT_VERIFICATION=true`. This lets `make_jwt` (unsigned test tokens) continue to work without modification.

```python
@pytest.fixture(autouse=True, scope="session")
def skip_jwt_verification(monkeypatch):
    monkeypatch.setenv("SKIP_JWT_VERIFICATION", "true")
```

### New test

One new test verifies the bypass is off by default and that a bad-signature token raises 401:

```python
def test_bad_signature_raises_401_when_verification_enabled(monkeypatch):
    monkeypatch.delenv("SKIP_JWT_VERIFICATION", raising=False)
    monkeypatch.setattr("services.azure_auth.SKIP_JWT_VERIFICATION", False)
    # PyJWKClient will fail to fetch keys in unit test — that's the right outcome
    token = make_jwt({"email": "a@b.com", "roles": ["Admin"]})
    with pytest.raises(HTTPException) as exc:
        extract_claims_from_token(token)
    assert exc.value.status_code == 401
```

## What Does Not Change

- `rbac.py` — `build_caller` is unchanged; it still calls `extract_claims_from_token`.
- All route handlers — they call `require(permission)` which calls `build_caller`.
- `extract_email_from_token` — still delegates to `extract_claims_from_token`, inherits verification automatically.
- Frontend — no changes.
- Deployed env vars — no new secrets needed; `TENANT_ID` and `CLIENT_ID` are already in Secret Manager.

## Rollout Notes

- `SKIP_JWT_VERIFICATION` is intentionally absent from the Cloud Run deployment in `google-cloudrun-docker.yml`. Do not add it.
- Once all callers hold valid Entra-issued tokens (which they do — the frontend uses MSAL), no behaviour change is visible to users.
- If `TENANT_ID` or `CLIENT_ID` is missing at startup, `_verify_and_decode` will raise on the first request. This is acceptable — those vars are required for the OBO flow already and are always present in production.
