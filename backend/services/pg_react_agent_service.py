"""LangGraph ReAct agent that generates read-only SQL for Azure PostgreSQL.

Same generate -> execute -> evaluate -> loop shape as react_agent_service.py
(Cosmos), with SQL-specific prompts. Reads are test-executed inside a READ ONLY
transaction; writes/DDL skip execution and are returned for manual review.
"""

import json
import logging
from typing import Any, TypedDict

from google import genai
from google.genai import types
from langgraph.graph import StateGraph, END

from services.gemini_service import extract_python_code, thinking_config_for
from services.pg_sql_utils import (
    _enrich_schema_context_from_db,
    _normalize_categorical_literals,
    _validate_sql_columns,
    _validate_sql_operators,
    _validate_sql_references,
)
from services.pg_query_service import execute_sql, is_write_sql

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

client = genai.Client()

GENERATE_PROMPT = """You are an expert PostgreSQL engineer.
Generate a single SQL statement answering the user's request.

User Request: {user_input}
Database: {database}
Schema (tables and columns):
{schema_context}

Previous Attempt (if a retry — do NOT repeat it verbatim):
{previous_query}
Previous Evaluation Feedback (if a retry):
{evaluation}

Rules:
1. Return ONLY the SQL. No prose. A ```sql fenced block is acceptable.
2. Prefer a SELECT. Include a LIMIT (<= 50) unless the user asks for all rows.
3. Use only schema-listed tables/columns; never invent names.
4. Standard PostgreSQL syntax. Use schema-qualified names when given.
5. When joining tables, follow FK relationships listed in the schema; alias tables a, b, c… in join order.
6. Interpret "with a <column>" as column IS NOT NULL; "without a <column>" as column IS NULL.
7. Normalize string literal values to lowercase (e.g. status = 'active', not 'Active').
8. To match a concept (e.g. 'heart failure'), find the column whose sample values (-- values: ...) contain it and use col = 'value'. For text/varchar columns never use @>, ->, ->> or ARRAY[] — they are not JSON or arrays. Prefer = over LIKE when the value matches a listed sample value; keep LIKE for genuine substring search.
9. For categorical array columns, prefer 'value' = ANY(col) instead of col @> ARRAY['value'].
"""

EVALUATE_PROMPT = """You are a database QA reviewer for a generated PostgreSQL query.

User's Original Request: {user_input}
Generated SQL: {generated_query}
Is Write Action: {is_write_action}
Query Result / Error:
{query_result}

If a write/DDL action, you cannot see a result — judge whether the SQL is
correct for the intent. Otherwise judge whether the result answers the request;
any error means it is NOT valid.

Respond in JSON:
{{"is_valid": true/false, "critique": "what went wrong and how to fix, or why it is valid"}}
"""


class _State(TypedDict, total=False):
    user_input: str
    database: str
    schema_context: str
    conn: Any
    model: str
    generated_query: str
    is_write_action: bool
    query_result: Any
    evaluation: str
    is_valid: bool
    iterations: int
    max_iterations: int


def _generate(state: _State):
    schema_context = state["schema_context"]
    # Enrich once, on the first call, to add sample values. Retries reuse the
    # result via state — including the raw fallback when enrichment failed, so a
    # broken connection can't re-trigger the expensive probe every iteration.
    if state.get("iterations", 0) == 0:
        schema_context = _enrich_schema_context_from_db(
            state.get("conn"), schema_context
        )

    prompt = GENERATE_PROMPT.format(
        user_input=state["user_input"],
        database=state["database"],
        schema_context=schema_context,
        previous_query=state.get("generated_query") or "None (first attempt).",
        evaluation=state.get("evaluation", "None"),
    )
    try:
        resp = client.models.generate_content(
            model=state.get("model", "gemini-2.5-flash"),
            contents=prompt,
            config=types.GenerateContentConfig(
                thinking_config=thinking_config_for(
                    state.get("model", "gemini-2.5-flash")
                )
            ),
        )
        sql = extract_python_code(resp.text).strip()
    except Exception as e:
        sql = f"-- Error generating query: {e}"
    sql = _normalize_categorical_literals(sql, schema_context)
    return {
        "generated_query": sql,
        "is_write_action": is_write_sql(sql),
        "iterations": state.get("iterations", 0) + 1,
        # Persist enriched schema so _evaluate can validate table/column refs
        "schema_context": schema_context,
    }


def _execute(state: _State):
    if state["is_write_action"]:
        return {
            "query_result": "Write/DDL operation detected. Execution skipped — "
            "returned for manual review."
        }
    return {"query_result": execute_sql(state["conn"], state["generated_query"])}


def _evaluate(state: _State):
    raw = state.get("query_result")

    # Postgres already rejects hallucinated tables/columns and bad operators when
    # the query runs, so a successful execution needs no static check — running
    # one anyway only risks a false positive on valid SQL (CTEs, derived-table
    # aliases, EXTRACT(... FROM col)). Only check when there is no verdict from
    # the database: execution errored, or it was skipped for a write/DDL. The
    # checks add a schema-aware critique the raw driver error doesn't give.
    if state.get("is_write_action") or (isinstance(raw, dict) and "error" in raw):
        for check in (
            _validate_sql_references,
            _validate_sql_columns,
            _validate_sql_operators,
        ):
            violation = check(
                state.get("generated_query", ""), state.get("schema_context", "")
            )
            if violation:
                return {"is_valid": False, "evaluation": violation}

    result_str = str(raw)[:2000]
    prompt = EVALUATE_PROMPT.format(
        user_input=state["user_input"],
        generated_query=state["generated_query"],
        is_write_action=state["is_write_action"],
        query_result=result_str,
    )
    try:
        resp = client.models.generate_content(
            model=state.get("model", "gemini-2.5-flash"),
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                thinking_config=thinking_config_for(
                    state.get("model", "gemini-2.5-flash")
                ),
            ),
        )
        data = resp.parsed if getattr(resp, "parsed", None) else json.loads(resp.text)
        return {
            "is_valid": data.get("is_valid", False),
            "evaluation": data.get("critique", "No critique provided."),
        }
    except Exception as e:
        return {"is_valid": False, "evaluation": f"Failed to evaluate: {e}"}


def _should_continue(state: _State):
    if state.get("is_valid"):
        return END
    if state.get("iterations", 0) >= min(state.get("max_iterations", 3), 10):
        return END
    return "generate"


_workflow = StateGraph(_State)
_workflow.add_node("generate", _generate)
_workflow.add_node("execute", _execute)
_workflow.add_node("evaluate", _evaluate)
_workflow.set_entry_point("generate")
_workflow.add_edge("generate", "execute")
_workflow.add_edge("execute", "evaluate")
_workflow.add_conditional_edges("evaluate", _should_continue)
_sql_generator = _workflow.compile()


def run_sql_generator(
    user_input: str,
    database: str,
    schema_context: str,
    conn,
    max_iterations: int = 3,
    model: str = "gemini-2.5-flash",
) -> dict:
    final = _sql_generator.invoke(
        {
            "user_input": user_input,
            "database": database,
            "schema_context": schema_context,
            "conn": conn,
            "model": model,
            "iterations": 0,
            "max_iterations": max_iterations,
        }
    )
    return {
        "generated_code": final.get("generated_query", ""),
        "is_write_action": final.get("is_write_action", False),
        "query_result": final.get("query_result", None),
        "explanation": final.get("evaluation", ""),
        "is_valid": final.get("is_valid", False),
    }
