from pydantic import BaseModel
from typing import Optional

class SavedQuery(BaseModel):
    id: str
    name: str
    prompt: str
    code: str

class SavedQueryCreate(BaseModel):
    name: str
    prompt: str
    code: str

class SavedQueryUpdate(BaseModel):
    name: str
    prompt: str
    code: str
