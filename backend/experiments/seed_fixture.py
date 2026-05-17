"""Seed a synthetic Cosmos collection with known defects for the HITL experiment.

The collection contains a mix of well-formed documents, deliberately
defective documents, and "near-miss" documents that look like they might
be defective but are not. Each seeded defect is recorded in
``ground_truth.json`` keyed by ``(field, category)`` so the oracle can
later label findings as TP / FP.

This module is intentionally idempotent for a given ``--seed`` — re-running
with the same seed against the same collection name re-creates exactly the
same documents.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Literal

DefectCategory = Literal[
    "null_rate",
    "type_drift",
    "enum_violation",
    "stale_timestamp",
    "orphan_fk",
    "duplicate",
]


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


def seed_collection(
    *,
    cosmos_account: str,
    database: str,
    collection: str,
    doc_count: int,
    seed: int,
) -> GroundTruth:
    """Generate documents, insert them into Cosmos, and return the ground truth.

    Must be deterministic for a given ``seed``.
    """
    raise NotImplementedError("scaffolding — implement in step 1 of the harness build-out")


def _ground_truth_path() -> Path:
    return Path(__file__).resolve().parent / "ground_truth.json"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Seed the HITL experiment fixture.")
    parser.add_argument("--cosmos-account", required=True)
    parser.add_argument("--database", required=True)
    parser.add_argument("--collection", required=True)
    parser.add_argument("--docs", type=int, default=15000)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args(argv)

    truth = seed_collection(
        cosmos_account=args.cosmos_account,
        database=args.database,
        collection=args.collection,
        doc_count=args.docs,
        seed=args.seed,
    )
    _ground_truth_path().write_text(truth.to_json(), encoding="utf-8")
    print(f"wrote {_ground_truth_path()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
