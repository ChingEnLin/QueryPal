from unittest.mock import MagicMock, patch

import services.azure_postgres_resources as pg


def _resp(json_body):
    r = MagicMock()
    r.json.return_value = json_body
    r.status_code = 200
    return r


def test_list_postgres_servers_filters_flexible_servers():
    pg._pg_list_cache.clear()
    subs = _resp({"value": [{"subscriptionId": "sub1"}]})
    servers = _resp(
        {
            "value": [
                {
                    "name": "database-patient-server",
                    "id": "/subscriptions/sub1/.../flexibleServers/database-patient-server",
                }
            ]
        }
    )
    with patch.object(pg.requests, "get", side_effect=[subs, servers]):
        out = pg.list_postgres_servers("arm-token")
    assert out == [
        {
            "name": "database-patient-server",
            "id": "/subscriptions/sub1/.../flexibleServers/database-patient-server",
            "fqdn": "database-patient-server.postgres.database.azure.com",
        }
    ]


def test_list_databases_excludes_templates():
    cur = MagicMock()
    cur.fetchall.return_value = [("appdb",), ("postgres",)]
    conn = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cur
    assert pg.list_databases(conn) == ["appdb", "postgres"]


def test_get_schema_overview_groups_tables_by_schema():
    cur = MagicMock()
    cur.fetchall.return_value = [
        ("public", "patients", 1200),
        ("public", "visits", 50),
    ]
    conn = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cur
    out = pg.get_schema_overview(conn)
    assert out == [
        {
            "schema": "public",
            "tables": [
                {"name": "patients", "rowEstimate": 1200},
                {"name": "visits", "rowEstimate": 50},
            ],
        }
    ]


def test_get_table_info_returns_columns_indexes_sample():
    cur = MagicMock()
    # 1) columns query  2) indexes query  3) sample query
    cur.fetchall.side_effect = [
        [("id", "integer", "NO"), ("name", "text", "YES")],
        [("patients_pkey",)],
        [(1, "Ann"), (2, "Bob")],
    ]
    cur.description = [("id",), ("name",)]
    conn = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cur
    out = pg.get_table_info(conn, "public", "patients", sample_limit=20)
    assert out["columns"] == [
        {"name": "id", "type": "integer", "nullable": False},
        {"name": "name", "type": "text", "nullable": True},
    ]
    assert out["indexes"] == ["patients_pkey"]
    assert out["sample"]["columns"] == ["id", "name"]
    assert out["sample"]["rows"] == [[1, "Ann"], [2, "Bob"]]
