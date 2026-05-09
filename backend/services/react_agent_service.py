from typing import TypedDict, Annotated, Sequence, Any
import operator
from langgraph.graph import StateGraph, END
from google import genai
from google.genai import types
import json
import re
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

from services.gemini_service import extract_python_code
from services.mongo_service import execute_mongo_query, transform_mongo_result


class AgentState(TypedDict):
    user_input: str
    database: str
    collections: list[str]
    schema_context: str
    intermediate_context: dict
    connection_string: str

    generated_query: str
    is_write_action: bool
    query_result: Any

    evaluation: str
    is_valid: bool
    iterations: int


# Define LLM clients and prompts
client = genai.Client()

GENERATE_PROMPT = """
You are an expert MongoDB architect. 
Your task is to generate a PyMongo query based on the user's request.

User Request: {user_input}
Database: {database}
Collections: {collections}
Schema summary: {schema_context}
Intermediate Context (optional): {intermediate_context}

Previous Evaluation Feedback (if this is a retry): 
{evaluation}

Instructions:
1. Write ONLY the PyMongo query code. 
2. Use variables appropriately (e.g., db['collection_name'].find(...)).
3. Do not include markdown formatting or explanations, just return the code, but you can use ```python if you must.
4. If the user is asking for a visualization, ensure the query retrieves the necessary data format.
"""

EVALUATE_PROMPT = """
You are a database QA tester evaluating a generated MongoDB query.

User's Original Request: {user_input}
Generated Query: {generated_query}
Is Write Action: {is_write_action}
Query Result / Error: 
{query_result}

Your task:
Determine if this query successfully answers the user's request based on the code and the result.
If there is an error in the query result, or if it clearly does not match the intent, it is NOT valid.
If it is a write action, we cannot test the result, but you should evaluate if the code looks correct for the user's intent.

Respond in JSON format:
{{
    "is_valid": true/false,
    "critique": "If invalid, explain what went wrong and how to fix it. If valid, briefly explain why."
}}
"""


def generate_query_node(state: AgentState):
    logger.info(f"--- GENERATE NODE (Iteration {state.get('iterations', 0)}) ---")

    prompt = GENERATE_PROMPT.format(
        user_input=state["user_input"],
        database=state["database"],
        collections=", ".join(state["collections"]),
        schema_context=state["schema_context"],
        intermediate_context=state.get("intermediate_context", {}),
        evaluation=state.get("evaluation", "None"),
    )

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                thinking_config=types.ThinkingConfig(thinking_budget=0)
            ),
        )
        code = extract_python_code(response.text)
    except Exception as e:
        code = f"# Error generating query: {str(e)}"

    # Check if write action heuristically
    write_methods = [
        "insert_one(",
        "insert_many(",
        "insert(",
        "update_one(",
        "update_many(",
        "update(",
        "delete_one(",
        "delete_many(",
        "delete(",
        "replace_one(",
        "drop(",
        "create_index(",
    ]
    is_write = any(method in code.lower() for method in write_methods)
    logger.info(f"Generated query: {code}")
    logger.info(f"Is write action heuristic: {is_write}")

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
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                thinking_config=types.ThinkingConfig(thinking_budget=0),
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
    if state.get("iterations", 0) >= 3:
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
):
    logger.info(f"Starting ReAct Agent workflow for input: '{user_input}'")
    initial_state = {
        "user_input": user_input,
        "database": database,
        "collections": collections,
        "schema_context": schema_context,
        "intermediate_context": intermediate_context,
        "connection_string": connection_string,
        "iterations": 0,
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
