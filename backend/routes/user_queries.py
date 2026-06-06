from fastapi import APIRouter, Body, Depends, HTTPException
from models.user_queries import SavedQuery, SavedQueryCreate, SavedQueryUpdate
from services.user_queries_service import (
    get_saved_queries,
    create_saved_query,
    update_saved_query,
    delete_saved_query,
)
from services.rbac import require, Caller

router = APIRouter()


@router.get("/queries", response_model=list[SavedQuery])
def list_saved_queries(caller: Caller = Depends(require("self:manage"))):
    return get_saved_queries(caller.email)


@router.post("/queries", response_model=SavedQuery, status_code=201)
def create_query(
    data: SavedQueryCreate = Body(...),
    caller: Caller = Depends(require("self:manage")),
):
    return create_saved_query(caller.email, data)


@router.put("/queries/{query_id}", response_model=SavedQuery)
def update_query(
    query_id: str,
    data: SavedQueryUpdate = Body(...),
    caller: Caller = Depends(require("self:manage")),
):
    try:
        return update_saved_query(caller.email, query_id, data)
    except ValueError:
        raise HTTPException(status_code=404, detail="Saved query not found")


@router.delete("/queries/{query_id}", status_code=204)
def delete_query(
    query_id: str,
    caller: Caller = Depends(require("self:manage")),
):
    delete_saved_query(caller.email, query_id)
    return None
