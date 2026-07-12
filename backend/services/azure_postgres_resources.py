"""Discover Azure PostgreSQL Flexible Servers (ARM) and introspect schema/data.

Mirrors azure_cosmos_resources.py. Discovery uses the ARM access token;
introspection runs against an already-open psycopg2 connection (opened by the
route via pg_connection_obo) so the catalog queries stay unit-testable.
"""

from cachetools import TTLCache, cached
import psycopg2.sql as _sql  # noqa: F401  (reserved for future identifier quoting)
import requests

from services.pg_query_service import _json_safe

_pg_list_cache = TTLCache(maxsize=5, ttl=3600)
ALL_CACHES = [_pg_list_cache]


@cached(_pg_list_cache)
def list_postgres_servers(access_token: str):
    headers = {"Authorization": f"Bearer {access_token}"}
    subs = requests.get(
        "https://management.azure.com/subscriptions?api-version=2020-01-01",
        headers=headers,
    ).json()

    results = []
    for sub in subs.get("value", []):
        sub_id = sub["subscriptionId"]
        url = (
            f"https://management.azure.com/subscriptions/{sub_id}/resources"
            "?api-version=2021-04-01&$filter=resourceType eq "
            "'Microsoft.DBforPostgreSQL/flexibleServers'"
        )
        servers = requests.get(url, headers=headers).json()
        for srv in servers.get("value", []):
            results.append(
                {
                    "name": srv["name"],
                    "id": srv["id"],
                    "fqdn": f"{srv['name']}.postgres.database.azure.com",
                }
            )
    return results


def get_server_fqdn(server_id: str, servers: list) -> str:
    for srv in servers:
        if srv["id"] == server_id:
            return srv["fqdn"]
    raise KeyError(f"Unknown PostgreSQL server id: {server_id}")


def list_databases(conn) -> list:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT datname FROM pg_database "
            "WHERE NOT datistemplate ORDER BY datname"
        )
        return [r[0] for r in cur.fetchall()]


def get_schema_overview(conn) -> list:
    """Schemas -> tables with a fast row estimate from pg_class.reltuples."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT n.nspname AS schema,
                   c.relname AS table,
                   c.reltuples::bigint AS row_estimate
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relkind IN ('r', 'p')
              AND n.nspname NOT IN ('pg_catalog', 'information_schema')
              AND n.nspname NOT LIKE 'pg_toast%'
            ORDER BY n.nspname, c.relname
            """)
        rows = cur.fetchall()

    by_schema: dict = {}
    order: list = []
    for schema, table, estimate in rows:
        if schema not in by_schema:
            by_schema[schema] = []
            order.append(schema)
        by_schema[schema].append({"name": table, "rowEstimate": int(estimate)})
    return [{"schema": s, "tables": by_schema[s]} for s in order]


def get_table_info(conn, schema: str, table: str, sample_limit: int = 20) -> dict:
    with conn.cursor() as cur:
        # Resolve the table oid once; the pk/fk/index catalog queries key off it.
        # (These read pg_catalog, which is world-readable, so they succeed even
        # when the caller lacks table-level read on the data itself.)
        cur.execute(
            "SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace "
            "WHERE n.nspname = %s AND c.relname = %s",
            (schema, table),
        )
        row = cur.fetchone()
        relid = row[0] if row else None

        cur.execute(
            """
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position
            """,
            (schema, table),
        )
        col_rows = cur.fetchall()

        pk_cols: set = set()
        fk_map: dict = {}
        indexes: list = []
        if relid is not None:
            cur.execute(
                "SELECT a.attname FROM pg_index i "
                "JOIN pg_attribute a ON a.attrelid = i.indrelid "
                "AND a.attnum = ANY(i.indkey) "
                "WHERE i.indrelid = %s AND i.indisprimary",
                (relid,),
            )
            pk_cols = {r[0] for r in cur.fetchall()}

            # Outbound foreign keys: local column -> "reftable.refcol".
            cur.execute(
                """
                SELECT att.attname, cl.relname, refatt.attname
                FROM pg_constraint con
                JOIN LATERAL unnest(con.conkey, con.confkey)
                     WITH ORDINALITY AS cols(conkey, confkey, ord) ON true
                JOIN pg_attribute att
                     ON att.attrelid = con.conrelid AND att.attnum = cols.conkey
                JOIN pg_class cl ON cl.oid = con.confrelid
                JOIN pg_attribute refatt
                     ON refatt.attrelid = con.confrelid AND refatt.attnum = cols.confkey
                WHERE con.conrelid = %s AND con.contype = 'f'
                """,
                (relid,),
            )
            for col, reftable, refcol in cur.fetchall():
                fk_map[col] = f"{reftable}.{refcol}"

            # Indexes with column list + kind (uniq / gin / index) for badges.
            cur.execute(
                """
                SELECT i.relname, am.amname, ix.indisunique,
                       array_to_string(array_agg(a.attname ORDER BY k.ord), ', ')
                FROM pg_index ix
                JOIN pg_class i ON i.oid = ix.indexrelid
                JOIN pg_am am ON am.oid = i.relam
                JOIN unnest(ix.indkey) WITH ORDINALITY AS k(attnum, ord) ON true
                LEFT JOIN pg_attribute a
                     ON a.attrelid = ix.indrelid AND a.attnum = k.attnum
                WHERE ix.indrelid = %s
                GROUP BY i.relname, am.amname, ix.indisunique
                ORDER BY i.relname
                """,
                (relid,),
            )
            for name, method, is_unique, cols in cur.fetchall():
                kind = "gin" if method == "gin" else "uniq" if is_unique else "index"
                indexes.append({"name": name, "cols": cols or "", "kind": kind})

        columns = [
            {
                "name": name,
                "type": dtype,
                "nullable": (nullable == "YES"),
                "pk": name in pk_cols,
                "fk": fk_map.get(name),
            }
            for name, dtype, nullable in col_rows
        ]

        # Sample data is best-effort: the caller may lack table-level read
        # privileges (e.g. no pg_read_all_data) even though catalog metadata
        # above is readable. Don't fail the whole request — return columns/
        # indexes with an empty sample and a reason the UI can surface.
        # Identifiers can't be parameterized; quote on validated catalog names.
        sample = {"columns": [], "rows": []}
        try:
            cur.execute(
                'SELECT * FROM "{}"."{}" LIMIT %s'.format(
                    schema.replace('"', '""'), table.replace('"', '""')
                ),
                (sample_limit,),
            )
            sample = {
                "columns": [d[0] for d in (cur.description or [])],
                "rows": [[_json_safe(v) for v in row] for row in cur.fetchall()],
            }
        except Exception as e:
            conn.rollback()  # clear the aborted transaction
            sample = {"columns": [], "rows": [], "error": str(e).strip()}

    return {
        "schema": schema,
        "table": table,
        "columns": columns,
        "indexes": indexes,
        "sample": sample,
    }
