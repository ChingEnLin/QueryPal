import base64
import json
import sqlite3
import uuid
from models.user_queries import SavedQuery, SavedQueryCreate, SavedQueryUpdate
from typing import List

DB_PATH = "querypal.db"

# Initialize DB and table
conn = sqlite3.connect(DB_PATH)
c = conn.cursor()
c.execute("""
CREATE TABLE IF NOT EXISTS saved_queries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    prompt TEXT NOT NULL,
    code TEXT NOT NULL
)
""")
conn.commit()
conn.close()

def get_user_id_from_token(token: str) -> str:
    # Extract user email from Azure Entra ID JWT access token
    try:
        # JWT format: header.payload.signature
        payload = token.split(".")[1]
        # Pad base64 if needed
        missing_padding = len(payload) % 4
        if missing_padding:
            payload += '=' * (4 - missing_padding)
        claims = json.loads(base64.urlsafe_b64decode(payload).decode())
        # Use 'email' claim if present, else 'upn' (user principal name)
        return claims.get("email") or claims.get("upn") or token
    except Exception:
        # Fallback: use token if parsing fails
        return token

def get_saved_queries(user_id: str) -> List[SavedQuery]:
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id, name, prompt, code FROM saved_queries WHERE user_id = ?", (user_id,))
    rows = c.fetchall()
    conn.close()
    return [SavedQuery(id=row[0], name=row[1], prompt=row[2], code=row[3]) for row in rows]

def create_saved_query(user_id: str, data: SavedQueryCreate) -> SavedQuery:
    query_id = str(uuid.uuid4())
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("INSERT INTO saved_queries (id, user_id, name, prompt, code) VALUES (?, ?, ?, ?, ?)",
              (query_id, user_id, data.name, data.prompt, data.code))
    conn.commit()
    conn.close()
    return SavedQuery(id=query_id, name=data.name, prompt=data.prompt, code=data.code)

def update_saved_query(user_id: str, query_id: str, data: SavedQueryUpdate) -> SavedQuery:
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("UPDATE saved_queries SET name = ?, prompt = ?, code = ? WHERE id = ? AND user_id = ?",
              (data.name, data.prompt, data.code, query_id, user_id))
    conn.commit()
    c.execute("SELECT id, name, prompt, code FROM saved_queries WHERE id = ? AND user_id = ?", (query_id, user_id))
    row = c.fetchone()
    conn.close()
    if not row:
        raise ValueError("Saved query not found")
    return SavedQuery(id=row[0], name=row[1], prompt=row[2], code=row[3])

def delete_saved_query(user_id: str, query_id: str):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM saved_queries WHERE id = ? AND user_id = ?", (query_id, user_id))
    conn.commit()
    conn.close()
