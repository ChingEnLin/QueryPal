"""Test configuration and fixtures."""

import pytest
from fastapi.testclient import TestClient
from main import app


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    return TestClient(app)


@pytest.fixture
def mock_auth_header():
    """Mock authorization header."""
    return {"authorization": "Bearer mock-token-123"}
