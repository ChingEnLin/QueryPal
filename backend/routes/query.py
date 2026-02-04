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
    SchemaRelationshipsRequest,
    SchemaRelationshipsResponse,
)
from services.gemini_service import (
    generate_query_from_prompt,
    generate_suggestion_from_query_error,
    generate_schema_relationships,
)
from services.mongo_service import execute_mongo_query, transform_mongo_result, get_database_schema_summary
from models.analyze import AnalyzeRequest, AnalyzeResponse
from services.analyze_service import analyze_query_result

router = APIRouter()


@router.post("/nl2query")
def nl2query(prompt: QueryPrompt = Body(...), authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")

    try:
        user_token = authorization.replace("Bearer ", "")
        access_token = exchange_token_obo(user_token)
        # Fetch schema summary
        # Note: We need the connection string to fetch the schema
        # Ideally we might cache this, but for now we fetch it live
        schema_summary = get_database_schema_summary(prompt.account_id, prompt.db_context.name, access_token)
    except Exception as e:
        print(f"Error fetching schema context: {e}")
        schema_summary = "Could not fetch schema summary."

    collections = [col.name for col in prompt.db_context.collections]
    return generate_query_from_prompt(
        prompt.user_input,
        collections,
        prompt.db_context.name,
        prompt.collection_context,
        prompt.intermediate_context,
        all_collections_schema=schema_summary
    )


@router.post("/infer-relationships", response_model=SchemaRelationshipsResponse)
def infer_relationships(request: SchemaRelationshipsRequest = Body(...), authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")
    
    try:
        user_token = authorization.replace("Bearer ", "")
        access_token = exchange_token_obo(user_token)
        
        # Fetch schema summary ONLY for correct collections
        schema_summary = get_database_schema_summary(
            request.account_id, 
            request.database_name, 
            access_token, 
            collection_filter=request.collection_names
        )
        
        return generate_schema_relationships(schema_summary)
    
    except Exception as e:
        print(f"Error inferring relationships: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
