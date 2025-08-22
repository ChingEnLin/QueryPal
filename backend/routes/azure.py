from fastapi import APIRouter, Header, Body, HTTPException
from services.azure_auth import exchange_token_obo
from services.azure_cosmos_resources import (
    list_cosmos_resources,
    get_connection_string,
    get_cosmosdb_info_from_conn_str,
    get_collection_info_with_conn_str,
)
from models.schemas import AccountDetailsRequest, CollectionInfoRequest

router = APIRouter()


@router.get("/cosmos_accounts")
def get_cosmos_resources(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")

    user_token = authorization.replace("Bearer ", "")
    access_token = exchange_token_obo(user_token)
    return list_cosmos_resources(access_token)


@router.post("/account_details")
def get_account_details(
    data: AccountDetailsRequest = Body(...), authorization: str = Header(...)
):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")

    user_token = authorization.replace("Bearer ", "")
    access_token = exchange_token_obo(user_token)
    connection_string = get_connection_string(data.account_id, access_token)
    return get_cosmosdb_info_from_conn_str(connection_string)


@router.post("/collection_info")
def get_collection_info(
    data: CollectionInfoRequest = Body(...), authorization: str = Header(...)
):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")
    user_token = authorization.replace("Bearer ", "")
    access_token = exchange_token_obo(user_token)
    connection_string = get_connection_string(data.account_id, access_token)
    return get_collection_info_with_conn_str(
        connection_string, data.database_name, data.collection_name
    )
