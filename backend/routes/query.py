from fastapi import APIRouter
from ..models.schemas import QueryPrompt, BaseModel
from ..services.gemini_service import generate_query_from_prompt
from ..services.mongo_service import execute_mongo_query

router = APIRouter()

class ExecuteInput(BaseModel):
    generated_code: str
    connection_string: str

@router.post("/nl2query")
def nl2query(input: QueryPrompt):
    collections = [col.name for col in input.db_context.collections]
    return generate_query_from_prompt(input.user_input, collections, input.db_context.name)

@router.post("/execute")
def execute(input: ExecuteInput):
    return execute_mongo_query(input.generated_code, input.connection_string)