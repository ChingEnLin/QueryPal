from google import genai
from google.genai import types
from models.schemas import GeneratedCode, CollectionContext, DebugSuggestionResponse, SchemaRelationshipsResponse
from pydantic import BaseModel, Field
from typing import Optional, List


class VisualizationConfig(BaseModel):
    available: bool = Field(description="Whether a chart is recommended for this data")
    type: Optional[str] = Field(
        description="Type of chart: 'bar', 'line', 'pie', 'scatter'"
    )
    x_key: Optional[str] = Field(description="Key for X-axis data")
    y_key: Optional[str] = Field(description="Key for Y-axis data")
    title: Optional[str] = Field(description="Title for the chart")
    data_keys: Optional[List[str]] = Field(
        description="Keys to include in the chart data points (e.g. ['count', 'date'])"
    )


class AuditSummaryResponse(BaseModel):
    summary: str = Field(description="Markdown summary of the results")
    visualization: VisualizationConfig = Field(
        description="Configuration for data visualization"
    )


PROMPT_TEMPLATE_QUERY = """
You are an assistant that converts user requests into MongoDB query code.
User said: "{user_input}"
Database: {database}
Available collections: {collections}
Sample collection document (optional): {collection_context}
Schema summary for ALL collections (for JOINs/lookups): {all_collections_schema}
Intermediate context (optional): {intermediate_context}
Return:
only one line of pure pymongo query code (e.g., db["collection"].find(...))
"""

PROMPT_TEMPLATE_DEBUG = """
You are a MongoDB and PyMongo expert. A user tried to run the following query and got an error. Analyze the error and suggest a fix in one sentence.
Query:{query}
Error message:{error_message}
Respond ONLY with a suggestion for how to fix the query. Do not repeat the error message or query.
"""


def extract_python_code(text: str) -> str:
    """
    Extracts code from a string wrapped in triple backticks (```python ... ```), or returns the original if not wrapped.
    """
    import re

    match = re.search(r"```python\s*([\s\S]+?)\s*```", text)
    if match:
        return match.group(1).strip()
    return text.strip()


def prune_intermediate_context(context: dict, max_length: int = 512) -> dict:
    """
    Recursively remove keys from the context dict that likely contain image or large binary data (e.g., base64-encoded images).
    - Removes any string value longer than max_length.
    - Removes keys with common image/binary names (e.g., 'image', 'img', 'picture', 'photo', 'data', 'file', 'content', 'blob').
    - Recurses into nested dicts and lists.
    """
    if not isinstance(context, dict):
        return context
    image_keys = {
        "image",
        "picture",
        "photo",
        "thumbnail",
        "preview_image",
        "avatar",
        "icon",
    }
    pruned = {}
    for k, v in context.items():
        # Remove by key name
        if k.lower() in image_keys:
            continue
        # Remove by string length (likely base64 or large text)
        if isinstance(v, str) and len(v) > max_length:
            continue
        # Recurse for dicts
        if isinstance(v, dict):
            nested = prune_intermediate_context(v, max_length)
            if nested:  # Only add if not empty
                pruned[k] = nested
        # Recurse for lists
        elif isinstance(v, list):
            filtered = []
            for item in v:
                if isinstance(item, dict):
                    nested = prune_intermediate_context(item, max_length)
                    if nested:
                        filtered.append(nested)
                elif isinstance(item, str) and len(item) <= max_length:
                    filtered.append(item)
                elif not isinstance(item, str):
                    filtered.append(item)
            if filtered:
                pruned[k] = filtered
        else:
            pruned[k] = v
    return pruned


def generate_query_from_prompt(
    user_input: str,
    collections: list[str],
    database: str,
    collection_context: CollectionContext = None,
    intermediate_context: dict = None,
    all_collections_schema: str = ""
) -> GeneratedCode:
    # Prune intermediate_context to remove image/large data
    safe_intermediate_context = (
        prune_intermediate_context(intermediate_context) if intermediate_context else {}
    )
    full_prompt = PROMPT_TEMPLATE_QUERY.format(
        user_input=user_input,
        database=database,
        collections=", ".join(collections),
        collection_context=(
            collection_context.sampleDocument if collection_context else ""
        ),
        all_collections_schema=all_collections_schema,
        intermediate_context=safe_intermediate_context,
    )
    client = genai.Client()
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=full_prompt,
        config=types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(thinking_budget=0)  # Disables thinking
        ),
    )
    code = extract_python_code(response.text)
    return GeneratedCode(generated_code=code)


