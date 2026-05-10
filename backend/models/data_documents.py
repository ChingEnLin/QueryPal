from pydantic import BaseModel
from typing import Optional, List, Dict, Any


class DataDocumentsFilter(BaseModel):
    key: str
    value: Any = ""  # Can be str, int, etc. depending on the field type
    operator: Optional[str] = "equals"  # 'equals', 'exists', 'not_exists'
    type: Optional[str] = "string"


class DataDocumentsRequest(BaseModel):
    account_id: str
    database_name: str
    collection_name: str
    page: int = 1
    limit: int = 20
    filter: Optional[DataDocumentsFilter] = None
    filters: Optional[List[DataDocumentsFilter]] = None


class DataDocumentsQueryResponse(BaseModel):
    query_code: str


class DataDocumentsResponse(BaseModel):
    documents: List[Dict[str, Any]]
    currentPage: int
    totalPages: int
    totalDocuments: int


class FindByIdRequest(BaseModel):
    account_id: str
    database_name: str
    collection_names: List[str]
    document_id: str
    key_context: Optional[str] = None


class FindByIdResponse(BaseModel):
    document: Dict[str, Any]
    collectionName: str


class UpdateDocumentRequest(BaseModel):
    account_id: str
    database_name: str
    collection: str
    id: str
    content: Dict[str, Any]


class SingleDocumentRequest(BaseModel):
    account_id: str
    database_name: str
    collection_name: str
    document_id: str


class InsertDocumentRequest(BaseModel):
    account_id: str
    database_name: str
    collection_name: str
    document: Dict[str, Any]


class DeleteDocumentRequest(BaseModel):
    account_id: str
    database_name: str
    collection_name: str
    document_id: str


# Document History Models
class DocumentHistoryEntry(BaseModel):
    id: str
    user_email: str
    operation: str  # 'insert', 'update', 'delete'
    timestamp_utc: str
    diff_data: Any
    database_name: str
    collection_name: str


class DocumentHistoryRequest(BaseModel):
    account_id: str
    database_name: str
    collection_name: str
    document_id: str


class DocumentHistoryResponse(BaseModel):
    document_id: str
    history_entries: List[DocumentHistoryEntry]
    total_entries: int
