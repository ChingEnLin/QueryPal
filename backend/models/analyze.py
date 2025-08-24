from pydantic import BaseModel
from typing import Any, Dict, List


class AnalyzeRequest(BaseModel):
    query_result: List[Dict[str, Any]]


class AnalyzeResponse(BaseModel):
    insight: str
    chartType: str
    chartData: Dict[str, Any]
    chartOptions: Dict[str, Any]
