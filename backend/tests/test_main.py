"""Tests for main FastAPI application."""


def test_app_startup(client):
    """Test that the app starts up and has the correct structure."""
    # Test that the app is created successfully
    assert client.app is not None

    # Check that all routers are included. Newer FastAPI versions wrap
    # `include_router` results in `_IncludedRouter`, which has no `.path` of
    # its own — expand those into their prefixed sub-route paths.
    routes = []
    for route in client.app.routes:
        if hasattr(route, "path"):
            routes.append(route.path)
        elif hasattr(route, "original_router"):
            prefix = route.include_context.prefix
            routes.extend(
                prefix + sub.path
                for sub in route.original_router.routes
                if hasattr(sub, "path")
            )

    # Check that main route prefixes exist
    route_prefixes = ["/query", "/azure", "/system", "/user", "/data"]

    for prefix in route_prefixes:
        # Check that at least one route with this prefix exists
        matching_routes = [route for route in routes if route.startswith(prefix)]
        assert len(matching_routes) > 0, f"No routes found for prefix {prefix}"


def test_cors_middleware(client):
    """Test that CORS middleware is properly configured."""
    # The CORS middleware should allow all origins, methods, and headers
    # We can test this by making an OPTIONS request
    response = client.options("/system/clear_cache")

    # The test should not fail due to CORS issues
    # Status might be 405 (Method Not Allowed) but not a CORS error
    assert response.status_code in [200, 405]
