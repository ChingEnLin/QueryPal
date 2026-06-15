from typing import TypedDict, Annotated, Sequence, Any
import ast
import operator
from langgraph.graph import StateGraph, END
from google import genai
from google.genai import types
import json
import logging

# Configure logger
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)

from services.gemini_service import extract_python_code, thinking_config_for
from services.mongo_service import execute_mongo_query, transform_mongo_result

WRITE_METHODS = {
    "insert_one",
    "insert_many",
    "update_one",
    "update_many",
    "replace_one",
    "delete_one",
    "delete_many",
    "drop",
    "create_index",
}


def is_write_operation(code: str) -> bool:
    """Return True if code contains a write method call, using AST parsing."""
    try:
        tree = ast.parse(code)
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                func = node.func
                if isinstance(func, ast.Attribute) and func.attr in WRITE_METHODS:
                    return True
    except SyntaxError:
        # If we can't parse the code, treat it as a write to be safe
        return True
    return False


class AgentState(TypedDict):
    user_input: str
    database: str
    collections: list[str]
    schema_context: str
    relationship_context: str
    intermediate_context: dict
    connection_string: str
    model: str

    generated_query: str
    is_write_action: bool
    query_result: Any

    evaluation: str
    is_valid: bool
    iterations: int
    max_iterations: int


# Define LLM clients and prompts
client = genai.Client()

CROSS_COLLECTION_GUIDANCE = """

Cross-Collection Join Guidance (MULTIPLE collections selected):
- Target: Azure Cosmos DB (MongoDB API). IMPORTANT — Cosmos does NOT support `let` or `pipeline` inside `$lookup`. Only the plain `localField`/`foreignField` form works. Never emit `let` or a `pipeline` array inside `$lookup` — it will fail with `CommandNotSupported`.
- Produce ONE aggregate() pipeline. Pick the most-filtering collection as the driver.
- Use the Inferred Relationships block above to choose join fields. Do NOT invent field names that are not in the schema or relationships.
- TYPE-MISMATCH HANDLING (this is the #1 reason $lookup returns empty arrays on Cosmos): if one side is an ObjectId and the other is a string, you MUST pre-convert with an `$addFields` stage BEFORE `$lookup`, then $lookup on the converted field. Do not rely on $lookup to coerce types.
  - String → ObjectId: `{"$addFields": {"<field>_oid": {"$toObjectId": "$<field>"}}}` (or `$map` over an array of strings).
  - ObjectId → String: `{"$addFields": {"<field>_str": {"$toString": "$<field>"}}}`.
- After $lookup, $unwind the joined array (use `preserveNullAndEmptyArrays: True` for LEFT-JOIN semantics) before filtering on joined fields, OR filter with `joined.field` dotted notation.
- Always include a $limit (<=50) unless the user explicitly asks for all rows.

Example A — simple equality join (same field type on both sides):
```python
db['orders'].aggregate([
    {"$match": {"status": "paid"}},
    {"$lookup": {
        "from": "users",
        "localField": "userId",
        "foreignField": "_id",
        "as": "user"
    }},
    {"$unwind": {"path": "$user", "preserveNullAndEmptyArrays": True}},
    {"$limit": 20}
])
```

Example B — array-of-strings → ObjectId join (Cosmos-safe; pre-convert via $addFields):
```python
db['patient-cohort'].aggregate([
    {"$addFields": {
        "patient_oids": {"$map": {"input": "$patient_ids", "in": {"$toObjectId": "$$this"}}}
    }},
    {"$lookup": {
        "from": "patient",
        "localField": "patient_oids",
        "foreignField": "_id",
        "as": "patients_info"
    }},
    {"$match": {"patients_info.origin_ethnicity": "caucasian"}},
    {"$limit": 50}
])
```

Example C — single ObjectId → string join (Cosmos-safe; pre-convert the other side):
```python
db['orders'].aggregate([
    {"$addFields": {"userId_str": {"$toString": "$userId"}}},
    {"$lookup": {
        "from": "users",
        "localField": "userId_str",
        "foreignField": "external_id",
        "as": "user"
    }},
    {"$unwind": "$user"},
    {"$limit": 20}
])
```
"""

