"""Tests for the synthetic-fixture generator.

Exercises ``generate_docs`` directly (no DB) so we can verify defect counts,
near-miss field rates, and determinism without spinning up mongomock or a
real cluster.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from backend.experiments.seed_fixture import (
    _DEFECT_FIELDS,
    _DEFECT_SHARES,
    GroundTruth,
    SeededDefect,
    generate_docs,
)


_NOW = datetime(2026, 5, 1, tzinfo=UTC)


def test_generate_docs_is_deterministic_per_seed() -> None:
    docs_a, defects_a = generate_docs(doc_count=500, seed=42, now=_NOW)
    docs_b, defects_b = generate_docs(doc_count=500, seed=42, now=_NOW)
    assert docs_a == docs_b
    assert defects_a == defects_b


def test_generate_docs_differs_across_seeds() -> None:
    docs_a, _ = generate_docs(doc_count=500, seed=42, now=_NOW)
    docs_b, _ = generate_docs(doc_count=500, seed=43, now=_NOW)
    # At least *some* document must differ — otherwise the seed isn't routed.
    assert any(a != b for a, b in zip(docs_a, docs_b))


def test_each_defect_category_meets_its_share_target() -> None:
    doc_count = 2000
    docs, defects = generate_docs(doc_count=doc_count, seed=42, now=_NOW)
    by_cat = {d.category: d for d in defects}

    # null_rate — count docs where email is None
    null_count = sum(1 for d in docs if d["email"] is None)
    assert null_count == by_cat["null_rate"].affected_count
    assert null_count == pytest.approx(doc_count * _DEFECT_SHARES["null_rate"], abs=1)

    # type_drift — created_at is a string instead of datetime
    drift_count = sum(1 for d in docs if isinstance(d["created_at"], str))
    assert drift_count == by_cat["type_drift"].affected_count

    # enum_violation — status is off the legal list
    legal_statuses = {"active", "inactive", "pending"}
    enum_count = sum(1 for d in docs if d["status"] not in legal_statuses)
    assert enum_count == by_cat["enum_violation"].affected_count

    # stale_timestamp — last_active >2 years before _NOW
    stale_threshold = _NOW.replace(year=_NOW.year - 2)
    stale_count = sum(1 for d in docs if d["last_active"] < stale_threshold)
    assert stale_count == by_cat["stale_timestamp"].affected_count

    # outlier_value — age is impossible
    outlier_count = sum(1 for d in docs if d["age"] in (9999, -1, 0, 250))
    assert outlier_count == by_cat["outlier_value"].affected_count

    # duplicates — username starts with "popular_user_"
    dup_count = sum(1 for d in docs if d["username"].startswith("popular_user_"))
    assert dup_count == by_cat["duplicates"].affected_count


def test_near_miss_fields_have_low_pct_nulls_below_warning_threshold() -> None:
    """phone should land around 3% null — below QueryArgus's 5% warning threshold."""
    docs, _ = generate_docs(doc_count=2000, seed=42, now=_NOW)
    phone_null_pct = sum(1 for d in docs if d["phone"] is None) / len(docs)
    assert 0.01 < phone_null_pct < 0.05, f"phone null rate {phone_null_pct:.3f} out of band"


def test_middle_name_is_the_trap_field_with_high_optional_nulls() -> None:
    """middle_name should land around 35% null — high enough to tempt a noisy agent."""
    docs, _ = generate_docs(doc_count=2000, seed=42, now=_NOW)
    middle_null_pct = sum(1 for d in docs if d["middle_name"] is None) / len(docs)
    assert 0.25 < middle_null_pct < 0.45, f"middle_name null rate {middle_null_pct:.3f} out of band"


def test_all_defect_fields_are_distinct() -> None:
    """Each defect category targets a DIFFERENT field so they don't interfere."""
    fields = list(_DEFECT_FIELDS.values())
    assert len(set(fields)) == len(fields), f"defect fields are not unique: {fields}"


def test_generate_docs_rejects_non_positive_doc_count() -> None:
    with pytest.raises(ValueError):
        generate_docs(doc_count=0, seed=42)


def test_ground_truth_round_trips_through_json() -> None:
    truth = GroundTruth(
        collection="c", database="d", cosmos_account="a",
        doc_count=100, seed=42,
        defects=[SeededDefect(field="email", category="null_rate",
                              affected_count=12, total=100, notes="...")],
        near_miss_fields=["phone"],
    )
    import json
    loaded = json.loads(truth.to_json())
    assert loaded["collection"] == "c"
    assert loaded["defects"][0]["field"] == "email"
    assert loaded["near_miss_fields"] == ["phone"]
