from unittest.mock import patch
import services.pg_connection_obo as mod


def test_get_pg_connection_passes_entra_credentials():
    with patch.object(mod.psycopg2, "connect") as connect:
        connect.return_value = object()
        mod.get_pg_connection(
            fqdn="srv.postgres.database.azure.com",
            dbname="appdb",
            email="user@example.com",
            pg_token="the-obo-token",
        )
    _, kwargs = connect.call_args
    assert kwargs["host"] == "srv.postgres.database.azure.com"
    assert kwargs["dbname"] == "appdb"
    assert kwargs["user"] == "user@example.com"
    assert kwargs["password"] == "the-obo-token"
    assert kwargs["sslmode"] == "require"
