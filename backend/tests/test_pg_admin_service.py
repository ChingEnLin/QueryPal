from unittest.mock import MagicMock

from services.pg_admin_service import (
    grant_access,
    grant_write_access,
    list_access,
    revoke_access,
    revoke_write_access,
)


def _conn_with_cursor():
    cur = MagicMock()
    conn = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cur
    return conn, cur


def _executed_sql(cur):
    return " || ".join(str(c.args[0]) for c in cur.execute.call_args_list)


def test_grant_creates_principal_and_grants_read_when_absent():
    conn, cur = _conn_with_cursor()
    cur.fetchone.return_value = None  # role does not exist yet
    out = grant_access(conn, "new@virtonomy.io")
    assert out == {"granted": "new@virtonomy.io", "created": True}
    blob = _executed_sql(cur)
    assert "pgaadauth_create_principal" in blob
    assert "pg_read_all_data" in blob
    # email passed as a parameter to create_principal (not interpolated)
    params = [c.args[1] for c in cur.execute.call_args_list if len(c.args) > 1]
    assert ("new@virtonomy.io",) in params
    # GRANT quotes the identifier
    assert "new@virtonomy.io" in blob


def test_grant_skips_create_when_role_exists():
    conn, cur = _conn_with_cursor()
    cur.fetchone.return_value = (1,)  # role already exists
    out = grant_access(conn, "lin@virtonomy.io")
    assert out == {"granted": "lin@virtonomy.io", "created": False}
    blob = _executed_sql(cur)
    assert "pgaadauth_create_principal" not in blob
    assert "pg_read_all_data" in blob  # membership still ensured


def test_revoke_drops_role():
    conn, cur = _conn_with_cursor()
    out = revoke_access(conn, "lin@virtonomy.io")
    assert out == {"revoked": "lin@virtonomy.io"}
    blob = _executed_sql(cur)
    assert "DROP ROLE IF EXISTS" in blob
    assert "lin@virtonomy.io" in blob


def test_list_access_returns_emails_with_write_flag():
    conn, cur = _conn_with_cursor()
    cur.fetchall.return_value = [("a@x.io", True), ("b@x.io", False)]
    assert list_access(conn) == [
        {"email": "a@x.io", "write": True},
        {"email": "b@x.io", "write": False},
    ]
    blob = _executed_sql(cur)
    assert "pgaadauth_list_principals" in blob
    assert "pg_write_all_data" in blob


def test_grant_write_grants_write_role():
    conn, cur = _conn_with_cursor()
    out = grant_write_access(conn, "lin@virtonomy.io")
    assert out == {"granted_write": "lin@virtonomy.io"}
    blob = _executed_sql(cur)
    assert "GRANT pg_write_all_data" in blob
    assert "lin@virtonomy.io" in blob


def test_revoke_write_revokes_write_role():
    conn, cur = _conn_with_cursor()
    out = revoke_write_access(conn, "lin@virtonomy.io")
    assert out == {"revoked_write": "lin@virtonomy.io"}
    blob = _executed_sql(cur)
    assert "REVOKE pg_write_all_data" in blob
    assert "lin@virtonomy.io" in blob
