"""Provision Azure PostgreSQL access for QueryPal users (grant / revoke / list).

Runs as the backend service principal, which is a permanent PG Entra admin
(member of azure_pg_admin). The SP authenticates app-only and logs into PG with
its Entra DISPLAY NAME (set via PG_ADMIN_LOGIN) — not its appId/objectId. This
lets a QueryPal admin grant DB access to any user without themselves being a PG
admin (and without az/psql).

Grant creates an Entra LOGIN principal AND grants pg_read_all_data — the
principal alone has no table privileges, so reads would otherwise fail. Read-only
tool: no write/DDL privileges are ever granted.
"""

from os import environ as env

import psycopg2
from psycopg2 import sql

from services.azure_auth import get_app_token
from services.pg_query_service import OSSRDBMS_SCOPE


def get_pg_admin_connection(fqdn: str, dbname: str = "postgres"):
    """Open a PG connection as the backend SP admin (app-only token)."""
    login = env["PG_ADMIN_LOGIN"]
    token = get_app_token(OSSRDBMS_SCOPE)
    conn = psycopg2.connect(
        host=fqdn,
        dbname=dbname,
        user=login,
        password=token,
        sslmode="require",
        connect_timeout=10,
    )
    conn.autocommit = True
    return conn


def grant_access(conn, user_email: str) -> dict:
    """Idempotently grant `user_email` read-only PG access.

    Creates the Entra login principal if absent, then ensures pg_read_all_data.
    """
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (user_email,))
        existed = cur.fetchone() is not None
        if not existed:
            cur.execute(
                "SELECT pgaadauth_create_principal(%s, false, false)", (user_email,)
            )
        cur.execute(
            sql.SQL("GRANT pg_read_all_data TO {}").format(sql.Identifier(user_email))
        )
    return {"granted": user_email, "created": not existed}


def grant_write_access(conn, user_email: str) -> dict:
    """Add write privileges (INSERT/UPDATE/DELETE on all tables) on top of the
    caller's existing read access, via the built-in pg_write_all_data role.

    Opt-in and separate from grant_access, which stays read-only. Assumes the
    user already has a login principal + read (granted from the same admin UI).
    """
    with conn.cursor() as cur:
        cur.execute(
            sql.SQL("GRANT pg_write_all_data TO {}").format(sql.Identifier(user_email))
        )
    return {"granted_write": user_email}


def revoke_write_access(conn, user_email: str) -> dict:
    """Drop write privileges while leaving read access intact."""
    with conn.cursor() as cur:
        cur.execute(
            sql.SQL("REVOKE pg_write_all_data FROM {}").format(
                sql.Identifier(user_email)
            )
        )
    return {"revoked_write": user_email}


def revoke_access(conn, user_email: str) -> dict:
    """Revoke `user_email` PG access by dropping the role.

    Read-only principals own nothing, so DROP ROLE suffices. If a role owns
    objects this raises (we never silently DROP OWNED) — surface as a 409.
    """
    with conn.cursor() as cur:
        cur.execute(
            sql.SQL("DROP ROLE IF EXISTS {}").format(sql.Identifier(user_email))
        )
    return {"revoked": user_email}


def list_access(conn) -> list:
    """Entra user principals with read access + whether they also have write.

    "Has access" = member of pg_read_all_data (what grant_access confers), NOT
    merely having a login principal — otherwise a created-but-ungranted user
    would show as granted yet fail every query with permission denied. The
    `write` flag reflects membership in pg_write_all_data (grant_write_access).
    Returns [{"email": str, "write": bool}].
    """
    with conn.cursor() as cur:
        cur.execute("""
            SELECT p.rolname,
                   pg_has_role(u.oid, 'pg_write_all_data', 'member')
            FROM pgaadauth_list_principals(false) p
            JOIN pg_roles u ON u.rolname = p.rolname
            WHERE p.principaltype = 'user'
              AND pg_has_role(u.oid, 'pg_read_all_data', 'member')
            """)
        return [{"email": r[0], "write": bool(r[1])} for r in cur.fetchall()]
