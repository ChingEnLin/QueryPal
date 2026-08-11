"""Heuristic SQL helpers for pg_react_agent_service."""

import re
from typing import Any

_NUMERIC_INTENT_HINTS: list[tuple[str, tuple[str, ...], int]] = [
    (r"\b(older|younger|years old|year old)\b", ("age", "years", "year"), 2),
    (
        r"\b(how many|count|number of)\b",
        ("count", "num", "number", "qty"),
        1,
    ),
    (
        r"\b(amount|price|cost|total|revenue|spend)\b",
        ("amount", "price", "cost", "total", "revenue", "spend"),
        1,
    ),
]


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
    except Exception:
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


def _resolve_table_name(
    ref_table: str, tables: dict[str, dict[str, Any]]
) -> str | None:
    for full, meta in tables.items():
        if meta["table"].lower() == ref_table.lower():
            return full
    return None


def _table_variants(table_name: str) -> list[str]:
    base = table_name.lower()
    spaced = base.replace("_", " ")
    variants = {base, spaced}
    if base.endswith("s") and len(base) > 1:
        variants.add(base[:-1])
    if spaced.endswith("s") and len(spaced) > 1:
        variants.add(spaced[:-1])
    return sorted(variants, key=len, reverse=True)


def _pick_root_table(
    user_input: str, candidate_tables: set[str], tables: dict[str, dict[str, Any]]
) -> str:
    text = user_input.lower()
    best: tuple[int, str] | None = None

    for full in sorted(candidate_tables):
        tname = tables[full]["table"]
        first_idx = None
        for variant in _table_variants(tname):
            m = re.search(rf"\b{re.escape(variant)}\b", text)
            if m:
                first_idx = (
                    m.start() if first_idx is None else min(first_idx, m.start())
                )
        if first_idx is not None:
            cand = (first_idx, full)
            if best is None or cand < best:
                best = cand

    if best is not None:
        return best[1]
    return sorted(candidate_tables)[0]


def _build_join_edges(
    tables: dict[str, dict[str, Any]],
) -> dict[str, list[dict[str, str]]]:
    graph: dict[str, list[dict[str, str]]] = {k: [] for k in tables.keys()}
    for source, meta in tables.items():
        for fk in meta.get("fks", []):
            target = _resolve_table_name(fk["ref_table"], tables)
            if not target:
                continue
            graph[source].append(
                {
                    "to": target,
                    "left_table": source,
                    "left_col": fk["column"],
                    "right_table": target,
                    "right_col": fk["ref_col"],
                }
            )
            graph[target].append(
                {
                    "to": source,
                    "left_table": source,
                    "left_col": fk["column"],
                    "right_table": target,
                    "right_col": fk["ref_col"],
                }
            )
    return graph


def _column_variants(column: str) -> list[str]:
    base = column.lower()
    spaced = base.replace("_", " ")
    variants = {base, spaced}
    if base.endswith("s") and len(base) > 1:
        variants.add(base[:-1])
    if spaced.endswith("s") and len(spaced) > 1:
        variants.add(spaced[:-1])
    return sorted(variants, key=len, reverse=True)


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


def _find_mentioned_tables(text: str, tables: dict[str, dict[str, Any]]) -> list[str]:
    hits: list[tuple[int, str]] = []
    for full, meta in tables.items():
        first_idx: int | None = None
        for variant in _table_variants(meta["table"]):
            m = re.search(rf"\b{re.escape(variant)}\b", text)
            if m:
                first_idx = (
                    m.start() if first_idx is None else min(first_idx, m.start())
                )
        if first_idx is not None:
            hits.append((first_idx, full))
    hits.sort(key=lambda x: (x[0], x[1]))
    return [full for _, full in hits]


