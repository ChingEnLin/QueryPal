from pydantic import BaseModel

class QueryResultData(BaseModel):
    intent_summary: str
    generated_code: str
    confirmation_prompt: str

class DbConfig(BaseModel):
    name: str
    connectionString: str
