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

Query result (JSON array):
{query_result}

Respond in JSON with keys: insight, chartType, chartData, chartOptions.
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
