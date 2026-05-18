"""Tests for the Arm B escalation queue (`GET /argus/escalations`,
`POST /argus/escalations/.../resolve`).

Exercises the auth + account-scope checks against a faked ``ReportStore`` so
no real Postgres or Azure dependency is needed.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID, uuid4

import pytest


@dataclass
class _FakeReport:
    cosmos_account: str
    id: UUID


class _FakeStore:
    def __init__(self, report: _FakeReport | None) -> None:
        self._report = report

    def get(self, report_id: UUID) -> _FakeReport | None:
        if self._report is None or self._report.id != report_id:
            return None
        return self._report


@pytest.fixture
def auth_header() -> dict[str, str]:
    return {"authorization": "Bearer fake-token"}


# ---- GET /argus/escalations -----------------------------------------------


def test_list_escalations_returns_rows_for_accessible_accounts(
    client, auth_header, monkeypatch
) -> None:  # type: ignore[no-untyped-def]
    monkeypatch.setattr("routes.argus.exchange_token_obo", lambda _t: "arm-token")
    monkeypatch.setattr(
        "routes.argus._accessible_account_ids",
        lambda _t: ["/subscriptions/s/acct-a", "/subscriptions/s/acct-b"],
    )
    fake_rows = [
        {
            "finding_id": "f1", "report_id": "r1",
            "collection": "c", "database": "d",
            "cosmos_account": "/subscriptions/s/acct-a",
            "field": "email", "category": "null_rate", "severity": "high",
            "description": "...", "hypothesis": "...", "evidence_query": "...",
            "affected_count": 30, "affected_pct": 0.3,
            "confidence": 0.6, "confidence_reason": "borderline",
            "sample_values": [], "created_at": None, "escalated_at": None,
        }
    ]
    seen_args: dict[str, Any] = {}

    def _fetch(**kwargs: Any) -> list[dict[str, Any]]:
        seen_args.update(kwargs)
        return fake_rows

    monkeypatch.setattr("routes.argus.fetch_pending_escalations", _fetch)

    resp = client.get("/argus/escalations", headers=auth_header)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["escalations"] == fake_rows
    # Caller's accessible accounts must be the scope passed to the helper.
    assert seen_args["cosmos_accounts"] == [
        "/subscriptions/s/acct-a",
        "/subscriptions/s/acct-b",
    ]


def test_list_escalations_returns_empty_when_caller_has_no_access(
    client, auth_header, monkeypatch
) -> None:  # type: ignore[no-untyped-def]
    monkeypatch.setattr("routes.argus.exchange_token_obo", lambda _t: "arm-token")
    monkeypatch.setattr("routes.argus._accessible_account_ids", lambda _t: [])
    # Helper should NOT be called when accessible is empty (no point).
    called = {"hit": False}

    def _fetch(**_: Any) -> list[Any]:
        called["hit"] = True
        return []

    monkeypatch.setattr("routes.argus.fetch_pending_escalations", _fetch)

    resp = client.get("/argus/escalations", headers=auth_header)
    assert resp.status_code == 200
    assert resp.json() == {"escalations": []}
    assert called["hit"] is False


def test_list_escalations_rejects_non_bearer_auth(client) -> None:  # type: ignore[no-untyped-def]
    resp = client.get("/argus/escalations", headers={"authorization": "Basic foo"})
    assert resp.status_code == 401


# ---- POST /argus/escalations/.../resolve -----------------------------------


def _patch_resolve(
    monkeypatch: pytest.MonkeyPatch,
    *,
    email: str | None,
    accessible: list[str],
    store: _FakeStore | None,
    resolve_ok: bool = True,
) -> dict[str, Any]:
    calls: dict[str, Any] = {"resolve_args": None}
    monkeypatch.setattr("routes.argus.extract_email_from_token", lambda _t: email)
    monkeypatch.setattr("routes.argus.exchange_token_obo", lambda _t: "arm-token")
    monkeypatch.setattr("routes.argus._accessible_account_ids", lambda _t: accessible)
    monkeypatch.setattr("routes.argus.get_report_store", lambda: store)

    def _resolve(**kwargs: Any) -> bool:
        calls["resolve_args"] = kwargs
        return resolve_ok

    monkeypatch.setattr("routes.argus.resolve_escalation", _resolve)
    return calls


def test_resolve_pending_writes_verdict_for_accessible_caller(
    client, auth_header, monkeypatch
) -> None:  # type: ignore[no-untyped-def]
    report_id = uuid4()
    finding_id = uuid4()
    report = _FakeReport(cosmos_account="/subscriptions/s/acct", id=report_id)
    calls = _patch_resolve(
        monkeypatch,
        email="alice@example.com",
        accessible=[report.cosmos_account],
        store=_FakeStore(report),
    )

    resp = client.post(
        f"/argus/escalations/{report_id}/{finding_id}/resolve",
        headers=auth_header,
        json={"verdict": "tp"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["verdict"] == "tp"
    assert body["resolved_by"] == "alice@example.com"
    assert calls["resolve_args"]["report_id"] == str(report_id)
    assert calls["resolve_args"]["finding_id"] == str(finding_id)
    assert calls["resolve_args"]["verdict"] == "tp"


def test_resolve_pending_returns_404_for_inaccessible_account(
    client, auth_header, monkeypatch
) -> None:  # type: ignore[no-untyped-def]
    report_id = uuid4()
    finding_id = uuid4()
    report = _FakeReport(cosmos_account="/subscriptions/s/other", id=report_id)
    _patch_resolve(
        monkeypatch,
        email="bob@example.com",
        accessible=["/subscriptions/s/MY-acct"],
        store=_FakeStore(report),
    )

    resp = client.post(
        f"/argus/escalations/{report_id}/{finding_id}/resolve",
        headers=auth_header,
        json={"verdict": "fp"},
    )
    assert resp.status_code == 404


def test_resolve_pending_returns_404_when_already_resolved(
    client, auth_header, monkeypatch
) -> None:  # type: ignore[no-untyped-def]
    """resolve_escalation returns False when finding is no longer pending → 404."""
    report_id = uuid4()
    finding_id = uuid4()
    report = _FakeReport(cosmos_account="/subscriptions/s/acct", id=report_id)
    _patch_resolve(
        monkeypatch,
        email="alice@example.com",
        accessible=[report.cosmos_account],
        store=_FakeStore(report),
        resolve_ok=False,
    )

    resp = client.post(
        f"/argus/escalations/{report_id}/{finding_id}/resolve",
        headers=auth_header,
        json={"verdict": "tp"},
    )
    assert resp.status_code == 404


def test_resolve_pending_rejects_invalid_verdict(
    client, auth_header, monkeypatch
) -> None:  # type: ignore[no-untyped-def]
    report_id = uuid4()
    finding_id = uuid4()
    report = _FakeReport(cosmos_account="/subscriptions/s/acct", id=report_id)
    _patch_resolve(
        monkeypatch,
        email="alice@example.com",
        accessible=[report.cosmos_account],
        store=_FakeStore(report),
    )
    resp = client.post(
        f"/argus/escalations/{report_id}/{finding_id}/resolve",
        headers=auth_header,
        json={"verdict": "delete"},  # not in Literal['tp','fp','need_info']
    )
    assert resp.status_code == 422
