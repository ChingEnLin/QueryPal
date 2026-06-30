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
