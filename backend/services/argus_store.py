"""Process-wide accessor for QueryArgus's ReportStore.

Builds a libpq DSN from the same DB_* env vars QueryPal already uses
(``services.pg_connection``). Returns ``None`` when DB vars are absent so local
dev without Postgres keeps working — matches QueryArgus's "storage is optional"
contract.

The first call applies the upstream schema (idempotent ``CREATE TABLE IF NOT
EXISTS``) and then runs additive ALTERs for QueryPal-specific columns we don't
want to fork into the upstream ``schema.sql``.
"""

from __future__ import annotations

import logging
from typing import Optional

import psycopg2

from queryargus.storage.postgres import ReportStore
from services.pg_connection import (
    DB_HOST,
    DB_NAME,
    DB_PASS,
    DB_PORT,
    DB_UNIX_SOCKET,
    DB_USER,
)

logger = logging.getLogger(__name__)

_store: Optional[ReportStore] = None
_initialised = False


def _build_dsn() -> Optional[str]:
    if not DB_NAME or not DB_USER:
        return None
    host = DB_UNIX_SOCKET or DB_HOST
    if not host:
        return None
    parts = [
        f"dbname={DB_NAME}",
        f"user={DB_USER}",
        f"password={DB_PASS}",
        f"host={host}",
    ]
    # Unix socket connections must not pass port=
    if not DB_UNIX_SOCKET and DB_PORT:
        parts.append(f"port={DB_PORT}")
    return " ".join(parts)


def _apply_querypal_columns(dsn: str) -> None:
    """Additive ALTERs + QueryPal-only tables that don't belong in upstream DDL."""
    with psycopg2.connect(dsn) as conn, conn.cursor() as cur:
        cur.execute(
            "ALTER TABLE argus_reports " "ADD COLUMN IF NOT EXISTS created_by TEXT"
        )
        # Arm A (post-hoc rating) audit trail — who labelled a finding and when.
        # The label itself lives in upstream argus_findings.user_label; these two
        # columns are QueryPal-specific so we don't fork upstream schema.sql.
        cur.execute(
            "ALTER TABLE argus_findings "
            "ADD COLUMN IF NOT EXISTS rated_by TEXT"
        )
        cur.execute(
            "ALTER TABLE argus_findings "
            "ADD COLUMN IF NOT EXISTS rated_at TIMESTAMPTZ"
        )
        # Arm B (self-escalation) audit trail — when a finding was queued for
        # human review and when the human resolved it. ``status`` itself is
        # upstream on this branch (see submodule schema.sql).
        cur.execute(
            "ALTER TABLE argus_findings "
            "ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ"
        )
        cur.execute(
            "ALTER TABLE argus_findings "
            "ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ"
        )
        # Per-user saved custom profiles (Tier 4). Per-user scoping only — no
        # team sharing in v1. Reference to argus_reports is intentionally absent;
        # deleting a profile must not break reproducibility of past reports.
        cur.execute("""
            CREATE TABLE IF NOT EXISTS argus_profiles (
                id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_email          TEXT NOT NULL,
                name                TEXT NOT NULL,
                base_profile        TEXT NOT NULL,
                evaluator_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
                argus_overrides     JSONB NOT NULL DEFAULT '{}'::jsonb,
                created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (user_email, name)
            )
            """)


def get_report_store() -> Optional[ReportStore]:
    """Return a shared ReportStore, or None when PG is not configured."""
    global _store, _initialised
    if _initialised:
        return _store
    _initialised = True
    dsn = _build_dsn()
    if dsn is None:
        logger.info("argus report store disabled (DB env vars missing)")
        return None
    try:
        store = ReportStore(dsn)
        store.init_schema()
        _apply_querypal_columns(dsn)
        _store = store
        logger.info("argus schema applied")
    except Exception:
        logger.exception("argus report store init failed")
        _store = None
    return _store


def set_report_created_by(report_id: str, email: str) -> None:
    """Record who triggered a run. Best-effort — logs on failure."""
    dsn = _build_dsn()
    if dsn is None:
        return
    try:
        with psycopg2.connect(dsn) as conn, conn.cursor() as cur:
            cur.execute(
                "UPDATE argus_reports SET created_by = %s WHERE id = %s",
                (email, report_id),
            )
    except Exception:
        logger.exception("failed to set created_by on report %s", report_id)


