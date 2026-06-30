"""Open a psycopg2 connection to an Azure PostgreSQL Flexible Server using the
caller's Entra identity (OBO token as password). No stored secrets.

Distinct from services/pg_connection.py, which connects to QueryPal's own
metadata store on GCP Cloud SQL.
"""
import psycopg2


def get_pg_connection(fqdn: str, dbname: str, email: str, pg_token: str):
    return psycopg2.connect(
        host=fqdn,
        dbname=dbname,
        user=email,
        password=pg_token,
        sslmode="require",
        # Fail fast instead of hanging on the OS default (~minutes) when the
        # server is unreachable — almost always a firewall/network issue.
        connect_timeout=10,
    )
