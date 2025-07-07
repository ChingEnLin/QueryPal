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

class QueryResultData(BaseModel):
    generated_code: str
