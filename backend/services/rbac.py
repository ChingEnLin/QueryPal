from dataclasses import dataclass, field
from os import environ as env
from typing import Callable

from fastapi import Header, HTTPException

from services.azure_auth import extract_claims_from_token

VIEWER = {"query:read", "self:manage"}
ANALYST = VIEWER | {"data:write", "argus:write"}
ADMIN = ANALYST | {"audit:read", "system:admin"}

ROLE_PERMISSIONS: dict[str, set[str]] = {
    "Viewer": VIEWER,
    "Analyst": ANALYST,
    "Admin": ADMIN,
}

# Role applied when a token carries no `roles` claim (rollout safety).
# Set RBAC_DEFAULT_ROLE="" to enforce default-deny once all users are assigned.
DEFAULT_ROLE = env.get("RBAC_DEFAULT_ROLE", "Viewer")


def resolve_permissions(roles: list[str]) -> set[str]:
    effective = roles or ([DEFAULT_ROLE] if DEFAULT_ROLE else [])
    perms: set[str] = set()
    for role in effective:
        perms |= ROLE_PERMISSIONS.get(role, set())
    return perms


@dataclass
class Caller:
    email: str
    roles: list[str] = field(default_factory=list)
    permissions: set[str] = field(default_factory=set)


def build_caller(authorization: str) -> Caller:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")
    claims = extract_claims_from_token(authorization[7:])
    if not claims.email:
        raise HTTPException(status_code=401, detail="Caller identity missing")
    return Caller(
        email=claims.email,
        roles=claims.roles,
        permissions=resolve_permissions(claims.roles),
    )


def require(permission: str) -> Callable[..., Caller]:
    def _dependency(authorization: str = Header(...)) -> Caller:
        caller = build_caller(authorization)
        if permission not in caller.permissions:
            raise HTTPException(
                status_code=403, detail=f"Requires permission: {permission}"
            )
        return caller

    return _dependency
