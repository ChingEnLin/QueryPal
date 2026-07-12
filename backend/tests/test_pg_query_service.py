import datetime
import decimal
from unittest.mock import MagicMock

import pytest

from services.pg_query_service import is_write_sql, execute_sql


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT * FROM patients",
        "  select 1",
        "WITH t AS (SELECT 1) SELECT * FROM t",
    ],
)
def test_read_sql_is_not_write(sql):
    assert is_write_sql(sql) is False


@pytest.mark.parametrize(
    "sql",
    [
        "UPDATE patients SET name='x'",
        "INSERT INTO patients (id) VALUES (1)",
        "DELETE FROM patients",
        "DROP TABLE patients",
        "CREATE TABLE t (id int)",
        "TRUNCATE patients",
        "not valid sql ;;;",
    ],
)
def test_write_or_ddl_or_unparseable_is_write(sql):
    assert is_write_sql(sql) is True


def test_execute_sql_returns_columns_and_json_safe_rows():
    cur = MagicMock()
    cur.description = [("id",), ("created",), ("amount",)]
    cur.fetchall.return_value = [
        (1, datetime.datetime(2026, 1, 1), decimal.Decimal("9.50")),
    ]
    conn = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cur

    out = execute_sql(conn, "SELECT id, created, amount FROM t")

    assert out["columns"] == ["id", "created", "amount"]
    assert out["rows"] == [[1, "2026-01-01T00:00:00", "9.50"]]
    # read-only transaction was set before running the query
    executed = " ".join(str(c.args[0]) for c in cur.execute.call_args_list)
    assert "READ ONLY" in executed.upper()


def test_execute_sql_returns_error_dict_on_failure():
    cur = MagicMock()
    cur.execute.side_effect = Exception("relation does not exist")
    conn = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cur

    out = execute_sql(conn, "SELECT * FROM nope")
    assert "error" in out
    assert "relation does not exist" in out["error"]
