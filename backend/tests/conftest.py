"""Test configuration and fixtures."""

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
    """Mock authorization header."""
    return {"authorization": "Bearer mock-token-123"}


@pytest.fixture(autouse=True, scope="session")
def _skip_jwt_verification_in_tests():
    """Disable JWKS network calls for all tests. Patched per-test when needed."""
    original = _azure_auth.SKIP_JWT_VERIFICATION
    _azure_auth.SKIP_JWT_VERIFICATION = True
    yield
    _azure_auth.SKIP_JWT_VERIFICATION = original
