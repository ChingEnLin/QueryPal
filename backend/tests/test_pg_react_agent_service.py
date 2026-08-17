from unittest.mock import MagicMock, patch

import services.pg_react_agent_service as agent


def _gen_response(text):
    r = MagicMock()
    r.text = text
    r.parsed = None
    return r


def _eval_ok_response():
    return _gen_response('{"is_valid": true, "critique": "looks good"}')


def test_read_query_runs_and_validates():
    conn = MagicMock()
    gen = _gen_response("```sql\nSELECT id FROM users\n```")
    eval_resp = _eval_ok_response()
    with (
        patch.object(
            agent.client.models, "generate_content", side_effect=[gen, eval_resp]
        ),
        patch.object(
            agent, "execute_sql", return_value={"columns": ["id"], "rows": [[1]]}
        ),
    ):
        out = agent.run_sql_generator(
            user_input="list user ids",
            database="appdb",
            schema_context="public.users(id int)",
            conn=conn,
            max_iterations=1,
        )

    assert out["generated_code"] == "SELECT id FROM users"
    assert out["is_write_action"] is False
    assert out["is_valid"] is True
    assert out["query_result"] == {"columns": ["id"], "rows": [[1]]}


def test_write_sql_is_not_executed():
    conn = MagicMock()
    gen = _gen_response("UPDATE users SET name='x'")
    eval_resp = _eval_ok_response()
    with (
        patch.object(
            agent.client.models, "generate_content", side_effect=[gen, eval_resp]
        ),
        patch.object(agent, "execute_sql") as exec_sql,
    ):
        out = agent.run_sql_generator(
            user_input="rename user",
            database="appdb",
            schema_context="public.users(id int, name text)",
            conn=conn,
            max_iterations=1,
        )

    exec_sql.assert_not_called()
    assert out["is_write_action"] is True
    assert "review" in str(out["query_result"]).lower()


def _schema_context_accounts_orders():
    return (
        "public.accounts\n"
        "  - account_id integer [PK, NOT NULL]\n"
        "  - account_status text\n\n"
        "public.orders\n"
        "  - order_id integer [PK, NOT NULL]\n"
        "  - account_id integer [FK -> accounts.account_id]\n"
        "  - tenure_years integer\n"
        "  - promo_code text"
    )


def test_table_only_schema_context_gets_enriched_before_generation():
    conn = MagicMock()
    table_only_context = "public.accounts\npublic.orders"
    enriched_context = (
        "public.accounts\n"
        "  - account_id integer [PK, NOT NULL]\n"
        "  - account_status text\n\n"
        "public.orders\n"
        "  - order_id integer [PK, NOT NULL]\n"
        "  - account_id integer [FK -> accounts.account_id]\n"
        "  - tenure_years integer"
    )

    with (
        patch.object(
            agent, "_enrich_schema_context_from_db", return_value=enriched_context
        ) as enrich,
        patch.object(
            agent.client.models,
            "generate_content",
            side_effect=[
                _gen_response("SELECT * FROM public.accounts"),
                _eval_ok_response(),
            ],
        ),
        patch.object(agent, "execute_sql", return_value={"columns": [], "rows": []}),
    ):
        agent.run_sql_generator(
            user_input="Give me all active accounts that are older than 50 years.",
            database="appdb",
            schema_context=table_only_context,
            conn=conn,
            max_iterations=1,
        )

    enrich.assert_called_once()


def test_llm_fallback_normalizes_string_like_column_literals():
    conn = MagicMock()
    gen = _gen_response("SELECT * FROM public.orders WHERE order_status = 'Paid'")
    eval_resp = _eval_ok_response()

    with (
        patch.object(
            agent.client.models, "generate_content", side_effect=[gen, eval_resp]
        ),
        patch.object(agent, "execute_sql", return_value={"columns": [], "rows": []}),
    ):
        out = agent.run_sql_generator(
            user_input="show all orders",
            database="appdb",
            schema_context="public.orders\n  - order_status text",
            conn=conn,
            max_iterations=1,
        )

    assert (
        out["generated_code"]
        == "SELECT * FROM public.orders WHERE order_status = 'paid'"
    )


def test_llm_fallback_does_not_normalize_non_string_columns():
    conn = MagicMock()
    gen = _gen_response("SELECT * FROM public.orders WHERE total_amount = 'Paid'")
    eval_resp = _eval_ok_response()

    with (
        patch.object(
            agent.client.models, "generate_content", side_effect=[gen, eval_resp]
        ),
        patch.object(agent, "execute_sql", return_value={"columns": [], "rows": []}),
    ):
        out = agent.run_sql_generator(
            user_input="show all orders",
            database="appdb",
            schema_context="public.orders\n  - total_amount numeric",
            conn=conn,
            max_iterations=1,
        )

    assert (
        out["generated_code"]
        == "SELECT * FROM public.orders WHERE total_amount = 'Paid'"
    )


