import pytest

from services import pg_row_service as s


def test_browse_builds_where_order_limit_offset():
    q, params = s.build_browse(
        "public",
        "orders",
        {"id", "status", "total"},
        [{"column": "status", "op": "=", "value": "paid"}],
        {"column": "total", "dir": "desc"},
        50,
        100,
    )
    assert q == (
        'SELECT * FROM "public"."orders" WHERE "status" = %s '
        'ORDER BY "total" DESC LIMIT %s OFFSET %s'
    )
    assert params == ["paid", 50, 100]


def test_browse_nullary_operator_binds_no_value():
    q, params = s.build_browse(
        "public",
        "orders",
        {"id", "note"},
        [{"column": "note", "op": "isnull"}],
        None,
        50,
        0,
    )
    assert '"note" IS NULL' in q
    assert params == [50, 0]


def test_unknown_column_is_rejected():
    with pytest.raises(s.RowError):
        s.build_browse(
            "public",
            "orders",
            {"id"},
            [{"column": "secret", "op": "=", "value": 1}],
            None,
            50,
            0,
        )


def test_unsupported_operator_is_rejected():
    with pytest.raises(s.RowError):
        s.build_browse(
            "public",
            "orders",
            {"id"},
            [{"column": "id", "op": "; drop", "value": 1}],
            None,
            50,
            0,
        )


def test_count_builds_matching_where():
    q, params = s.build_count(
        "public", "orders", {"status"}, [{"column": "status", "op": "=", "value": "x"}]
    )
    assert q == 'SELECT count(*) FROM "public"."orders" WHERE "status" = %s'
    assert params == ["x"]


def test_insert_builds_columns_and_params_in_order():
    q, params = s.build_insert(
        "public", "orders", {"status", "total"}, {"status": "paid", "total": 9.5}
    )
    assert q == (
        'INSERT INTO "public"."orders" ("status", "total") '
        "VALUES (%s, %s) RETURNING *"
    )
    assert params == ["paid", 9.5]


def test_update_binds_set_then_pk():
    q, params = s.build_update(
        "public",
        "orders",
        {"status", "total"},
        ["id"],
        {"id": 7},
        {"status": "refunded"},
    )
    assert q == (
        'UPDATE "public"."orders" SET "status" = %s WHERE "id" = %s RETURNING *'
    )
    assert params == ["refunded", 7]


def test_delete_binds_pk():
    q, params = s.build_delete("public", "orders", ["id"], {"id": 7})
    assert q == 'DELETE FROM "public"."orders" WHERE "id" = %s RETURNING *'
    assert params == [7]


def test_write_without_primary_key_raises():
    with pytest.raises(s.NoPrimaryKey):
        s.build_delete("public", "logs", [], {"id": 1})
    with pytest.raises(s.NoPrimaryKey):
        s.build_update("public", "logs", {"id"}, [], {"id": 1}, {"x": 1})


def test_update_pk_mismatch_raises():
    with pytest.raises(s.RowError):
        s.build_update(
            "public", "orders", {"status"}, ["id"], {"wrong": 1}, {"status": "x"}
        )


def test_write_wraps_db_error_as_rowerror():
    from unittest.mock import MagicMock
    import psycopg2

    cur = MagicMock()
    cur.__enter__ = lambda self=cur: cur
    cur.__exit__ = lambda *a: False
    cur.execute.side_effect = psycopg2.Error("null value violates not-null constraint")
    conn = MagicMock()
    conn.cursor.return_value = cur
    with pytest.raises(s.RowError):
        s.insert_row(conn, "public", "orders", {"status"}, {"status": "x"})


def test_browse_wraps_db_error_as_rowerror():
    from unittest.mock import MagicMock
    import psycopg2

    cur = MagicMock()
    cur.__enter__ = lambda self=cur: cur
    cur.__exit__ = lambda *a: False
    cur.execute.side_effect = psycopg2.Error("permission denied for table orders")
    conn = MagicMock()
    conn.cursor.return_value = cur
    with pytest.raises(s.RowError):
        s.browse(conn, "public", "orders", {"status"}, ["id"], [], None, 50, 0)


def test_update_row_captures_before_image_for_diff():
    from unittest.mock import MagicMock

    cur = MagicMock()
    cur.__enter__ = lambda self=cur: cur
    cur.__exit__ = lambda *a: False
    cur.description = [("id",), ("status",)]
    cur.fetchone.return_value = (7, "old")  # SELECT pre-image
    cur.fetchall.return_value = [(7, "new")]  # UPDATE ... RETURNING *
    conn = MagicMock()
    conn.cursor.return_value = cur
    result = s.update_row(
        conn, "public", "orders", {"status"}, ["id"], {"id": 7}, {"status": "new"}
    )
    assert result["before"] == {"id": 7, "status": "old"}
    assert result["rows"] == [[7, "new"]]
