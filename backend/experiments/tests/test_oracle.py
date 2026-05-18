"""Tests for the rule-based oracle."""

from __future__ import annotations

from backend.experiments.oracle import CATEGORY_SYNONYMS, Verdict, rate_finding


def _gt() -> dict:
    return {
        "collection": "hitl_eval",
        "database": "hitl_test",
        "cosmos_account": "acct",
        "doc_count": 1000,
        "seed": 42,
        "defects": [
            {"field": "email", "category": "null_rate",
             "affected_count": 120, "total": 1000, "notes": ""},
            {"field": "created_at", "category": "type_drift",
             "affected_count": 80, "total": 1000, "notes": ""},
            {"field": "username", "category": "duplicates",
             "affected_count": 30, "total": 1000, "notes": ""},
        ],
        "near_miss_fields": ["phone", "middle_name"],
    }


def test_exact_match_is_tp() -> None:
    v = rate_finding(
        {"field": "email", "category": "null_rate"},
        ground_truth=_gt(),
    )
    assert v.label == "tp"
    assert "matched seeded defect" in v.reason


def test_synonym_match_is_tp() -> None:
    """missing_field_rate is a synonym of null_rate — should still TP."""
    v = rate_finding(
        {"field": "email", "category": "missing_field_rate"},
        ground_truth=_gt(),
    )
    assert v.label == "tp"


def test_wrong_field_for_known_category_is_fp() -> None:
    """null_rate IS a real defect category, but on email — flagging it on `address.city` is wrong."""
    v = rate_finding(
        {"field": "address.city", "category": "null_rate"},
        ground_truth=_gt(),
    )
    assert v.label == "fp"


def test_near_miss_field_is_fp_with_dedicated_reason() -> None:
    """phone is a near-miss field; flagging it should FP with the near-miss reason."""
    v = rate_finding(
        {"field": "phone", "category": "null_rate"},
        ground_truth=_gt(),
    )
    assert v.label == "fp"
    assert "near-miss" in v.reason


def test_completely_unknown_field_is_fp() -> None:
    v = rate_finding(
        {"field": "nonexistent_field", "category": "something_made_up"},
        ground_truth=_gt(),
    )
    assert v.label == "fp"


def test_type_drift_canonical_vs_agent_label() -> None:
    """The fixture calls it ``type_drift``; the agent calls it ``type_mismatch``."""
    v = rate_finding(
        {"field": "created_at", "category": "type_mismatch"},
        ground_truth=_gt(),
    )
    assert v.label == "tp"


def test_duplicates_synonyms() -> None:
    for cat in ("duplicates", "duplicate_value", "non_unique"):
        v = rate_finding(
            {"field": "username", "category": cat},
            ground_truth=_gt(),
        )
        assert v.label == "tp", f"{cat} should be TP"


def test_simulated_latency_is_carried_in_verdict() -> None:
    v = rate_finding(
        {"field": "email", "category": "null_rate"},
        ground_truth=_gt(),
        simulated_latency_ms=12000,
    )
    assert v.latency_ms == 12000


def test_synonym_map_self_contains_canonical_names() -> None:
    """Every canonical seeded category must be in its own synonym set."""
    for canonical, aliases in CATEGORY_SYNONYMS.items():
        assert canonical in aliases, f"{canonical} missing from its own synonym set"


def test_verdict_dict_roundtrip() -> None:
    v = Verdict(label="tp", latency_ms=4000, reason="x")
    assert v.to_dict() == {"label": "tp", "latency_ms": 4000, "reason": "x"}