def test_llm_fallback_skips_normalization_without_type_metadata():
    conn = MagicMock()
    gen = _gen_response("SELECT * FROM public.orders WHERE order_status = 'Paid'")
    eval_resp = _eval_ok_response()
    table_only_context = "public.orders"

    with (
        patch.object(
            agent, "_enrich_schema_context_from_db", return_value=table_only_context
        ),
        patch.object(
            agent.client.models, "generate_content", side_effect=[gen, eval_resp]
        ),
        patch.object(agent, "execute_sql", return_value={"columns": [], "rows": []}),
    ):
        out = agent.run_sql_generator(
            user_input="show all orders",
            database="appdb",
            schema_context=table_only_context,
            conn=conn,
            max_iterations=1,
        )

    assert (
        out["generated_code"]
        == "SELECT * FROM public.orders WHERE order_status = 'Paid'"
    )


def test_invalid_query_retries_with_llm_on_second_iteration():
    conn = MagicMock()
    first_sql = "SELECT * FROM public.accounts AS a JOIN public.orders AS b ON a.account_id = b.account_id WHERE a.account_status = 'active';"
    eval_invalid = _gen_response(
        '{"is_valid": false, "critique": "Use accounts only; remove orders join."}'
    )
    retry_sql = "SELECT * FROM public.accounts WHERE account_status = 'active';"
    eval_valid = _eval_ok_response()

    with (
        patch.object(
            agent.client.models,
            "generate_content",
            side_effect=[
                _gen_response(f"```sql\n{first_sql}\n```"),
                eval_invalid,
                _gen_response(retry_sql),
                eval_valid,
            ],
        ) as gen_content,
        patch.object(agent, "execute_sql", return_value={"columns": [], "rows": []}),
    ):
        out = agent.run_sql_generator(
            user_input="Give me all active accounts with tenure years greater than 40 and have a promo code.",
            database="appdb",
            schema_context=_schema_context_accounts_orders(),
            conn=conn,
            max_iterations=2,
        )

    assert out["generated_code"] == retry_sql
    assert out["is_valid"] is True
    assert gen_content.call_count == 4

    retry_prompt = gen_content.call_args_list[2].kwargs["contents"]
    assert "Use accounts only; remove orders join." in retry_prompt
    assert "JOIN public.orders" in retry_prompt


def test_hallucinated_table_names_are_caught_and_corrected():
    """_evaluate short-circuits with a correction when the SQL references tables
    that are not listed in the schema context."""
    conn = MagicMock()
    schema_context = (
        "public.patients\n"
        "  - patient_id integer [PK, NOT NULL]\n"
        "  - name text\n\n"
        "public.diagnoses\n"
        "  - diagnosis_id integer [PK, NOT NULL]\n"
        "  - patient_id integer [FK -> patients.patient_id]\n"
        "  - diagnosis_name text"
    )
    hallucinated_sql = (
        "SELECT a.* FROM patient AS a "
        "JOIN patient_pathology AS b ON a.patient_id = b.patient_id "
        "JOIN pathology AS c ON b.pathology_id = c.pathology_id "
        "WHERE c.pathology_name = 'heart failure' LIMIT 50"
    )
    corrected_sql = (
        "SELECT a.* FROM public.patients AS a "
        "JOIN public.diagnoses AS b ON a.patient_id = b.patient_id "
        "WHERE b.diagnosis_name = 'heart failure' LIMIT 50"
    )

    with (
        patch.object(
            agent.client.models,
            "generate_content",
            side_effect=[
                _gen_response(hallucinated_sql),
                _gen_response(corrected_sql),
                _eval_ok_response(),
            ],
        ) as gen_content,
        patch.object(
            agent, "execute_sql", return_value={"columns": [], "rows": []}
        ) as exec_sql,
    ):
        out = agent.run_sql_generator(
            user_input="Show me all patients with a heart failure pathology.",
            database="appdb",
            schema_context=schema_context,
            conn=conn,
            max_iterations=3,
        )

    assert out["is_valid"] is True
    assert out["generated_code"] == corrected_sql
    retry_prompt = gen_content.call_args_list[1].kwargs["contents"]
    assert "public.patients" in retry_prompt
    assert "public.diagnoses" in retry_prompt
    assert "patient_pathology" in retry_prompt
