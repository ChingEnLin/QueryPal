"""Read-only SQL execution + write/DDL detection for Azure PostgreSQL.

Safety model: every statement runs inside a transaction explicitly set
READ ONLY, so PostgreSQL itself rejects any write — no custom sandbox. Write
and DDL statements are detected up front and returned for manual review
instead of being executed (parity with the Cosmos Mongo write-guard).
"""

import datetime
import decimal
import uuid

import sqlparse

OSSRDBMS_SCOPE = "https://ossrdbms-aad.database.windows.net/.default"

# Leading keyword of statements we consider safe to execute.
_READ_KEYWORDS = {"SELECT", "WITH", "SHOW", "EXPLAIN"}


def is_write_sql(sql: str) -> bool:
    """True if `sql` is a write/DDL statement (or cannot be parsed).

    Fails safe: anything we can't confidently classify as a read is a write.
    """
    statements = [s for s in sqlparse.parse(sql or "") if str(s).strip()]
    if not statements:
        return True
    for stmt in statements:
        keyword = stmt.token_first(skip_cm=True)
        if keyword is None:
            return True
        if keyword.normalized.upper() not in _READ_KEYWORDS:
            return True
    return False


def _json_safe(value):
    if isinstance(value, (datetime.datetime, datetime.date, datetime.time)):
        return value.isoformat()
    if isinstance(value, decimal.Decimal):
        return str(value)
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, (bytes, memoryview)):
        return bytes(value).hex()
    return value


def execute_sql(conn, sql: str) -> dict:
    """Run `sql` read-only. Returns {"columns", "rows"} or {"error"}."""
    try:
        with conn.cursor() as cur:
            cur.execute("SET TRANSACTION READ ONLY")
            cur.execute(sql)
            columns = [d[0] for d in (cur.description or [])]
            rows = [[_json_safe(v) for v in row] for row in cur.fetchall()]
        return {"columns": columns, "rows": rows}
    except Exception as e:
        return {"error": str(e)}
