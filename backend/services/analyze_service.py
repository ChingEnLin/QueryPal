import json
from google import genai
from google.genai import types
from models.analyze import AnalyzeResponse
from services.gemini_service import thinking_config_for


def analyze_query_result(
    query_result: list[dict], model: str = "gemini-2.5-flash"
) -> AnalyzeResponse:
    prompt = f"""
You are a data analyst assistant. Given the following MongoDB query result, provide:
1. A concise textual insight or summary of the data.
2. A recommended chart type (bar, line, pie, etc.) for visualization.
3. Chart.js compatible data and options objects for the recommended chart.
4. Exactly three follow-up prompts the user could run next as new queries. Each must be a short, actionable natural-language request phrased so it can be handed straight to a query generator (e.g. "show the 10 most recent orders", "count documents grouped by status"), grounded in this data or the collection it came from. This field is REQUIRED and must always contain three non-empty strings — never return an empty list.

Query result (JSON array):
{query_result}

Respond in JSON with keys: insight, chartType, chartData, chartOptions, followups.
The followups value must be a JSON array of exactly three non-empty strings.
"""
    client = genai.Client()
    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(thinking_config=thinking_config_for(model)),
    )
    # Try to extract JSON from the response
    try:
        # Find the first JSON object in the response
        import re

        match = re.search(r"\{[\s\S]+\}", response.text)
        if match:
            data = json.loads(match.group(0))
        else:
            data = json.loads(response.text)
    except Exception:
        raise ValueError("Gemini did not return valid JSON for analysis.")
    return AnalyzeResponse(**data)