def _extract_implicit_categorical_filters(
    text: str,
    tables: dict[str, dict[str, Any]],
    filters: list[dict[str, str]],
) -> list[dict[str, str]]:
    stopwords = {
        "a",
        "an",
        "and",
        "all",
        "any",
        "are",
        "as",
        "at",
        "be",
        "by",
        "count",
        "display",
        "equals",
        "equal",
        "find",
        "for",
        "from",
        "get",
        "has",
        "have",
        "having",
        "in",
        "include",
        "is",
        "it",
        "less",
        "list",
        "more",
        "not",
        "of",
        "on",
        "or",
        "order",
        "return",
        "select",
        "show",
        "than",
        "that",
        "the",
        "to",
        "under",
        "where",
        "with",
        "without",
    }

    schema_words: set[str] = set()
    for meta in tables.values():
        for tv in _table_variants(meta["table"]):
            schema_words.update(tv.split())
        for col in meta.get("column_order", []):
            for cv in _column_variants(col):
                schema_words.update(cv.split())

    candidate_literals: list[str] = []
    seen_literals: set[str] = set()
    for token in re.findall(r"\b[a-z][a-z0-9_-]{1,}\b", text):
        if token in seen_literals:
            continue
        if token in stopwords or token in schema_words:
            continue
        if token in {"true", "false", "null"}:
            continue
        seen_literals.add(token)
        candidate_literals.append(token)

    if not candidate_literals:
        return []

    mentioned_tables = _find_mentioned_tables(text, tables)
    filtered_tables = [f["table"] for f in filters]
    if mentioned_tables:
        target_tables = set(mentioned_tables)
    elif filtered_tables:
        target_tables = set(filtered_tables)
    else:
        target_tables = set(tables.keys())

    filtered_columns = {
        (f["table"], m.group(1).lower())
        for f in filters
        for m in [re.match(r"^([A-Za-z_][\w]*)\s*=", f["sql"])]
        if m
    }

    inferred: list[dict[str, str]] = []
    for literal in candidate_literals:
        owners: list[tuple[str, str]] = []
        for table_name in target_tables:
            meta = tables[table_name]
            col_types = meta.get("column_types", {})
            for col in meta.get("column_order", []):
                if col.endswith("_id"):
                    continue
                if (table_name, col) in filtered_columns:
                    continue
                dtype = col_types.get(col)
                if not _type_is_string_like(dtype):
                    continue
                owners.append((table_name, col))

        if len(owners) == 1:
            table_name, col = owners[0]
            val = literal.replace("'", "''")
            inferred.append({"table": table_name, "sql": f"{col} = '{val}'"})

    return inferred


def _extract_numeric_filter(text: str, variant: str, column: str) -> str | None:
    num = r"(-?\d+(?:\.\d+)?)"
    patterns = [
        (rf"\b{re.escape(variant)}\s*(?:>=|=>)\s*{num}\b", ">="),
        (rf"\b{re.escape(variant)}\s*(?:<=|=<)\s*{num}\b", "<="),
        (rf"\b{re.escape(variant)}\s*>\s*{num}\b", ">"),
        (rf"\b{re.escape(variant)}\s*<\s*{num}\b", "<"),
        (rf"\b{re.escape(variant)}\s*=\s*{num}\b", "="),
        (
            rf"\b{re.escape(variant)}\s+(?:is\s+)?(?:greater than|more than|over|above)\s+{num}\b",
            ">",
        ),
        (
            rf"\b{re.escape(variant)}\s+(?:is\s+)?(?:at least|greater than or equal to|not less than)\s+{num}\b",
            ">=",
        ),
        (
            rf"\b{re.escape(variant)}\s+(?:is\s+)?(?:less than|under|below)\s+{num}\b",
            "<",
        ),
        (
            rf"\b{re.escape(variant)}\s+(?:is\s+)?(?:at most|less than or equal to|not more than)\s+{num}\b",
            "<=",
        ),
    ]
    for pat, op in patterns:
        m = re.search(pat, text)
        if m:
            return f"{column} {op} {m.group(1)}"

    m_between = re.search(
        rf"\b{re.escape(variant)}\s+between\s+{num}\s+and\s+{num}\b", text
    )
    if m_between:
        return f"{column} BETWEEN {m_between.group(1)} AND {m_between.group(2)}"
    return None