def set_finding_rating(
    *,
    report_id: str,
    finding_id: str,
    label: str,
    rated_by: str,
) -> bool:
    """Persist a human reviewer's verdict on a finding (Arm A — post-hoc rating).

    Writes both the upstream ``argus_findings.user_label`` column (via the
    store, which also patches ``raw_report`` JSONB) and the QueryPal-only
    ``rated_by`` / ``rated_at`` audit columns. Returns ``True`` when the
    finding was found and updated, ``False`` when no such finding exists
    under that report (e.g. typo, deleted, or wrong report).
    """
    if label not in ("tp", "fp"):
        raise ValueError(f"invalid label {label!r}; expected 'tp' or 'fp'")
    store = get_report_store()
    if store is None:
        return False
    from uuid import UUID

    ok = store.update_user_label(
        report_id=UUID(report_id),
        finding_id=UUID(finding_id),
        label=label,  # type: ignore[arg-type]
    )
    if not ok:
        return False
    dsn = _build_dsn()
    if dsn is None:
        # update_user_label succeeded, but we have no separate DSN to record
        # the audit trail — surface as success since the verdict is stored.
        return True
    try:
        with psycopg2.connect(dsn) as conn, conn.cursor() as cur:
            cur.execute(
                """
                UPDATE argus_findings
                SET rated_by = %s, rated_at = NOW()
                WHERE id = %s AND report_id = %s
                """,
                (rated_by, finding_id, report_id),
            )
    except Exception:
        logger.exception(
            "failed to record rating audit trail for finding %s on report %s",
            finding_id,
            report_id,
        )
    return True


def fetch_report_created_by(report_id: str) -> Optional[str]:
    dsn = _build_dsn()
    if dsn is None:
        return None
    try:
        with psycopg2.connect(dsn) as conn, conn.cursor() as cur:
            cur.execute(
                "SELECT created_by FROM argus_reports WHERE id = %s",
                (report_id,),
            )
            row = cur.fetchone()
            return row[0] if row else None
    except Exception:
        logger.exception("failed to fetch created_by for report %s", report_id)
        return None


def fetch_pending_escalations(
    *,
    cosmos_accounts: list[str],
    limit: int = 100,
) -> list[dict]:
    """List findings currently in status='pending_review', scoped by account access.

    Returns rows pre-shaped for the HTTP response — each carries enough context
    (collection, database, finding fields, confidence) for the UI to render the
    review modal without a second fetch.
    """
    if not cosmos_accounts:
        return []
    dsn = _build_dsn()
    if dsn is None:
        return []
    sql = """
        SELECT f.id, f.report_id, r.collection, r.database, r.cosmos_account,
               f.field, f.category, f.severity, f.description, f.hypothesis,
               f.evidence_query, f.affected_count, f.affected_pct,
               f.confidence, f.confidence_reason, f.sample_values,
               f.created_at, f.escalated_at
        FROM argus_findings f
        JOIN argus_reports r ON f.report_id = r.id
        WHERE f.status = 'pending_review'
          AND r.cosmos_account = ANY(%s)
        ORDER BY COALESCE(f.escalated_at, f.created_at) DESC
        LIMIT %s
    """
    try:
        with psycopg2.connect(dsn) as conn, conn.cursor() as cur:
            cur.execute(sql, (cosmos_accounts, limit))
            rows = cur.fetchall()
    except Exception:
        logger.exception("failed to list pending escalations")
        return []
    return [
        {
            "finding_id": str(row[0]),
            "report_id": str(row[1]),
            "collection": row[2],
            "database": row[3],
            "cosmos_account": row[4],
            "field": row[5],
            "category": row[6],
            "severity": row[7],
            "description": row[8],
            "hypothesis": row[9],
            "evidence_query": row[10],
            "affected_count": int(row[11] or 0),
            "affected_pct": float(row[12] or 0.0),
            "confidence": float(row[13]) if row[13] is not None else None,
            "confidence_reason": row[14],
            "sample_values": row[15] or [],
            "created_at": row[16].isoformat() if row[16] else None,
            "escalated_at": row[17].isoformat() if row[17] else None,
        }
        for row in rows
    ]


