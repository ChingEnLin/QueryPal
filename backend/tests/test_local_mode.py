"""Tests for the LOCAL_MONGO_URI bypass — exercises the three call sites
that would otherwise need real Azure credentials."""

from __future__ import annotations

import pytest


def test_is_local_mode_toggles_on_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("LOCAL_MONGO_URI", raising=False)
    from services import azure_auth
    assert azure_auth.is_local_mode() is False

    monkeypatch.setenv("LOCAL_MONGO_URI", "mongodb://localhost:27017")
    assert azure_auth.is_local_mode() is True


def test_exchange_token_obo_short_circuits_in_local_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LOCAL_MONGO_URI", "mongodb://localhost:27017")
    from services import azure_auth
    # Should NOT call MSAL — would explode without AZURE_TENANT_ID etc.
    assert azure_auth.exchange_token_obo("anything") == azure_auth.LOCAL_STUB_TOKEN


def test_extract_email_returns_local_dev_in_local_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LOCAL_MONGO_URI", "mongodb://localhost:27017")
    from services import azure_auth
    assert azure_auth.extract_email_from_token("garbage") == azure_auth.LOCAL_EMAIL


def test_get_connection_string_returns_local_uri_in_local_mode(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("LOCAL_MONGO_URI", "mongodb://localhost:27017")
    from services import azure_cosmos_resources
    # Clear the cache so the bypass actually runs.
    azure_cosmos_resources._connection_string_cache.clear()
    assert azure_cosmos_resources.get_connection_string("ignored", "ignored") == "mongodb://localhost:27017"


def test_accessible_account_ids_returns_sentinel_in_local_mode(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("LOCAL_MONGO_URI", "mongodb://localhost:27017")
    from routes import argus
    assert argus._accessible_account_ids("anything") == [argus.LOCAL_ACCOUNT_ID]


def test_extract_email_still_decodes_real_jwt_when_local_mode_off(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Regression guard: the bypass must NOT fire in production mode."""
    import base64
    import json

    monkeypatch.delenv("LOCAL_MONGO_URI", raising=False)
    from services import azure_auth

    payload = {"preferred_username": "real@user.com"}
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=").decode()
    fake_jwt = f"hdr.{payload_b64}.sig"
    assert azure_auth.extract_email_from_token(fake_jwt) == "real@user.com"
