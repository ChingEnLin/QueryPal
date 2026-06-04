from unittest.mock import patch, MagicMock


def test_ensure_users_table_creates_table():
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_conn.cursor.return_value.__enter__ = lambda s: mock_cursor
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

    with patch("services.users_service.get_connection", return_value=mock_conn):
        from services.users_service import ensure_users_table
        ensure_users_table()

    executed_sql = mock_cursor.execute.call_args[0][0]
    assert "CREATE TABLE IF NOT EXISTS users" in executed_sql
    assert "oid" in executed_sql


def test_upsert_user_executes_insert():
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_conn.cursor.return_value.__enter__ = lambda s: mock_cursor
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

    with patch("services.users_service.get_connection", return_value=mock_conn):
        from services.users_service import upsert_user
        upsert_user(oid="abc-123", email="a@b.com", display_name="Alice")

    mock_cursor.execute.assert_called_once()
    args = mock_cursor.execute.call_args[0]
    assert "INSERT INTO users" in args[0]
    assert ("abc-123", "a@b.com", "Alice") == args[1]


def test_upsert_user_skips_when_oid_none():
    with patch("services.users_service.get_connection") as mock_get:
        from services.users_service import upsert_user
        upsert_user(oid=None, email="a@b.com", display_name=None)
    mock_get.assert_not_called()
