from typing import Dict, Any
from services.pg_connection import get_connection
from services.gemini_service import generate_audit_sql, summarize_audit_results
import json


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
                if hasattr(value, 'isoformat'):
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


def process_audit_question(question: str) -> Dict[str, Any]:
    """
    Orchestrates the process of answering a user's audit question:
    1. Generate SQL from NL question (via Gemini)
    2. Execute SQL
    3. Summarize results (via Gemini)
    """
    sql_query = generate_audit_sql(question)
    
    # If the generator returned an error query or invalid SQL, return it
    if "Error:" in sql_query:
        return {
            "sql_query": sql_query,
            "results": [],
            "summary": "Could not generate a valid query for your request."
        }
        
    results = execute_audit_query(sql_query)
    
    # If execution failed
    if results and "error" in results[0]:
        return {
            "sql_query": sql_query,
            "results": [],
            "summary": f"Error executing query: {results[0]['error']}"
        }
        
    summary_response = summarize_audit_results(question, sql_query, results)
    
    return {
        "sql_query": sql_query,
        "results": results,
        "summary": summary_response.summary,
        "visualization": summary_response.visualization
    }
