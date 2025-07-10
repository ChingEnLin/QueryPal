from google import genai
from google.genai import types
from models.schemas import (
    GeneratedCode,
    CollectionContext,
    DebugSuggestionResponse
)

PROMPT_TEMPLATE_QUERY = """
You are an assistant that converts user requests into MongoDB query code.
User said: "{user_input}"
Database: {database}
Available collections: {collections}
Sample collection document (optional): {collection_context}
Return:
pymongo query code (e.g., db["collection"].find(...))
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

def generate_query_from_prompt(user_input: str,
                               collections: list[str],
                               database: str,
                               collection_context: CollectionContext = None) -> GeneratedCode:
    full_prompt = PROMPT_TEMPLATE_QUERY.format(
        user_input=user_input,
        database=database,
        collections=", ".join(collections),
        collection_context=collection_context.sampleDocument if collection_context else ""
    )
    client = genai.Client()
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=full_prompt,
        config=types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(thinking_budget=0) # Disables thinking
        ))
    code = extract_python_code(response.text)
    return GeneratedCode(generated_code=code)

def generate_suggestion_from_query_error(query: str, error_message: str) -> str:
    """
    Sends a failed query and error message to Gemini for debugging suggestion.
    """
    full_prompt = PROMPT_TEMPLATE_DEBUG.format(
        query=query,
        error_message=error_message
    )
    client = genai.Client()
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=full_prompt,
        config=types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(thinking_budget=0) # Disables thinking
        ))
    suggestion = response.text.strip() if hasattr(response, 'text') else str(response).strip
    return DebugSuggestionResponse(suggestion=suggestion)