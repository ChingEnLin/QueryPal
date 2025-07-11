from pydantic import BaseModel

class AccountDetailsRequest(BaseModel):
    account_id: str

class CollectionInfoRequest(BaseModel):
    account_id: str
    database_name: str
    collection_name: str

class Collection(BaseModel):
    name: str
    count: int

class DBContext(BaseModel):
    name: str
    collections: list[Collection]

class CollectionContext(BaseModel):
    name: str
    sampleDocument: dict | None = None  # Optional sample document

class QueryPrompt(BaseModel):
    user_input: str
    db_context: DBContext
    collection_context: CollectionContext | None = None  # Optional context for specific collection
    intermediate_context: object | None = None  # Optional intermediate context for complex queries

class GeneratedCode(BaseModel):
    generated_code: str

class ExecuteInput(BaseModel):
    account_id: str
    database_name: str
    query: str

class DebugQueryRequest(BaseModel):
    query: str
    error_message: str

class DebugSuggestionResponse(BaseModel):
    suggestion: str