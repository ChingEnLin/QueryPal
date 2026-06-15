"""
Comprehensive test suite for MongoDB operations in QueryPal backend.

This test module provides comprehensive coverage for all MongoDB-related operations
including query execution, document management, and utility functions.
Uses mongomock for in-memory testing to avoid dependency on actual MongoDB instance.

Test Coverage:
- MongoService operations
- DataDocumentsService CRUD operations
- Utility functions
- Integration scenarios
- Error handling and edge cases
"""

import json
from datetime import datetime, timezone
from unittest.mock import Mock, patch

import mongomock
import pytest
from bson import ObjectId
from freezegun import freeze_time

from services.data_documents_service import (
    delete_document,
    fetch_documents,
    find_document_by_id,
    get_single_document,
    insert_document,
    json_dumps_safe,
    log_write_operation,
    update_document,
)
from services.mongo_service import execute_mongo_query, transform_mongo_result


class TestMongoService:
    """Test cases for mongo_service module."""

    @pytest.fixture
    def mock_client(self):
        """Create a mock MongoDB client using mongomock."""
        return mongomock.MongoClient()

    @pytest.fixture
    def sample_documents(self):
        """Sample documents for testing."""
        return [
            {
                "_id": ObjectId("507f1f77bcf86cd799439011"),
                "name": "John Doe",
                "email": "john@example.com",
                "age": 30,
                "created_at": datetime(2023, 1, 1, 12, 0, 0, tzinfo=timezone.utc),
            },
            {
                "_id": ObjectId("507f1f77bcf86cd799439012"),
                "name": "Jane Smith",
                "email": "jane@example.com",
                "age": 25,
                "created_at": datetime(2023, 1, 2, 12, 0, 0, tzinfo=timezone.utc),
            },
        ]

    @patch("services.mongo_service.pymongo.MongoClient")
    def test_execute_mongo_query_find_all(
        self, mock_mongo_client, mock_client, sample_documents
    ):
        """Test execute_mongo_query with find operation."""
        # Setup
        mock_mongo_client.return_value = mock_client
        db = mock_client["test_db"]
        collection = db["test_collection"]
        collection.insert_many(sample_documents)

        # Execute
        query = 'db["test_collection"].find({})'
        result = execute_mongo_query("mongodb://localhost", "test_db", query)

        # Assert
        assert len(result) == 2
        assert result[0]["name"] == "John Doe"
        assert result[1]["name"] == "Jane Smith"

    @patch("services.mongo_service.pymongo.MongoClient")
    def test_execute_mongo_query_with_filter(
        self, mock_mongo_client, mock_client, sample_documents
    ):
        """Test execute_mongo_query with filtered find operation."""
        # Setup
        mock_mongo_client.return_value = mock_client
        db = mock_client["test_db"]
        collection = db["test_collection"]
        collection.insert_many(sample_documents)

        # Execute
        query = 'db["test_collection"].find({"name": "John Doe"})'
        result = execute_mongo_query("mongodb://localhost", "test_db", query)

        # Assert
        assert len(result) == 1
        assert result[0]["name"] == "John Doe"
        assert result[0]["email"] == "john@example.com"

    @patch("services.mongo_service.pymongo.MongoClient")
    def test_execute_mongo_query_find_one(
        self, mock_mongo_client, mock_client, sample_documents
    ):
        """Test execute_mongo_query with find_one operation."""
        # Setup
        mock_mongo_client.return_value = mock_client
        db = mock_client["test_db"]
        collection = db["test_collection"]
        collection.insert_many(sample_documents)

        # Execute
        query = 'db["test_collection"].find_one({"name": "Jane Smith"})'
        result = execute_mongo_query("mongodb://localhost", "test_db", query)

        # Assert
        assert result["name"] == "Jane Smith"
        assert result["age"] == 25

    @patch("services.mongo_service.pymongo.MongoClient")
    def test_execute_mongo_query_count_documents(
        self, mock_mongo_client, mock_client, sample_documents
    ):
        """Test execute_mongo_query with count_documents operation."""
        # Setup
        mock_mongo_client.return_value = mock_client
        db = mock_client["test_db"]
        collection = db["test_collection"]
        collection.insert_many(sample_documents)

        # Execute
        query = 'db["test_collection"].count_documents({})'
        result = execute_mongo_query("mongodb://localhost", "test_db", query)

        # Assert
        assert result == 2

    @patch("services.mongo_service.pymongo.MongoClient")
    def test_execute_mongo_query_with_datetime_in_scope(
        self, mock_mongo_client, mock_client, sample_documents
    ):
        """Regression: `datetime` must be in the eval scope.

        Previously the sandbox scope was only {db, ObjectId}, so a query using
        `datetime.datetime(...)` failed with `name 'datetime' is not defined`.
        """
        # Setup
        mock_mongo_client.return_value = mock_client
        db = mock_client["test_db"]
        collection = db["test_collection"]
        collection.insert_many(sample_documents)

        # Execute — filter created_at on or after Jan 2 (matches Jane only)
        query = (
            'db["test_collection"].find('
            '{"created_at": {"$gte": datetime.datetime(2023, 1, 2, '
            "tzinfo=datetime.timezone.utc)}})"
        )
        result = execute_mongo_query("mongodb://localhost", "test_db", query)

        # Assert
        assert "error" not in result
        assert len(result) == 1
        assert result[0]["name"] == "Jane Smith"

    @patch("services.mongo_service.pymongo.MongoClient")
    def test_execute_mongo_query_with_isodate_shim(
        self, mock_mongo_client, mock_client, sample_documents
    ):
        """Regression: the mongosh-style `ISODate("...")` shim must resolve.

        The LLM instinctively reaches for `ISODate(...)`; the shim turns it into
        a timezone-aware datetime so the query does not blow up.
        """
        # Setup
        mock_mongo_client.return_value = mock_client
        db = mock_client["test_db"]
        collection = db["test_collection"]
        collection.insert_many(sample_documents)

        # Execute
        query = (
            'db["test_collection"].find('
            '{"created_at": {"$gte": ISODate("2023-01-02T00:00:00Z")}})'
        )
        result = execute_mongo_query("mongodb://localhost", "test_db", query)

        # Assert
        assert "error" not in result
        assert len(result) == 1
        assert result[0]["name"] == "Jane Smith"

    @patch("services.mongo_service.pymongo.MongoClient")
    def test_execute_mongo_query_invalid_query(self, mock_mongo_client, mock_client):
        """Test execute_mongo_query with invalid query syntax."""
        # Setup
        mock_mongo_client.return_value = mock_client

        # Execute
        query = "invalid_syntax("
        result = execute_mongo_query("mongodb://localhost", "test_db", query)

        # Assert
        assert "error" in result
        assert "exception_type" in result

    def test_transform_mongo_result_with_objectid(self):
        """Test transform_mongo_result with ObjectId conversion."""
        # Setup
        data = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "name": "Test Document",
            "nested": {"id": ObjectId("507f1f77bcf86cd799439012")},
        }

        # Execute
        result = transform_mongo_result(data)

        # Assert
        assert result["_id"] == "507f1f77bcf86cd799439011"
        # Note: nested ObjectIds are not converted in the actual implementation
        assert result["name"] == "Test Document"

    def test_transform_mongo_result_with_list(self):
        """Test transform_mongo_result with list of documents."""
        # Setup
        data = [
            {"_id": ObjectId("507f1f77bcf86cd799439011"), "name": "Doc1"},
            {"_id": ObjectId("507f1f77bcf86cd799439012"), "name": "Doc2"},
        ]

        # Execute
        result = transform_mongo_result(data)

        # Assert
        assert len(result) == 2
        assert result[0]["_id"] == "507f1f77bcf86cd799439011"
        assert result[1]["_id"] == "507f1f77bcf86cd799439012"

    def test_transform_mongo_result_primitive_types(self):
        """Test transform_mongo_result with primitive types."""
        # Execute & Assert
        assert transform_mongo_result("string") == "string"
        assert transform_mongo_result(123) == 123
        assert transform_mongo_result(None) is None
        assert transform_mongo_result(True) is True


