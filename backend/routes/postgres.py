from fastapi import APIRouter, Body, Depends, Header, HTTPException

from models.schemas import (
    PgAccessListRequest,
    PgAnalyzeRequest,
    PgDatabasesRequest,
    PgExecuteRequest,
    PgGrantRequest,
    PgNl2SqlRequest,
    PgRevokeRequest,
    PgRowDeleteRequest,
    PgRowInsertRequest,
    PgRowsRequest,
    PgRowUpdateRequest,
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
from services.data_documents_service import log_write_operation
from services.gemini_service import analyze_pg_result
from services.pg_admin_service import (
    get_pg_admin_connection,
    grant_access,
    grant_write_access,
    list_access,
    revoke_access,
    revoke_write_access,
)
from services import pg_row_service
from services.pg_connection_obo import get_pg_connection
from services.pg_query_service import OSSRDBMS_SCOPE, execute_sql
from services.pg_row_service import NoPrimaryKey, RowError
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
        raise HTTPException(
            status_code=502, detail=f"PostgreSQL connection failed: {e}"
        )


def _admin_connect(authorization: str, server_id: str):
    """Resolve FQDN (via the caller's OBO ARM discovery, 404 on unknown) and open
    a PG connection as the backend SP admin — used by grant/revoke/list, which
    must run as a PG admin regardless of the caller's own PG access."""
    user_token = authorization.replace("Bearer ", "")
    arm_token = exchange_token_obo(user_token)
    servers = list_postgres_servers(arm_token)
    try:
        fqdn = get_server_fqdn(server_id, servers)
    except KeyError:
        raise HTTPException(status_code=404, detail="PostgreSQL server not found")
    try:
        return get_pg_admin_connection(fqdn)
    except Exception as e:
        raise HTTPException(
            status_code=502, detail=f"PostgreSQL connection failed: {e}"
        )


def _row_meta(conn, schema_name: str, table: str):
    """Whitelist source: the target table's real columns + primary-key columns.
    Raises 404 if the table is not visible (empty columns list from catalog)."""
    info = get_table_info(conn, schema_name, table)
    if not info["columns"]:
        raise HTTPException(status_code=404, detail="Table not found")
    allowed = {c["name"] for c in info["columns"]}
    pk_cols = [c["name"] for c in info["columns"] if c.get("pk")]
    return allowed, pk_cols


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


@router.post("/analyze")
def analyze(
    data: PgAnalyzeRequest = Body(...),
    authorization: str = Header(...),
    caller: Caller = Depends(require("query:read")),
):
    """AI insight over a result set the caller already fetched. No DB access —
    operates purely on the provided rows, so no server connection is opened."""
    return analyze_pg_result(
        columns=data.columns,
        rows=data.rows,
        user_input=data.user_input,
        model=data.model,
    )


@router.post("/rows")
def rows(
    data: PgRowsRequest = Body(...),
    authorization: str = Header(...),
    caller: Caller = Depends(require("query:read")),
):
    conn = _connect(authorization, data.server_id, data.database, caller)
    try:
        allowed, pk_cols = _row_meta(conn, data.schema_name, data.table)
        return pg_row_service.browse(
            conn, data.schema_name, data.table, allowed, pk_cols,
            data.filters, data.sort, data.limit, data.offset,
        )
    except RowError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()


def _row_dict(result: dict):
    """The single affected row (from RETURNING *) as a dict, for the audit log."""
    rows = result.get("rows") or []
    if not rows:
        return None
    return dict(zip(result.get("columns", []), rows[0]))


@router.post("/row")
def insert_row(
    data: PgRowInsertRequest = Body(...),
    authorization: str = Header(...),
    caller: Caller = Depends(require("data:write")),
):
    conn = _connect(authorization, data.server_id, data.database, caller)
    try:
        allowed, _ = _row_meta(conn, data.schema_name, data.table)
        result = pg_row_service.insert_row(
            conn, data.schema_name, data.table, allowed, data.values,
        )
    except RowError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()
    log_write_operation(
        user_email=caller.email, operation="insert",
        database_name=data.server_id,
        collection_name=f"{data.schema_name}.{data.table}",
        after_data=_row_dict(result) or data.values,
    )
    return result


@router.patch("/row")
def update_row(
    data: PgRowUpdateRequest = Body(...),
    authorization: str = Header(...),
    caller: Caller = Depends(require("data:write")),
):
    conn = _connect(authorization, data.server_id, data.database, caller)
    try:
        allowed, pk_cols = _row_meta(conn, data.schema_name, data.table)
        result = pg_row_service.update_row(
            conn, data.schema_name, data.table, allowed, pk_cols, data.pk, data.values,
        )
    except NoPrimaryKey as e:
        raise HTTPException(status_code=409, detail=str(e))
    except RowError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()
    log_write_operation(
        user_email=caller.email, operation="update",
        database_name=data.server_id,
        collection_name=f"{data.schema_name}.{data.table}",
        document_id=str(data.pk),
        before_data=result.get("before"),
        after_data=_row_dict(result) or data.values,
    )
    return result


@router.delete("/row")
def delete_row(
    data: PgRowDeleteRequest = Body(...),
    authorization: str = Header(...),
    caller: Caller = Depends(require("data:write")),
):
    conn = _connect(authorization, data.server_id, data.database, caller)
    try:
        _, pk_cols = _row_meta(conn, data.schema_name, data.table)
        result = pg_row_service.delete_row(
            conn, data.schema_name, data.table, pk_cols, data.pk,
        )
    except NoPrimaryKey as e:
        raise HTTPException(status_code=409, detail=str(e))
    except RowError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()
    log_write_operation(
        user_email=caller.email, operation="delete",
        database_name=data.server_id,
        collection_name=f"{data.schema_name}.{data.table}",
        document_id=str(data.pk), before_data=_row_dict(result),
    )
    return result


# --- Access provisioning (admin only) ------------------------------------


@router.post("/grant")
def grant(
    data: PgGrantRequest = Body(...),
    authorization: str = Header(...),
    caller: Caller = Depends(require("system:admin")),
):
    conn = _admin_connect(authorization, data.server_id)
    try:
        result = grant_access(conn, data.user_email)
    finally:
        conn.close()
    log_write_operation(
        user_email=caller.email,
        operation="grant",
        database_name=data.server_id,
        collection_name="pg_access",
        document_id=data.user_email,
    )
    return result


@router.post("/revoke")
def revoke(
    data: PgRevokeRequest = Body(...),
    authorization: str = Header(...),
    caller: Caller = Depends(require("system:admin")),
):
    conn = _admin_connect(authorization, data.server_id)
    try:
        result = revoke_access(conn, data.user_email)
    except Exception as e:
        raise HTTPException(status_code=409, detail=f"Cannot revoke: {e}")
    finally:
        conn.close()
    log_write_operation(
        user_email=caller.email,
        operation="revoke",
        database_name=data.server_id,
        collection_name="pg_access",
        document_id=data.user_email,
    )
    return result


@router.post("/grant_write")
def grant_write(
    data: PgGrantRequest = Body(...),
    authorization: str = Header(...),
    caller: Caller = Depends(require("system:admin")),
):
    conn = _admin_connect(authorization, data.server_id)
    try:
        result = grant_write_access(conn, data.user_email)
    except Exception as e:
        raise HTTPException(status_code=409, detail=f"Cannot grant write: {e}")
    finally:
        conn.close()
    log_write_operation(
        user_email=caller.email,
        operation="grant_write",
        database_name=data.server_id,
        collection_name="pg_access",
        document_id=data.user_email,
    )
    return result


@router.post("/revoke_write")
def revoke_write(
    data: PgRevokeRequest = Body(...),
    authorization: str = Header(...),
    caller: Caller = Depends(require("system:admin")),
):
    conn = _admin_connect(authorization, data.server_id)
    try:
        result = revoke_write_access(conn, data.user_email)
    except Exception as e:
        raise HTTPException(status_code=409, detail=f"Cannot revoke write: {e}")
    finally:
        conn.close()
    log_write_operation(
        user_email=caller.email,
        operation="revoke_write",
        database_name=data.server_id,
        collection_name="pg_access",
        document_id=data.user_email,
    )
    return result


@router.post("/access")
def access(
    data: PgAccessListRequest = Body(...),
    authorization: str = Header(...),
    caller: Caller = Depends(require("system:admin")),
):
    conn = _admin_connect(authorization, data.server_id)
    try:
        return list_access(conn)
    finally:
        conn.close()
