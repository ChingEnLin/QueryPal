from google import genai
from models.schemas import GeneratedCode, CollectionContext

PROMPT_TEMPLATE = """
You are an assistant that converts user requests into MongoDB query code.
User said: "{user_input}"
Database: {database}
Available collections: {collections}
Sample collection document (optional): {collection_context}
Return:
pymongo query code (e.g., db["collection"].find(...))
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
    full_prompt = PROMPT_TEMPLATE.format(
        user_input=user_input,
        database=database,
        collections=", ".join(collections),
        collection_context=collection_context.sampleDocument if collection_context else ""
    )
    client = genai.Client()
    response = client.models.generate_content(model="gemini-2.5-flash", contents=full_prompt)
    code = extract_python_code(response.text)
    return GeneratedCode(generated_code=code)