def _extract_string_filter(text: str, variant: str, column: str) -> str | None:
    m_quoted = re.search(
        rf"\b{re.escape(variant)}\s*(?:=|is|equals?)\s*['\"]([^'\"]+)['\"]",
        text,
    )
    if m_quoted:
        val = m_quoted.group(1).replace("'", "''")
        return f"{column} = '{val}'"

    m_unquoted = re.search(
        rf"\b{re.escape(variant)}\s*(?:=|is|equals?)\s+([a-z][a-z0-9_\-]*)\b",
        text,
    )
    if m_unquoted:
        val = m_unquoted.group(1)
        if val not in {"null", "not", "true", "false", "and", "or"}:
            return f"{column} = '{val}'"
    return None


def _find_column_mentions(
    text: str, tables: dict[str, dict[str, Any]]
) -> list[tuple[str, str, int]]:
    mentions: list[tuple[str, str, int]] = []
    best_idx: dict[tuple[str, str], int] = {}

    for table_name, meta in tables.items():
        for column in meta.get("column_order", []):
            idx: int | None = None
            for variant in _column_variants(column):
                m = re.search(rf"\b{re.escape(variant)}\b", text)
                if m:
                    idx = m.start() if idx is None else min(idx, m.start())
            if idx is not None:
                key = (table_name, column)
                if key not in best_idx or idx < best_idx[key]:
                    best_idx[key] = idx

    for (table_name, column), idx in best_idx.items():
        mentions.append((table_name, column, idx))
    mentions.sort(key=lambda x: (x[2], x[0], x[1]))
    return mentions


def _pick_id_column(meta: dict[str, Any]) -> str | None:
    for col in meta.get("pk", []):
        return col
    for col in meta.get("column_order", []):
        if col.endswith("_id"):
            return col
    return meta.get("column_order", [None])[0]


def _table_distance(
    graph: dict[str, list[dict[str, str]]], start: str, target: str
) -> int:
    if start == target:
        return 0
    queue: list[tuple[str, int]] = [(start, 0)]
    seen = {start}
    while queue:
        node, dist = queue.pop(0)
        for edge in graph.get(node, []):
            nxt = edge["to"]
            if nxt == target:
                return dist + 1
            if nxt in seen:
                continue
            seen.add(nxt)
            queue.append((nxt, dist + 1))
    return 10_000


def _choose_numeric_candidate(
    text: str,
    numeric_like_cols: list[tuple[str, str]],
    filters: list[dict[str, str]],
    tables: dict[str, dict[str, Any]],
) -> tuple[str, str] | None:
    if not numeric_like_cols:
        return None
    if len(numeric_like_cols) == 1:
        return numeric_like_cols[0]

    graph = _build_join_edges(tables)
    anchor_tables = [f["table"] for f in filters]

    active_hints: list[tuple[tuple[str, ...], int]] = []
    for phrase_pattern, column_tokens, miss_penalty in _NUMERIC_INTENT_HINTS:
        if re.search(phrase_pattern, text):
            active_hints.append((column_tokens, miss_penalty))

    def semantic_penalty(col: str) -> int:
        c = col.lower()
        if active_hints:
            penalties = [
                0 if any(token in c for token in tokens) else miss_penalty
                for tokens, miss_penalty in active_hints
            ]
            return min(penalties)
        return 0

    best: tuple[int, int, str, str] | None = None
    for table_name, col in numeric_like_cols:
        if anchor_tables:
            dist = min(_table_distance(graph, t, table_name) for t in anchor_tables)
        else:
            dist = 0
        sem = semantic_penalty(col)
        cand = (sem, dist, table_name, col)
        if best is None or cand < best:
            best = cand

    if best is None:
        return None
    return best[2], best[3]


