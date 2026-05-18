"""Seed a synthetic collection with known defects for the HITL experiment.

Connects via the provided ``--connection-string`` (Cosmos for MongoDB or local
MongoDB — both speak the wire protocol) and writes a deterministic mix of
well-formed docs, defect docs across 6 categories, and near-miss non-defect
docs. Dumps a ``ground_truth.json`` registry the oracle reads.

Defects per category (counts chosen so each is unambiguously above QueryArgus's
default warning thresholds, so an honest agent SHOULD find them):

  =================  =================  ==================================
  category           field              affected share (of doc_count)
  =================  =================  ==================================
  null_rate          email              ~12%
  type_drift         created_at         ~8% (string instead of datetime)
  enum_violation     status             ~6% (off-list values)
  stale_timestamp    last_active        ~5% (more than 2 years old)
  outlier_value      age                ~4% (9999 or -1)
  duplicates         username           ~3% (each member of ~25 dup clusters)
  =================  =================  ==================================

Near-miss fields (NOT defects — used to test FP rate):

  - ``phone``       : ~3% null. Legitimately optional, below the 5% warning
                      threshold. An honest agent should NOT flag it.
  - ``middle_name`` : ~35% null. Legitimately optional, but the high pct is
                      a trap — a noisy agent may flag it as null_rate.

This module separates document generation (``generate_docs`` — pure) from
the DB write so the generator can be unit-tested with mongomock and the
fixture re-derived offline.
"""

from __future__ import annotations

import argparse
import json
import random
import string
from dataclasses import asdict, dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, Literal

DefectCategory = Literal[
    "null_rate",
    "type_drift",
    "enum_violation",
    "stale_timestamp",
    "outlier_value",
    "duplicates",
]

# Affected-share targets per defect — fractions of ``doc_count``. Chosen so
# every defect's true rate is well above QueryArgus's default warning
# thresholds (5% null_rate, 2% type-consistency), giving an honest agent
# clear signal. Tune up to raise difficulty.
_DEFECT_SHARES: dict[DefectCategory, float] = {
    "null_rate":       0.12,
    "type_drift":      0.08,
    "enum_violation":  0.06,
    "stale_timestamp": 0.05,
    "outlier_value":   0.04,
    "duplicates":      0.03,
}

# Field a defect attaches to. Canonical map — both the generator and the
# oracle agree on this so the ground-truth registry is self-describing.
_DEFECT_FIELDS: dict[DefectCategory, str] = {
    "null_rate":       "email",
    "type_drift":      "created_at",
    "enum_violation":  "status",
    "stale_timestamp": "last_active",
    "outlier_value":   "age",
    "duplicates":      "username",
}

_NEAR_MISS_FIELDS = ("phone", "middle_name")

_STATUS_VALUES = ("active", "inactive", "pending")
_OFF_LIST_STATUS_VALUES = ("ACTV", "deleted", "??", "trial-2024")
_COUNTRIES = ("US", "CA", "GB", "DE", "FR", "AU", "JP")
_CITIES = ("Seattle", "Toronto", "London", "Berlin", "Paris", "Sydney", "Tokyo")


@dataclass(frozen=True)
class SeededDefect:
    """A scripted data-quality issue planted in the fixture."""

    field: str
    category: DefectCategory
    affected_count: int
    total: int
    notes: str


@dataclass(frozen=True)
class GroundTruth:
    """All defects + near-miss fields in the seeded collection."""

    collection: str
    database: str
    cosmos_account: str
    doc_count: int
    seed: int
    defects: list[SeededDefect]
    near_miss_fields: list[str]

    def to_json(self) -> str:
        return json.dumps(
            {
                "collection": self.collection,
                "database": self.database,
                "cosmos_account": self.cosmos_account,
                "doc_count": self.doc_count,
                "seed": self.seed,
                "defects": [asdict(d) for d in self.defects],
                "near_miss_fields": list(self.near_miss_fields),
            },
            indent=2,
            sort_keys=True,
        )


def _random_string(rng: random.Random, length: int = 8) -> str:
    return "".join(rng.choices(string.ascii_lowercase, k=length))


