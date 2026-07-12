import base64
import json
import uuid
from typing import List, Optional
from models.user_queries import SavedQuery, SavedQueryCreate, SavedQueryUpdate
from services.pg_connection import get_connection

_COLS = "id, name, prompt, code, engine, owner_email, shared_with, last_modified_by, updated_at"

# Additive migration: existing deployments created saved_queries without an
# engine column. Add it once per process (ALTER ... IF NOT EXISTS is idempotent).
_engine_col_ready = False


def _ensure_engine_column(conn):
    global _engine_col_ready
    if _engine_col_ready:
        return
    c = conn.cursor()
    c.execute(
        "ALTER TABLE saved_queries "
        "ADD COLUMN IF NOT EXISTS engine TEXT NOT NULL DEFAULT 'cosmos'"
    )
    _engine_col_ready = True


def _row_to_query(row) -> SavedQuery:
    shared_with = row[6].split(",") if row[6] else []
    return SavedQuery(
        id=row[0],
        name=row[1],
        prompt=row[2],
        code=row[3],
        engine=row[4] or "cosmos",
        ownerEmail=row[5],
        sharedWith=shared_with,
        lastModifiedBy=row[7],
        updatedAt=row[8],
    )


def get_user_id_from_token(token: str) -> str:
    # Extract user email from Azure Entra ID JWT access token
    try:
        # JWT format: header.payload.signature
        payload = token.split(".")[1]
        # Pad base64 if needed
        missing_padding = len(payload) % 4
        if missing_padding:
            payload += "=" * (4 - missing_padding)
        claims = json.loads(base64.urlsafe_b64decode(payload).decode())
        # Use 'email' claim if present, else 'upn' (user principal name)
        return claims.get("email") or claims.get("upn") or token
    except Exception:
        # Fallback: use token if parsing fails
        return token


def get_saved_queries(user_id: str, engine: Optional[str] = None) -> List[SavedQuery]:
    conn = get_connection()
    _ensure_engine_column(conn)
    c = conn.cursor()
    # Return queries owned by or shared with user, optionally filtered by engine.
    sql = (
        f"SELECT {_COLS} FROM saved_queries "
        "WHERE (owner_email = %s OR position(%s in shared_with) > 0)"
    )
    params = [user_id, user_id]
    if engine:
        sql += " AND engine = %s"
        params.append(engine)
    c.execute(sql, tuple(params))
    rows = c.fetchall()
    conn.close()
    return [_row_to_query(row) for row in rows]


def create_saved_query(user_id: str, data: SavedQueryCreate) -> SavedQuery:
    import datetime

    query_id = str(uuid.uuid4())
    now = datetime.datetime.utcnow().isoformat() + "Z"
    conn = get_connection()
    _ensure_engine_column(conn)
    c = conn.cursor()
    c.execute(
        "INSERT INTO saved_queries "
        "(id, name, prompt, code, engine, owner_email, shared_with, "
        "last_modified_by, updated_at) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
        (
            query_id,
            data.name,
            data.prompt,
            data.code,
            data.engine,
            user_id,
            "",
            user_id,
            now,
        ),
    )
    conn.close()
    return SavedQuery(
        id=query_id,
        name=data.name,
        prompt=data.prompt,
        code=data.code,
        engine=data.engine,
        ownerEmail=user_id,
        sharedWith=[],
        lastModifiedBy=user_id,
        updatedAt=now,
    )


def update_saved_query(
    user_id: str, query_id: str, data: SavedQueryUpdate
) -> SavedQuery:
    import datetime

    # Only owner or shared user can update
    conn = get_connection()
    _ensure_engine_column(conn)
    c = conn.cursor()
    c.execute(
        "SELECT owner_email, shared_with FROM saved_queries WHERE id = %s", (query_id,)
    )
    row = c.fetchone()
    if not row:
        conn.close()
        raise ValueError("Saved query not found")
    owner_email, shared_with = row
    shared_list = shared_with.split(",") if shared_with else []
    if user_id != owner_email and user_id not in shared_list:
        conn.close()
        raise PermissionError("Not allowed to update this query")
    now = datetime.datetime.utcnow().isoformat() + "Z"
    # engine is immutable after creation; not updated here.
    c.execute(
        "UPDATE saved_queries SET name = %s, prompt = %s, code = %s, shared_with = %s, "
        "last_modified_by = %s, updated_at = %s WHERE id = %s",
        (
            data.name,
            data.prompt,
            data.code,
            ",".join(data.sharedWith),
            user_id,
            now,
            query_id,
        ),
    )
    c.execute(f"SELECT {_COLS} FROM saved_queries WHERE id = %s", (query_id,))
    row = c.fetchone()
    conn.close()
    return _row_to_query(row)


def delete_saved_query(user_id: str, query_id: str):
    # Only owner can delete
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT owner_email FROM saved_queries WHERE id = %s", (query_id,))
    row = c.fetchone()
    if not row or row[0] != user_id:
        conn.close()
        raise PermissionError("Not allowed to delete this query")
    c.execute("DELETE FROM saved_queries WHERE id = %s", (query_id,))
    conn.close()