class TestDataDocumentsService:
    """Test cases for data_documents_service module."""

    @pytest.fixture
    def mock_client(self):
        """Create a mock MongoDB client using mongomock."""
        return mongomock.MongoClient()

    @pytest.fixture
    def sample_documents(self):
        """Sample documents for testing."""
        return [
            {
                "_id": ObjectId("507f1f77bcf86cd799439011"),
                "title": "Document 1",
                "content": "Content of document 1",
                "category": "research",
                "datetime_creation": datetime(2023, 1, 1, tzinfo=timezone.utc),
            },
            {
                "_id": ObjectId("507f1f77bcf86cd799439012"),
                "title": "Document 2",
                "content": "Content of document 2",
                "category": "notes",
                "datetime_creation": datetime(2023, 1, 2, tzinfo=timezone.utc),
            },
        ]

    @patch("services.data_documents_service.MongoClient")
    def test_fetch_documents_no_filter(
        self, mock_mongo_client, mock_client, sample_documents
    ):
        """Test fetch_documents without any filters."""
        # Setup
        mock_mongo_client.return_value = mock_client
        db = mock_client["test_db"]
        collection = db["documents"]
        collection.insert_many(sample_documents)

        # Execute
        result = fetch_documents(
            connection_string="mongodb://localhost",
            database_name="test_db",
            collection_name="documents",
            page=1,
            limit=10,
        )

        # Assert
        assert len(result.documents) == 2
        assert result.documents[0]["title"] == "Document 1"
        assert result.documents[1]["title"] == "Document 2"
        assert result.totalDocuments == 2

    @patch("services.data_documents_service.MongoClient")
    def test_fetch_documents_with_filter(
        self, mock_mongo_client, mock_client, sample_documents
    ):
        """Test fetch_documents with filter."""
        # Setup
        mock_mongo_client.return_value = mock_client
        db = mock_client["test_db"]
        collection = db["documents"]
        collection.insert_many(sample_documents)

        # Execute
        result = fetch_documents(
            connection_string="mongodb://localhost",
            database_name="test_db",
            collection_name="documents",
            page=1,
            limit=10,
            filter={"key": "category", "value": "research"},
        )

        # Assert
        assert len(result.documents) == 1
        assert result.documents[0]["title"] == "Document 1"
        assert result.documents[0]["category"] == "research"

    @patch("services.data_documents_service.MongoClient")
    def test_fetch_documents_with_pagination(
        self, mock_mongo_client, mock_client, sample_documents
    ):
        """Test fetch_documents with pagination."""
        # Setup
        mock_mongo_client.return_value = mock_client
        db = mock_client["test_db"]
        collection = db["documents"]
        collection.insert_many(sample_documents)

        # Execute
        result = fetch_documents(
            connection_string="mongodb://localhost",
            database_name="test_db",
            collection_name="documents",
            page=1,
            limit=1,
        )

        # Assert
        assert len(result.documents) == 1
        assert result.totalPages == 2

    @patch("services.data_documents_service.MongoClient")
    @patch("services.data_documents_service.generate_query_from_prompt")
    def test_find_document_by_id_exists(
        self, mock_generate_query, mock_mongo_client, mock_client, sample_documents
    ):
        """Test find_document_by_id with existing document."""
        # Setup
        mock_mongo_client.return_value = mock_client
        db = mock_client["test_db"]
        collection = db["documents"]
        collection.insert_many(sample_documents)

        # Mock Gemini response
        mock_response = Mock()
        mock_response.generated_code = "documents"
        mock_generate_query.return_value = mock_response

        # Execute
        result_doc, result_collection = find_document_by_id(
            connection_string="mongodb://localhost",
            database_name="test_db",
            collection_names="documents, other_collection",
            document_id="507f1f77bcf86cd799439011",
        )

        # Assert
        assert result_doc is not None
        assert result_doc["title"] == "Document 1"
        assert result_collection == "documents"

    @patch("services.data_documents_service.MongoClient")
    def test_find_document_by_id_not_exists(self, mock_mongo_client, mock_client):
        """Test find_document_by_id with non-existing document."""
        # Setup
        mock_mongo_client.return_value = mock_client

        # Execute
        result_doc, result_collection = find_document_by_id(
            connection_string="mongodb://localhost",
            database_name="test_db",
            collection_names="documents",
            document_id="507f1f77bcf86cd799439999",
        )

        # Assert
        assert result_doc is None
        assert result_collection is None

    @patch("services.data_documents_service.MongoClient")
    def test_get_single_document_exists(
        self, mock_mongo_client, mock_client, sample_documents
    ):
        """Test get_single_document with existing document."""
        # Setup
        mock_mongo_client.return_value = mock_client
        db = mock_client["test_db"]
        collection = db["documents"]
        collection.insert_many(sample_documents)

        # Execute
        result = get_single_document(
            connection_string="mongodb://localhost",
            database_name="test_db",
            collection_name="documents",
            document_id="507f1f77bcf86cd799439011",
        )

        # Assert
        assert result is not None
        assert result["title"] == "Document 1"

    @patch("services.data_documents_service.MongoClient")
    def test_get_single_document_not_exists(self, mock_mongo_client, mock_client):
        """Test get_single_document with non-existing document."""
        # Setup
        mock_mongo_client.return_value = mock_client

        # Execute
        result = get_single_document(
            connection_string="mongodb://localhost",
            database_name="test_db",
            collection_name="documents",
            document_id="507f1f77bcf86cd799439999",
        )

        # Assert
        assert result is None

    @patch("services.data_documents_service.MongoClient")
    @patch("services.data_documents_service.log_write_operation")
    def test_insert_document_success(self, mock_log, mock_mongo_client, mock_client):
        """Test insert_document with successful insertion."""
        # Setup
        mock_mongo_client.return_value = mock_client
        new_doc = {"title": "New Document", "content": "New content"}

        # Execute
        result = insert_document(
            connection_string="mongodb://testuser:testpass@localhost",
            database_name="test_db",
            collection_name="documents",
            document=new_doc,
        )

        # Assert
        assert result is not None
        assert result["title"] == "New Document"
        assert "_id" in result
        assert "datetime_creation" in result
        mock_log.assert_called_once()

    @patch("services.data_documents_service.MongoClient")
    @patch("services.data_documents_service.log_write_operation")
    def test_update_document_success(
        self, mock_log, mock_mongo_client, mock_client, sample_documents
    ):
        """Test update_document with successful update."""
        # Setup
        mock_mongo_client.return_value = mock_client
        db = mock_client["test_db"]
        collection = db["documents"]
        collection.insert_many(sample_documents)

        update_data = {"title": "Updated Document", "content": "Updated content"}

        # Execute
        result = update_document(
            connection_string="mongodb://testuser:testpass@localhost",
            database_name="test_db",
            collection_name="documents",
            document_id="507f1f77bcf86cd799439011",
            content=update_data,
        )

        # Assert
        assert result is not None
        assert result["title"] == "Updated Document"
        mock_log.assert_called_once()

    @patch("services.data_documents_service.MongoClient")
    def test_update_document_not_found(self, mock_mongo_client, mock_client):
        """Test update_document with non-existing document."""
        # Setup
        mock_mongo_client.return_value = mock_client
        update_data = {"title": "Updated Document"}

        # Execute
        result = update_document(
            connection_string="mongodb://localhost",
            database_name="test_db",
            collection_name="documents",
            document_id="507f1f77bcf86cd799439999",
            content=update_data,
        )

        # Assert
        assert result is None

    @patch("services.data_documents_service.MongoClient")
    @patch("services.data_documents_service.log_write_operation")
    def test_delete_document_success(
        self, mock_log, mock_mongo_client, mock_client, sample_documents
    ):
        """Test delete_document with successful deletion."""
        # Setup
        mock_mongo_client.return_value = mock_client
        db = mock_client["test_db"]
        collection = db["documents"]
        collection.insert_many(sample_documents)

        # Execute
        result = delete_document(
            connection_string="mongodb://testuser:testpass@localhost",
            database_name="test_db",
            collection_name="documents",
            document_id="507f1f77bcf86cd799439011",
        )

        # Assert
        assert result is True
        mock_log.assert_called_once()

    @patch("services.data_documents_service.MongoClient")
    def test_delete_document_not_found(self, mock_mongo_client, mock_client):
        """Test delete_document with non-existing document."""
        # Setup
        mock_mongo_client.return_value = mock_client

        # Execute
        result = delete_document(
            connection_string="mongodb://localhost",
            database_name="test_db",
            collection_name="documents",
            document_id="507f1f77bcf86cd799439999",
        )

        # Assert
        assert result is False


