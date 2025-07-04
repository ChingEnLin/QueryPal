from fastapi import APIRouter
from models.config import DATABASE_CONFIGS
from services.mongo_service import connect_to_mongo

router = APIRouter()

@router.get("/available-databases")
def get_available_dbs():
    return DATABASE_CONFIGS

@router.post("/connect")
def connect_db(connection_string: str):
    return connect_to_mongo(connection_string)
