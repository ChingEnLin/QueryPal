"""SQL schema utilities and literal normalisation for pg_react_agent_service."""

import logging
import re
import difflib
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


# data_type values from information_schema that warrant sampling distinct values
_TEXT_SAMPLE_TYPES = frozenset(
    {"character varying", "text", "character", "user-defined", "name", "citext"}
)
# Maximum distinct values to include as hints; columns with more are skipped
_MAX_SAMPLE_VALUES = 20
# Cap on rows scanned per column when sampling distinct values, to bound the
# cost of probing unindexed text columns on wide/large schemas
_SAMPLE_SCAN_ROW_CAP = 5000


def _enrich_schema_context_from_db(
    conn, schema_context: str, failed_flag: list[bool] | None = None
) -> str:
    """Build detailed schema context using information_schema for listed tables.

    When enrichment raises and falls back to the raw context, ``failed_flag``
    (if provided) is appended with True so callers can avoid retrying the
    (expensive) enrichment on every subsequent iteration.
    """
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
                    col_line = f"  - {col} {dtype}{tag_str}"
                    if dtype.lower() in _TEXT_SAMPLE_TYPES:
                        col_line += _sample_values_hint(conn, schema, table, col)
                    lines.append(col_line)
                blocks.append("\n".join(lines))
    except Exception as e:
        logger.warning(
            "schema enrichment failed (%s), falling back to raw context: %s",
            type(e).__name__,
            e,
        )
        if failed_flag is not None:
            failed_flag.append(True)
        return schema_context

    enriched = "\n\n".join(blocks) if blocks else schema_context
    logger.info(
        "schema enrichment complete: %d table(s), %d chars", len(blocks), len(enriched)
    )
    return enriched


def _sample_values_hint(conn, schema: str, table: str, col: str) -> str:
    """Return ' -- values: ...' hint when the column has low cardinality, else ''.

    Opens its own cursor per probe. On non-autocommit connections a failed query
    aborts the transaction, so we rollback to keep the enrichment loop running.
    Distinct-values are sampled from a capped subset of rows (not the whole
    table) so an unindexed column doesn't force a full scan on every call.
    """
    try:
        with conn.cursor() as cur:
            cur.execute(
                f'SELECT DISTINCT "{col}" FROM ('
                f'  SELECT "{col}" FROM "{schema}"."{table}" '
                f'  WHERE "{col}" IS NOT NULL LIMIT %s'
                f") sample LIMIT %s",
                (_SAMPLE_SCAN_ROW_CAP, _MAX_SAMPLE_VALUES + 1),
            )
            vals = [str(r[0]) for r in cur.fetchall()]
        if len(vals) > _MAX_SAMPLE_VALUES:
            return ""
        vals_str = ", ".join(
            f"'{v.replace(chr(39), chr(39) * 2)}'" for v in sorted(vals)
        )
        return f" -- values: {vals_str}"
    except Exception:
        if not getattr(conn, "autocommit", True):
            try:
                conn.rollback()
            except Exception:
                pass
        return ""


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
                "value_hints": {},
                "value_hints_raw": {},
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
                    "value_hints": {},
                    "value_hints_raw": {},
                },
            )
            current = full
            continue

        if current and line.startswith("-"):
            m_col = re.match(
                r"^-\s*([A-Za-z_][\w]*)(?:\s+(.+?))?(?:\s+\[[^\]]*\])?(?:\s*--.*)?$",
                line,
            )
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
            hinted_values = _extract_values_from_schema_line(line)
            if hinted_values:
                tables[current]["value_hints"][low] = hinted_values
            raw_hinted_values = _extract_raw_values_from_schema_line(line)
            if raw_hinted_values:
                tables[current]["value_hints_raw"][low] = raw_hinted_values
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


def _extract_values_from_schema_line(line: str) -> set[str]:
    """Extract low-cardinality value hints from schema lines.

    Supports both "-- values: ..." and "-- enum-values: ..." decorations.
    """
    m = re.search(r"--\s*(?:values|enum-values)\s*:\s*(.+)$", line, re.IGNORECASE)
    if not m:
        return set()
    raw_values = re.findall(r"'((?:[^']|'')*)'", m.group(1))
    raw_values = [v.replace("''", "'") for v in raw_values]
    return {v.strip().lower() for v in raw_values if v.strip()}


