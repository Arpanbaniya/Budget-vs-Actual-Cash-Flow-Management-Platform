import asyncio
import json

import httpx
import pytest
from test_imports import COMPANY_A, auth

from app.config import Settings
from app.insights import fact_hash, groq_commentary, render_commentary

PACK = {
    "period": {"from": "2026-01-01", "to": "2026-09-30"},
    "cash_start_date": "2026-10-01",
    "currency": "NPR",
    "facts": [
        {"id": "revenue", "text": "Revenue actual 90 NPR; budget 100; variance -10."},
        {"id": "minimum", "text": "Minimum cash: 20 NPR."},
    ],
}


@pytest.mark.parametrize(
    "failure", ["none", "missing", "timeout", "429", "invalid", "invented", "extra", "oversized"]
)
def test_groq_success_and_all_failure_paths(monkeypatch, failure):
    original = httpx.AsyncClient

    def handle(request):
        assert request.url == "https://api.groq.com/openai/v1/chat/completions"
        payload = json.loads(request.content)
        assert "source_row" not in payload["messages"][1]["content"]
        if failure == "timeout":
            raise httpx.ReadTimeout("private provider error", request=request)
        if failure == "429":
            return httpx.Response(429, json={"error": "private"})
        content = {"fact_ids": ["minimum", "revenue"], "actions": ["payments"]}
        if failure == "invented":
            content["fact_ids"] = ["invented"]
        if failure == "extra":
            content["advice"] = "invented figures"
        if failure == "oversized":
            return httpx.Response(200, content=b"x" * 70000)
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": "bad json" if failure == "invalid" else json.dumps(content)
                        }
                    }
                ]
            },
        )

    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **kwargs: original(transport=httpx.MockTransport(handle), **kwargs),
    )
    settings = Settings(
        frontend_origins=("http://localhost:3000",),
        ai_provider="groq",
        groq_api_key=None if failure == "missing" else "test-key",
    )
    result = asyncio.run(groq_commentary(PACK, settings))
    if failure == "none":
        assert result.index("Minimum cash") < result.index("Revenue actual")
        assert "Review planned payment" in result
    else:
        assert result is None


def test_fallback_hash_and_private_cache(imports_api):
    env = imports_api
    payload = {
        "from": "2026-01-01",
        "to": "2026-09-30",
        "cash_start_date": "2026-10-01",
        "scenario_id": None,
    }
    path = f"/api/v1/companies/{COMPANY_A}/insights"
    first = env["client"].post(path, headers=auth(), json=payload)
    assert first.status_code == 200
    assert first.json()["provider"] == "deterministic" and first.json()["fallback_used"]
    assert "No opening cash" in first.json()["text"]
    assert env["client"].post(path, headers=auth(), json=payload).json()["cached"]
    assert env["client"].post(path, headers=auth("user-b"), json=payload).status_code == 404
    payload["cash_start_date"] = "2026-10-02"
    assert env["client"].post(path, headers=auth(), json=payload).json()["cached"] is False
    assert fact_hash(PACK, {}) == fact_hash(dict(reversed(list(PACK.items()))), {})
    assert "90 NPR" in render_commentary(PACK)


def test_unavailable_cache_does_not_break_fallback(imports_api):
    env = imports_api
    env["failures"]["GET /rest/v1/analysis_results"] = 503
    env["failures"]["POST /rest/v1/analysis_results"] = 503
    response = env["client"].post(
        f"/api/v1/companies/{COMPANY_A}/insights",
        headers=auth(),
        json={"from": "2026-01-01", "to": "2026-09-30", "cash_start_date": "2026-10-01"},
    )
    assert response.status_code == 200 and response.json()["fallback_used"]