GENERATE_PROMPT = """
You are an expert MongoDB architect.
Your task is to generate a PyMongo query based on the user's request.

User Request: {user_input}
Database: {database}
Collections: {collections}
Schema summary: {schema_context}
Inferred Relationships (foreign keys between collections):
{relationship_context}
Intermediate Context (optional): {intermediate_context}

Previous Attempt (if this is a retry — DO NOT repeat the same query verbatim):
{previous_query}

Previous Evaluation Feedback (if this is a retry):
{evaluation}

Instructions:
0. If a Previous Attempt is shown above, your new query MUST be materially different — change the join form, fields, types, or stages in response to the critique. Producing the same query (or a trivial reformat) is a failure. If the previous $lookup returned empty arrays for every input doc, the cause is almost always a type mismatch on the join key: add an `$addFields` stage BEFORE the `$lookup` that applies `$toObjectId` (string→OID) or `$toString` (OID→string), then $lookup on the converted field. NEVER use `let` or `pipeline` inside `$lookup` — Cosmos rejects both with CommandNotSupported.
1. Write ONLY the PyMongo query code.
2. Use variables appropriately (e.g., db['collection_name'].find(...) or db['collection_name'].aggregate(...)).
3. Do not include markdown formatting or explanations, just return the code, but you can use ```python if you must.
4. If the user is asking for a visualization, ensure the query retrieves the necessary data format.
5. You are allowed to use both find() and aggregate() pipelines. If using aggregate(), be mindful of the resulting data size and include $limit stages if applicable.
6. EXECUTION CONTEXT: the query is run with PyMongo via Python `eval()` as a SINGLE expression — NOT in mongosh. This has two consequences:
   - Do NOT write `import` statements (e.g. `import datetime`). `eval()` only accepts one expression and an import is a statement — it will raise `invalid syntax`.
   - For dates, use Python datetime objects: `datetime.datetime(2025, 1, 1, tzinfo=datetime.timezone.utc)`. The `datetime` module is already in scope. Do NOT use mongosh-only syntax like a bare `ISODate("...")` mindset — `datetime.datetime(...)` is the correct, supported form here.
{cross_collection_guidance}
"""

EVALUATE_PROMPT = """
You are a database QA tester evaluating a generated MongoDB query.

User's Original Request: {user_input}
Generated Query: {generated_query}
Is Write Action: {is_write_action}
Query Result / Error: 
{query_result}

EXECUTION CONTEXT (important): this query is executed with PyMongo via Python `eval()`, NOT in mongosh. The scope already provides `db`, `ObjectId`, `datetime`, and an `ISODate` shim. Therefore:
  - Python datetime objects such as `datetime.datetime(2025, 1, 1, tzinfo=datetime.timezone.utc)` are the CORRECT, supported way to express dates. Do NOT critique them or recommend replacing them with mongosh `ISODate("...")`.
  - If the error is `name 'datetime' is not defined` or `invalid syntax` caused by an `import` line, the fix is to REMOVE the `import` statement (the query must be a single expression) and rely on the in-scope `datetime` module — NOT to switch to mongosh syntax.

Your task:
Determine if this query successfully answers the user's request based on the code and the result.
If there is an error in the query result, or if it clearly does not match the intent, it is NOT valid.
If it is a write action, we cannot test the result, but you should evaluate if the code looks correct for the user's intent.
If the query uses $lookup, specifically verify (target is Azure Cosmos DB MongoDB API):
  - The query does NOT use `let` or `pipeline` inside `$lookup` — Cosmos rejects both with `CommandNotSupported`. If you see either, it is NOT valid; recommend pre-converting the type with an `$addFields` stage and then using plain `localField`/`foreignField`.
  - The `localField`/`foreignField` reference fields that actually exist on each side.
  - When the joined array is empty for every input doc, suspect a type mismatch (ObjectId vs string). The query is NOT valid; recommend an `$addFields` stage BEFORE `$lookup` that applies `$toObjectId` (string→OID) or `$toString` (OID→string), and a `$map` if the local field is an array of strings.
  - Do not rationalize an empty result with "maybe no such records exist" when the filter is on a field inside the joined array — empty joined arrays will make the downstream $match drop everything; treat that as a join-correctness failure unless the join itself is clearly populated.
  - The driving collection is the right one (smallest filtered set first).

Respond in JSON format:
{{
    "is_valid": true/false,
    "critique": "If invalid, explain what went wrong and how to fix it. If valid, briefly explain why."
}}
"""


def generate_query_node(state: AgentState):
    logger.info(f"--- GENERATE NODE (Iteration {state.get('iterations', 0)}) ---")

    is_multi_collection = len(state.get("collections", [])) > 1
    is_retry = state.get("iterations", 0) > 0
    previous_query = state.get("generated_query", "") if is_retry else ""
    prompt = GENERATE_PROMPT.format(
        user_input=state["user_input"],
        database=state["database"],
        collections=", ".join(state["collections"]),
        schema_context=state["schema_context"],
        relationship_context=state.get("relationship_context")
        or "None (single collection or no inferred relationships).",
        intermediate_context=state.get("intermediate_context", {}),
        previous_query=previous_query or "None (this is the first attempt).",
        evaluation=state.get("evaluation", "None"),
        cross_collection_guidance=(
            CROSS_COLLECTION_GUIDANCE if is_multi_collection else ""
        ),
    )

    try:
        response = client.models.generate_content(
            model=state.get("model", "gemini-2.5-flash"),
            contents=prompt,
            config=types.GenerateContentConfig(
                thinking_config=thinking_config_for(
                    state.get("model", "gemini-2.5-flash")
                )
            ),
        )
        code = extract_python_code(response.text)
    except Exception as e:
        code = f"# Error generating query: {str(e)}"

    # Detect write operations via AST — more reliable than substring matching
    is_write = is_write_operation(code)
    logger.info(f"Generated query: {code}")
    logger.info(f"Is write action (AST): {is_write}")

    return {
        "generated_query": code,
        "is_write_action": is_write,
        "iterations": state.get("iterations", 0) + 1,
    }


