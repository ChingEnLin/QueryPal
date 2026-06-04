from typing import Optional

from pydantic import BaseModel, Field


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
    max_iterations: int = Field(
        default=3, ge=1, le=10
    )  # Server-enforced agent iteration cap
    model: str = "gemini-2.5-flash"


class GeneratedCode(BaseModel):
    generated_code: str


class ExecuteInput(BaseModel):
    account_id: str
    database_name: str
    query: str


class DebugQueryRequest(BaseModel):
    query: str
    error_message: str
    model: str = "gemini-2.5-flash"


class DebugSuggestionResponse(BaseModel):
    suggestion: str


class SchemaRelationshipsRequest(BaseModel):
    account_id: str
    database_name: str
    collection_names: list[str]
    model: str = "gemini-2.5-flash"


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
    model: str = "gemini-2.5-flash"


class EvaluateWriteResponse(BaseModel):
    evaluation: str


class RoleAssignment(BaseModel):
    assignment_id: str
    role_name: str


class UserWithRoles(BaseModel):
    oid: str
    email: str
    display_name: Optional[str] = None
    first_seen: str
    last_seen: str
    roles: list[RoleAssignment] = []


class AssignRoleRequest(BaseModel):
    role: str
