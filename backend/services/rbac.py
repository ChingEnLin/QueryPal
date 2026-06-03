from dataclasses import dataclass, field
from os import environ as env

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