def _extract_raw_values_from_schema_line(line: str) -> list[str]:
    """Extract hinted values preserving original case and separators."""
    m = re.search(r"--\s*(?:values|enum-values)\s*:\s*(.+)$", line, re.IGNORECASE)
    if not m:
        return []
    raw_values = re.findall(r"'((?:[^']|'')*)'", m.group(1))
    return [v.replace("''", "'").strip() for v in raw_values if v.strip()]


def _tokenize_ident(text: str) -> set[str]:
    parts = re.split(r"[^a-z0-9]+", text.lower())
    return {p for p in parts if p}


def _snake_literal(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


def _value_key(value: str) -> str:
    """Canonical key to compare value variants (space/hyphen/underscore/case)."""
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


def _canonicalize_literal_for_column(
    value: str,
    col: str,
    col_types: dict[str, str],
    value_hints_raw: dict[str, list[str]],
) -> str:
    """Pick literal format from hinted values first, then fallback by column type."""
    clean = value.strip()
    low_col = col.lower()
    hinted = value_hints_raw.get(low_col, [])

    if hinted:
        for candidate in hinted:
            if candidate.lower() == clean.lower():
                return candidate
        key = _value_key(clean)
        for candidate in hinted:
            if _value_key(candidate) == key:
                return candidate

    normalized = clean.lower()
    col_type = (col_types.get(low_col) or "").lower()
    if "enum" in col_type or "user-defined" in col_type:
        return _snake_literal(normalized)
    return normalized


def _choose_best_column_candidate(
    unknown: str,
    literal: str,
    all_columns: set[str],
    value_hints: dict[str, set[str]],
) -> str | None:
    """Pick the most likely real column for an unknown categorical bucket name."""
    unknown_tokens = _tokenize_ident(unknown)
    literal_tokens = _tokenize_ident(literal)
    literal_variants = {
        literal.strip().lower(),
        _snake_literal(literal),
    }

    best_col = None
    best_score = -1
    for candidate in sorted(all_columns):
        if candidate.lower() == unknown.lower():
            continue
        score = len(unknown_tokens.intersection(_tokenize_ident(candidate)))
        score += len(literal_tokens.intersection(_tokenize_ident(candidate)))

        hinted = value_hints.get(candidate.lower(), set())
        if hinted and any(v in hinted for v in literal_variants):
            score += 5

        if score > best_score:
            best_score = score
            best_col = candidate

    if best_col and best_score > 0:
        return best_col
    return None


def _suggest_columns_for_unknown_refs(
    unknown_columns: list[str],
    all_columns: set[str],
    value_hints: dict[str, set[str]],
    sql: str,
) -> list[str]:
    """Suggest likely intended columns using lexical and value-hint matching."""
    suggestions: list[str] = []
    literals = re.findall(r"'([^']+)'", sql)
    literal_tokens = set()
    literal_variants = set()
    for lit in literals:
        literal_tokens.update(_tokenize_ident(lit))
        literal_variants.add(lit.strip().lower())
        literal_variants.add(_snake_literal(lit))

    combined_literal = " ".join(literals) if literals else ""
    for unknown in unknown_columns:
        best_col = _choose_best_column_candidate(
            unknown, combined_literal, all_columns, value_hints
        )

        if best_col:
            hinted = value_hints.get(best_col.lower(), set())
            if hinted:
                suggestions.append(
                    f"Unknown column {unknown!r} likely maps to {best_col!r} "
                    f"(hint values: {sorted(hinted)})."
                )
            else:
                suggestions.append(
                    f"Unknown column {unknown!r} likely maps to {best_col!r}."
                )

    for lit in literals:
        snake = _snake_literal(lit)
        if snake and snake != lit.strip().lower():
            suggestions.append(
                f"If this is an enum value, prefer snake_case literal {snake!r} over {lit!r}."
            )

    return suggestions


def _validate_sql_references(sql: str, schema_context: str) -> str | None:
    """Check that every FROM/JOIN table in the SQL exists in schema_context.

    Returns a correction message string when unknown tables are found, or None
    when all references are valid (or when the schema has no info to check).
    """
    refs = _extract_table_refs(schema_context)
    if not refs:
        return None

    known_qualified = {f"{s}.{t}".lower() for s, t in refs}
    known_unqualified = {t.lower() for _, t in refs}

    sql_no_comments = re.sub(r"--[^\n]*", "", sql)
    table_matches = re.findall(
        r"(?:FROM|JOIN)\s+(?:LATERAL\s+)?([A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)?)",
        sql_no_comments,
        re.IGNORECASE,
    )

    unknown = []
    for ref in table_matches:
        low = ref.lower()
        if "." in low:
            if low not in known_qualified:
                unknown.append(ref)
        else:
            if low not in known_unqualified:
                unknown.append(ref)

    if not unknown:
        return None

    available = sorted(f"{s}.{t}" for s, t in refs)
    return (
        f"The SQL references table(s) not present in the schema: {unknown}. "
        f"Available tables are: {available}. "
        "Rewrite the query using only these exact table and schema names."
    )


def _validate_sql_columns(sql: str, schema_context: str) -> str | None:
    """Check that alias.column references in the SQL exist in the schema.

    Returns a correction message when unknown columns are found, or None when
    all references are valid (or there is not enough schema info to check).
    """
    tables = _parse_schema_context(schema_context)
    if not tables:
        return None

    all_columns: set[str] = set()
    all_table_names: set[str] = set()
    value_hints: dict[str, set[str]] = {}
    for meta in tables.values():
        all_columns.update(meta.get("columns", set()))
        all_table_names.add(meta["table"].lower())
        for col, hinted in meta.get("value_hints", {}).items():
            value_hints.setdefault(col.lower(), set()).update(hinted)

    if not all_columns:
        return None

    sql_no_comments = re.sub(r"--[^\n]*", "", sql)
    dotted_refs = re.findall(
        r"\b[A-Za-z_][\w]*\.([A-Za-z_][\w]*)\b",
        sql_no_comments,
    )
    unknown = [
        col
        for col in dotted_refs
        if col.lower() not in all_columns and col.lower() not in all_table_names
    ]
    if not unknown:
        return None

    unknown_unique = sorted(set(unknown), key=str.lower)
    suggestions = _suggest_columns_for_unknown_refs(
        unknown_unique, all_columns, value_hints, sql_no_comments
    )
    suggestion_text = " " + " ".join(suggestions) if suggestions else ""

    return (
        f"The SQL references column(s) not present in any schema-listed table: {unknown_unique}. "
        f"Available columns are: {sorted(all_columns)}. "
        "Rewrite the query using only these exact column names, and avoid inventing "
        "JSON bucket columns for categorical fields; use real columns with = comparisons."
        f"{suggestion_text}"
    )


def _validate_sql_operators(sql: str, schema_context: str) -> str | None:
    """Catch JSON/array operators used on plain text columns.

    Returns a correction message if @>, ->, or ->> is applied to a
    text/varchar column (where = should be used instead), or None when valid.
    """
    tables = _parse_schema_context(schema_context)
    if not tables:
        return None

    plain_text_cols: dict[str, str] = {}
    for meta in tables.values():
        col_types = meta.get("column_types", {})
        for col in meta.get("columns", set()):
            dtype = col_types.get(col, "")
            d = dtype.lower()
            is_text = any(
                t in d
                for t in ("char", "text", "citext", "enum", "name", "user-defined")
            )
            is_json_or_array = any(t in d for t in ("json", "[]", "array"))
            if is_text and not is_json_or_array:
                plain_text_cols[col.lower()] = dtype

    if not plain_text_cols:
        return None

    sql_no_comments = re.sub(r"--[^\n]*", "", sql)
    mismatches = re.findall(
        r"\b[A-Za-z_][\w]*\.([A-Za-z_][\w]*)\s*(@>|->|->>)",
        sql_no_comments,
        re.IGNORECASE,
    )
    json_op_violations = [
        f"{col!r} (type: {plain_text_cols[col.lower()]!r}) with operator {op!r}"
        for col, op in mismatches
        if col.lower() in plain_text_cols
    ]

    any_all_mismatches = re.findall(
        r"'([^']+)'\s*=\s*(ANY|ALL)\s*\(\s*(?:[A-Za-z_][\w]*\.)?([A-Za-z_][\w]*)\s*\)",
        sql_no_comments,
        re.IGNORECASE,
    )
    any_all_violations = []
    for lit, op, col in any_all_mismatches:
        low = col.lower()
        if low not in plain_text_cols:
            continue
        col_type = plain_text_cols[low].lower()
        normalized_lit = lit.strip().lower()
        if "enum" in col_type or "user-defined" in col_type:
            normalized_lit = _snake_literal(normalized_lit)
        any_all_violations.append(
            f"{col!r} (type: {plain_text_cols[low]!r}) with {op.upper()} expects an array; "
            f"use {col} = '{normalized_lit}'"
        )

    if not json_op_violations and not any_all_violations:
        return None

    parts: list[str] = []
    if json_op_violations:
        parts.append(
            "Operator mismatch — plain text column(s) used with JSON/array operator: "
            f"{json_op_violations}. Use = for equality on text/varchar columns, "
            "e.g. WHERE col = 'value'."
        )
    if any_all_violations:
        parts.append(
            "ANY/ALL mismatch — non-array categorical column(s) used with ANY/ALL: "
            f"{any_all_violations}. Use = for scalar columns; reserve ANY/ALL for array columns."
        )
    return " ".join(parts)


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
            "user-defined",
        )
    )


