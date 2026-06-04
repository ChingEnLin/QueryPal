# QueryPal RBAC Design

**Date:** 2026-06-03
**Status:** Approved (pending spec review)

## Goal

Add role-based access control to QueryPal so that authenticated users are
restricted to the operations appropriate for their role. Three roles:
**Admin**, **Analyst**, **Viewer**.

## Design Principles

1. **Entra ID owns identity → role assignment.** Roles are defined as Entra
   **App Roles** in the app registration and assigned to users/groups in the
   portal. The role arrives in the JWT as a `roles` claim.
2. **QueryPal owns role → permission mapping.** A static permission map lives
   in `backend/services/rbac.py`. Roles are coarse; permissions are the
   fine-grained capabilities the code enforces.
3. **Backend is the source of truth.** Every gate is enforced server-side.
   Frontend role-gating is cosmetic UX only and is never relied upon for
   security.
4. **Reuse the existing enforcement chokepoint.** Today every protected route
   calls `_require_caller_email(authorization)` (in `routes/argus.py`) which
   decodes the JWT and extracts the caller email. RBAC extends this same path
   to also read roles and check a required permission.

## Architecture

```
JWT (roles claim)  ──►  extract_claims_from_token()  ──►  Caller{email, roles, permissions}
                                                              │
                                          require("data:write") FastAPI dependency
                                                              │
                                              200 (allowed) / 403 (under-privileged) / 401 (no identity)
```

- **Entra App Roles**: `Admin`, `Analyst`, `Viewer` defined in the app
  registration manifest. Token carries e.g. `"roles": ["Analyst"]`.
- **`backend/services/azure_auth.py`**: existing `extract_email_from_token`
  performs an *unsigned* base64url decode of the JWT payload (signature already
  validated by Azure during the OBO exchange). Add
  `extract_claims_from_token(jwt) -> TokenClaims{email, roles}` that extends the
  same decode to also read the `roles` claim. `extract_email_from_token`
  delegates to it for backward compatibility.
- **`backend/services/rbac.py`** (new):
  - `ROLE_PERMISSIONS: dict[str, set[str]]` — role → permission set.
  - `Caller` dataclass: `email: str`, `roles: list[str]`, `permissions: set[str]`.
  - `require(permission: str)` — FastAPI dependency factory. Reads the
    `Authorization` header, builds the `Caller`, raises 401 if no identity,
    403 if the permission is absent, otherwise returns the `Caller`.
- **Routes**: replace `email = _require_caller_email(authorization)` with
  `caller: Caller = Depends(require("<permission>"))` and use `caller.email`.

## Permission Matrix

| Permission     | Viewer | Analyst | Admin | Endpoints gated |
|----------------|:------:|:-------:|:-----:|-----------------|
| `query:read`   |   ✓    |    ✓    |   ✓   | `query/nl2query`, `query/execute` (reads), `query/analyze`, `query/debug`, `query/infer-relationships`, `query/models`, `azure/cosmos_accounts`, `azure/account_details`, `azure/collection_info`, `data_documents/documents`, `query_code`, `find_by_id`, `document`, `document_history`, `argus/runs`, `argus/runs/{id}`, `argus/runs/{id}/events`, `argus/reports/{id}` |
| `data:write`   |   –    |    ✓    |   ✓   | `data_documents/insert_document`, `delete_document`, PUT `data_documents/documents`, `query/evaluate-write` |
| `argus:write`  |   –    |    ✓    |   ✓   | `argus/run`, `argus/findings/{report}/{finding}/rate`, POST `argus/profiles`, DELETE `argus/profiles/{id}` |
| `self:manage`  |   ✓    |    ✓    |   ✓   | `user_queries` GET/POST/PUT/DELETE, `argus/profiles` GET (data is always scoped to caller email) |
| `audit:read`   |   –    |    –    |   ✓   | `audit/query`, `audit/recent` |
| `system:admin` |   –    |    –    |   ✓   | `system/clear_cache`, `system/clear_documents_cache` |

Role → permission sets:

- **Viewer**: `{query:read, self:manage}`
- **Analyst**: Viewer + `{data:write, argus:write}`
- **Admin**: Analyst + `{audit:read, system:admin}`

Notes:
- `query/execute` is gated by `query:read`. Mutating operations go through the
  dedicated write endpoints (`insert_document`, `delete_document`, PUT
  `documents`) and `evaluate-write`, which are gated by `data:write`. This keeps
  the read/write split aligned with existing write-evaluation guardrails.
- `self:manage` endpoints already scope their data to the caller's email, so the
  permission only asserts "is an authenticated user".

## Authentication Semantics

- **401 Unauthorized**: `Authorization` header missing/malformed, or no caller
  identity (email) in the token. Detail: existing messages preserved
  ("Invalid token format", "Caller identity missing").
- **403 Forbidden**: valid identity but the required permission is absent.
  Detail: `"Requires permission: <permission>"`.

## Rollout Safety

- Env var `RBAC_DEFAULT_ROLE` (default `Analyst`). When a token has **no** `roles`
  claim — i.e. before users have been assigned App Roles in the portal — the
  caller is treated as having the default role rather than being locked out.
- The `Analyst` default grants read **and** write (`data:write`, `argus:write`)
  but never `audit:read` or `system:admin` — those always require an explicit
  Admin assignment.
- This lets the code ship before portal role assignment is complete without
  breaking existing write workflows. Once all users are assigned,
  `RBAC_DEFAULT_ROLE` can be lowered to `Viewer` or set to empty to enforce
  default-deny.

## Frontend Changes

- Read roles from the MSAL account's ID-token claims (`account.idTokenClaims.roles`)
  — no extra network call.
- A small `useRoles()` hook / permission helper exposing `can(permission)`.
- Apply gates:
  - Hide the **Audit** nav item for non-admins.
  - Disable write buttons (insert / delete / save-write) for Viewers.
  - Hide the argus **Run** action for Viewers.
- All gates are cosmetic; the backend independently enforces every one.

## Testing

- Unit tests for `ROLE_PERMISSIONS` resolution (each role resolves to the
  expected permission set).
- Unit tests for the `require()` dependency:
  - 200 when the caller has the permission.
  - 403 when the caller lacks it.
  - 401 when no identity.
  - Default-role fallback when the token has no `roles` claim.
- Update existing argus test fixtures to include a `roles` claim.

## Out of Scope

- Per-resource / per-row sharing.
- Self-service role assignment inside QueryPal (roles are managed in Entra).
- Custom roles beyond the three defined here (additive later if needed).
