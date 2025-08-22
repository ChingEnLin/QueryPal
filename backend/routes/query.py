from fastapi import APIRouter, Header, Body, HTTPException
from services.azure_auth import exchange_token_obo
from services.azure_cosmos_resources import (
    get_connection_string,
)
from models.schemas import (
    QueryPrompt,
    ExecuteInput,
    DebugQueryRequest,
    DebugSuggestionResponse,
)
from services.gemini_service import (
    generate_query_from_prompt,
    generate_suggestion_from_query_error,
)
from services.mongo_service import execute_mongo_query, transform_mongo_result
from models.analyze import AnalyzeRequest, AnalyzeResponse
from services.analyze_service import analyze_query_result

router = APIRouter()


@router.post("/nl2query")
def nl2query(prompt: QueryPrompt = Body(...)):
    collections = [col.name for col in prompt.db_context.collections]
    return generate_query_from_prompt(
        prompt.user_input,
        collections,
        prompt.db_context.name,
        prompt.collection_context,
        prompt.intermediate_context,
    )


@router.post("/execute")
def execute(query: ExecuteInput = Body(...), authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")

    user_token = authorization.replace("Bearer ", "")
    access_token = exchange_token_obo(user_token)
    connection_string = get_connection_string(query.account_id, access_token)
    result = execute_mongo_query(connection_string, query.database_name, query.query)
    if isinstance(result, dict) and "error" in result:
        raise HTTPException(
            status_code=500,
            detail=f"MongoDB query error: {result['error']} ({result['exception_type']})",
        )
    return transform_mongo_result(result)


@router.post("/debug", response_model=DebugSuggestionResponse)
def debug(body: DebugQueryRequest = Body(...)):
    """
    Sends a failed query and error message to Gemini for debugging suggestion.
    """
    return generate_suggestion_from_query_error(body.query, body.error_message)


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze(body: AnalyzeRequest = Body(...)):
    """
    Sends a query result to the AI for analysis and visualization suggestions.
    """
    return analyze_query_result(body.query_result)
