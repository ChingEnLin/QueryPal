"""Parameterized, whitelist-validated row CRUD for Azure PostgreSQL.

Distinct from pg_query_service (arbitrary read-only SQL): here every identifier
is validated against the target table's real catalog columns and every value is
bound as a parameter, closing both the identifier and value injection paths.
Writes require a primary key so UPDATE/DELETE target exactly one row.
"""
from typing import Iterable, List, Tuple

from services.pg_query_service import _json_safe


class RowError(Exception):
    """Bad request against a row endpoint (unknown column, bad operator, etc.)."""


class NoPrimaryKey(RowError):
    """Table has no primary key, so row-scoped writes are unsupported."""


_OPS = {
    "=": "=", "!=": "<>", "<": "<", ">": ">", "<=": "<=", ">=": ">=",
    "like": "LIKE", "ilike": "ILIKE",
}
_NULLARY = {"isnull": "IS NULL", "isnotnull": "IS NOT NULL"}


def _qi(name: str) -> str:
    # Safe only after `name` is whitelisted against real catalog columns; the
    # doubling handles legitimate special characters in an identifier.
    return '"' + name.replace('"', '""') + '"'


def _qt(schema: str, table: str) -> str:
    # Contract: schema/table are quote-escaped here (injection-safe) but NOT
    # allowlisted — the caller must resolve them against the real catalog first
    # (the route does this via get_table_info, which 404s an unknown table).
    return f"{_qi(schema)}.{_qi(table)}"


def _check(cols: Iterable[str], allowed: set) -> None:
    unknown = [c for c in cols if c not in allowed]
    if unknown:
        raise RowError(f"Unknown column(s): {', '.join(unknown)}")


def _where(filters: list, allowed: set) -> Tuple[str, List]:
    if not filters:
        return "", []
    clauses, params = [], []
    for f in filters:
        col = f.get("column")
        op = (f.get("op") or "=").lower()
        _check([col], allowed)
        if op in _NULLARY:
            clauses.append(f"{_qi(col)} {_NULLARY[op]}")
        elif op in _OPS:
            clauses.append(f"{_qi(col)} {_OPS[op]} %s")
            params.append(f.get("value"))
        else:
            raise RowError(f"Unsupported operator: {op}")
    return " WHERE " + " AND ".join(clauses), params


def build_browse(schema, table, allowed, filters, sort, limit, offset):
    where, params = _where(filters or [], allowed)
    order = ""
    if sort and sort.get("column"):
        _check([sort["column"]], allowed)
        direction = "DESC" if str(sort.get("dir", "asc")).lower() == "desc" else "ASC"
        order = f" ORDER BY {_qi(sort['column'])} {direction}"
    q = f"SELECT * FROM {_qt(schema, table)}{where}{order} LIMIT %s OFFSET %s"
    return q, params + [limit, offset]


def build_count(schema, table, allowed, filters):
    where, params = _where(filters or [], allowed)
    return f"SELECT count(*) FROM {_qt(schema, table)}{where}", params


def build_insert(schema, table, allowed, values):
    if not values:
        raise RowError("No values to insert.")
    _check(values.keys(), allowed)
    cols = list(values)
    placeholders = ", ".join(["%s"] * len(cols))
    collist = ", ".join(_qi(c) for c in cols)
    q = f"INSERT INTO {_qt(schema, table)} ({collist}) VALUES ({placeholders}) RETURNING *"
    return q, [values[c] for c in cols]


def _pk_where(pk, pk_cols):
    if not pk_cols:
        raise NoPrimaryKey("Table has no primary key; row edits are unsupported.")
    if set(pk) != set(pk_cols):
        raise RowError("Primary key columns do not match the table's key.")
    clause = " AND ".join(f"{_qi(c)} = %s" for c in pk_cols)
    return clause, [pk[c] for c in pk_cols]


def build_update(schema, table, allowed, pk_cols, pk, values):
    if not values:
        raise RowError("No values to update.")
    where, wparams = _pk_where(pk, pk_cols)
    _check(values.keys(), allowed)
    cols = list(values)
    setlist = ", ".join(f"{_qi(c)} = %s" for c in cols)
    q = f"UPDATE {_qt(schema, table)} SET {setlist} WHERE {where} RETURNING *"
    return q, [values[c] for c in cols] + wparams


def build_delete(schema, table, pk_cols, pk):
    where, wparams = _pk_where(pk, pk_cols)
    q = f"DELETE FROM {_qt(schema, table)} WHERE {where} RETURNING *"
    return q, wparams


def _fetch(cur) -> dict:
    columns = [d[0] for d in (cur.description or [])]
    rows = [[_json_safe(v) for v in row] for row in cur.fetchall()]
    return {"columns": columns, "rows": rows}


def browse(conn, schema, table, allowed, pk_cols, filters, sort, limit, offset):
    dq, dp = build_browse(schema, table, allowed, filters, sort, limit, offset)
    cq, cp = build_count(schema, table, allowed, filters)
    with conn.cursor() as cur:
        cur.execute("SET TRANSACTION READ ONLY")
        cur.execute(dq, dp)
        result = _fetch(cur)
        cur.execute(cq, cp)
        result["total"] = cur.fetchone()[0]
    result["pk"] = sorted(pk_cols)
    return result


def _write(conn, query, params) -> dict:
    with conn.cursor() as cur:
        cur.execute(query, params)
        result = _fetch(cur)
    conn.commit()
    return result


def insert_row(conn, schema, table, allowed, values):
    q, params = build_insert(schema, table, allowed, values)
    return _write(conn, q, params)


def update_row(conn, schema, table, allowed, pk_cols, pk, values):
    q, params = build_update(schema, table, allowed, pk_cols, pk, values)
    return _write(conn, q, params)


def delete_row(conn, schema, table, pk_cols, pk):
    q, params = build_delete(schema, table, pk_cols, pk)
    return _write(conn, q, params)
