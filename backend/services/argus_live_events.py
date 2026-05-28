"""Per-job in-memory buffer of structured agent events for live progress polling.

Attached as a third observer alongside StructuredLogObserver + CostTracker on
each Argus run. Mirrors StructuredLogObserver's event shapes so the frontend
can render one timeline regardless of source.

Thread-safe: ArgusAgent.run is invoked via run_in_threadpool, so the FastAPI
request loop reads `snapshot()` from one thread while the worker thread writes
events from another.

Bounded by a ring buffer so a runaway agent cannot OOM the process; the live
view is for progress, not the system of record (the persisted AuditReport is).
"""

from __future__ import annotations

from collections import deque
from datetime import datetime, timezone
from threading import Lock
from typing import Any, Literal
from uuid import UUID

from queryargus.llm.client import TokenUsage
from queryargus.models.action import AgentAction
from queryargus.models.finding import Finding
from queryargus.models.report import AuditReport

_MAX_EVENTS_PER_JOB = 500


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat()


class LiveEventBuffer:
    def __init__(self) -> None:
        self._events: deque[dict[str, Any]] = deque(maxlen=_MAX_EVENTS_PER_JOB)
        self._lock = Lock()
        self._run_id: str | None = None
        self.current_iter = 0
        self.findings_count = 0
        self.input_tokens = 0
        self.output_tokens = 0
        self.last_action: str | None = None
        self.last_tool: str | None = None
        self.tool_errors = 0

    def _push(self, event: str, /, **extras: object) -> None:
        with self._lock:
            self._events.append(
                {"event": event, "run_id": self._run_id, "ts": _ts(), **extras}
            )

    def snapshot(self, since: int = 0) -> dict[str, Any]:
        with self._lock:
            evs = list(self._events)
            aggregates = {
                "current_iter": self.current_iter,
                "findings_count": self.findings_count,
                "input_tokens": self.input_tokens,
                "output_tokens": self.output_tokens,
                "last_action": self.last_action,
                "last_tool": self.last_tool,
                "tool_errors": self.tool_errors,
            }
        tail = evs[since:] if since < len(evs) else []
        return {"events": tail, "next_cursor": len(evs), "aggregates": aggregates}

    # RunObserver protocol -------------------------------------------------

    def on_run_start(self, *, run_id: UUID, collection: str) -> None:
        self._run_id = str(run_id)
        self._push("run_start", collection=collection)

    def on_iteration_start(self, *, iter: int) -> None:
        with self._lock:
            self.current_iter = iter
        self._push("iteration_start", iter=iter)

    def on_llm_call(
        self,
        *,
        purpose: Literal["propose_action", "self_eval", "judge"],
        model: str,
        usage: TokenUsage,
        latency_ms: int,
    ) -> None:
        with self._lock:
            self.input_tokens += usage.input_tokens
            self.output_tokens += usage.output_tokens
        self._push(
            "llm_call",
            purpose=purpose,
            model=model,
            input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens,
            latency_ms=latency_ms,
        )

    def on_tool_call(
        self,
        *,
        name: str,
        args_summary: str,
        ok: bool,
        latency_ms: int,
        error: str | None,
    ) -> None:
        with self._lock:
            self.last_tool = name
            if not ok:
                self.tool_errors += 1
        self._push(
            "tool_call",
            tool=name,
            args_summary=args_summary,
            ok=ok,
            latency_ms=latency_ms,
            error=error,
        )

    def on_action(self, *, action: AgentAction) -> None:
        with self._lock:
            self.last_action = action.action
        self._push("action", action=action.action, confidence=action.confidence)

    def on_finding(self, *, finding: Finding) -> None:
        with self._lock:
            self.findings_count += 1
        self._push(
            "finding",
            field=finding.field,
            category=finding.category,
            severity=str(finding.severity),
        )

    def on_eval(
        self,
        *,
        target: Literal["action", "finding", "run"],
        verdict: str,
        score: float,
        evaluator: str,
    ) -> None:
        self._push(
            "eval", target=target, verdict=verdict, score=score, evaluator=evaluator
        )

    def on_run_complete(self, *, report: AuditReport) -> None:
        self._push(
            "run_complete",
            findings_count=len(report.findings),
            duration_ms=int(report.duration_seconds * 1000),
            usd_total=(report.cost.usd_total if report.cost is not None else None),
        )
