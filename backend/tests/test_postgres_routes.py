from unittest.mock import MagicMock

import pytest

SERVERS = [
    {
        "name": "database-patient-server",
        "id": "/subscriptions/sub1/.../flexibleServers/database-patient-server",
        "fqdn": "database-patient-server.postgres.database.azure.com",
    }
]


@pytest.fixture
def patched(monkeypatch):
    import routes.postgres as r

    monkeypatch.setattr(r, "exchange_token_obo", lambda *a, **k: "tok")
    monkeypatch.setattr(r, "list_postgres_servers", lambda token: SERVERS)
    monkeypatch.setattr(r, "get_pg_connection", lambda *a, **k: MagicMock())
    return r


def test_list_servers(client, mock_auth_header, patched):
    resp = client.get("/postgres/servers", headers=mock_auth_header)
    assert resp.status_code == 200
    assert resp.json()[0]["name"] == "database-patient-server"


def test_schema_overview(client, mock_auth_header, patched, monkeypatch):
    monkeypatch.setattr(
        patched,
        "get_schema_overview",
        lambda conn: [
            {"schema": "public", "tables": [{"name": "patients", "rowEstimate": 5}]}
        ],
    )
    resp = client.post(
        "/postgres/schema",
        headers=mock_auth_header,
        json={"server_id": SERVERS[0]["id"], "database": "appdb"},
    )
    assert resp.status_code == 200
    assert resp.json()[0]["schema"] == "public"


def test_execute_runs_readonly(client, mock_auth_header, patched, monkeypatch):
    monkeypatch.setattr(
        patched, "execute_sql", lambda conn, sql: {"columns": ["id"], "rows": [[1]]}
    )
    resp = client.post(
        "/postgres/execute",
        headers=mock_auth_header,
        json={
            "server_id": SERVERS[0]["id"],
            "database": "appdb",
            "sql": "SELECT id FROM patients",
        },
    )
    assert resp.status_code == 200
    assert resp.json() == {"columns": ["id"], "rows": [[1]]}


def test_execute_rejects_unknown_server(client, mock_auth_header, patched):
    resp = client.post(
        "/postgres/execute",
        headers=mock_auth_header,
        json={"server_id": "/bogus/id", "database": "appdb", "sql": "SELECT 1"},
    )
    assert resp.status_code == 404


def test_analyze_returns_insight(client, mock_auth_header, patched, monkeypatch):
    from services.gemini_service import PgInsight

    monkeypatch.setattr(
        patched,
        "analyze_pg_result",
        lambda **kw: PgInsight(summary="2 rows", points=["p1"], followups=["f1"]),
    )
    resp = client.post(
        "/postgres/analyze",
        headers=mock_auth_header,
        json={"columns": ["id"], "rows": [[1], [2]], "user_input": "count"},
    )
    assert resp.status_code == 200
    assert resp.json() == {"summary": "2 rows", "points": ["p1"], "followups": ["f1"]}


# --- Access provisioning (admin) routes ---------------------------------

import base64 as _b64
import json as _json


def _admin_header():
    payload = (
        _b64.urlsafe_b64encode(
            _json.dumps(
                {"preferred_username": "admin@example.com", "roles": ["Admin"]}
            ).encode()
        )
        .rstrip(b"=")
        .decode()
    )
    return {"authorization": f"Bearer header.{payload}.sig"}


@pytest.fixture
def patched_admin(monkeypatch):
    import routes.postgres as r

    monkeypatch.setattr(r, "exchange_token_obo", lambda *a, **k: "tok")
    monkeypatch.setattr(r, "list_postgres_servers", lambda token: SERVERS)
    monkeypatch.setattr(r, "get_pg_admin_connection", lambda *a, **k: MagicMock())
    monkeypatch.setattr(r, "log_write_operation", lambda *a, **k: None)
    return r


def test_grant_requires_admin(client, mock_auth_header, patched_admin):
    # default mock_auth_header is an Analyst -> no system:admin
    resp = client.post(
        "/postgres/grant",
        headers=mock_auth_header,
        json={"server_id": SERVERS[0]["id"], "user_email": "u@x.io"},
    )
    assert resp.status_code == 403


def test_grant_ok_for_admin(client, patched_admin, monkeypatch):
    monkeypatch.setattr(
        patched_admin,
        "grant_access",
        lambda conn, email: {"granted": email, "created": True},
    )
    resp = client.post(
        "/postgres/grant",
        headers=_admin_header(),
        json={"server_id": SERVERS[0]["id"], "user_email": "u@x.io"},
    )
    assert resp.status_code == 200
    assert resp.json() == {"granted": "u@x.io", "created": True}


def test_revoke_ok_for_admin(client, patched_admin, monkeypatch):
    monkeypatch.setattr(
        patched_admin, "revoke_access", lambda conn, email: {"revoked": email}
    )
    resp = client.post(
        "/postgres/revoke",
        headers=_admin_header(),
        json={"server_id": SERVERS[0]["id"], "user_email": "u@x.io"},
    )
    assert resp.status_code == 200
    assert resp.json() == {"revoked": "u@x.io"}


