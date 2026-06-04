import base64
import json
from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient
from main import app


def make_jwt(claims: dict) -> str:
    payload = base64.urlsafe_b64encode(json.dumps(claims).encode()).rstrip(b"=").decode()
    return f"header.{payload}.sig"


@pytest.fixture
def admin_header():
    return {"authorization": f"Bearer {make_jwt({'preferred_username': 'admin@example.com', 'roles': ['Admin'], 'oid': 'admin-oid-1'})}"}


@pytest.fixture
def analyst_header():
    return {"authorization": f"Bearer {make_jwt({'preferred_username': 'analyst@example.com', 'roles': ['Analyst'], 'oid': 'analyst-oid-1'})}"}


@pytest.fixture
def client():
    return TestClient(app)


def _mock_db_users():
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.__enter__ = lambda s: mock_cursor
    mock_cursor.__exit__ = MagicMock(return_value=False)
    mock_conn.cursor.return_value = mock_cursor
    mock_cursor.fetchall.return_value = [
        ("user-oid-b", "b@example.com", "Bob", "2026-06-01T10:00:00+00:00", "2026-06-04T12:00:00+00:00"),
    ]
    mock_cursor.description = [("oid",), ("email",), ("display_name",), ("first_seen",), ("last_seen",)]
    return mock_conn


def test_list_users_returns_200_for_admin(client, admin_header):
    with patch("routes.admin.get_connection", return_value=_mock_db_users()), \
         patch("routes.admin.list_role_assignments", return_value={}), \
         patch("services.users_service.upsert_user"):
        resp = client.get("/admin/users", headers=admin_header)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["email"] == "b@example.com"
    assert data[0]["roles"] == []


def test_list_users_returns_403_for_analyst(client, analyst_header):
    with patch("services.users_service.upsert_user"):
        resp = client.get("/admin/users", headers=analyst_header)
    assert resp.status_code == 403


def test_assign_role_returns_201(client, admin_header):
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.__enter__ = lambda s: mock_cursor
    mock_cursor.__exit__ = MagicMock(return_value=False)
    mock_conn.cursor.return_value = mock_cursor
    mock_cursor.fetchone.return_value = ("user-oid-b",)

    with patch("routes.admin.get_connection", return_value=mock_conn), \
         patch("routes.admin.assign_role") as mock_assign, \
         patch("services.users_service.upsert_user"):
        resp = client.post(
            "/admin/users/user-oid-b/roles",
            json={"role": "Analyst"},
            headers=admin_header,
        )
    assert resp.status_code == 201
    mock_assign.assert_called_once_with(user_oid="user-oid-b", role_name="Analyst")


def test_assign_role_returns_404_for_unknown_user(client, admin_header):
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.__enter__ = lambda s: mock_cursor
    mock_cursor.__exit__ = MagicMock(return_value=False)
    mock_conn.cursor.return_value = mock_cursor
    mock_cursor.fetchone.return_value = None

    with patch("routes.admin.get_connection", return_value=mock_conn), \
         patch("services.users_service.upsert_user"):
        resp = client.post(
            "/admin/users/unknown-oid/roles",
            json={"role": "Analyst"},
            headers=admin_header,
        )
    assert resp.status_code == 404


def test_remove_role_returns_204(client, admin_header):
    with patch("routes.admin.remove_role") as mock_remove, \
         patch("services.users_service.upsert_user"):
        resp = client.delete("/admin/users/user-oid-b/roles/asgn-1", headers=admin_header)
    assert resp.status_code == 204
    mock_remove.assert_called_once_with(assignment_id="asgn-1")