def resolve_escalation(
    *,
    report_id: str,
    finding_id: str,
    verdict: str,
    resolved_by: str,
) -> bool:
    """Persist a human's resolution of a pending_review finding (Arm B).

    Bridges the submodule's ``ReportStore.resolve_pending_finding`` (which flips
    ``status`` + writes ``user_label`` + patches raw_report) with the QueryPal-only
    ``resolved_at`` / ``rated_by`` / ``rated_at`` audit columns.

    Returns ``True`` when the finding was found and resolved, ``False`` otherwise
    (e.g. finding does not exist or is no longer in pending_review).
    """
    if verdict not in ("tp", "fp", "need_info"):
        raise ValueError(f"invalid verdict {verdict!r}; expected 'tp' | 'fp' | 'need_info'")
    store = get_report_store()
    if store is None:
        return False
    from uuid import UUID

    ok = store.resolve_pending_finding(
        report_id=UUID(report_id),
        finding_id=UUID(finding_id),
        verdict=verdict,
    )
    if not ok:
        return False
    # need_info is a non-decision — skip the audit-column write.
    if verdict == "need_info":
        return True
    dsn = _build_dsn()
    if dsn is None:
        return True
    try:
        with psycopg2.connect(dsn) as conn, conn.cursor() as cur:
            cur.execute(
                """
                UPDATE argus_findings
                SET rated_by = %s, rated_at = NOW(), resolved_at = NOW()
                WHERE id = %s AND report_id = %s
                """,
                (resolved_by, finding_id, report_id),
            )
    except Exception:
        logger.exception(
            "failed to record resolution audit trail for finding %s on report %s",
            finding_id,
            report_id,
        )
    return True


def fetch_run_summaries(
    *,
    cosmos_accounts: list[str],
    database: Optional[str],
    collection: Optional[str],
    limit: int,
) -> list[dict]:
    """List recent runs scoped to the caller's accessible Cosmos accounts.

    Returns a list of dicts already shaped for the HTTP response. Empty list when
    PG is not configured or when ``cosmos_accounts`` is empty.
    """
    if not cosmos_accounts:
        return []
    dsn = _build_dsn()
    if dsn is None:
        return []
    clauses = ["r.cosmos_account = ANY(%s)"]
    args: list = [cosmos_accounts]
    if database:
        clauses.append("r.database = %s")
        args.append(database)
    if collection:
        clauses.append("r.collection = %s")
        args.append(collection)
    where = " AND ".join(clauses)
    # Severity buckets follow the same mapping as routes/argus.py _SEVERITY_UI:
    # critical -> critical, high -> warning, medium|low -> info.
    sql = f"""
        SELECT r.id, r.collection, r.database, r.cosmos_account, r.run_at,
               r.overall_quality_score, r.run_eval_verdict,
               r.total_input_tokens, r.total_output_tokens, r.created_by,
               COALESCE(fc.total, 0)    AS findings_count,
               COALESCE(fc.critical, 0) AS critical_count,
               COALESCE(fc.warning, 0)  AS warning_count,
               COALESCE(fc.info, 0)     AS info_count
        FROM argus_reports r
        LEFT JOIN (
            SELECT report_id,
                   COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE severity = 'critical') AS critical,
                   COUNT(*) FILTER (WHERE severity = 'high')     AS warning,
                   COUNT(*) FILTER (WHERE severity IN ('medium','low')) AS info
            FROM argus_findings
            GROUP BY report_id
        ) fc ON fc.report_id = r.id
        WHERE {where}
        ORDER BY r.run_at DESC
        LIMIT %s
    """
    args.append(limit)
    try:
        with psycopg2.connect(dsn) as conn, conn.cursor() as cur:
            cur.execute(sql, args)
            rows = cur.fetchall()
    except Exception:
        logger.exception("failed to list argus runs")
        return []
    return [
        {
            "report_id": str(row[0]),
            "collection": row[1],
            "database": row[2],
            "cosmos_account": row[3],
            "run_at": row[4].isoformat() if row[4] else None,
            "quality_score": (round(row[5] * 100) if row[5] is not None else None),
            "run_eval_verdict": row[6],
            "total_tokens": int(row[7] or 0) + int(row[8] or 0),
            "created_by": row[9],
            "findings_count": int(row[10] or 0),
            "counts": {
                "critical": int(row[11] or 0),
                "warning": int(row[12] or 0),
                "info": int(row[13] or 0),
            },
        }
        for row in rows
    ]
