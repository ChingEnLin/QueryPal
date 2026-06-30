from unittest.mock import MagicMock, patch

import services.pg_react_agent_service as agent


def _gen_response(text):
    r = MagicMock()
    r.text = text
    r.parsed = None
    return r


def test_read_query_runs_and_validates():
    conn = MagicMock()
    gen = _gen_response("```sql\nSELECT id FROM patients\n```")
    eval_resp = _gen_response('{"is_valid": true, "critique": "looks good"}')
    with patch.object(
        agent.client.models, "generate_content", side_effect=[gen, eval_resp]
    ), patch.object(
        agent, "execute_sql", return_value={"columns": ["id"], "rows": [[1]]}
    ):
        out = agent.run_sql_generator(
            user_input="list patient ids",
            database="appdb",
            schema_context="public.patients(id int)",
            conn=conn,
            max_iterations=1,
        )
    assert out["generated_code"] == "SELECT id FROM patients"
    assert out["is_write_action"] is False
    assert out["is_valid"] is True
    assert out["query_result"] == {"columns": ["id"], "rows": [[1]]}


def test_write_sql_is_not_executed():
    conn = MagicMock()
    gen = _gen_response("UPDATE patients SET name='x'")
    eval_resp = _gen_response('{"is_valid": true, "critique": "write looks correct"}')
    with patch.object(
        agent.client.models, "generate_content", side_effect=[gen, eval_resp]
    ), patch.object(agent, "execute_sql") as exec_sql:
        out = agent.run_sql_generator(
            user_input="rename patient",
            database="appdb",
            schema_context="public.patients(id int, name text)",
            conn=conn,
            max_iterations=1,
        )
    exec_sql.assert_not_called()
    assert out["is_write_action"] is True
    assert "review" in str(out["query_result"]).lower()
