from fastapi import APIRouter
from ..services.mongo_service import connect_to_mongo

router = APIRouter()

@router.post("/connect")
def connect_db(connection_string: str):
    return connect_to_mongo(connection_string)