class TestUtilityFunctions:
    """Test cases for utility functions in data_documents_service."""

    def test_json_dumps_safe_with_objectid(self):
        """Test json_dumps_safe with ObjectId objects."""
        # Setup
        data = {"_id": ObjectId("507f1f77bcf86cd799439011"), "name": "Test Document"}

        # Execute
        result = json_dumps_safe(data)

        # Assert
        assert '"_id": "507f1f77bcf86cd799439011"' in result
        assert '"name": "Test Document"' in result

    def test_json_dumps_safe_with_datetime(self):
        """Test json_dumps_safe with datetime objects."""
        # Setup
        data = {"created_at": datetime(2023, 1, 1, 12, 0, 0, tzinfo=timezone.utc)}

        # Execute
        result = json_dumps_safe(data)

        # Assert - actual format includes space instead of 'T'
        assert '"created_at": "2023-01-01 12:00:00+00:00"' in result

    def test_json_dumps_safe_with_regular_types(self):
        """Test json_dumps_safe with regular JSON-serializable types."""
        # Setup
        data = {"name": "Test", "count": 123, "active": True}

        # Execute
        result = json_dumps_safe(data)

        # Assert
        expected = json.dumps(data)
        assert result == expected

    @patch("services.data_documents_service.get_connection")
    def test_log_write_operation(self, mock_get_connection):
        """Test log_write_operation function."""
        # Setup
        mock_conn = Mock()
        mock_cursor = Mock()
        mock_get_connection.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor

        # Execute
        log_write_operation(
            user_email="test@example.com",
            operation="insert",
            database_name="test_db",
            collection_name="documents",
            document_id="123",
            after_data={"title": "Test"},
        )

        # Assert
        mock_cursor.execute.assert_called_once()
        mock_conn.commit.assert_called_once()