def test_revoke_conflict_on_dependency_error(client, patched_admin, monkeypatch):
    def _boom(conn, email):
        raise Exception("role has dependent objects")

    monkeypatch.setattr(patched_admin, "revoke_access", _boom)
    resp = client.post(
        "/postgres/revoke",
        headers=_admin_header(),
        json={"server_id": SERVERS[0]["id"], "user_email": "u@x.io"},
    )
    assert resp.status_code == 409


def test_access_list_for_admin(client, patched_admin, monkeypatch):
    monkeypatch.setattr(patched_admin, "list_access", lambda conn: ["a@x.io", "b@x.io"])
    resp = client.post(
        "/postgres/access",
        headers=_admin_header(),
        json={"server_id": SERVERS[0]["id"]},
    )
    assert resp.status_code == 200
    assert resp.json() == ["a@x.io", "b@x.io"]


def test_access_rejects_unknown_server(client, patched_admin):
    resp = client.post(
        "/postgres/access",
        headers=_admin_header(),
        json={"server_id": "/bogus/id"},
    )
    assert resp.status_code == 404


# --- Row CRUD routes ------------------------------------------------------


def _fake_conn_with_rows(monkeypatch, patched, rows, columns, total=None):
    """Patch get_table_info + a cursor that returns `rows`/`columns`, and for
    browse a trailing count fetchone()."""
    monkeypatch.setattr(
        patched, "get_table_info",
        lambda conn, schema, table: {
            "columns": [
                {"name": "id", "type": "integer", "nullable": False, "pk": True, "fk": None},
                {"name": "status", "type": "text", "nullable": True, "pk": False, "fk": None},
            ],
            "indexes": [], "sample": {"columns": [], "rows": []},
        },
    )
    cur = MagicMock()
    cur.__enter__ = lambda s: cur
    cur.__exit__ = lambda *a: False
    cur.description = [(c,) for c in columns]
    cur.fetchall.return_value = rows
    cur.fetchone.return_value = (total,) if total is not None else None
    conn = MagicMock()
    conn.cursor.return_value = cur
    monkeypatch.setattr(patched, "get_pg_connection", lambda *a, **k: conn)
    return conn


def test_rows_browse(client, mock_auth_header, patched, monkeypatch):
    _fake_conn_with_rows(monkeypatch, patched, [[1, "paid"]], ["id", "status"], total=1)
    resp = client.post("/postgres/rows", headers=mock_auth_header, json={
        "server_id": SERVERS[0]["id"], "database": "app", "schema_name": "public",
        "table": "orders", "filters": [], "limit": 50, "offset": 0,
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["columns"] == ["id", "status"]
    assert body["total"] == 1
    assert body["pk"] == ["id"]


def test_insert_row(client, mock_auth_header, patched, monkeypatch):
    _fake_conn_with_rows(monkeypatch, patched, [[2, "new"]], ["id", "status"])
    monkeypatch.setattr(patched, "log_write_operation", lambda **k: None)
    resp = client.post("/postgres/row", headers=mock_auth_header, json={
        "server_id": SERVERS[0]["id"], "database": "app", "schema_name": "public",
        "table": "orders", "values": {"status": "new"},
    })
    assert resp.status_code == 200
    assert resp.json()["rows"] == [[2, "new"]]


def test_delete_row_without_pk_is_409(client, mock_auth_header, patched, monkeypatch):
    monkeypatch.setattr(
        patched, "get_table_info",
        lambda conn, schema, table: {
            "columns": [{"name": "id", "type": "integer", "nullable": True,
                         "pk": False, "fk": None}],
            "indexes": [], "sample": {"columns": [], "rows": []},
        },
    )
    monkeypatch.setattr(patched, "get_pg_connection", lambda *a, **k: MagicMock())
    resp = client.request("DELETE", "/postgres/row", headers=mock_auth_header, json={
        "server_id": SERVERS[0]["id"], "database": "app", "schema_name": "public",
        "table": "logs", "pk": {"id": 1},
    })
    assert resp.status_code == 409


def test_rows_unknown_table_is_404(client, mock_auth_header, patched, monkeypatch):
    monkeypatch.setattr(
        patched, "get_table_info",
        lambda conn, schema, table: {
            "columns": [], "indexes": [], "sample": {"columns": [], "rows": []},
        },
    )
    monkeypatch.setattr(patched, "get_pg_connection", lambda *a, **k: MagicMock())
    resp = client.post("/postgres/rows", headers=mock_auth_header, json={
        "server_id": SERVERS[0]["id"], "database": "app", "schema_name": "public",
        "table": "nonexistent", "filters": [], "limit": 50, "offset": 0,
    })
    assert resp.status_code == 404
