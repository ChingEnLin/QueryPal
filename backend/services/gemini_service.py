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
    image_keys = {'image', 'picture', 'photo', 'thumbnail', 'preview_image', 'avatar', 'icon'}
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

def generate_query_from_prompt(user_input: str,
                               collections: list[str],
                               database: str,
                               collection_context: CollectionContext = None,
                               intermediate_context: dict = None) -> GeneratedCode:
    # Prune intermediate_context to remove image/large data
    safe_intermediate_context = prune_intermediate_context(intermediate_context) if intermediate_context else {}
    full_prompt = PROMPT_TEMPLATE_QUERY.format(
        user_input=user_input,
        database=database,
        collections=", ".join(collections),
        collection_context=collection_context.sampleDocument if collection_context else "",
        intermediate_context=safe_intermediate_context
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