def generate_suggestion_from_query_error(query: str, error_message: str) -> str:
    """
    Sends a failed query and error message to Gemini for debugging suggestion.
    """
    full_prompt = PROMPT_TEMPLATE_DEBUG.format(query=query, error_message=error_message)
    client = genai.Client()
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=full_prompt,
        config=types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(thinking_budget=0)  # Disables thinking
        ),
    )
    suggestion = (
        response.text.strip() if hasattr(response, "text") else str(response).strip
    )
    return DebugSuggestionResponse(suggestion=suggestion)


PROMPT_TEMPLATE_AUDIT_SQL = """
You are a PostgreSQL expert. Convert the user's natural language question into a read-only SQL query for the `write_audit_log` table.
Table Schema:
- user_email (text): Email of the user who performed the operation.
- operation (text): 'insert', 'update', or 'delete'.
- database_name (text): Name of the database (format: account.database).
- collection_name (text): Name of the collection.
- document_id (text): ID of the affected document.
- diff_data (jsonb): JSON containing the changes (for updates, it has 'before' and 'after' fields).
- timestamp_utc (timestamptz): When the operation occurred.

User Question: "{user_input}"

Rules:
1. Return ONLY the SQL query. No markdown, no explanations.
2. The query MUST be a SELECT statement.
3. Use LIMIT 100 if no limit is specified.
4. If the user asks for "recent", order by timestamp_utc DESC.
"""

PROMPT_TEMPLATE_AUDIT_SUMMARY = """
You are a data analyst. Analyze the following SQL query and its results.

User Question: "{user_input}"
SQL Query: "{sql_query}"
Results:
{results}

Tasks:
1. Provide a concise markdown summary identifying patterns or answering the specific question.
2. Determine if the data is suitable for visualization (e.g., time series, counts, comparisons).
3. If suitable, structure a visualization configuration (type, keys, title).
   - For time series, prefer 'line' or 'bar'.
   - For categorical counts, use 'bar' or 'pie'.
"""


def generate_audit_sql(user_input: str) -> str:
    full_prompt = PROMPT_TEMPLATE_AUDIT_SQL.format(user_input=user_input)
    client = genai.Client()
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=full_prompt,
        config=types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(thinking_budget=0)
        ),
    )
    sql = extract_python_code(response.text)
    # Basic safety check
    if not sql.lower().startswith("select"):
        return "SELECT 'Error: Generated query was not a SELECT statement' as error;"
    return sql


def summarize_audit_results(
    user_input: str, sql_query: str, results: list
) -> AuditSummaryResponse:
    # Truncate results if too large to avoid token limits
    results_str = str(results)[:10000]
    full_prompt = PROMPT_TEMPLATE_AUDIT_SUMMARY.format(
        user_input=user_input, sql_query=sql_query, results=results_str
    )
    client = genai.Client()
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=full_prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=AuditSummaryResponse,
            thinking_config=types.ThinkingConfig(thinking_budget=0),
        ),
    )

    if hasattr(response, "parsed") and response.parsed:
        return response.parsed

    import json

    try:
        data = json.loads(response.text)
        return AuditSummaryResponse(**data)
    except Exception as e:
        print(f"Error parsing Gemini response: {e}")
        return AuditSummaryResponse(
            summary="Could not generate summary due to parsing error.",
            visualization=VisualizationConfig(available=False),
        )


PROMPT_TEMPLATE_RELATIONSHIPS = """
You are a database architect. Analyze the provided MongoDB document samples to identify likely foreign key relationships and JOIN conditions between collections.

Schema/Samples:
{schema_summary}

Tasks:
1. Identify likely relationships (e.g., `userId` in `orders` -> `_id` in `users`).
2. Provide a confidence score (0.0 - 1.0) and a brief description for each.
3. Return a JSON object with a "relationships" key containing a list of these findings.

Output Format (Json):
{{
  "relationships": [
    {{
      "source_collection": "orders",
      "source_field": "userId",
      "target_collection": "users",
      "target_field": "_id",
      "description": "Orders belong to Users",
      "confidence": 0.95
    }}
  ]
}}
"""


def generate_schema_relationships(schema_summary: str) -> SchemaRelationshipsResponse:
    from models.schemas import SchemaRelationshipsResponse
    
    full_prompt = PROMPT_TEMPLATE_RELATIONSHIPS.format(schema_summary=schema_summary)
    client = genai.Client()
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=full_prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=SchemaRelationshipsResponse,
            thinking_config=types.ThinkingConfig(thinking_budget=0),
        ),
    )

    if hasattr(response, "parsed") and response.parsed:
        return response.parsed

    import json
    try:
        data = json.loads(response.text)
        return SchemaRelationshipsResponse(**data)
    except Exception as e:
        print(f"Error parsing Gemini relationship response: {e}")
        return SchemaRelationshipsResponse(relationships=[])
