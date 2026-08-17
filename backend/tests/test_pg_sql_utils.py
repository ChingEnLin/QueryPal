from services.pg_sql_utils import (
    _normalize_categorical_literals,
    _validate_sql_columns,
    _validate_sql_operators,
)


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
    sql = "SELECT * FROM public.acquisition AS a WHERE a.heart_failure = 'Heart Failure'"

    normalized = _normalize_categorical_literals(sql, schema_context)

    assert normalized == "SELECT * FROM public.acquisition AS a WHERE a.heart_failure = 'heart_failure'"


def test_normalize_categorical_literals_snake_cases_enum_like_values_in_any():
    schema_context = "public.acquisition\n  - pathology user-defined"
    sql = "SELECT a.human_id FROM public.acquisition AS a WHERE 'Heart Failure' = ANY (a.pathology) LIMIT 50"

    normalized = _normalize_categorical_literals(sql, schema_context)

    assert normalized == "SELECT a.human_id FROM public.acquisition AS a WHERE 'heart_failure' = ANY (a.pathology) LIMIT 50"


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
    schema_context = "public.acquisition\n  - modality user-defined -- values: 'CT', 'MR'"
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
