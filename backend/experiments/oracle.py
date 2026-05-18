"""Rule-based simulated rater for the HITL experiment.

Replaces a live human reviewer with a deterministic oracle that consults
``ground_truth.json`` (produced by ``seed_fixture.py``). A finding is
labelled ``tp`` if its ``(field, category)`` matches a seeded defect — with
category synonyms — and ``fp`` otherwise. A small simulated latency is
reported so the harness can account for "human-seconds per run" across
arms.

The synonym map exists because QueryArgus categorises freely (the agent
picks a snake_case label per finding). The smoke tests showed it uses
``null_rate`` / ``missing_field_rate`` / ``null_or_missing_rate`` for what
the seeded fixture calls ``null_rate``, ``type_mismatch`` for what the
fixture calls ``type_drift``, etc. The oracle's match must absorb that
without us pinning the agent's vocabulary in the prompt (which would
confound the experiment).
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Literal

Label = Literal["tp", "fp", "unsure"]

# Each seeded category (left) accepts any agent-emitted category (right) as
# a TP match. Both directions must be kept lower-case snake_case.
CATEGORY_SYNONYMS: dict[str, set[str]] = {
    "null_rate": {
        "null_rate", "missing_field_rate", "null_or_missing_rate",
        "missing_value_rate", "missingness",
    },
    "type_drift": {
        "type_mismatch", "type_drift", "inconsistent_type", "schema_drift",
    },
    "enum_violation": {
        "enum_violation", "unexpected_value", "invalid_enum",
        "out_of_enum", "low_cardinality_constant",  # see notes in seed_fixture
    },
    "stale_timestamp": {
        "stale_timestamp", "stale_data", "outdated_timestamp", "stale_record",
    },
    "outlier_value": {
        "outlier_value", "out_of_range", "impossible_value", "extreme_value",
    },
    "duplicates": {
        "duplicates", "duplicate_value", "non_unique", "duplicate_key",
        "duplicate_username", "uniqueness_violation",
    },
}


@dataclass(frozen=True)
class Verdict:
    label: Label
    latency_ms: int
    reason: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _default_ground_truth_path() -> Path:
    return Path(__file__).resolve().parent / "ground_truth.json"


def load_ground_truth(path: Path | None = None) -> dict[str, Any]:
    src = path or _default_ground_truth_path()
    return json.loads(src.read_text(encoding="utf-8"))


def _match_synonym(seeded_category: str, agent_category: str) -> bool:
    """True iff the agent's category label is in ``seeded_category``'s synonym set."""
    aliases = CATEGORY_SYNONYMS.get(seeded_category, {seeded_category})
    return agent_category in aliases


def rate_finding(
    finding: dict[str, Any],
    *,
    ground_truth: dict[str, Any] | None = None,
    simulated_latency_ms: int = 4000,
) -> Verdict:
    """Label a finding by matching its ``(field, category)`` against the ground truth.

    ``finding`` must expose ``field`` and ``category`` keys — both arms
    serialise findings with these fields today via QueryArgus's API.

    Match logic:
    - exact field + synonym-set category match → ``tp``
    - field is a near-miss field → ``fp``
    - everything else → ``fp``

    There is no ``unsure`` outcome in this version; the oracle's job is to
    be deterministic. The ``unsure`` label is reserved for a future
    confidence-aware oracle.
    """
    if ground_truth is None:
        ground_truth = load_ground_truth()

    field = str(finding.get("field", ""))
    category = str(finding.get("category", ""))

    for defect in ground_truth.get("defects", []):
        if defect["field"] != field:
            continue
        if _match_synonym(defect["category"], category):
            return Verdict(
                label="tp",
                latency_ms=simulated_latency_ms,
                reason=(
                    f"matched seeded defect ({defect['field']} / {defect['category']}); "
                    f"agent emitted '{category}'"
                ),
            )

    near_miss = set(ground_truth.get("near_miss_fields", []))
    if field in near_miss:
        return Verdict(
            label="fp",
            latency_ms=simulated_latency_ms,
            reason=(
                f"field '{field}' is a known near-miss (legitimately optional/sparse); "
                f"agent flagged it as '{category}'"
            ),
        )

    return Verdict(
        label="fp",
        latency_ms=simulated_latency_ms,
        reason=(
            f"no seeded defect on field='{field}' category='{category}'; "
            "treated as false positive"
        ),
    )