def _extract_filters(
    user_input: str, tables: dict[str, dict[str, Any]]
) -> list[dict[str, str]]:
    text = user_input.lower()
    filters: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()

    def add_filter(table: str, sql: str):
        key = (table, sql)
        if key not in seen:
            filters.append({"table": table, "sql": sql})
            seen.add(key)

    for table_name, meta in tables.items():
        ordered_cols = sorted(meta.get("column_order", []), key=len, reverse=True)
        for column in ordered_cols:
            for variant in _column_variants(column):
                if re.search(
                    rf"\b(?:without|no|missing)\s+(?:an?\s+)?{re.escape(variant)}\b",
                    text,
                ):
                    add_filter(table_name, f"{column} IS NULL")
                    break
                if re.search(
                    rf"\b(?:with|having|has|have)\s+(?:an?\s+)?{re.escape(variant)}\b",
                    text,
                ):
                    add_filter(table_name, f"{column} IS NOT NULL")
                    break

                numeric_sql = _extract_numeric_filter(text, variant, column)
                if numeric_sql:
                    add_filter(table_name, numeric_sql)
                    break

                string_sql = _extract_string_filter(text, variant, column)
                if string_sql:
                    add_filter(table_name, string_sql)
                    break

    for inferred in _extract_implicit_categorical_filters(text, tables, filters):
        add_filter(inferred["table"], inferred["sql"])

    if not any(re.search(r"\b(>|<|>=|<=|between)\b", f["sql"]) for f in filters):
        generic_patterns = [
            (
                r"\b(?:greater than|more than|over|above|older than)\s+(-?\d+(?:\.\d+)?)\b",
                ">",
            ),
            (
                r"\b(?:at least|greater than or equal to|not less than)\s+(-?\d+(?:\.\d+)?)\b",
                ">=",
            ),
            (r"\b(?:less than|under|below|younger than)\s+(-?\d+(?:\.\d+)?)\b", "<"),
            (
                r"\b(?:at most|less than or equal to|not more than)\s+(-?\d+(?:\.\d+)?)\b",
                "<=",
            ),
        ]
        numeric_like_cols = []
        for table_name, meta in tables.items():
            for col in meta.get("column_order", []):
                if col.endswith("_id"):
                    continue
                if re.search(
                    r"(age|year|years|count|total|amount|price|score|size|length|height|weight|duration|rate|percent|pct|level|rank|quantity|qty|number|num|days|hours)",
                    col,
                ):
                    numeric_like_cols.append((table_name, col))

        for pat, op in generic_patterns:
            m = re.search(pat, text)
            if not m:
                continue
            chosen = _choose_numeric_candidate(text, numeric_like_cols, filters, tables)
            if chosen:
                table_name, col = chosen
                add_filter(table_name, f"{col} {op} {m.group(1)}")
            break

    return filters


def _extract_requested_columns(
    user_input: str, tables: dict[str, dict[str, Any]], filters: list[dict[str, str]]
) -> list[tuple[str, str]]:
    text = user_input.lower()
    explicit_projection = bool(
        re.search(r"\b(show|also show|include|display|return|list|select)\b", text)
    )

    mentions = _find_column_mentions(text, tables)
    if explicit_projection and mentions:
        cols: list[tuple[str, str]] = []
        seen: set[tuple[str, str]] = set()
        for table_name, column, _ in mentions:
            key = (table_name, column)
            if key not in seen:
                cols.append(key)
                seen.add(key)

        first_table = cols[0][0] if cols else None
        if first_table:
            id_col = _pick_id_column(tables[first_table])
            if id_col and (first_table, id_col) not in seen:
                cols.insert(0, (first_table, id_col))
        return cols

    if len(filters) == 1:
        only = filters[0]
        m = re.match(r"^([A-Za-z_][\w]*)\s+IS\s+(?:NOT\s+)?NULL$", only["sql"])
        if m:
            table_name = only["table"]
            col = m.group(1).lower()
            id_col = _pick_id_column(tables[table_name])
            out: list[tuple[str, str]] = []
            if id_col:
                out.append((table_name, id_col))
            if not id_col or id_col != col:
                out.append((table_name, col))
            return out

    return []


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