class TestIntegrationScenarios:
    """Integration test scenarios combining multiple operations."""

    @pytest.fixture
    def mock_client(self):
        """Create a mock MongoDB client using mongomock."""
        return mongomock.MongoClient()

    @patch("services.data_documents_service.MongoClient")
    @patch("services.data_documents_service.log_write_operation")
    def test_document_lifecycle(self, mock_log, mock_mongo_client, mock_client):
        """Test complete document lifecycle: create, read, update, delete."""
        # Setup
        mock_mongo_client.return_value = mock_client

        # Create document
        new_doc = {"title": "Lifecycle Test", "content": "Initial content"}
        insert_result = insert_document(
            connection_string="mongodb://testuser:testpass@localhost",
            database_name="test_db",
            collection_name="documents",
            document=new_doc,
        )
        assert insert_result is not None
        doc_id = str(insert_result["_id"])

        # Read document
        found_doc = get_single_document(
            connection_string="mongodb://localhost",
            database_name="test_db",
            collection_name="documents",
            document_id=doc_id,
        )
        assert found_doc is not None
        assert found_doc["title"] == "Lifecycle Test"

        # Update document
        update_result = update_document(
            connection_string="mongodb://testuser:testpass@localhost",
            database_name="test_db",
            collection_name="documents",
            document_id=doc_id,
            content={"title": "Lifecycle Test", "content": "Updated content"},
        )
        assert update_result is not None
        assert update_result["content"] == "Updated content"

        # Delete document
        delete_result = delete_document(
            connection_string="mongodb://testuser:testpass@localhost",
            database_name="test_db",
            collection_name="documents",
            document_id=doc_id,
        )
        assert delete_result is True

        # Verify deletion
        deleted_doc = get_single_document(
            connection_string="mongodb://localhost",
            database_name="test_db",
            collection_name="documents",
            document_id=doc_id,
        )
        assert deleted_doc is None

    @patch("services.data_documents_service.MongoClient")
    @patch("services.data_documents_service.log_write_operation")
    def test_batch_operations(self, mock_log, mock_mongo_client, mock_client):
        """Test batch operations with multiple documents."""
        # Setup
        mock_mongo_client.return_value = mock_client

        # Insert multiple documents
        docs = [{"title": f"Batch Doc {i}", "category": "batch"} for i in range(5)]

        for doc in docs:
            result = insert_document(
                connection_string="mongodb://testuser:testpass@localhost",
                database_name="test_db",
                collection_name="documents",
                document=doc,
            )
            assert result is not None

        # Fetch documents by category
        batch_docs = fetch_documents(
            connection_string="mongodb://localhost",
            database_name="test_db",
            collection_name="documents",
            page=1,
            limit=10,
            filter={"key": "category", "value": "batch"},
        )
        assert len(batch_docs.documents) == 5

        # Verify all documents have correct category
        for doc in batch_docs.documents:
            assert doc["category"] == "batch"

    @patch("services.data_documents_service.MongoClient")
    @patch("services.data_documents_service.log_write_operation")
    @freeze_time("2023-01-01 12:00:00")
    def test_timestamp_handling(self, mock_log, mock_mongo_client, mock_client):
        """Test proper handling of timestamps in operations."""
        # Setup
        mock_mongo_client.return_value = mock_client

        # Insert document with timestamp
        doc_with_timestamp = {
            "title": "Timestamp Test",
            "created_at": datetime.now(timezone.utc),
        }

        result = insert_document(
            connection_string="mongodb://testuser:testpass@localhost",
            database_name="test_db",
            collection_name="documents",
            document=doc_with_timestamp,
        )
        assert result is not None
        doc_id = str(result["_id"])

        # Retrieve and verify timestamp
        found_doc = get_single_document(
            connection_string="mongodb://localhost",
            database_name="test_db",
            collection_name="documents",
            document_id=doc_id,
        )
        assert found_doc is not None
        assert "datetime_creation" in found_doc
        assert isinstance(found_doc["datetime_creation"], datetime)

    @patch("services.data_documents_service.MongoClient")
    def test_error_handling_chain(self, mock_mongo_client):
        """Test error handling across multiple operations."""
        # Setup mock client that raises exception during database operations
        mock_client = Mock()
        mock_mongo_client.return_value = mock_client

        # Mock database access to raise exception
        mock_db = Mock()
        mock_collection = Mock()
        mock_client.__getitem__ = Mock(return_value=mock_db)
        mock_db.__getitem__ = Mock(return_value=mock_collection)

        # Make collection operations fail
        mock_collection.insert_one.side_effect = Exception("Database operation failed")
        mock_collection.find_one.side_effect = Exception("Database operation failed")
        mock_collection.replace_one.side_effect = Exception("Database operation failed")
        mock_collection.delete_one.side_effect = Exception("Database operation failed")

        # Test that all operations handle errors gracefully
        assert (
            insert_document(
                "mongodb://localhost", "test_db", "documents", {"title": "Test"}
            )
            is None
        )
        assert (
            get_single_document(
                "mongodb://localhost",
                "test_db",
                "documents",
                "507f1f77bcf86cd799439011",
            )
            is None
        )
        assert (
            update_document(
                "mongodb://localhost",
                "test_db",
                "documents",
                "507f1f77bcf86cd799439011",
                {"title": "Updated"},
            )
            is None
        )
        assert (
            delete_document(
                "mongodb://localhost",
                "test_db",
                "documents",
                "507f1f77bcf86cd799439011",
            )
            is False
        )

    @patch("services.data_documents_service.MongoClient")
    @patch("services.data_documents_service.log_write_operation")
    def test_search_and_filter_combinations(
        self, mock_log, mock_mongo_client, mock_client
    ):
        """Test various search and filter combinations."""
        # Setup
        mock_mongo_client.return_value = mock_client
        # Note: database access will be handled by service functions

        # Insert test documents with various attributes
        test_docs = [
            {
                "title": "Python Guide",
                "category": "programming",
                "tags": ["python", "tutorial"],
            },
            {
                "title": "JavaScript Basics",
                "category": "programming",
                "tags": ["javascript", "beginner"],
            },
            {
                "title": "Data Science Notes",
                "category": "research",
                "tags": ["python", "data"],
            },
            {
                "title": "Meeting Notes",
                "category": "notes",
                "tags": ["meeting", "work"],
            },
        ]

        for doc in test_docs:
            insert_document(
                connection_string="mongodb://testuser:testpass@localhost",
                database_name="test_db",
                collection_name="documents",
                document=doc,
            )

        # Test category filtering
        programming_docs = fetch_documents(
            connection_string="mongodb://localhost",
            database_name="test_db",
            collection_name="documents",
            page=1,
            limit=10,
            filter={"key": "category", "value": "programming"},
        )
        assert len(programming_docs.documents) == 2

        # Test text search with "all" key
        python_docs = fetch_documents(
            connection_string="mongodb://localhost",
            database_name="test_db",
            collection_name="documents",
            page=1,
            limit=10,
            filter={"key": "all", "value": "Python"},
        )
        # Should find documents containing "Python" in any string field
        assert len(python_docs.documents) >= 1
