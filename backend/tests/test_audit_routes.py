def test_recent_allows_null_document_id(client, mock_auth_header, monkeypatch):
    """Inserts log a null document_id — /recent must still validate (not 500)."""
    import routes.audit as r

    monkeypatch.setattr(
        r,
        "get_recent_activity",
        lambda **k: [
            {
                "database_name": "srv",
                "collection_name": "public.orders",
                "operation": "insert",
                "document_id": None,
                "user_email": "u@x.io",
                "timestamp_utc": "2026-07-12T00:00:00Z",
            }
        ],
    )
    resp = client.get("/audit/recent?limit=8", headers=mock_auth_header)
    assert resp.status_code == 200
    assert resp.json()[0]["document_id"] is None
