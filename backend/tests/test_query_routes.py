"""Tests for query routes."""

from unittest.mock import patch
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
        patch("routes.query.generate_query_from_prompt") as mock_generate,
        patch("routes.query.exchange_token_obo") as mock_exchange,
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
        call_args = mock_generate.call_args
        assert call_args[0][0] == "Find all users"  # user_input
        assert call_args[0][1] == ["users"]  # collections
        assert call_args[0][2] == "test-db"  # db name


def test_execute_query_missing_authorization(client):
    """Test execute query without authorization header."""
    execute_input = ExecuteInput(
        account_id="test-account", database_name="test-db", query="db.users.find({})"
    )

    response = client.post("/query/execute", json=execute_input.model_dump())

    assert response.status_code == 422  # Unprocessable Entity (missing header)


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
    with patch("routes.query.generate_suggestion_from_query_error") as mock_debug:
        mock_debug.return_value = {"suggestion": "Check collection name"}

        debug_request = DebugQueryRequest(
            query="db.users.find({})", error_message="Collection not found"
        )

        response = client.post("/query/debug", json=debug_request.model_dump())

        assert response.status_code == 200
        data = response.json()
        assert data["suggestion"] == "Check collection name"

        mock_debug.assert_called_once_with("db.users.find({})", "Collection not found")


def test_analyze_query(client):
    """Test query result analysis."""
    with patch("routes.query.analyze_query_result") as mock_analyze:
        mock_analyze.return_value = {
            "insight": "Data analysis insight",
            "chartType": "bar",
            "chartData": {"labels": ["A", "B"], "data": [1, 2]},
            "chartOptions": {"title": "Test Chart"},
        }

        analyze_request = AnalyzeRequest(
            query_result=[{"name": "John", "age": 30}, {"name": "Jane", "age": 25}]
        )

        response = client.post("/query/analyze", json=analyze_request.model_dump())

        assert response.status_code == 200
        data = response.json()
        assert data["insight"] == "Data analysis insight"
        assert data["chartType"] == "bar"
        assert "chartData" in data
        assert "chartOptions" in data

        mock_analyze.assert_called_once()
