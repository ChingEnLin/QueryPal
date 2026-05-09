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
    account_id: str  # Added for cross-collection schema fetching
    db_context: DBContext
    collection_context: list[CollectionContext] = (
        []
    )  # List of contexts for selected collections
    intermediate_context: object | None = (
        None  # Optional intermediate context for complex queries
    )


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


class SchemaRelationshipsRequest(BaseModel):
    account_id: str
    database_name: str
    collection_names: list[str]


class Relationship(BaseModel):
    source_collection: str
    source_field: str
    target_collection: str
    target_field: str
    description: str
    confidence: float  # 0.0 to 1.0


class SchemaRelationshipsResponse(BaseModel):
    relationships: list[Relationship]


class EvaluateWriteRequest(BaseModel):
    user_intent: str
    query_code: str
    write_result: dict
    account_id: str
    database_name: str


class EvaluateWriteResponse(BaseModel):
    evaluation: str