def _clean_doc(idx: int, rng: random.Random, now: datetime) -> dict[str, Any]:
    """Build a well-formed user document. Defects are applied on top by caller."""
    return {
        "_id": f"u{idx:06d}",
        "email": f"user{idx}@example.com",
        "username": f"user_{idx}",
        "age": rng.randint(18, 75),
        "status": rng.choice(_STATUS_VALUES),
        "created_at": now - timedelta(days=rng.randint(1, 365 * 3)),
        "last_active": now - timedelta(days=rng.randint(0, 365)),
        "phone": f"+1-555-{rng.randint(1000, 9999)}",
        "middle_name": _random_string(rng, 6),
        "address": {
            "country": rng.choice(_COUNTRIES),
            "city": rng.choice(_CITIES),
            "zip": f"{rng.randint(10000, 99999)}",
        },
    }


def generate_docs(
    *,
    doc_count: int,
    seed: int,
    now: datetime | None = None,
) -> tuple[list[dict[str, Any]], list[SeededDefect]]:
    """Pure: generate ``doc_count`` documents and a description of every planted defect.

    Deterministic for a given ``(doc_count, seed)`` — re-running with the
    same args yields the exact same docs and defect counts. ``now`` defaults
    to a fixed UTC datetime so timestamp-based defects are reproducible.
    """
    if doc_count <= 0:
        raise ValueError(f"doc_count must be positive, got {doc_count}")
    rng = random.Random(seed)
    now = now or datetime(2026, 5, 1, tzinfo=UTC)

    # Pre-pick the "infected" index set for each defect category.
    indices = list(range(doc_count))
    defect_indices: dict[DefectCategory, set[int]] = {}
    for category, share in _DEFECT_SHARES.items():
        k = max(1, int(round(doc_count * share)))
        # Independent draw per category — a doc may carry multiple defects.
        # The actual affected_count for each defect is just len() of its set.
        defect_indices[category] = set(rng.sample(indices, k=k))

    # Near-miss share rates (NOT defects — just optional fields)
    phone_null_indices = set(rng.sample(indices, k=max(1, int(round(doc_count * 0.03)))))
    middle_null_indices = set(rng.sample(indices, k=max(1, int(round(doc_count * 0.35)))))

    # Duplicate clusters: pick ~25 "popular" usernames, assign infected
    # indices uniformly among them so each cluster has ~3-5 duplicates.
    dup_indices = sorted(defect_indices["duplicates"])
    dup_username_count = max(5, len(dup_indices) // 4)
    dup_usernames = [f"popular_user_{i:03d}" for i in range(dup_username_count)]
    dup_assignment = {idx: dup_usernames[i % dup_username_count] for i, idx in enumerate(dup_indices)}

    # Pre-build the docs.
    docs: list[dict[str, Any]] = []
    for i in range(doc_count):
        doc = _clean_doc(i, rng, now)

        if i in defect_indices["null_rate"]:
            doc["email"] = None
        if i in defect_indices["type_drift"]:
            doc["created_at"] = doc["created_at"].isoformat()  # string instead of datetime
        if i in defect_indices["enum_violation"]:
            doc["status"] = rng.choice(_OFF_LIST_STATUS_VALUES)
        if i in defect_indices["stale_timestamp"]:
            # 2-5 years old — clearly stale vs the 0-365d clean range.
            doc["last_active"] = now - timedelta(days=rng.randint(365 * 2, 365 * 5))
        if i in defect_indices["outlier_value"]:
            doc["age"] = rng.choice([9999, -1, 0, 250])
        if i in dup_assignment:
            doc["username"] = dup_assignment[i]

        # Near-miss optional fields
        if i in phone_null_indices:
            doc["phone"] = None
        if i in middle_null_indices:
            doc["middle_name"] = None

        docs.append(doc)

    defects = [
        SeededDefect(
            field=_DEFECT_FIELDS[cat],
            category=cat,
            affected_count=len(defect_indices[cat]),
            total=doc_count,
            notes=_defect_notes(cat),
        )
        for cat in _DEFECT_SHARES
    ]
    return docs, defects


def _defect_notes(category: DefectCategory) -> str:
    notes_map: dict[DefectCategory, str] = {
        "null_rate":
            "email is set to None on the affected docs; expected category emitted by the agent: "
            "'null_rate' / 'missing_field_rate' / 'null_or_missing_rate'.",
        "type_drift":
            "created_at is an ISO string instead of a datetime on the affected docs; "
            "expected category: 'type_mismatch' or 'type_drift'.",
        "enum_violation":
            "status carries off-list values (ACTV, deleted, ??, trial-2024); "
            "expected category: 'enum_violation' or 'low_cardinality_constant' "
            "(if the agent treats the legal set as the cardinality and the bogus as outliers).",
        "stale_timestamp":
            "last_active >2 years old on the affected docs; "
            "expected category: 'stale_timestamp' or 'stale_data'.",
        "outlier_value":
            "age has impossible values (9999, -1, 0, 250) on the affected docs; "
            "expected category: 'outlier_value' or 'out_of_range'.",
        "duplicates":
            "username repeats across roughly 25 'popular_user_NNN' clusters; "
            "expected category: 'duplicate_value' / 'duplicates' / 'non_unique'.",
    }
    return notes_map[category]


def seed_collection(
    *,
    connection_string: str,
    cosmos_account: str,
    database: str,
    collection: str,
    doc_count: int,
    seed: int,
    drop_existing: bool = True,
    batch_size: int = 500,
) -> GroundTruth:
    """Generate documents, insert them into the target collection, return ground truth.

    The collection is dropped first by default to keep runs idempotent — a
    re-run with the same seed produces exactly the same state. Pass
    ``drop_existing=False`` to append (the resulting collection won't match
    the returned ground-truth counts).
    """
    # Imported inside so the test path doesn't require pymongo to import the module.
    from pymongo import MongoClient

    docs, defects = generate_docs(doc_count=doc_count, seed=seed)

    client: MongoClient[dict[str, Any]] = MongoClient(connection_string)
    try:
        col = client[database][collection]
        if drop_existing:
            col.drop()
        for start in range(0, len(docs), batch_size):
            col.insert_many(docs[start:start + batch_size])
    finally:
        client.close()

    return GroundTruth(
        collection=collection,
        database=database,
        cosmos_account=cosmos_account,
        doc_count=doc_count,
        seed=seed,
        defects=defects,
        near_miss_fields=list(_NEAR_MISS_FIELDS),
    )


def _ground_truth_path() -> Path:
    return Path(__file__).resolve().parent / "ground_truth.json"


def main(argv: list[str] | None = None) -> int:
    import os
    parser = argparse.ArgumentParser(description="Seed the HITL experiment fixture.")
    parser.add_argument(
        "--connection-string",
        default=os.getenv("LOCAL_MONGO_URI"),
        help="MongoDB / Cosmos-for-MongoDB connection URI. Defaults to the "
             "LOCAL_MONGO_URI env var when set.",
    )
    parser.add_argument(
        "--cosmos-account",
        default=("local" if os.getenv("LOCAL_MONGO_URI") else None),
        help="ARM resource id of the Cosmos account — recorded in ground_truth.json "
             "so the harness can run the experiment under the same auth scope. "
             "In local mode, defaults to the sentinel 'local'.",
    )
    parser.add_argument("--database", required=True)
    parser.add_argument("--collection", required=True)
    parser.add_argument("--docs", type=int, default=15000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--keep-existing", action="store_true",
                        help="Do NOT drop the collection first. Use with care — counts will not "
                             "match the returned ground truth.")
    args = parser.parse_args(argv)
    if not args.connection_string:
        parser.error("--connection-string is required (or set LOCAL_MONGO_URI)")
    if not args.cosmos_account:
        parser.error("--cosmos-account is required (or set LOCAL_MONGO_URI for local mode)")

    truth = seed_collection(
        connection_string=args.connection_string,
        cosmos_account=args.cosmos_account,
        database=args.database,
        collection=args.collection,
        doc_count=args.docs,
        seed=args.seed,
        drop_existing=not args.keep_existing,
    )
    _ground_truth_path().write_text(truth.to_json(), encoding="utf-8")
    print(f"wrote {_ground_truth_path()}  ({len(truth.defects)} defect categories, "
          f"{truth.doc_count} docs, seed={truth.seed})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
