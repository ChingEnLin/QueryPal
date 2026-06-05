import logging
from os import environ as env
from typing import Optional

import msal
import requests
from fastapi import HTTPException

logger = logging.getLogger(__name__)

TENANT_ID = env.get("AZURE_TENANT_ID")
CLIENT_ID = env.get("AZURE_CLIENT_ID")
CLIENT_SECRET = env.get("AZURE_CLIENT_SECRET")
GRAPH_BASE = "https://graph.microsoft.com/v1.0"
GRAPH_SCOPE = ["https://graph.microsoft.com/.default"]

_sp_info_cache: Optional[dict] = None
_msal_app: Optional[msal.ConfidentialClientApplication] = None


def _get_msal_app() -> msal.ConfidentialClientApplication:
    global _msal_app
    if _msal_app is None:
        if not all([TENANT_ID, CLIENT_ID, CLIENT_SECRET]):
            raise HTTPException(
                status_code=500,
                detail="Server misconfigured: Azure credentials missing",
            )
        _msal_app = msal.ConfidentialClientApplication(
            client_id=CLIENT_ID,
            client_credential=CLIENT_SECRET,
            authority=f"https://login.microsoftonline.com/{TENANT_ID}",
        )
    return _msal_app


def _get_graph_token() -> str:
    app = _get_msal_app()
    result = app.acquire_token_for_client(scopes=GRAPH_SCOPE)
    if "access_token" not in result:
        logger.error(
            "Graph token acquisition failed: %s", result.get("error_description")
        )
        raise HTTPException(status_code=500, detail="Graph token acquisition failed")
    return result["access_token"]


def get_sp_info() -> dict:
    """Return cached dict with sp_oid, role_name_to_id, role_id_to_name."""
    global _sp_info_cache
    if _sp_info_cache is not None:
        return _sp_info_cache

    token = _get_graph_token()
    resp = requests.get(
        f"{GRAPH_BASE}/servicePrincipals?$filter=appId eq '{CLIENT_ID}'&$select=id,appRoles",
        headers={"Authorization": f"Bearer {token}"},
    )
    if not resp.ok:
        logger.error("Graph SP lookup failed: %s", resp.text)
        raise HTTPException(
            status_code=500, detail="Graph service principal lookup failed"
        )

    items = resp.json().get("value", [])
    if not items:
        raise HTTPException(
            status_code=500, detail="Service principal not found in tenant"
        )

    sp = items[0]
    name_to_id = {r["value"]: r["id"] for r in sp.get("appRoles", [])}
    id_to_name = {r["id"]: r["value"] for r in sp.get("appRoles", [])}

    _sp_info_cache = {
        "sp_oid": sp["id"],
        "role_name_to_id": name_to_id,
        "role_id_to_name": id_to_name,
    }
    return _sp_info_cache


def list_role_assignments() -> dict[str, list[dict]]:
    """Return {user_oid: [{assignment_id, role_name}, ...]} for all assignments.

    Follows @odata.nextLink to page through all results.
    """
    info = get_sp_info()
    token = _get_graph_token()
    headers = {"Authorization": f"Bearer {token}"}

    result: dict[str, list[dict]] = {}
    url: Optional[str] = (
        f"{GRAPH_BASE}/servicePrincipals/{info['sp_oid']}/appRoleAssignedTo"
    )
    while url:
        resp = requests.get(url, headers=headers)
        if not resp.ok:
            logger.error("Graph role list failed: %s", resp.text)
            raise HTTPException(status_code=500, detail="Graph role list failed")
        body = resp.json()
        for item in body.get("value", []):
            oid = item["principalId"]
            role_name = info["role_id_to_name"].get(item["appRoleId"])
            if role_name:
                result.setdefault(oid, []).append(
                    {"assignment_id": item["id"], "role_name": role_name}
                )
        url = body.get("@odata.nextLink")
    return result


def assign_role(user_oid: str, role_name: str) -> dict:
    """Returns {assignment_id, role_name} for the new assignment."""
    info = get_sp_info()
    role_id = info["role_name_to_id"].get(role_name)
    if not role_id:
        raise HTTPException(status_code=400, detail=f"Unknown role: {role_name}")
    token = _get_graph_token()
    resp = requests.post(
        f"{GRAPH_BASE}/servicePrincipals/{info['sp_oid']}/appRoleAssignedTo",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json={
            "principalId": user_oid,
            "resourceId": info["sp_oid"],
            "appRoleId": role_id,
        },
    )
    if resp.status_code == 409:
        raise HTTPException(status_code=409, detail="Role already assigned")
    if not resp.ok:
        logger.error("Graph assign failed: %s", resp.text)
        raise HTTPException(status_code=500, detail="Graph role assignment failed")
    return {"assignment_id": resp.json()["id"], "role_name": role_name}


def remove_role(assignment_id: str) -> None:
    info = get_sp_info()
    token = _get_graph_token()
    resp = requests.delete(
        f"{GRAPH_BASE}/servicePrincipals/{info['sp_oid']}/appRoleAssignedTo/{assignment_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if not resp.ok:
        logger.error("Graph remove failed: %s", resp.text)
        raise HTTPException(status_code=500, detail="Graph role removal failed")
