import logging

from fastapi import APIRouter, Depends, HTTPException, Body, Response
from typing import List

logger = logging.getLogger(__name__)

from models.schemas import UserWithRoles, RoleAssignment, AssignRoleRequest
from services.pg_connection import get_connection
from services.graph_service import list_role_assignments, assign_role, remove_role
from services.rbac import require, Caller

router = APIRouter()


@router.get("/users", response_model=List[UserWithRoles])
def list_admin_users(caller: Caller = Depends(require("system:admin"))):
    conn = get_connection()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT oid, email, display_name, first_seen, last_seen FROM users ORDER BY last_seen DESC"
        )
        rows = cur.fetchall()

    assignments = list_role_assignments()

    result = []
    for row in rows:
        oid, email, display_name, first_seen, last_seen = row
        user_roles = [
            RoleAssignment(assignment_id=a["assignment_id"], role_name=a["role_name"])
            for a in assignments.get(oid, [])
        ]
        result.append(
            UserWithRoles(
                oid=oid,
                email=email,
                display_name=display_name,
                first_seen=str(first_seen),
                last_seen=str(last_seen),
                roles=user_roles,
            )
        )
    return result


@router.post("/users/{oid}/roles", status_code=201)
def add_user_role(
    oid: str,
    body: AssignRoleRequest = Body(...),
    caller: Caller = Depends(require("system:admin")),
):
    conn = get_connection()
    with conn.cursor() as cur:
        cur.execute("SELECT oid FROM users WHERE oid = %s", (oid,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="User not found")

    logger.info("role_assigned by=%s target=%s role=%s", caller.oid, oid, body.role)
    assignment = assign_role(user_oid=oid, role_name=body.role)
    return assignment


@router.delete("/users/{oid}/roles/{assignment_id}", status_code=204)
def delete_user_role(
    oid: str,
    assignment_id: str,
    caller: Caller = Depends(require("system:admin")),
):
    logger.info("role_removed by=%s assignment=%s", caller.oid, assignment_id)
    remove_role(assignment_id=assignment_id)
    return Response(status_code=204)