def _normalize_categorical_literals(sql: str, schema_context: str) -> str:
    """Normalize simple categorical literals to lowercase for string-like columns."""
    if not sql:
        return sql

    tables = _parse_schema_context(schema_context)
    if not tables:
        return sql

    all_columns: set[str] = set()
    value_hints: dict[str, set[str]] = {}
    value_hints_raw: dict[str, list[str]] = {}
    col_types: dict[str, str] = {}
    for meta in tables.values():
        for col in meta.get("column_order", []):
            low = col.lower()
            all_columns.add(low)
            if low not in col_types:
                col_types[low] = (meta.get("column_types", {}).get(low) or "").lower()
            hinted = meta.get("value_hints", {}).get(low, set())
            if hinted:
                value_hints.setdefault(low, set()).update(hinted)
            hinted_raw = meta.get("value_hints_raw", {}).get(low, [])
            if hinted_raw and low not in value_hints_raw:
                value_hints_raw[low] = hinted_raw

    string_like_cols: set[str] = set()
    for meta in tables.values():
        meta_col_types = meta.get("column_types", {})
        for col in meta.get("column_order", []):
            dtype = (meta_col_types.get(col) or "").lower()
            if any(
                token in dtype
                for token in (
                    "char",
                    "text",
                    "json",
                    "uuid",
                    "citext",
                    "xml",
                    "enum",
                    "user-defined",
                )
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
        normalized_value = _canonicalize_literal_for_column(
            value, col, col_types, value_hints_raw
        )
        return f"{prefix}{normalized_value}{suffix}"

    normalized = pattern.sub(_repl, sql)

    pattern_any_all = re.compile(
        r"(')([^']+)('\s*=\s*(?:ANY|ALL)\s*\(\s*(?:[A-Za-z_][\w]*\.)?([A-Za-z_][\w]*)\s*\))",
        flags=re.IGNORECASE,
    )

    def _repl_any_all(match: re.Match[str]) -> str:
        quote1, value, suffix, col = match.groups()
        if col.lower() not in string_like_cols:
            return match.group(0)
        if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_\- ]*", value.strip()):
            return match.group(0)
        normalized_value = _canonicalize_literal_for_column(
            value, col, col_types, value_hints_raw
        )
        return f"{quote1}{normalized_value}{suffix}"

    normalized = pattern_any_all.sub(_repl_any_all, normalized)

    pattern_array_contains = re.compile(
        r"\b((?:[A-Za-z_][\w]*\.)?)([A-Za-z_][\w]*)\s*@>\s*ARRAY\s*\[\s*'([^']+)'\s*\]",
        flags=re.IGNORECASE,
    )

    def _repl_array_contains(match: re.Match[str]) -> str:
        prefix, col, literal = match.groups()
        low = col.lower()
        if low not in all_columns:
            return match.group(0)

        col_type = col_types.get(low, "")
        if not any(t in col_type for t in ("[]", "array")):
            return match.group(0)

        normalized_value = _canonicalize_literal_for_column(
            literal, col, col_types, value_hints_raw
        )

        return f"'{normalized_value}' = ANY({prefix}{col})"

    normalized = pattern_array_contains.sub(_repl_array_contains, normalized)

    pattern_bucket = re.compile(
        r"\b((?:[A-Za-z_][\w]*\.)?)([A-Za-z_][\w]*)\s*->>\s*'([^']+)'\s+IS\s+NOT\s+NULL\b",
        flags=re.IGNORECASE,
    )

    def _repl_bucket(match: re.Match[str]) -> str:
        prefix, col, literal = match.groups()
        low = col.lower()
        target_col = low
        if low in all_columns:
            dtype = col_types.get(low, "")
            if any(t in dtype for t in ("json", "[]", "array")):
                return match.group(0)
        else:
            guessed = _choose_best_column_candidate(
                col, literal, all_columns, value_hints
            )
            if not guessed:
                return match.group(0)
            target_col = guessed

        normalized_value = _canonicalize_literal_for_column(
            literal, target_col, col_types, value_hints_raw
        )
        return f"{prefix}{target_col} = '{normalized_value}'"

    return pattern_bucket.sub(_repl_bucket, normalized)
