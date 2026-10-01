from uuid import UUID

import httpx
import pytest
from fastapi.testclient import TestClient

from app.auth import AuthenticatedUser, ownership_filter, require_owner
from app.errors import ApiError
from app.main import create_app

USER_ID = "8e710e43-9806-4812-acd9-e223d6dc1918"


def test_me_requires_bearer_token() -> None:
    client = TestClient(create_app())

    missing = client.get("/api/v1/me")
    wrong_scheme = client.get("/api/v1/me", headers={"Authorization": "Basic abc"})

    assert missing.status_code == 401
    assert missing.json()["error"]["code"] == "AUTH_REQUIRED"
    assert wrong_scheme.status_code == 401
    assert client.get("/api/v1/health").status_code == 200


def test_me_rejects_invalid_token_from_supabase(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "public-key")
    original_client = httpx.AsyncClient

    def make_client(**kwargs: object) -> httpx.AsyncClient:
        def reject(request: httpx.Request) -> httpx.Response:
            assert request.url.path == "/auth/v1/user"
            assert request.headers["authorization"] == "Bearer bad-token"
            return httpx.Response(401, json={"message": "invalid"})

        return original_client(transport=httpx.MockTransport(reject), **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", make_client)
    response = TestClient(create_app()).get(
        "/api/v1/me", headers={"Authorization": "Bearer bad-token"}
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTH_INVALID"


def test_me_returns_verified_identity(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "public-key")
    original_client = httpx.AsyncClient

    def make_client(**kwargs: object) -> httpx.AsyncClient:
        def accept(request: httpx.Request) -> httpx.Response:
            assert request.headers["apikey"] == "public-key"
            assert request.headers["authorization"] == "Bearer valid-token"
            return httpx.Response(200, json={"id": USER_ID, "email": "user@example.com"})

        return original_client(transport=httpx.MockTransport(accept), **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", make_client)
    response = TestClient(create_app()).get(
        "/api/v1/me", headers={"Authorization": "Bearer valid-token"}
    )

    assert response.status_code == 200
    assert response.json() == {"user_id": USER_ID, "email": "user@example.com"}


def test_ownership_helpers_scope_and_hide_foreign_resources() -> None:
    user = AuthenticatedUser(user_id=USER_ID)
    assert ownership_filter(user) == {"user_id": USER_ID}
    require_owner(UUID(USER_ID), user)

    with pytest.raises(ApiError) as error:
        require_owner("879fe027-1c26-4e87-8687-1b3d65e223ef", user)
    assert error.value.status_code == 404
