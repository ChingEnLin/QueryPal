from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class DataDocumentsRequest(BaseModel):
    account_id: str
    database_name: str
    collection_name: str
    page: int = 1
    limit: int = 20
    search_term: Optional[str] = None

class DataDocumentsResponse(BaseModel):
    documents: List[Dict[str, Any]]
    currentPage: int
    totalPages: int
    totalDocuments: int
