"""Tests for the Arm A finding-rating endpoint (`POST /argus/findings/.../rate`).

These exercise the route's auth + account-scope checks against a faked
``ReportStore`` so no real Postgres or Azure dependency is needed.
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


def _patch_common(
    monkeypatch: pytest.MonkeyPatch,
    *,
    email: str | None,
    accessible: list[str],
    store: _FakeStore | None,
    rating_ok: bool = True,
) -> dict[str, Any]:
    """Patch out auth + storage so the route test runs without real deps."""
    calls: dict[str, Any] = {"rate_args": None}

    from services.azure_auth import TokenClaims

    monkeypatch.setattr(
        "services.rbac.extract_claims_from_token",
        lambda _t: TokenClaims(email=email, roles=["Analyst"]),
    )
    monkeypatch.setattr("routes.argus.exchange_token_obo", lambda _t: "arm-token")
    monkeypatch.setattr("routes.argus._accessible_account_ids", lambda _t: accessible)
    monkeypatch.setattr("routes.argus.get_report_store", lambda: store)

    def _rate(**kwargs: Any) -> bool:
        calls["rate_args"] = kwargs
        return rating_ok

    monkeypatch.setattr("routes.argus.set_finding_rating", _rate)
    return calls


def test_rate_finding_writes_label_when_caller_has_access(
    client, auth_header, monkeypatch
) -> None:  # type: ignore[no-untyped-def]
    report_id = uuid4()
    finding_id = uuid4()
    report = _FakeReport(cosmos_account="/subscriptions/s/acct", id=report_id)
    calls = _patch_common(
        monkeypatch,
        email="alice@example.com",
        accessible=[report.cosmos_account],
        store=_FakeStore(report),
    )

    resp = client.post(
        f"/argus/findings/{report_id}/{finding_id}/rate",
        headers=auth_header,
        json={"label": "fp"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["user_label"] == "fp"
    assert body["rated_by"] == "alice@example.com"
    # Verify the rating helper received the right args (preserves report/finding id).
    assert calls["rate_args"]["report_id"] == str(report_id)
    assert calls["rate_args"]["finding_id"] == str(finding_id)
    assert calls["rate_args"]["label"] == "fp"
    assert calls["rate_args"]["rated_by"] == "alice@example.com"


def test_rate_finding_returns_404_for_inaccessible_account(
    client, auth_header, monkeypatch
) -> None:  # type: ignore[no-untyped-def]
    """Cross-tenant attempts get 404, not 403 — same existence-leak guard as get_report."""
    report_id = uuid4()
    finding_id = uuid4()
    report = _FakeReport(cosmos_account="/subscriptions/s/other-acct", id=report_id)
    _patch_common(
        monkeypatch,
        email="bob@example.com",
        accessible=["/subscriptions/s/MY-acct"],  # caller cannot see 'other-acct'
        store=_FakeStore(report),
    )

    resp = client.post(
        f"/argus/findings/{report_id}/{finding_id}/rate",
        headers=auth_header,
        json={"label": "tp"},
    )
    assert resp.status_code == 404


def test_rate_finding_returns_404_when_report_missing(
    client, auth_header, monkeypatch
) -> None:  # type: ignore[no-untyped-def]
    report_id = uuid4()
    finding_id = uuid4()
    _patch_common(
        monkeypatch,
        email="alice@example.com",
        accessible=["/anything"],
        store=_FakeStore(None),  # store.get returns None
    )

    resp = client.post(
        f"/argus/findings/{report_id}/{finding_id}/rate",
        headers=auth_header,
        json={"label": "tp"},
    )
    assert resp.status_code == 404


def test_rate_finding_returns_404_when_finding_missing(
    client, auth_header, monkeypatch
) -> None:  # type: ignore[no-untyped-def]
    report_id = uuid4()
    finding_id = uuid4()
    report = _FakeReport(cosmos_account="/subscriptions/s/acct", id=report_id)
    _patch_common(
        monkeypatch,
        email="alice@example.com",
        accessible=[report.cosmos_account],
        store=_FakeStore(report),
        rating_ok=False,  # finding doesn't exist under this report
    )

    resp = client.post(
        f"/argus/findings/{report_id}/{finding_id}/rate",
        headers=auth_header,
        json={"label": "tp"},
    )
    assert resp.status_code == 404


def test_rate_finding_rejects_invalid_label(
    client, auth_header, monkeypatch
) -> None:  # type: ignore[no-untyped-def]
    """Pydantic Literal rejects anything other than 'tp' | 'fp' with 422."""
    report_id = uuid4()
    finding_id = uuid4()
    report = _FakeReport(cosmos_account="/subscriptions/s/acct", id=report_id)
    _patch_common(
        monkeypatch,
        email="alice@example.com",
        accessible=[report.cosmos_account],
        store=_FakeStore(report),
    )

    resp = client.post(
        f"/argus/findings/{report_id}/{finding_id}/rate",
        headers=auth_header,
        json={"label": "maybe"},
    )
    assert resp.status_code == 422


def test_rate_finding_requires_bearer_token(client) -> None:  # type: ignore[no-untyped-def]
    resp = client.post(
        f"/argus/findings/{uuid4()}/{uuid4()}/rate",
        headers={"authorization": "Basic foo"},
        json={"label": "tp"},
    )
    # _require_caller_email rejects non-Bearer formats with 401.
    assert resp.status_code == 401
