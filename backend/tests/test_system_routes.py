"""Tests for system routes."""

from unittest.mock import Mock, patch


def test_clear_cache(client):
    """Test clearing all caches."""
    with patch("routes.system.ALL_CACHES", [Mock(), Mock()]) as mock_caches:
        response = client.post("/system/clear_cache")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "All caches cleared" in data["message"]

        # Verify all caches were cleared
        for cache in mock_caches:
            cache.clear.assert_called_once()


def test_clear_documents_cache(client):
    """Test clearing all documents caches."""
    with patch("routes.system.ALL_DOCUMENTS_CACHES", [Mock(), Mock()]) as mock_caches:
        response = client.post("/system/clear_documents_cache")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "All documents caches cleared" in data["message"]

        # Verify all document caches were cleared
        for cache in mock_caches:
            cache.clear.assert_called_once()
