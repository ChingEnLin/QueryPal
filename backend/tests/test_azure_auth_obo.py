from unittest.mock import MagicMock, patch
import services.azure_auth as auth


def test_obo_uses_arm_scope_by_default():
    fake_app = MagicMock()
    fake_app.acquire_token_on_behalf_of.return_value = {"access_token": "tok"}
    with patch.object(auth, "_get_msal_app", return_value=fake_app):
        with patch.object(auth, "ARM_SCOPE", "arm/.default"):
            assert auth.exchange_token_obo("user-jwt") == "tok"
    _, kwargs = fake_app.acquire_token_on_behalf_of.call_args
    assert kwargs["scopes"] == ["arm/.default"]


def test_obo_uses_explicit_scope_when_given():
    fake_app = MagicMock()
    fake_app.acquire_token_on_behalf_of.return_value = {"access_token": "pgtok"}
    with patch.object(auth, "_get_msal_app", return_value=fake_app):
        result = auth.exchange_token_obo(
            "user-jwt", scope="https://ossrdbms-aad.database.windows.net/.default"
        )
    assert result == "pgtok"
    _, kwargs = fake_app.acquire_token_on_behalf_of.call_args
    assert kwargs["scopes"] == [
        "https://ossrdbms-aad.database.windows.net/.default"
    ]


def test_obo_raises_when_no_access_token():
    fake_app = MagicMock()
    fake_app.acquire_token_on_behalf_of.return_value = {"error": "bad"}
    with patch.object(auth, "_get_msal_app", return_value=fake_app):
        try:
            auth.exchange_token_obo("user-jwt")
            assert False, "expected exception"
        except Exception as e:
            assert "OBO token exchange failed" in str(e)


def test_get_app_token_uses_client_credentials():
    fake_app = MagicMock()
    fake_app.acquire_token_for_client.return_value = {"access_token": "apptok"}
    with patch.object(auth, "_get_msal_app", return_value=fake_app):
        assert auth.get_app_token("oss/.default") == "apptok"
    _, kwargs = fake_app.acquire_token_for_client.call_args
    assert kwargs["scopes"] == ["oss/.default"]


def test_get_app_token_raises_when_no_access_token():
    fake_app = MagicMock()
    fake_app.acquire_token_for_client.return_value = {"error": "nope"}
    with patch.object(auth, "_get_msal_app", return_value=fake_app):
        try:
            auth.get_app_token("oss/.default")
            assert False, "expected exception"
        except Exception as e:
            assert "App token acquisition failed" in str(e)
