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
    """Emails of Entra user principals that actually have read access.

    "Has access" = member of pg_read_all_data (what grant_access confers), NOT
    merely having a login principal — otherwise a created-but-ungranted user
    would show as granted yet fail every query with permission denied.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT p.rolname
            FROM pgaadauth_list_principals(false) p
            JOIN pg_roles u ON u.rolname = p.rolname
            WHERE p.principaltype = 'user'
              AND pg_has_role(u.oid, 'pg_read_all_data', 'member')
            """
        )
        return [r[0] for r in cur.fetchall()]
