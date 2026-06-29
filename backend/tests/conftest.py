"""Test configuration and fixtures."""

import base64
import json

import pytest

# Python 3.7 compatibility: add .args/.kwargs properties to _Call class
from unittest.mock import _Call

class _ArgsDescriptor:
    """Descriptor to provide .args attribute for Python 3.7 compatibility."""
    def __get__(self, obj, objtype=None):
        if obj is None:
            return self
        return obj[0]

class _KwargsDescriptor:
    """Descriptor to provide .kwargs attribute for Python 3.7 compatibility."""
    def __get__(self, obj, objtype=None):
        if obj is None:
            return self
        return obj[1]

if not hasattr(_Call, 'args'):
    _Call.args = _ArgsDescriptor()
if not hasattr(_Call, 'kwargs'):
    _Call.kwargs = _KwargsDescriptor()

try:
    from fastapi.testclient import TestClient
    from main import app
    import services.azure_auth as _azure_auth
    _main_loaded = True
except (ImportError, ModuleNotFoundError):
    _main_loaded = False
    app = None
    _azure_auth = None


if _main_loaded:
    @pytest.fixture
    def client():
        """Create a test client for the FastAPI app."""
        return TestClient(app)

    @pytest.fixture
    def mock_auth_header():
        """Mock authorization header — structurally valid unsigned JWT for tests."""
        payload = (
            base64.urlsafe_b64encode(
                json.dumps(
                    {"preferred_username": "test@example.com", "roles": ["Analyst"]}
                ).encode()
            )
            .rstrip(b"=")
            .decode()
        )
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
