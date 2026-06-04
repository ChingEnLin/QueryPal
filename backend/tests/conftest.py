"""Test configuration and fixtures."""

import base64
import json

import pytest
from fastapi.testclient import TestClient
from main import app
import services.azure_auth as _azure_auth


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    return TestClient(app)


@pytest.fixture
def mock_auth_header():
    """Mock authorization header — structurally valid unsigned JWT for tests."""
    payload = base64.urlsafe_b64encode(
        json.dumps({"preferred_username": "test@example.com", "roles": ["Analyst"]}).encode()
    ).rstrip(b"=").decode()
    return {"authorization": f"Bearer header.{payload}.sig"}


@pytest.fixture(autouse=True, scope="session")
def _skip_jwt_verification_in_tests():
    """Disable JWKS network calls for all tests. Patched per-test when needed."""
    original_flag = _azure_auth.SKIP_JWT_VERIFICATION
    original_client = _azure_auth._jwks_client
    _azure_auth.SKIP_JWT_VERIFICATION = True
    _azure_auth._jwks_client = None
    yield
    _azure_auth.SKIP_JWT_VERIFICATION = original_flag
    _azure_auth._jwks_client = original_client
