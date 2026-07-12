from pydantic import BaseModel
from typing import List


class SavedQuery(BaseModel):
    id: str
    name: str
    prompt: str
    code: str
    engine: str = "cosmos"  # "cosmos" | "pg"
    ownerEmail: str
    sharedWith: List[str]
    lastModifiedBy: str
    updatedAt: str  # ISO8601 string


class SavedQueryCreate(BaseModel):
    name: str
    prompt: str
    code: str
    engine: str = "cosmos"


class SavedQueryUpdate(BaseModel):
    name: str
    prompt: str
    code: str
    engine: str = "cosmos"
    ownerEmail: str
    sharedWith: List[str]
    lastModifiedBy: str
    updatedAt: str
