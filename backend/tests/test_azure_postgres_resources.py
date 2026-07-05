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
    cur.fetchone.return_value = (16384,)  # relid lookup
    # fetchall order: columns, pk, fk, indexes, sample
    cur.fetchall.side_effect = [
        [
            ("id", "integer", "NO"),
            ("name", "text", "YES"),
            ("study_id", "integer", "YES"),
        ],
        [("id",)],  # primary key columns
        [("study_id", "studies", "id")],  # foreign keys
        [("patients_pkey", "btree", True, "id"), ("idx_name", "gin", False, "name")],
        [(1, "Ann", 7), (2, "Bob", 7)],  # sample
    ]
    cur.description = [("id",), ("name",), ("study_id",)]
    conn = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cur
    out = pg.get_table_info(conn, "public", "patients", sample_limit=20)
    assert out["columns"] == [
        {"name": "id", "type": "integer", "nullable": False, "pk": True, "fk": None},
        {"name": "name", "type": "text", "nullable": True, "pk": False, "fk": None},
        {
            "name": "study_id",
            "type": "integer",
            "nullable": True,
            "pk": False,
            "fk": "studies.id",
        },
    ]
    assert out["indexes"] == [
        {"name": "patients_pkey", "cols": "id", "kind": "uniq"},
        {"name": "idx_name", "cols": "name", "kind": "gin"},
    ]
    assert out["sample"]["columns"] == ["id", "name", "study_id"]
    assert out["sample"]["rows"] == [[1, "Ann", 7], [2, "Bob", 7]]
