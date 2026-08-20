import pytest

from services.pg_sql_utils import (
    _normalize_categorical_literals,
    _validate_sql_columns,
    _validate_sql_operators,
    _validate_sql_references,
)

_VALID_SQL_SCHEMA = (
    "public.orders\n"
    "  - id integer [PK]\n"
    "  - customer_id integer [FK -> customers.id]\n"
    "  - status character varying -- values: 'active', 'cancelled'\n"
    "  - created_at timestamp without time zone\n\n"
    "public.customers\n"
    "  - id integer [PK]\n"
    "  - name text"
)


@pytest.mark.parametrize(
    "sql",
    [
        # CTE name is not a schema table, but is a legal reference.
        "WITH recent AS (SELECT o.id, o.status FROM public.orders o) "
        "SELECT r.id FROM recent r LIMIT 50",
        # Derived-table alias projects a column that exists in no table.
        "SELECT s.cnt FROM (SELECT count(*) AS cnt FROM public.orders) s",
        # EXTRACT/TRIM put FROM inside a function call.
        "SELECT EXTRACT(YEAR FROM o.created_at) AS yr FROM public.orders o "
        "GROUP BY yr LIMIT 50",
        "SELECT TRIM(BOTH ' ' FROM c.name) FROM public.customers c LIMIT 50",
        # LATERAL is a keyword, not a table.
        "SELECT a.id FROM public.orders a JOIN LATERAL (SELECT 1) b ON true",
        # A string literal that happens to contain 'from'.
        "SELECT c.name FROM public.customers c WHERE c.name = 'from paris' LIMIT 50",
    ],
)
def test_validators_do_not_reject_valid_sql(sql):
    """Regression: these shapes are all legal SQL and must not be flagged.

    The static validators only run when the database gave no verdict, so a false
    positive here would burn the retry budget and surface a bogus critique.
    """
    for check in (
        _validate_sql_references,
        _validate_sql_columns,
        _validate_sql_operators,
    ):
        assert check(sql, _VALID_SQL_SCHEMA) is None, f"{check.__name__} false positive"


def test_validate_sql_columns_suggests_enum_column_for_unknown_bucket():
    schema_context = (
        "public.acquisition\n"
        "  - human_id text\n"
        "  - heart_failure user-defined -- values: 'heart_failure', 'none'"
    )
    sql = (
        "SELECT a.human_id FROM public.acquisition AS a "
        "WHERE a.heart_conditions ->> 'heart failure' IS NOT NULL LIMIT 50"
    )

    violation = _validate_sql_columns(sql, schema_context)

    assert violation is not None
    assert "heart_conditions" in violation
    assert "heart_failure" in violation
    assert "snake_case literal 'heart_failure'" in violation


def test_validate_sql_operators_flags_user_defined_column_json_operator_usage():
    schema_context = "public.acquisition\n  - heart_failure user-defined"
    sql = "SELECT * FROM public.acquisition AS a WHERE a.heart_failure ->> 'heart_failure' IS NOT NULL"

    violation = _validate_sql_operators(sql, schema_context)

    assert violation is not None
    assert "heart_failure" in violation
    assert "Operator mismatch" in violation


def test_validate_sql_operators_flags_any_on_scalar_user_defined_column():
    schema_context = "public.acquisition\n  - pathology user-defined"
    sql = "SELECT a.human_id FROM public.acquisition AS a WHERE 'heart failure' = ANY (a.pathology) LIMIT 50"

    violation = _validate_sql_operators(sql, schema_context)

    assert violation is not None
    assert "ANY/ALL mismatch" in violation
    assert "pathology" in violation
    assert "pathology = 'heart_failure'" in violation


def test_normalize_categorical_literals_snake_cases_enum_like_values():
    schema_context = "public.acquisition\n  - heart_failure user-defined"
    sql = (
        "SELECT * FROM public.acquisition AS a WHERE a.heart_failure = 'Heart Failure'"
    )

    normalized = _normalize_categorical_literals(sql, schema_context)

    assert (
        normalized
        == "SELECT * FROM public.acquisition AS a WHERE a.heart_failure = 'heart_failure'"
    )


def test_normalize_categorical_literals_snake_cases_enum_like_values_in_any():
    schema_context = "public.acquisition\n  - pathology user-defined"
    sql = "SELECT a.human_id FROM public.acquisition AS a WHERE 'Heart Failure' = ANY (a.pathology) LIMIT 50"

    normalized = _normalize_categorical_literals(sql, schema_context)

    assert (
        normalized
        == "SELECT a.human_id FROM public.acquisition AS a WHERE 'heart_failure' = ANY (a.pathology) LIMIT 50"
    )


def test_normalize_categorical_literals_rewrites_unknown_json_bucket_to_enum_column():
    schema_context = (
        "public.acquisition\n"
        "  - human_id text\n"
        "  - heart_failure user-defined -- values: 'heart_failure', 'none'"
    )
    sql = (
        "SELECT a.human_id FROM public.acquisition AS a "
        "WHERE a.heart_conditions ->> 'heart_failure' IS NOT NULL LIMIT 50"
    )

    normalized = _normalize_categorical_literals(sql, schema_context)

    assert normalized == (
        "SELECT a.human_id FROM public.acquisition AS a "
        "WHERE a.heart_failure = 'heart_failure' LIMIT 50"
    )


def test_normalize_categorical_literals_rewrites_array_contains_to_any_membership():
    schema_context = "public.acquisition\n  - pathology user-defined[]"
    sql = (
        "SELECT a.human_id FROM public.acquisition AS a "
        "WHERE a.pathology @> ARRAY ['heart failure'] LIMIT 50"
    )

    normalized = _normalize_categorical_literals(sql, schema_context)

    assert normalized == (
        "SELECT a.human_id FROM public.acquisition AS a "
        "WHERE 'heart_failure' = ANY(a.pathology) LIMIT 50"
    )


def test_normalize_categorical_literals_prefers_hinted_value_format_for_scalar_enum():
    schema_context = (
        "public.acquisition\n  - modality user-defined -- values: 'CT', 'MR'"
    )
    sql = "SELECT * FROM public.acquisition AS a WHERE a.modality = 'ct'"

    normalized = _normalize_categorical_literals(sql, schema_context)

    assert normalized == "SELECT * FROM public.acquisition AS a WHERE a.modality = 'CT'"


def test_normalize_categorical_literals_prefers_hinted_value_format_for_any_membership():
    schema_context = "public.acquisition\n  - pathology user-defined[] -- values: 'heart_failure', 'none'"
    sql = "SELECT a.human_id FROM public.acquisition AS a WHERE 'heart failure' = ANY(a.pathology) LIMIT 50"

    normalized = _normalize_categorical_literals(sql, schema_context)

    assert normalized == (
        "SELECT a.human_id FROM public.acquisition AS a "
        "WHERE 'heart_failure' = ANY(a.pathology) LIMIT 50"
    )
