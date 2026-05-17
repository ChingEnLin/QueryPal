"""Summarise per-run snapshots across all arms × seeds × runs.

Reads ``results/<arm>/seed_<n>/run_<i>.json`` produced by ``harness.py``
and emits ``results/summary.md`` with:

- a per-arm × per-run table of precision / recall / F1 (mean ± per-seed range)
- token cost per arm
- simulated human-seconds per arm
- a reliability curve (predicted-confidence-bucket vs observed-precision) for arm B
"""

from __future__ import annotations

import argparse
from pathlib import Path


def summarize(results_dir: Path) -> str:
    """Walk ``results_dir`` and return the Markdown summary as a string."""
    raise NotImplementedError("scaffolding — implement once metrics.py is producing RunMetrics")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Summarise HITL experiment results.")
    parser.add_argument(
        "results_dir",
        type=Path,
        help="path to the results/ directory produced by harness.py",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help="output Markdown path (default: <results_dir>/summary.md)",
    )
    args = parser.parse_args(argv)
    markdown = summarize(args.results_dir)
    out = args.output or (args.results_dir / "summary.md")
    out.write_text(markdown, encoding="utf-8")
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