def _heuristic_sql(user_input: str, schema_context: str) -> str | None:
    tables = _parse_schema_context(schema_context)
    if not tables:
        return None

    filters = _extract_filters(user_input, tables)
    if not filters:
        return None

    requested_columns = _extract_requested_columns(user_input, tables, filters)

    required_tables = {f["table"] for f in filters}
    required_tables.update(t for t, _ in requested_columns)
    root = _pick_root_table(user_input, required_tables, tables)

    if len(required_tables) == 1 and root in required_tables:
        where_lines = [f["sql"] for f in filters]
        select_line = "SELECT *"
        if requested_columns:
            cols = []
            seen_cols = set()
            for table_name, col in requested_columns:
                if (
                    table_name == root
                    and col in tables[root]["columns"]
                    and col not in seen_cols
                ):
                    cols.append(col)
                    seen_cols.add(col)
            if cols:
                select_line = "SELECT\n  " + ",\n  ".join(cols)
        query = [
            select_line,
            f"FROM {root}",
            "WHERE " + "\n  AND ".join(where_lines),
        ]
        return "\n".join(query) + ";"

    graph = _build_join_edges(tables)
    parent: dict[str, tuple[str, dict[str, str]]] = {}
    queue: list[str] = [root]
    seen = {root}
    while queue:
        cur = queue.pop(0)
        for edge in graph.get(cur, []):
            nxt = edge["to"]
            if nxt in seen:
                continue
            parent[nxt] = (cur, edge)
            seen.add(nxt)
            queue.append(nxt)

    for t in required_tables:
        if t != root and t not in parent:
            return None

    included = {root}
    for t in required_tables:
        x = t
        while x != root:
            included.add(x)
            x = parent[x][0]
        included.add(root)

    ordered = [root]
    frontier = [root]
    while frontier:
        cur = frontier.pop(0)
        children = sorted(
            [t for t, (p, _) in parent.items() if p == cur and t in included]
        )
        for ch in children:
            if ch not in ordered:
                ordered.append(ch)
                frontier.append(ch)

    aliases = {t: chr(ord("a") + i) for i, t in enumerate(ordered)}

    select_line = "SELECT *"
    if requested_columns:
        select_cols = []
        seen_select = set()
        for table_name, col in requested_columns:
            if table_name in aliases and col in tables[table_name]["columns"]:
                entry = f"{aliases[table_name]}.{col}"
                if entry not in seen_select:
                    select_cols.append(entry)
                    seen_select.add(entry)
        if select_cols:
            select_line = "SELECT\n  " + ",\n  ".join(select_cols)

    lines = [select_line, f"FROM {root} AS {aliases[root]}"]
    for t in ordered[1:]:
        p, edge = parent[t]
        if edge["right_table"] == p and edge["left_table"] == t:
            parent_col = edge["right_col"]
            child_col = edge["left_col"]
        else:
            parent_col = edge["left_col"]
            child_col = edge["right_col"]
        on_expr = f"{aliases[p]}.{parent_col} = {aliases[t]}.{child_col}"
        lines.append(f"JOIN {t} AS {aliases[t]}")
        lines.append(f"  ON {on_expr}")

    where_exprs = []
    for f in filters:
        alias = aliases.get(f["table"])
        expr = f["sql"]
        if alias:
            for col in sorted(
                tables[f["table"]].get("column_order", []), key=len, reverse=True
            ):
                expr = re.sub(rf"\b{re.escape(col)}\b", f"{alias}.{col}", expr)
        where_exprs.append(expr)
    lines.append("WHERE " + "\n  AND ".join(where_exprs))

    return "\n".join(lines) + ";"
