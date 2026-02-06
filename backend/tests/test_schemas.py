"""Tests for Pydantic models and schemas."""

import pytest
from pydantic import ValidationError
from models.schemas import (
    AccountDetailsRequest,
    CollectionInfoRequest,
    Collection,
    DBContext,
    CollectionContext,
    QueryPrompt,
    GeneratedCode,
    ExecuteInput,
    DebugQueryRequest,
    DebugSuggestionResponse,
)


def test_account_details_request():
    """Test AccountDetailsRequest model."""
    # Valid data
    request = AccountDetailsRequest(account_id="test-account-123")
    assert request.account_id == "test-account-123"

    # Invalid data - missing required field
    with pytest.raises(ValidationError):
        AccountDetailsRequest()


def test_collection_info_request():
    """Test CollectionInfoRequest model."""
    # Valid data
    request = CollectionInfoRequest(
        account_id="test-account",
        database_name="test-db",
        collection_name="test-collection",
    )
    assert request.account_id == "test-account"
    assert request.database_name == "test-db"
    assert request.collection_name == "test-collection"

    # Invalid data - missing required fields
    with pytest.raises(ValidationError):
        CollectionInfoRequest(account_id="test")


def test_collection_model():
    """Test Collection model."""
    collection = Collection(name="users", count=100)
    assert collection.name == "users"
    assert collection.count == 100

    # Test with invalid count type
    with pytest.raises(ValidationError):
        Collection(name="users", count="invalid")


def test_db_context():
    """Test DBContext model."""
    collections = [
        Collection(name="users", count=50),
        Collection(name="orders", count=200),
    ]
    db_context = DBContext(name="ecommerce", collections=collections)

    assert db_context.name == "ecommerce"
    assert len(db_context.collections) == 2
    assert db_context.collections[0].name == "users"


def test_collection_context():
    """Test CollectionContext model."""
    # With sample document
    context = CollectionContext(
        name="users", sampleDocument={"_id": "123", "name": "John", "age": 30}
    )
    assert context.name == "users"
    assert context.sampleDocument["name"] == "John"

    # Without sample document (optional)
    context_no_sample = CollectionContext(name="orders")
    assert context_no_sample.name == "orders"
    assert context_no_sample.sampleDocument is None


def test_query_prompt():
    """Test QueryPrompt model."""
    collections = [Collection(name="users", count=50)]
    db_context = DBContext(name="test-db", collections=collections)
    collection_context = CollectionContext(name="users")

    prompt = QueryPrompt(
        user_input="Find all users",
        account_id="test-account",
        db_context=db_context,
        collection_context=[collection_context],
        intermediate_context={"key": "value"},
    )

    assert prompt.user_input == "Find all users"
    assert prompt.db_context.name == "test-db"
    assert prompt.collection_context[0].name == "users"
    assert prompt.intermediate_context == {"key": "value"}

    # Test with minimal required fields
    minimal_prompt = QueryPrompt(
        user_input="Find all users", account_id="test-account", db_context=db_context
    )
    assert minimal_prompt.collection_context == []
    assert minimal_prompt.intermediate_context is None


def test_generated_code():
    """Test GeneratedCode model."""
    code = GeneratedCode(generated_code="db.users.find({})")
    assert code.generated_code == "db.users.find({})"


def test_execute_input():
    """Test ExecuteInput model."""
    execute_input = ExecuteInput(
        account_id="account-123", database_name="test-db", query="db.users.find({})"
    )
    assert execute_input.account_id == "account-123"
    assert execute_input.database_name == "test-db"
    assert execute_input.query == "db.users.find({})"


def test_debug_query_request():
    """Test DebugQueryRequest model."""
    debug_request = DebugQueryRequest(
        query="db.users.find({})", error_message="Collection not found"
    )
    assert debug_request.query == "db.users.find({})"
    assert debug_request.error_message == "Collection not found"


def test_debug_suggestion_response():
    """Test DebugSuggestionResponse model."""
    response = DebugSuggestionResponse(
        suggestion="Check if the collection name is correct"
    )
    assert response.suggestion == "Check if the collection name is correct"
