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


def test_heuristic_generates_status_years_and_promo_filter_with_join():
    conn = MagicMock()
    with (
        patch.object(
            agent.client.models, "generate_content", return_value=_eval_ok_response()
        ),
        patch.object(agent, "execute_sql", return_value={"columns": [], "rows": []}),
    ):
        out = agent.run_sql_generator(
            user_input=(
                "Give me all active accounts with tenure years greater than 40 "
                "and have a promo code."
            ),
            database="appdb",
            schema_context=_schema_context_accounts_orders(),
            conn=conn,
            max_iterations=1,
        )

    assert out["generated_code"] == (
        "SELECT *\n"
        "FROM public.accounts AS a\n"
        "JOIN public.orders AS b\n"
        "  ON a.account_id = b.account_id\n"
        "WHERE a.account_status = 'active'\n"
        "  AND b.tenure_years > 40\n"
        "  AND b.promo_code IS NOT NULL;"
    )


def test_heuristic_generates_single_table_filter_without_alias():
    conn = MagicMock()
    schema_context = "public.accounts\n  - account_id integer\n  - account_status text"
    with (
        patch.object(
            agent.client.models, "generate_content", return_value=_eval_ok_response()
        ),
        patch.object(agent, "execute_sql", return_value={"columns": [], "rows": []}),
    ):
        out = agent.run_sql_generator(
            user_input="Give me all active accounts",
            database="appdb",
            schema_context=schema_context,
            conn=conn,
            max_iterations=1,
        )

    assert out["generated_code"] == (
        "SELECT *\n" "FROM public.accounts\n" "WHERE account_status = 'active';"
    )


def test_heuristic_generates_item_category_and_amount_projection():
    conn = MagicMock()
    schema_context = (
        "public.order_items\n"
        "  - order_id integer [PK, NOT NULL, FK -> orders.order_id]\n"
        "  - item_category text\n\n"
        "public.orders\n"
        "  - order_id integer [PK, NOT NULL]\n"
        "  - total_amount numeric"
    )

    with (
        patch.object(
            agent.client.models, "generate_content", return_value=_eval_ok_response()
        ),
        patch.object(agent, "execute_sql", return_value={"columns": [], "rows": []}),
    ):
        out = agent.run_sql_generator(
            user_input='Give me all orders with the item category "hardware". Also show the total amount.',
            database="appdb",
            schema_context=schema_context,
            conn=conn,
            max_iterations=1,
        )

    assert out["generated_code"] == (
        "SELECT\n"
        "  b.order_id,\n"
        "  b.item_category,\n"
        "  a.total_amount\n"
        "FROM public.orders AS a\n"
        "JOIN public.order_items AS b\n"
        "  ON a.order_id = b.order_id\n"
        "WHERE b.item_category = 'hardware';"
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
        ),
        patch.object(
            agent.client.models, "generate_content", return_value=_eval_ok_response()
        ),
        patch.object(agent, "execute_sql", return_value={"columns": [], "rows": []}),
    ):
        out = agent.run_sql_generator(
            user_input="Give me all active accounts that are older than 50 years.",
            database="appdb",
            schema_context=table_only_context,
            conn=conn,
            max_iterations=1,
        )

    assert out["generated_code"] == (
        "SELECT *\n"
        "FROM public.accounts AS a\n"
        "JOIN public.orders AS b\n"
        "  ON a.account_id = b.account_id\n"
        "WHERE a.account_status = 'active'\n"
        "  AND b.tenure_years > 50;"
    )


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
            schema_context="public.orders",
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


def test_invalid_heuristic_retries_with_llm_generation():
    conn = MagicMock()
    heuristic_context = _schema_context_accounts_orders()
    eval_invalid = _gen_response(
        '{"is_valid": false, "critique": "Use accounts only; remove orders join."}'
    )
    llm_retry = _gen_response("SELECT * FROM public.accounts WHERE account_status = 'active';")
    eval_valid = _eval_ok_response()

    with (
        patch.object(
            agent.client.models,
            "generate_content",
            side_effect=[eval_invalid, llm_retry, eval_valid],
        ) as gen_content,
        patch.object(agent, "execute_sql", return_value={"columns": [], "rows": []}),
    ):
        out = agent.run_sql_generator(
            user_input="Give me all active accounts with tenure years greater than 40 and have a promo code.",
            database="appdb",
            schema_context=heuristic_context,
            conn=conn,
            max_iterations=2,
        )

    assert out["generated_code"] == "SELECT * FROM public.accounts WHERE account_status = 'active';"
    assert out["is_valid"] is True
    assert gen_content.call_count == 3

    retry_prompt = gen_content.call_args_list[1].kwargs["contents"]
    assert "Use accounts only; remove orders join." in retry_prompt
    assert "JOIN public.orders AS b" in retry_prompt
