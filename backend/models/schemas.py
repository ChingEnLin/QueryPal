from pydantic import BaseModel
class AccountDetailsRequest(BaseModel):
    account_id: str

class CollectionInfoRequest(BaseModel):
    account_id: str
    database_name: str
    collection_name: str

class QueryResultData(BaseModel):
    intent_summary: str
    generated_code: str
    confirmation_prompt: str
