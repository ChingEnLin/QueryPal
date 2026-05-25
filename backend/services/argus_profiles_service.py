"""CRUD for per-user QueryArgus run profiles (Tier 4 — saved custom profiles)."""

from __future__ import annotations

import json
import logging
import uuid
from typing import Any, Literal, Optional

import psycopg2
from psycopg2.errors import UniqueViolation

from services.argus_store import _build_dsn

logger = logging.getLogger(__name__)

BaseProfile = Literal["fast", "balanced", "thorough"]


def list_profiles(user_email: str) -> list[dict[str, Any]]:
    dsn = _build_dsn()
    if dsn is None:
        return []
    try:
        with psycopg2.connect(dsn) as conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, base_profile, evaluator_overrides, argus_overrides, created_at
                FROM argus_profiles
                WHERE user_email = %s
                ORDER BY created_at DESC
                """,
                (user_email,),
            )
            rows = cur.fetchall()
    except Exception:
        logger.exception("failed to list profiles for %s", user_email)
        return []
    return [
        {
            "id": str(r[0]),
            "name": r[1],
            "base_profile": r[2],
            "evaluator_overrides": r[3] or {},
            "argus_overrides": r[4] or {},
            "created_at": r[5].isoformat() if r[5] else None,
        }
        for r in rows
    ]


class ProfileNameConflict(Exception):
    """Raised when (user_email, name) already exists."""


def create_profile(
    *,
    user_email: str,
    name: str,
    base_profile: BaseProfile,
    evaluator_overrides: dict[str, Any],
    argus_overrides: dict[str, Any],
) -> Optional[dict[str, Any]]:
    dsn = _build_dsn()
    if dsn is None:
        return None
    try:
        with psycopg2.connect(dsn) as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO argus_profiles
                    (user_email, name, base_profile, evaluator_overrides, argus_overrides)
                VALUES (%s, %s, %s, %s::jsonb, %s::jsonb)
                RETURNING id, created_at
                """,
                (
                    user_email,
                    name,
                    base_profile,
                    json.dumps(evaluator_overrides),
                    json.dumps(argus_overrides),
                ),
            )
            row = cur.fetchone()
    except UniqueViolation as exc:
        raise ProfileNameConflict(name) from exc
    except Exception:
        logger.exception("failed to create profile %s for %s", name, user_email)
        return None
    if row is None:
        return None
    return {
        "id": str(row[0]),
        "name": name,
        "base_profile": base_profile,
        "evaluator_overrides": evaluator_overrides,
        "argus_overrides": argus_overrides,
        "created_at": row[1].isoformat() if row[1] else None,
    }


def delete_profile(*, profile_id: str, user_email: str) -> bool:
    dsn = _build_dsn()
    if dsn is None:
        return False
    try:
        profile_uuid = uuid.UUID(profile_id)
    except ValueError:
        return False
    try:
        with psycopg2.connect(dsn) as conn, conn.cursor() as cur:
            cur.execute(
                "DELETE FROM argus_profiles WHERE id = %s AND user_email = %s",
                (profile_uuid, user_email),
            )
            return cur.rowcount > 0
    except Exception:
        logger.exception("failed to delete profile %s for %s", profile_id, user_email)
        return False


def get_profile_for_user(
    *, profile_id: str, user_email: str
) -> Optional[dict[str, Any]]:
    """Fetch a profile only if it belongs to the caller. Returns None otherwise."""
    dsn = _build_dsn()
    if dsn is None:
        return None
    try:
        profile_uuid = uuid.UUID(profile_id)
    except ValueError:
        return None
    try:
        with psycopg2.connect(dsn) as conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, name, base_profile, evaluator_overrides, argus_overrides
                FROM argus_profiles
                WHERE id = %s AND user_email = %s
                """,
                (profile_uuid, user_email),
            )
            row = cur.fetchone()
    except Exception:
        logger.exception("failed to fetch profile %s for %s", profile_id, user_email)
        return None
    if row is None:
        return None
    return {
        "id": str(row[0]),
        "name": row[1],
        "base_profile": row[2],
        "evaluator_overrides": row[3] or {},
        "argus_overrides": row[4] or {},
    }
