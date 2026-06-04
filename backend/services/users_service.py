import logging
from typing import Optional

from services.pg_connection import get_connection

logger = logging.getLogger(__name__)

_DDL = """
CREATE TABLE IF NOT EXISTS users (
    oid          TEXT PRIMARY KEY,
    email        TEXT NOT NULL,
    display_name TEXT,
    first_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""


def ensure_users_table() -> None:
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(_DDL)
    except Exception:
        logger.warning("users_service: could not ensure users table", exc_info=True)


def upsert_user(oid: Optional[str], email: str, display_name: Optional[str]) -> None:
    if not oid:
        return
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO users (oid, email, display_name, last_seen)
                VALUES (%s, %s, %s, NOW())
                ON CONFLICT (oid) DO UPDATE
                    SET email        = EXCLUDED.email,
                        display_name = EXCLUDED.display_name,
                        last_seen    = NOW()
                """,
                (oid, email, display_name),
            )
    except Exception:
        logger.warning("users_service: upsert_user failed", exc_info=True)
