"""SQL schema utilities and literal normalisation for pg_react_agent_service."""

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)


def _extract_table_refs(schema_context: str) -> list[tuple[str, str]]:
    refs: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for raw in (schema_context or "").splitlines():
        line = raw.strip()
        if not line:
            continue
        m = re.match(r"^([A-Za-z_][\w]*)\.([A-Za-z_][\w]*)", line)
        if not m:
            continue
        item = (m.group(1), m.group(2))
        if item not in seen:
            refs.append(item)
            seen.add(item)
    return refs


def _schema_context_has_columns(schema_context: str) -> bool:
    parsed = _parse_schema_context(schema_context)
    return any(meta.get("columns") for meta in parsed.values())


def _enrich_schema_context_from_db(conn, schema_context: str) -> str:
    """Build detailed schema context using information_schema for listed tables."""
    refs = _extract_table_refs(schema_context)
    if not refs:
        return schema_context

    blocks: list[str] = []
    try:
        with conn.cursor() as cur:
            for schema, table in refs:
                cur.execute(
                    """
                    SELECT c.column_name, c.data_type, c.is_nullable,
                           (tc.constraint_type = 'PRIMARY KEY') AS is_pk,
                           ccu.table_name AS fk_table,
                           ccu.column_name AS fk_col
                    FROM information_schema.columns c
                    LEFT JOIN information_schema.key_column_usage kcu
                      ON c.table_schema = kcu.table_schema
                      AND c.table_name = kcu.table_name
                      AND c.column_name = kcu.column_name
                    LEFT JOIN information_schema.table_constraints tc
                      ON kcu.constraint_name = tc.constraint_name
                      AND kcu.table_schema = tc.table_schema
                      AND kcu.table_name = tc.table_name
                    LEFT JOIN information_schema.constraint_column_usage ccu
                      ON tc.constraint_name = ccu.constraint_name
                      AND tc.table_schema = ccu.table_schema
                    WHERE c.table_schema = %s AND c.table_name = %s
                    ORDER BY c.ordinal_position
                    """,
                    (schema, table),
                )
                rows = cur.fetchall()
                if not rows:
                    continue
                lines = [f"{schema}.{table}"]
                for col, dtype, nullable, is_pk, fk_table, fk_col in rows:
                    tags = []
                    if is_pk:
                        tags.append("PK")
                    if fk_table and fk_col:
                        tags.append(f"FK -> {fk_table}.{fk_col}")
                    if nullable == "NO":
                        tags.append("NOT NULL")
                    tag_str = f" [{', '.join(tags)}]" if tags else ""
                    lines.append(f"  - {col} {dtype}{tag_str}")
                blocks.append("\n".join(lines))
    except Exception as e:
        logger.warning("schema enrichment failed: %s", e)
        return schema_context

    return "\n\n".join(blocks) if blocks else schema_context


def _parse_schema_context(schema_context: str) -> dict[str, dict[str, Any]]:
    """Parse selected-table schema context into table/column/fk metadata."""
    tables: dict[str, dict[str, Any]] = {}
    current: str | None = None

    for raw in (schema_context or "").splitlines():
        line = raw.strip()
        if not line:
            continue

        m_table_cols = re.match(
            r"^([A-Za-z_][\w]*)\.([A-Za-z_][\w]*)\s*\((.*)\)\s*$", line
        )
        if m_table_cols:
            schema, table, cols_part = m_table_cols.groups()
            full = f"{schema}.{table}"
            cols = set()
            col_order = []
            pk_cols = []
            col_types: dict[str, str] = {}
            for col_def in cols_part.split(","):
                col_def = col_def.strip()
                if not col_def:
                    continue
                parts = col_def.split()
                col = parts[0].strip('"')
                if col:
                    low = col.lower()
                    cols.add(low)
                    col_order.append(low)
                    if len(parts) > 1:
                        col_types[low] = " ".join(parts[1:]).lower()
                    if low.endswith("_id"):
                        pk_cols.append(low)
            tables[full] = {
                "schema": schema,
                "table": table,
                "columns": cols,
                "column_order": col_order,
                "column_types": col_types,
                "pk": pk_cols,
                "fks": [],
            }
            current = full
            continue

        m_table = re.match(r"^([A-Za-z_][\w]*)\.([A-Za-z_][\w]*)$", line)
        if m_table:
            schema, table = m_table.groups()
            full = f"{schema}.{table}"
            tables.setdefault(
                full,
                {
                    "schema": schema,
                    "table": table,
                    "columns": set(),
                    "column_order": [],
                    "column_types": {},
                    "pk": [],
                    "fks": [],
                },
            )
            current = full
            continue

        if current and line.startswith("-"):
            m_col = re.match(r"^-\s*([A-Za-z_][\w]*)(?:\s+([^\[]+))?", line)
            if not m_col:
                continue
            col = m_col.group(1)
            low = col.lower()
            if low not in tables[current]["columns"]:
                tables[current]["column_order"].append(low)
            tables[current]["columns"].add(low)
            dtype = (m_col.group(2) or "").strip().lower()
            if dtype:
                tables[current]["column_types"][low] = dtype
            if "[" in line and "PK" in line and low not in tables[current]["pk"]:
                tables[current]["pk"].append(low)
            m_fk = re.search(r"FK\s*->\s*([A-Za-z_][\w]*)\.([A-Za-z_][\w]*)", line)
            if m_fk:
                ref_table, ref_col = m_fk.groups()
                tables[current]["fks"].append(
                    {
                        "column": col.lower(),
                        "ref_table": ref_table.lower(),
                        "ref_col": ref_col.lower(),
                    }
                )

    return tables


def _type_is_string_like(dtype: str | None) -> bool:
    if not dtype:
        return True
    d = dtype.lower()
    return any(
        token in d
        for token in (
            "char",
            "text",
            "json",
            "uuid",
            "citext",
            "xml",
            "enum",
        )
    )


def _normalize_categorical_literals(sql: str, schema_context: str) -> str:
    """Normalize simple categorical literals to lowercase for string-like columns."""
    if not sql:
        return sql

    tables = _parse_schema_context(schema_context)
    if not tables:
        return sql

    string_like_cols: set[str] = set()
    for meta in tables.values():
        col_types = meta.get("column_types", {})
        for col in meta.get("column_order", []):
            dtype = (col_types.get(col) or "").lower()
            if any(
                token in dtype
                for token in ("char", "text", "json", "uuid", "citext", "xml", "enum")
            ):
                string_like_cols.add(col.lower())

    if not string_like_cols:
        return sql

    pattern = re.compile(
        r"(\b(?:[A-Za-z_][\w]*\.)?([A-Za-z_][\w]*)\b\s*=\s*')([^']+)(')",
        flags=re.IGNORECASE,
    )

    def _repl(match: re.Match[str]) -> str:
        prefix, col, value, suffix = match.groups()
        if col.lower() not in string_like_cols:
            return match.group(0)
        if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_\- ]*", value.strip()):
            return match.group(0)
        return f"{prefix}{value.strip().lower()}{suffix}"

    return pattern.sub(_repl, sql)
