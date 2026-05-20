from google import genai
from google.genai import types
from models.schemas import EvaluateWriteResponse
from services.mongo_service import execute_mongo_query, transform_mongo_result
from services.react_agent_service import is_write_operation


def evaluate_write_result(
    user_intent: str,
    query_code: str,
    write_result: dict,
    connection_string: str = "",
    database_name: str = "",
    model: str = "gemini-2.5-flash",
) -> EvaluateWriteResponse:
    prompt = f"""
You are an expert MongoDB database administrator and assistant.
The user wanted to achieve the following intent:
"{user_intent}"

To do this, the following MongoDB query was executed:
```python
{query_code}
```

The execution resulted in the following write summary from MongoDB:
```json
{write_result}
```

Please evaluate if the query successfully achieved the user's intent based on the write result. If you are unsure and need to verify the actual data in the database, you can use the `query_database` tool to run a READ ONLY query.

If the write summary provides enough confidence that the operation worked as intended, you don't need to run a query.

Provide a short, friendly, and helpful explanation (1-3 sentences) telling the user what happened (e.g., "Successfully updated 1 document", "The query didn't update any documents, which might mean the data wasn't found", etc.). Provide details if you verified the data.

Respond with plain text only in your final answer.
"""

    def query_database(query: str) -> str:
        """
        Executes a PyMongo read-only query on the database.
        Example query: "db['users'].find_one({'name': 'Test'})"

        Args:
            query: The PyMongo query string to execute. Must be read-only.
        Returns:
            The JSON stringified result of the query.
        """
        if not connection_string or not database_name:
            return "Error: Database connection not available for verification."

        if is_write_operation(query):
            return "Error: Only read queries are allowed."

        try:
            res = execute_mongo_query(connection_string, database_name, query)
            return str(transform_mongo_result(res))
        except Exception as e:
            return f"Error executing query: {str(e)}"

    client = genai.Client()

    tools = [query_database] if connection_string else None

    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(
            tools=tools, thinking_config=types.ThinkingConfig(thinking_budget=0)
        ),
    )

    # Process function calls, capped to prevent unbounded loops
    MAX_TOOL_ROUNDS = 5
    tool_rounds = 0
    while response.function_calls and tool_rounds < MAX_TOOL_ROUNDS:
        tool_rounds += 1
        for function_call in response.function_calls:
            if function_call.name == "query_database":
                # Execute the tool
                args = function_call.args
                query_str = args.get("query", "")
                tool_result = query_database(query_str)

                # Send the tool result back to the model
                response = client.models.generate_content(
                    model=model,
                    contents=[
                        prompt,
                        response.candidates[0].content,
                        types.Part.from_function_response(
                            name="query_database", response={"result": tool_result}
                        ),
                    ],
                    config=types.GenerateContentConfig(
                        tools=tools,
                        thinking_config=types.ThinkingConfig(thinking_budget=0),
                    ),
                )

    return EvaluateWriteResponse(evaluation=response.text.strip())
