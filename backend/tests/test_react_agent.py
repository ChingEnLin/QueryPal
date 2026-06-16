"""Unit tests for the ReAct agent's clarification (triage) gate.

These tests exercise triage_node / after_triage in isolation by mocking the
Gemini client, so no real API calls are made (GEMINI_API_KEY is mocked in CI).
"""

import json
from unittest.mock import Mock, patch

from langgraph.graph import END

from services.react_agent_service import after_triage, triage_node


def _mock_response(payload: dict) -> Mock:
    """Build a fake Gemini response whose .text is JSON and .parsed is falsy.

    triage_node prefers response.parsed when truthy, otherwise json.loads(text).
    We force the json.loads path for deterministic, dependency-free tests.
    """
    resp = Mock()
    resp.parsed = None
    resp.text = json.dumps(payload)
    return resp


BASE_STATE = {
    "user_input": "show me stuff",
    "database": "appdb",
    "collections": ["room", "device"],
    "schema_context": "Collection: room ...",
    "relationship_context": "",
    "intermediate_context": None,
    "enable_clarification": True,
    "model": "gemini-2.5-flash",
}


@patch("services.react_agent_service.client")
def test_triage_flags_vague_request(mock_client):
    """A vague request yields needs_clarification with concrete questions."""
    mock_client.models.generate_content.return_value = _mock_response(
        {
            "needs_clarification": True,
            "questions": ["Which collection do you mean by 'stuff'?"],
        }
    )

    result = triage_node({**BASE_STATE, "user_input": "show me stuff"})

    assert result["needs_clarification"] is True
    assert result["clarifying_questions"] == [
        "Which collection do you mean by 'stuff'?"
    ]


@patch("services.react_agent_service.client")
def test_triage_passes_clear_request(mock_client):
    """A clear request proceeds with no questions."""
    mock_client.models.generate_content.return_value = _mock_response(
        {"needs_clarification": False, "questions": []}
    )

    result = triage_node({**BASE_STATE, "user_input": "find all rooms created in 2025"})

    assert result["needs_clarification"] is False
    assert result["clarifying_questions"] == []


@patch("services.react_agent_service.client")
def test_triage_disabled_skips_llm(mock_client):
    """When the gate is disabled, no LLM call is made and we proceed."""
    result = triage_node({**BASE_STATE, "enable_clarification": False})

    assert result["needs_clarification"] is False
    assert result["clarifying_questions"] == []
    mock_client.models.generate_content.assert_not_called()


@patch("services.react_agent_service.client")
def test_triage_true_without_questions_proceeds(mock_client):
    """A 'needs clarification' verdict with no questions is useless → proceed."""
    mock_client.models.generate_content.return_value = _mock_response(
        {"needs_clarification": True, "questions": []}
    )

    result = triage_node(BASE_STATE)

    assert result["needs_clarification"] is False
    assert result["clarifying_questions"] == []


@patch("services.react_agent_service.client")
def test_triage_fails_open_on_error(mock_client):
    """Triage must never block generation: an exception fails open."""
    mock_client.models.generate_content.side_effect = RuntimeError("API down")

    result = triage_node(BASE_STATE)

    assert result["needs_clarification"] is False
    assert result["clarifying_questions"] == []


def test_after_triage_routes_to_end_when_clarifying():
    assert after_triage({"needs_clarification": True}) == END


def test_after_triage_routes_to_generate_when_clear():
    assert after_triage({"needs_clarification": False}) == "generate_query_node"
