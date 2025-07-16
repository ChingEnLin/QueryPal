from fastapi import APIRouter, Header, Body, HTTPException
from models.user_queries import SavedQuery, SavedQueryCreate, SavedQueryUpdate
from services.user_queries_service import (
    get_user_id_from_token,
    get_saved_queries,
    create_saved_query,
    update_saved_query,
    delete_saved_query
)

router = APIRouter()

@router.get("/queries", response_model=list[SavedQuery])
def list_saved_queries(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")
    user_id = get_user_id_from_token(authorization.replace("Bearer ", ""))
    return get_saved_queries(user_id)

@router.post("/queries", response_model=SavedQuery, status_code=201)
def create_query(
    data: SavedQueryCreate = Body(...),
    authorization: str = Header(...)
):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")
    user_id = get_user_id_from_token(authorization.replace("Bearer ", ""))
    return create_saved_query(user_id, data)

@router.put("/queries/{query_id}", response_model=SavedQuery)
def update_query(
    query_id: str,
    data: SavedQueryUpdate = Body(...),
    authorization: str = Header(...)
):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")
    user_id = get_user_id_from_token(authorization.replace("Bearer ", ""))
    try:
        return update_saved_query(user_id, query_id, data)
    except ValueError:
        raise HTTPException(status_code=404, detail="Saved query not found")

@router.delete("/queries/{query_id}", status_code=204)
def delete_query(
    query_id: str,
    authorization: str = Header(...)
):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")
    user_id = get_user_id_from_token(authorization.replace("Bearer ", ""))
    delete_saved_query(user_id, query_id)
    return None
