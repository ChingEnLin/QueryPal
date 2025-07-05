from os import environ as env
import requests
from ..models.schemas import QueryResultData

GEMINI_API_KEY = env.get("GEMINI_API_KEY")

PROMPT_TEMPLATE = """
You are an assistant that converts user requests into MongoDB query code.
User said: "{prompt}" for DB: {db_name}, collection: {collection}.
Return:
- A one-sentence summary of intent
- MongoDB query code (e.g., db.collection.find(...))
- A confirmation prompt string
"""

def generate_query_from_prompt(prompt: str, db_name: str, collection: str) -> QueryResultData:
    full_prompt = PROMPT_TEMPLATE.format(prompt=prompt, db_name=db_name, collection=collection)
    response = requests.post(
        url="https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent",
        params={"key": GEMINI_API_KEY},
        json={"contents": [{"parts": [{"text": full_prompt}]}]}
    )
    response.raise_for_status()
    text = response.json()['candidates'][0]['content']['parts'][0]['text']

    # Basic output parsing – this depends on Gemini response style
    lines = text.splitlines()
    return QueryResultData(
        intent_summary=lines[0].strip(),
        generated_code=lines[1].strip(),
        confirmation_prompt=lines[2].strip()
    )