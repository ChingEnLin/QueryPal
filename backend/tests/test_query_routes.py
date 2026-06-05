"""Tests for query routes."""

from unittest.mock import patch
from services.azure_auth import TokenClaims
from models.schemas import (
    QueryPrompt,
    ExecuteInput,
    DebugQueryRequest,
    Collection,
    DBContext,
    CollectionContext,
)
from models.analyze import AnalyzeRequest


def test_nl2query(client):
    """Test natural language to query conversion."""
    # Mock dependencies
    with (
        patch("routes.query.run_query_generator") as mock_generate,
        patch("routes.query.exchange_token_obo") as mock_exchange,
        patch(
            "services.rbac.extract_claims_from_token",
            return_value=TokenClaims(email="user@test.com", roles=["Analyst"]),
        ),
    ):
        mock_generate.return_value = {"generated_code": "db.users.find({})"}

        # Create test data
        collections = [Collection(name="users", count=100)]
        db_context = DBContext(name="test-db", collections=collections)
        collection_context = CollectionContext(name="users")

        prompt = QueryPrompt(
            user_input="Find all users",
            account_id="test-account",
            db_context=db_context,
            collection_context=[collection_context],
        )

        headers = {"authorization": "Bearer valid-token"}
        response = client.post(
            "/query/nl2query", json=prompt.model_dump(), headers=headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["generated_code"] == "db.users.find({})"

        # Verify the mock was called with correct parameters
        mock_generate.assert_called_once()
        call_kwargs = mock_generate.call_args[1]
        assert call_kwargs["user_input"] == "Find all users"
        assert call_kwargs["collections"] == ["users"]
        assert call_kwargs["database"] == "test-db"


def test_execute_query_missing_authorization(client):
    """Test execute query without authorization header."""
    execute_input = ExecuteInput(
        account_id="test-account", database_name="test-db", query="db.users.find({})"
    )

    response = client.post("/query/execute", json=execute_input.model_dump())

    assert response.status_code == 401  # Missing authorization header


def test_execute_query_invalid_token_format(client):
    """Test execute query with invalid token format."""
    execute_input = ExecuteInput(
        account_id="test-account", database_name="test-db", query="db.users.find({})"
    )

    headers = {"authorization": "InvalidToken123"}  # Missing "Bearer " prefix
    response = client.post(
        "/query/execute", json=execute_input.model_dump(), headers=headers
    )

    assert response.status_code == 401
    data = response.json()
    assert data["detail"] == "Invalid token format"


def test_execute_query_success(client):
    """Test successful query execution."""
    with (
        patch("routes.query.exchange_token_obo") as mock_exchange,
        patch("routes.query.get_connection_string") as mock_get_conn,
        patch("routes.query.execute_mongo_query") as mock_execute,
        patch("routes.query.transform_mongo_result") as mock_transform,
        patch(
            "services.rbac.extract_claims_from_token",
            return_value=TokenClaims(email="user@test.com", roles=["Analyst"]),
        ),
    ):

        # Setup mocks
        mock_exchange.return_value = "access-token"
        mock_get_conn.return_value = "connection-string"
        mock_execute.return_value = [{"_id": "123", "name": "John"}]
        mock_transform.return_value = {"results": [{"_id": "123", "name": "John"}]}

        execute_input = ExecuteInput(
            account_id="test-account",
            database_name="test-db",
            query="db.users.find({})",
        )

        headers = {"authorization": "Bearer valid-token"}
        response = client.post(
            "/query/execute", json=execute_input.model_dump(), headers=headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "results" in data

        # Verify all mocks were called
        mock_exchange.assert_called_once_with("valid-token")
        mock_get_conn.assert_called_once_with("test-account", "access-token")
        mock_execute.assert_called_once_with(
            "connection-string", "test-db", "db.users.find({})"
        )
        mock_transform.assert_called_once()


def test_execute_query_mongo_error(client):
    """Test query execution with MongoDB error."""
    with (
        patch("routes.query.exchange_token_obo") as mock_exchange,
        patch("routes.query.get_connection_string") as mock_get_conn,
        patch("routes.query.execute_mongo_query") as mock_execute,
        patch(
            "services.rbac.extract_claims_from_token",
            return_value=TokenClaims(email="user@test.com", roles=["Analyst"]),
        ),
    ):

        # Setup mocks
        mock_exchange.return_value = "access-token"
        mock_get_conn.return_value = "connection-string"
        mock_execute.return_value = {
            "error": "Collection not found",
            "exception_type": "CollectionNotFound",
        }

        execute_input = ExecuteInput(
            account_id="test-account",
            database_name="test-db",
            query="db.nonexistent.find({})",
        )

        headers = {"authorization": "Bearer valid-token"}
        response = client.post(
            "/query/execute", json=execute_input.model_dump(), headers=headers
        )

        assert response.status_code == 500
        data = response.json()
        assert "Collection not found" in data["detail"]


def test_debug_query(client):
    """Test debug query functionality."""
    with (
        patch("routes.query.generate_suggestion_from_query_error") as mock_debug,
        patch(
            "services.rbac.extract_claims_from_token",
            return_value=TokenClaims(email="user@test.com", roles=["Analyst"]),
        ),
    ):
        mock_debug.return_value = {"suggestion": "Check collection name"}

        debug_request = DebugQueryRequest(
            query="db.users.find({})", error_message="Collection not found"
        )

        headers = {"authorization": "Bearer valid-token"}
        response = client.post(
            "/query/debug", json=debug_request.model_dump(), headers=headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["suggestion"] == "Check collection name"

        mock_debug.assert_called_once_with(
            "db.users.find({})", "Collection not found", model="gemini-2.5-flash"
        )


def test_analyze_query(client):
    """Test query result analysis."""
    with (
        patch("routes.query.analyze_query_result") as mock_analyze,
        patch(
            "services.rbac.extract_claims_from_token",
            return_value=TokenClaims(email="user@test.com", roles=["Analyst"]),
        ),
    ):
        mock_analyze.return_value = {
            "insight": "Data analysis insight",
            "chartType": "bar",
            "chartData": {"labels": ["A", "B"], "data": [1, 2]},
            "chartOptions": {"title": "Test Chart"},
        }

        analyze_request = AnalyzeRequest(
            query_result=[{"name": "John", "age": 30}, {"name": "Jane", "age": 25}]
        )

        headers = {"authorization": "Bearer valid-token"}
        response = client.post(
            "/query/analyze", json=analyze_request.model_dump(), headers=headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["insight"] == "Data analysis insight"
        assert data["chartType"] == "bar"
        assert "chartData" in data
        assert "chartOptions" in data

        mock_analyze.assert_called_once_with(
            [{"name": "John", "age": 30}, {"name": "Jane", "age": 25}],
            model="gemini-2.5-flash",
        )


from models.schemas import EvaluateWriteRequest
from unittest.mock import patch, MagicMock


def test_evaluate_write(client):
    """Test evaluating write query results."""
    with (
        patch("routes.query.exchange_token_obo") as mock_exchange,
        patch("routes.query.evaluate_write_result") as mock_evaluate,
        patch("routes.query.get_connection_string") as mock_conn,
        patch(
            "services.rbac.extract_claims_from_token",
            return_value=TokenClaims(email="user@test.com", roles=["Analyst"]),
        ),
    ):
        mock_exchange.return_value = "access-token"
        mock_conn.return_value = "conn-string"
        mock_evaluate.return_value = {
            "evaluation": "Looks good",
        }

        req = EvaluateWriteRequest(
            account_id="test-account",
            database_name="test-db",
            user_intent="Update user age to 30",
            query_code="db.users.update_one({'_id': '123'}, {'$set': {'age': 30}})",
            write_result={"matched_count": 1, "modified_count": 1},
        )

        headers = {"authorization": "Bearer valid-token"}
        response = client.post(
            "/query/evaluate-write", json=req.model_dump(), headers=headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["evaluation"] == "Looks good"

        mock_exchange.assert_called_once_with("valid-token")
        mock_conn.assert_called_once_with("test-account", "access-token")
        mock_evaluate.assert_called_once()


def test_execute_query_write_logging(client):
    """Test successful query execution and write operation logging."""
    from pymongo.results import UpdateResult

    with (
        patch("routes.query.exchange_token_obo") as mock_exchange,
        patch("routes.query.get_connection_string") as mock_get_conn,
        patch("routes.query.execute_mongo_query") as mock_execute,
        patch("routes.query.log_write_operation") as mock_log,
        patch("routes.query.transform_mongo_result") as mock_transform,
        patch(
            "services.rbac.extract_claims_from_token",
            return_value=TokenClaims(email="test@example.com", roles=["Analyst"]),
        ),
    ):
        # Setup mocks
        mock_exchange.return_value = "access-token"
        mock_get_conn.return_value = "mongodb://mock-account:pass@host/db"

        # Mock UpdateResult
        update_result = UpdateResult(
            {"n": 1, "nModified": 1, "ok": 1.0, "updatedExisting": True}, True
        )
        mock_execute.return_value = update_result
        mock_transform.return_value = {"matched_count": 1, "modified_count": 1}

        execute_input = ExecuteInput(
            account_id="test-account",
            database_name="test-db",
            query="db.users.update_one({'_id': '123'}, {'$set': {'age': 30}})",
        )

        headers = {"authorization": "Bearer valid-token"}
        response = client.post(
            "/query/execute", json=execute_input.model_dump(), headers=headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "matched_count" in data

        # Verify all mocks were called
        mock_exchange.assert_called_once_with("valid-token")
        mock_get_conn.assert_called_once_with("test-account", "access-token")
        mock_execute.assert_called_once_with(
            "mongodb://mock-account:pass@host/db",
            "test-db",
            "db.users.update_one({'_id': '123'}, {'$set': {'age': 30}})",
        )
        mock_log.assert_called_once()
        call_kwargs = mock_log.call_args[1]
        assert call_kwargs["user_email"] == "test@example.com"
        assert call_kwargs["operation"] == "update"
        assert call_kwargs["database_name"] == "mock-account.test-db"
        assert call_kwargs["collection_name"] == "users"
        assert call_kwargs["document_id"] == "query_generator"
        assert (
            call_kwargs["after_data"]["query"]
            == "db.users.update_one({'_id': '123'}, {'$set': {'age': 30}})"
        )


def test_list_models_intersects_allowlist(client):
    """Test /models returns only allowlisted models the API actually exposes."""

    class MockModel:
        def __init__(self, name):
            self.name = name

    mock_models = [
        MockModel("models/gemini-2.5-flash"),
        MockModel("models/gemini-2.5-pro"),
        MockModel("models/gemini-1.0-pro"),  # not in allowlist
        MockModel("models/text-embedding-004"),  # not in allowlist
        MockModel(None),
    ]

    with (
        patch("routes.query.genai") as mock_genai,
        patch(
            "services.rbac.extract_claims_from_token",
            return_value=TokenClaims(email="user@test.com", roles=["Analyst"]),
        ),
    ):
        mock_genai.Client.return_value.models.list.return_value = mock_models
        response = client.get(
            "/query/models", headers={"authorization": "Bearer valid-token"}
        )

    assert response.status_code == 200
    data = response.json()
    assert "gemini-2.5-flash" in data
    assert "gemini-2.5-pro" in data
    assert "gemini-1.0-pro" not in data
    assert "text-embedding-004" not in data


def test_list_models_falls_back_when_api_errors(client):
    """Test /models returns the allowlist when the API listing fails."""
    from routes.query import SUPPORTED_MODELS

    with (
        patch("routes.query.genai") as mock_genai,
        patch(
            "services.rbac.extract_claims_from_token",
            return_value=TokenClaims(email="user@test.com", roles=["Analyst"]),
        ),
    ):
        mock_genai.Client.side_effect = RuntimeError("API down")
        response = client.get(
            "/query/models", headers={"authorization": "Bearer valid-token"}
        )

    assert response.status_code == 200
    assert response.json() == SUPPORTED_MODELS