def execute_test_node(state: AgentState):
    logger.info("--- EXECUTE TEST NODE ---")
    if state["is_write_action"]:
        logger.info("Skipping execution for write operation safety.")
        return {
            "query_result": "Write operation detected. Execution skipped during testing for safety."
        }

    # It's a read query, execute it
    try:
        # We need to run the query to test it.
        # We inject a limit if it's a find query just to be safe during testing.
        test_query = state["generated_query"]
        if ".find(" in test_query and ".limit(" not in test_query:
            test_query += ".limit(10)"

        result = execute_mongo_query(
            state["connection_string"], state["database"], test_query
        )

        # Pass the transformed result to the state so the frontend can display it
        transformed_result = transform_mongo_result(result)
        if isinstance(transformed_result, dict) and "error" in transformed_result:
            return {
                "query_result": {
                    "error": transformed_result["error"],
                    "exception_type": transformed_result.get("exception_type", ""),
                }
            }

        return {"query_result": transformed_result}

    except Exception as e:
        logger.error(f"Execution Exception: {str(e)}")
        return {"query_result": {"error": f"Execution Exception: {str(e)}"}}


def evaluate_node(state: AgentState):
    logger.info("--- EVALUATE NODE ---")
    # Limit the result size for the LLM evaluator to avoid token explosion
    raw_result = state.get("query_result")
    if isinstance(raw_result, list):
        result_str = str(raw_result[:5])
        if len(raw_result) > 5:
            result_str += f"... (and {len(raw_result) - 5} more items)"
    elif isinstance(raw_result, dict) and "error" in raw_result:
        result_str = f"Error: {raw_result['error']}"
    elif isinstance(raw_result, str):
        result_str = raw_result
    else:
        result_str = str(raw_result)[:2000]

    prompt = EVALUATE_PROMPT.format(
        user_input=state["user_input"],
        generated_query=state["generated_query"],
        is_write_action=state["is_write_action"],
        query_result=result_str,
    )

    try:
        response = client.models.generate_content(
            model=state.get("model", "gemini-2.5-flash"),
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                thinking_config=thinking_config_for(
                    state.get("model", "gemini-2.5-flash")
                ),
            ),
        )

        if hasattr(response, "parsed") and response.parsed:
            data = response.parsed
        else:
            data = json.loads(response.text)

        is_valid = data.get("is_valid", False)
        critique = data.get("critique", "No critique provided.")
    except Exception as e:
        logger.error(f"Failed to evaluate query: {str(e)}")
        is_valid = False
        critique = f"Failed to evaluate query: {str(e)}"

    logger.info(f"Evaluation result - is_valid: {is_valid}")
    logger.info(f"Critique: {critique}")

    return {"is_valid": is_valid, "evaluation": critique}


def should_continue(state: AgentState):
    if state.get("is_valid"):
        return END

    # Enforce a hard limit of 10 maximum iterations
    max_iter = min(state.get("max_iterations", 3), 10)
    if state.get("iterations", 0) >= max_iter:
        return END
    return "generate_query_node"


# Build the graph
workflow = StateGraph(AgentState)

workflow.add_node("generate_query_node", generate_query_node)
workflow.add_node("execute_test_node", execute_test_node)
workflow.add_node("evaluate_node", evaluate_node)

workflow.set_entry_point("generate_query_node")

workflow.add_edge("generate_query_node", "execute_test_node")
workflow.add_edge("execute_test_node", "evaluate_node")
workflow.add_conditional_edges("evaluate_node", should_continue)

react_query_generator = workflow.compile()


def run_query_generator(
    user_input: str,
    database: str,
    collections: list[str],
    schema_context: str,
    intermediate_context: dict,
    connection_string: str,
    max_iterations: int = 3,
    model: str = "gemini-2.5-flash",
    relationship_context: str = "",
):
    logger.info(f"Starting ReAct Agent workflow for input: '{user_input}'")
    initial_state = {
        "user_input": user_input,
        "database": database,
        "collections": collections,
        "schema_context": schema_context,
        "relationship_context": relationship_context,
        "intermediate_context": intermediate_context,
        "connection_string": connection_string,
        "model": model,
        "iterations": 0,
        "max_iterations": max_iterations,
    }

    # Run the graph
    final_state = react_query_generator.invoke(initial_state)

    return {
        "generated_code": final_state.get("generated_query", ""),
        "is_write_action": final_state.get("is_write_action", False),
        "query_result": final_state.get("query_result", None),
        "explanation": final_state.get("evaluation", ""),
        "is_valid": final_state.get("is_valid", False),
    }
