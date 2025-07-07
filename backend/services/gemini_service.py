from os import environ as env
from google import genai
from ..models.schemas import QueryResultData

PROMPT_TEMPLATE = """
You are an assistant that converts user requests into MongoDB query code.
User said: "{user_input}"
Database: {database}
Available collections: {collections}
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

def generate_query_from_prompt(user_input: str, collections: list[str], database: str) -> QueryResultData:
    full_prompt = PROMPT_TEMPLATE.format(
        user_input=user_input,
        database=database,
        collections=", ".join(collections)
    )
    client = genai.Client()
    response = client.models.generate_content(model="gemini-2.5-flash", contents=full_prompt)
    code = extract_python_code(response.text)
    return QueryResultData(generated_code=code)
