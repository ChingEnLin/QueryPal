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
    EvaluateWriteRequest,
    EvaluateWriteResponse,
)
from services.react_agent_service import run_query_generator
from services.gemini_service import (
    generate_suggestion_from_query_error,
    generate_schema_relationships,
)
from services.mongo_service import (
    execute_mongo_query,
    transform_mongo_result,
    get_database_schema_summary,
)
from models.analyze import AnalyzeRequest, AnalyzeResponse
from services.analyze_service import analyze_query_result
from services.evaluate_write_service import evaluate_write_result
from services.data_documents_service import log_write_operation
from services.user_queries_service import get_user_id_from_token
from pymongo.results import (
    UpdateResult,
    InsertOneResult,
    InsertManyResult,
    DeleteResult,
)
import ast
import re

router = APIRouter()


def extract_collection_name(query_str: str) -> str:
    """Extract collection name from a PyMongo query string using AST."""
    try:
        tree = ast.parse(query_str)
        for node in ast.walk(tree):
            # Match: db["collection"] or db['collection']
            if (
                isinstance(node, ast.Subscript)
                and isinstance(node.value, ast.Name)
                and node.value.id == "db"
            ):
                if isinstance(node.slice, ast.Constant):
                    return str(node.slice.value)
            # Match: db.collection
            if (
                isinstance(node, ast.Attribute)
                and isinstance(node.value, ast.Name)
                and node.value.id == "db"
            ):
                return node.attr
    except SyntaxError:
        pass
    return "unknown"


@router.post("/nl2query")
def nl2query(prompt: QueryPrompt = Body(...), authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")

    try:
        user_token = authorization.replace("Bearer ", "")
        access_token = exchange_token_obo(user_token)
        # Use provided contexts if available to avoid re-fetch and ensure consistency
        if prompt.collection_context:
            summary = []
            for ctx in prompt.collection_context:
                doc_str = (
                    str(ctx.sampleDocument)
                    if ctx.sampleDocument
                    else "No documents found"
                )
                summary.append(f"Collection: {ctx.name}\nSample Document: {doc_str}")
            schema_summary = "\n\n".join(summary)
        # Fallback: fetch schema summary from DB
        else:
            schema_summary = get_database_schema_summary(
                prompt.account_id, prompt.db_context.name, access_token
            )
        connection_string = get_connection_string(prompt.account_id, access_token)
    except Exception as e:
        print(
            f"[ERROR] Failed to fetch schema/connection for account {prompt.account_id}: {e}"
        )
        schema_summary = "Could not fetch schema summary."
        connection_string = ""

    collections = [col.name for col in prompt.db_context.collections]

    return run_query_generator(
        user_input=prompt.user_input,
        database=prompt.db_context.name,
        collections=collections,
        schema_context=schema_summary,
        intermediate_context=prompt.intermediate_context,
        connection_string=connection_string,
        max_iterations=prompt.max_iterations,
    )


@router.post("/infer-relationships", response_model=SchemaRelationshipsResponse)
def infer_relationships(
    request: SchemaRelationshipsRequest = Body(...), authorization: str = Header(...)
):
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
            collection_filter=request.collection_names,
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

    # LOG WRITE OPERATIONS
    if isinstance(
        result, (UpdateResult, InsertOneResult, InsertManyResult, DeleteResult)
    ):
        try:
            user_email = get_user_id_from_token(user_token)

            operation = "query_generator"
            if isinstance(result, UpdateResult):
                operation = "update"
            elif isinstance(result, (InsertOneResult, InsertManyResult)):
                operation = "insert"
            elif isinstance(result, DeleteResult):
                operation = "delete"

            collection = extract_collection_name(query.query)

            match = re.search(r"//([^:@]+)", connection_string)
            account_name = match.group(1) if match else "unknown"
            account_database = f"{account_name}.{query.database_name}"

            transformed_res = transform_mongo_result(result)
            query_info = {
                "query": query.query,
                "source": "query_generator",
                "result": transformed_res,
            }

            before_data = query_info if operation == "delete" else None
            after_data = query_info if operation in ["update", "insert"] else None

            log_write_operation(
                user_email=user_email,
                operation=operation,
                database_name=account_database,
                collection_name=collection,
                document_id="query_generator",
                before_data=before_data,
                after_data=after_data,
            )
        except Exception as e:
            print(f"Error logging query generator write: {e}")

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


@router.post("/evaluate-write", response_model=EvaluateWriteResponse)
def evaluate_write(
    body: EvaluateWriteRequest = Body(...), authorization: str = Header(...)
):
    """
    Evaluates the result of a write operation against the user's original intent.
    Requires authentication via Bearer token.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")

    user_token = authorization.replace("Bearer ", "")
    access_token = exchange_token_obo(user_token)
    try:
        connection_string = get_connection_string(body.account_id, access_token)
    except Exception as e:
        print(
            f"[ERROR] Failed to fetch connection string for account {body.account_id}: {e}"
        )
        connection_string = ""

    return evaluate_write_result(
        user_intent=body.user_intent,
        query_code=body.query_code,
        write_result=body.write_result,
        connection_string=connection_string,
        database_name=body.database_name,
    )
