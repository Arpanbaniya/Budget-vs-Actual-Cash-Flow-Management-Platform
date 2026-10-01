import json
import logging

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import Settings
from app.errors import ApiError
from app.main import create_app
from app.structured_logging import JsonFormatter


@pytest.mark.parametrize("value", ["0", "6", "1.5"])
def test_import_limit_cannot_exceed_hard_ceiling(monkeypatch, value):
    monkeypatch.setenv("MAX_IMPORT_MB", value)
    with pytest.raises(ValueError):
        Settings.from_environment()


def test_import_limit_from_environment(monkeypatch):
    monkeypatch.setenv("MAX_IMPORT_MB", "2")
    assert Settings.from_environment().max_import_mb == 2


def test_cors_uses_only_configured_origins(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FRONTEND_ORIGINS", "https://flow-forecast.vercel.app")
    client = TestClient(create_app())

    allowed = client.get("/api/v1/health", headers={"Origin": "https://flow-forecast.vercel.app"})
    blocked = client.get("/api/v1/health", headers={"Origin": "https://other.example"})

    assert allowed.headers["access-control-allow-origin"] == "https://flow-forecast.vercel.app"
    assert "access-control-allow-origin" not in blocked.headers


def test_invalid_cors_origin_fails_at_startup(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FRONTEND_ORIGINS", "*")
    with pytest.raises(ValidationError):
        Settings.from_environment()


def test_api_errors_have_standard_shape() -> None:
    application = create_app()

    @application.get("/api/v1/test-error")
    def fail() -> None:
        raise ApiError(409, "STATE_CONFLICT", "The resource is not ready.")

    response = TestClient(application).get("/api/v1/test-error")
    assert response.status_code == 409
    assert response.json() == {
        "error": {
            "code": "STATE_CONFLICT",
            "message": "The resource is not ready.",
            "details": {},
        }
    }


def test_structured_logger_does_not_emit_unlisted_fields() -> None:
    record = logging.LogRecord("api", logging.INFO, __file__, 1, "http_request", (), None)
    record.method = "GET"
    record.route = "/api/v1/health"
    record.status_code = 200
    record.authorization = "Bearer secret-token"
    record.query = "token=secret-token"

    payload = json.loads(JsonFormatter().format(record))
    assert payload["event"] == "http_request"
    assert payload["route"] == "/api/v1/health"
    assert "secret-token" not in json.dumps(payload)
