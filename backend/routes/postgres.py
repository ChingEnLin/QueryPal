from fastapi import APIRouter, Body, Depends, Header, HTTPException

from models.schemas import (
    PgDatabasesRequest,
    PgExecuteRequest,
    PgNl2SqlRequest,
    PgSchemaRequest,
    PgTableInfoRequest,
)
from services.azure_auth import exchange_token_obo
from services.azure_postgres_resources import (
    get_schema_overview,
    get_server_fqdn,
    get_table_info,
    list_databases,
    list_postgres_servers,
)
from services.pg_connection_obo import get_pg_connection
from services.pg_query_service import OSSRDBMS_SCOPE, execute_sql
from services.pg_react_agent_service import run_sql_generator
from services.rbac import Caller, require

router = APIRouter()


def _connect(authorization: str, server_id: str, database: str, caller: Caller):
    """Resolve server FQDN and open an Entra-OBO PG connection. 404 on unknown
    server id (do not leak existence of servers the caller can't enumerate)."""
    user_token = authorization.replace("Bearer ", "")
    arm_token = exchange_token_obo(user_token)
    servers = list_postgres_servers(arm_token)
    try:
        fqdn = get_server_fqdn(server_id, servers)
    except KeyError:
        raise HTTPException(status_code=404, detail="PostgreSQL server not found")
    pg_token = exchange_token_obo(user_token, scope=OSSRDBMS_SCOPE)
    try:
        return get_pg_connection(fqdn, database, caller.email, pg_token)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"PostgreSQL connection failed: {e}")


@router.get("/servers")
def servers(
    authorization: str = Header(...),
    caller: Caller = Depends(require("query:read")),
):
    arm_token = exchange_token_obo(authorization.replace("Bearer ", ""))
    return list_postgres_servers(arm_token)


@router.post("/databases")
def databases(
    data: PgDatabasesRequest = Body(...),
    authorization: str = Header(...),
    caller: Caller = Depends(require("query:read")),
):
    conn = _connect(authorization, data.server_id, "postgres", caller)
    try:
        return list_databases(conn)
    finally:
        conn.close()


@router.post("/schema")
def schema(
    data: PgSchemaRequest = Body(...),
    authorization: str = Header(...),
    caller: Caller = Depends(require("query:read")),
):
    conn = _connect(authorization, data.server_id, data.database, caller)
    try:
        return get_schema_overview(conn)
    finally:
        conn.close()


@router.post("/table_info")
def table_info(
    data: PgTableInfoRequest = Body(...),
    authorization: str = Header(...),
    caller: Caller = Depends(require("query:read")),
):
    conn = _connect(authorization, data.server_id, data.database, caller)
    try:
        return get_table_info(conn, data.schema_name, data.table)
    finally:
        conn.close()


@router.post("/nl2sql")
def nl2sql(
    data: PgNl2SqlRequest = Body(...),
    authorization: str = Header(...),
    caller: Caller = Depends(require("query:read")),
):
    conn = _connect(authorization, data.server_id, data.database, caller)
    try:
        return run_sql_generator(
            user_input=data.user_input,
            database=data.database,
            schema_context=data.schema_context,
            conn=conn,
            max_iterations=data.max_iterations,
            model=data.model,
        )
    finally:
        conn.close()


@router.post("/execute")
def execute(
    data: PgExecuteRequest = Body(...),
    authorization: str = Header(...),
    caller: Caller = Depends(require("query:read")),
):
    conn = _connect(authorization, data.server_id, data.database, caller)
    try:
        result = execute_sql(conn, data.sql)
    finally:
        conn.close()
    if isinstance(result, dict) and "error" in result:
        raise HTTPException(status_code=500, detail=f"SQL error: {result['error']}")
    return result
