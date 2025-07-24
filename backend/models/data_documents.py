from pydantic import BaseModel
from typing import Optional, List, Dict, Any


class DataDocumentsFilter(BaseModel):
    key: str
    value: Any  # Can be str, int, etc. depending on the field type

class DataDocumentsRequest(BaseModel):
    account_id: str
    database_name: str
    collection_name: str
    page: int = 1
    limit: int = 20
    filter: Optional[DataDocumentsFilter] = None

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