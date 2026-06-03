"""Tests for system routes."""

from unittest.mock import Mock, patch

from services.azure_auth import TokenClaims

ADMIN_HEADERS = {"authorization": "Bearer valid-token"}


def _patch_claims(roles):
    return patch(
        "services.rbac.extract_claims_from_token",
        return_value=TokenClaims(email="admin@test.com", roles=roles),
    )


def test_clear_cache(client):
    """Test clearing all caches as an admin."""
    with (
        patch("routes.system.ALL_CACHES", [Mock(), Mock()]) as mock_caches,
        _patch_claims(["Admin"]),
    ):
        response = client.post("/system/clear_cache", headers=ADMIN_HEADERS)

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "All caches cleared" in data["message"]

        # Verify all caches were cleared
        for cache in mock_caches:
            cache.clear.assert_called_once()


def test_clear_documents_cache(client):
    """Test clearing all documents caches as an admin."""
    with (
        patch("routes.system.ALL_DOCUMENTS_CACHES", [Mock(), Mock()]) as mock_caches,
        _patch_claims(["Admin"]),
    ):
        response = client.post(
            "/system/clear_documents_cache", headers=ADMIN_HEADERS
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "All documents caches cleared" in data["message"]

        # Verify all document caches were cleared
        for cache in mock_caches:
            cache.clear.assert_called_once()


def test_clear_cache_requires_authorization(client):
    """System endpoints reject callers with no identity."""
    response = client.post("/system/clear_cache")
    assert response.status_code == 401


def test_clear_cache_forbidden_for_non_admin(client):
    """Non-admins lack system:admin and are forbidden."""
    with _patch_claims(["Analyst"]):
        response = client.post("/system/clear_cache", headers=ADMIN_HEADERS)
    assert response.status_code == 403
    assert response.json()["detail"] == "Requires permission: system:admin"
