from pydantic import BaseModel
class AccountDetailsRequest(BaseModel):
    account_id: str
class QueryResultData(BaseModel):
    intent_summary: str
    generated_code: str
    confirmation_prompt: str
