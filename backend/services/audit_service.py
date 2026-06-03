from typing import Dict, Any, List
from services.pg_connection import get_connection
from services.gemini_service import generate_audit_sql, summarize_audit_results


def execute_audit_query(sql_query: str) -> list:
    """
    Executes a read-only SQL query against the audit database.
    """
    if not sql_query.lower().strip().startswith("select"):
        return [{"error": "Only SELECT queries are allowed."}]

    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(sql_query)

        # Get column names
        columns = [desc[0] for desc in cur.description]
        results = [dict(zip(columns, row)) for row in cur.fetchall()]

        # Serialize datetime and json objects
        for row in results:
            for key, value in row.items():
                if hasattr(value, "isoformat"):
                    row[key] = value.isoformat()
                elif isinstance(value, dict):
                    # Ensure dicts (like diff_data) are kept as dicts for the frontend
                    pass

        cur.close()
        conn.close()
        return results
    except Exception as e:
        print(f"Error executing audit query: {e}")
        return [{"error": str(e)}]


def get_recent_activity(user_email: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Returns the most recent write_audit_log rows for a specific user."""
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT user_email, operation, database_name, collection_name, document_id, timestamp_utc
            FROM write_audit_log
            WHERE user_email = %s
            ORDER BY timestamp_utc DESC
            LIMIT %s
            """,
            (user_email, limit),
        )
        columns = [desc[0] for desc in cur.description]
        rows = []
        for row in cur.fetchall():
            item = dict(zip(columns, row))
            if hasattr(item.get("timestamp_utc"), "isoformat"):
                item["timestamp_utc"] = item["timestamp_utc"].isoformat()
            rows.append(item)
        cur.close()
        conn.close()
        return rows
    except Exception as e:
        print(f"Error fetching recent activity: {e}")
        return []


def get_audit_events(days: int = 90, limit: int = 1000) -> List[Dict[str, Any]]:
    """Returns recent write_audit_log rows (team-wide) with full diff_data.

    Powers the audit dashboard: every write within the time window, regardless
    of actor, newest first.
    """
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT user_email, operation, database_name, collection_name,
                   document_id, diff_data, timestamp_utc
            FROM write_audit_log
            WHERE timestamp_utc >= NOW() - make_interval(days => %s)
            ORDER BY timestamp_utc DESC
            LIMIT %s
            """,
            (days, limit),
        )
        columns = [desc[0] for desc in cur.description]
        rows = []
        for row in cur.fetchall():
            item = dict(zip(columns, row))
            ts = item.get("timestamp_utc")
            if hasattr(ts, "isoformat"):
                item["timestamp_utc"] = ts.isoformat()
            rows.append(item)
        cur.close()
        conn.close()
        return rows
    except Exception as e:
        print(f"Error fetching audit events: {e}")
        return []


def process_audit_question(
    question: str, model: str = "gemini-2.5-flash"
) -> Dict[str, Any]:
    """
    Orchestrates the process of answering a user's audit question:
    1. Generate SQL from NL question (via Gemini)
    2. Execute SQL
    3. Summarize results (via Gemini)
    """
    sql_query = generate_audit_sql(question, model=model)

    # If the generator returned an error query or invalid SQL, return it
    if "Error:" in sql_query:
        return {
            "sql_query": sql_query,
            "results": [],
            "summary": "Could not generate a valid query for your request.",
        }

    results = execute_audit_query(sql_query)

    # If execution failed
    if results and "error" in results[0]:
        return {
            "sql_query": sql_query,
            "results": [],
            "summary": f"Error executing query: {results[0]['error']}",
        }

    summary_response = summarize_audit_results(
        question, sql_query, results, model=model
    )

    return {
        "sql_query": sql_query,
        "results": results,
        "summary": summary_response.summary,
        "visualization": summary_response.visualization,
    }
