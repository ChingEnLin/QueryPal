from fastapi import APIRouter, Header, HTTPException
from ..services.azure_auth import exchange_token_obo
from ..services.azure_cosmos_resources import list_cosmos_resources

router = APIRouter()

@router.get("/cosmos-accounts")
def get_cosmos_resources(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")

    user_token = authorization.replace("Bearer ", "")
    access_token = exchange_token_obo(user_token)
    return list_cosmos_resources(access_token)