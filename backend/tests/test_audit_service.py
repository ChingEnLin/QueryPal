import unittest
from unittest.mock import patch, MagicMock
from services.audit_service import process_audit_question


class TestAuditService(unittest.TestCase):

    @patch("services.audit_service.generate_audit_sql")
    @patch("services.audit_service.get_connection")
    @patch("services.audit_service.summarize_audit_results")
    def test_process_audit_question_success(
        self, mock_summarize, mock_get_conn, mock_generate_sql
    ):
        # Setup mocks
        mock_generate_sql.return_value = "SELECT * FROM write_audit_log LIMIT 5"

        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_get_conn.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor

        # Mock DB results
        mock_cursor.description = [("user_email",), ("operation",)]
        mock_cursor.fetchall.return_value = [("test@example.com", "insert")]

        mock_summarize.return_value = "Summary of results."

        # Execute
        result = process_audit_question("Show me inserts")

        # Assertions
        self.assertEqual(result["sql_query"], "SELECT * FROM write_audit_log LIMIT 5")
        self.assertEqual(len(result["results"]), 1)
        self.assertEqual(result["results"][0]["user_email"], "test@example.com")
        self.assertEqual(result["summary"], "Summary of results.")

        mock_generate_sql.assert_called_once()
        mock_cursor.execute.assert_called_with("SELECT * FROM write_audit_log LIMIT 5")
        mock_summarize.assert_called_once()

    @patch("services.audit_service.generate_audit_sql")
    def test_process_audit_question_invalid_sql(self, mock_generate_sql):
        mock_generate_sql.return_value = "DELETE FROM write_audit_log"

        result = process_audit_question("Delete everything")

        self.assertIn("Error executing query", result["summary"])
        self.assertIn("Only SELECT", result["summary"])


if __name__ == "__main__":
    unittest.main()
