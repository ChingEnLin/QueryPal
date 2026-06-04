from unittest.mock import patch, MagicMock


def _mock_sp_response():
    return {
        "value": [{
            "id": "sp-oid-999",
            "appRoles": [
                {"id": "role-admin-id", "displayName": "Admin", "value": "Admin"},
                {"id": "role-analyst-id", "displayName": "Analyst", "value": "Analyst"},
                {"id": "role-viewer-id", "displayName": "Viewer", "value": "Viewer"},
            ]
        }]
    }


def _mock_assignments_response():
    return {
        "value": [
            {"id": "asgn-1", "principalId": "user-oid-a", "appRoleId": "role-analyst-id"},
        ]
    }


@patch("services.graph_service._get_graph_token", return_value="fake-token")
@patch("services.graph_service.requests.get")
def test_get_sp_info_returns_oid_and_roles(mock_get, mock_token):
    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_resp.json.return_value = _mock_sp_response()
    mock_get.return_value = mock_resp

    import importlib
    import services.graph_service as gs
    importlib.reload(gs)  # clear module-level cache

    info = gs.get_sp_info()
    assert info["sp_oid"] == "sp-oid-999"
    assert info["role_name_to_id"]["Admin"] == "role-admin-id"
    assert info["role_id_to_name"]["role-analyst-id"] == "Analyst"


@patch("services.graph_service._get_graph_token", return_value="fake-token")
@patch("services.graph_service.requests.get")
def test_list_role_assignments_returns_map(mock_get, mock_token):
    # First call: SP info, second call: assignments
    mock_sp = MagicMock()
    mock_sp.ok = True
    mock_sp.json.return_value = _mock_sp_response()

    mock_asgn = MagicMock()
    mock_asgn.ok = True
    mock_asgn.json.return_value = _mock_assignments_response()

    mock_get.side_effect = [mock_sp, mock_asgn]

    import importlib
    import services.graph_service as gs
    importlib.reload(gs)

    result = gs.list_role_assignments()
    assert "user-oid-a" in result
    assert result["user-oid-a"][0]["role_name"] == "Analyst"
    assert result["user-oid-a"][0]["assignment_id"] == "asgn-1"


@patch("services.graph_service._get_graph_token", return_value="fake-token")
@patch("services.graph_service.requests.post")
@patch("services.graph_service.requests.get")
def test_assign_role_posts_to_graph(mock_get, mock_post, mock_token):
    mock_sp = MagicMock()
    mock_sp.ok = True
    mock_sp.json.return_value = _mock_sp_response()
    mock_get.return_value = mock_sp

    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_post.return_value = mock_resp

    import importlib
    import services.graph_service as gs
    importlib.reload(gs)

    gs.assign_role(user_oid="user-oid-b", role_name="Admin")

    mock_post.assert_called_once()
    call_url = mock_post.call_args[0][0]
    assert "sp-oid-999" in call_url
    assert "appRoleAssignedTo" in call_url
    body = mock_post.call_args[1]["json"]
    assert body["principalId"] == "user-oid-b"
    assert body["appRoleId"] == "role-admin-id"


@patch("services.graph_service._get_graph_token", return_value="fake-token")
@patch("services.graph_service.requests.delete")
@patch("services.graph_service.requests.get")
def test_remove_role_deletes_from_graph(mock_get, mock_delete, mock_token):
    mock_sp = MagicMock()
    mock_sp.ok = True
    mock_sp.json.return_value = _mock_sp_response()
    mock_get.return_value = mock_sp

    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_delete.return_value = mock_resp

    import importlib
    import services.graph_service as gs
    importlib.reload(gs)

    gs.remove_role(assignment_id="asgn-1")

    mock_delete.assert_called_once()
    call_url = mock_delete.call_args[0][0]
    assert "sp-oid-999" in call_url
    assert "asgn-1" in call_url
