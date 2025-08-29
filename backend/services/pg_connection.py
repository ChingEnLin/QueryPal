from os import environ as env
import psycopg2

DB_NAME = env.get("DB_NAME", "querypal")
DB_USER = env.get("DB_USER", "postgres")
DB_PASS = env.get("DB_PASS", "postgres")
DB_HOST = env.get("DB_HOST", "127.0.0.1")
DB_PORT = env.get("DB_PORT", "5432")
DB_UNIX_SOCKET = env.get("DB_UNIX_SOCKET")


def get_connection():
    # Use Unix socket if available (Cloud SQL), otherwise use host/port (local dev)
    if DB_UNIX_SOCKET:
        conn = psycopg2.connect(
            dbname=DB_NAME, user=DB_USER, password=DB_PASS, host=DB_UNIX_SOCKET
        )
    else:
        conn = psycopg2.connect(
            dbname=DB_NAME, user=DB_USER, password=DB_PASS, host=DB_HOST, port=DB_PORT
        )
    conn.autocommit = True
    return conn
