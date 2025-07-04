from fastapi import APIRouter
from pydantic import BaseModel
from ..services.gemini_service import generate_query_from_prompt
from ..services.mongo_service import execute_mongo_query

router = APIRouter()

class QueryPrompt(BaseModel):
    prompt: str
    db_name: str
    collection: str

class ExecuteInput(BaseModel):
    generated_code: str
    connection_string: str

@router.post("/nl2query")
def nl2query(input: QueryPrompt):
    return generate_query_from_prompt(input.prompt, input.db_name, input.collection)

@router.post("/execute")
def execute(input: ExecuteInput):
    return execute_mongo_query(input.generated_code, input.connection_string)