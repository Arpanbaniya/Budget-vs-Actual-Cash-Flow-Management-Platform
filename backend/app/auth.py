"""Supabase bearer-token verification and reusable ownership checks."""

from dataclasses import dataclass
from typing import Annotated
from uuid import UUID

import httpx
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import Settings
from app.errors import ApiError

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AuthenticatedUser:
    user_id: str
    email: str | None = None


async def verify_access_token(token: str, settings: Settings) -> AuthenticatedUser:
    """Ask this project's Auth server to validate the token, including expiry/revocation."""
    if not settings.supabase_url or not settings.supabase_publishable_key:
        raise ApiError(503, "AUTH_NOT_CONFIGURED", "Authentication is not configured.")

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{settings.supabase_url.rstrip('/')}/auth/v1/user",
                headers={
                    "apikey": settings.supabase_publishable_key,
                    "Authorization": f"Bearer {token}",
                },
            )
    except httpx.RequestError as error:
        raise ApiError(503, "AUTH_UNAVAILABLE", "Authentication is temporarily unavailable.") from error

    if response.status_code in {401, 403}:
        raise ApiError(401, "AUTH_INVALID", "The access token is invalid or expired.")
    if response.status_code != 200:
        raise ApiError(503, "AUTH_UNAVAILABLE", "Authentication is temporarily unavailable.")

    try:
        body = response.json()
        user_id = str(UUID(body["id"]))
    except (ValueError, KeyError, TypeError) as error:
        raise ApiError(401, "AUTH_INVALID", "The access token is invalid or expired.") from error

    email = body.get("email")
    return AuthenticatedUser(user_id=user_id, email=email if isinstance(email, str) else None)


async def get_authenticated_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> AuthenticatedUser:
    if credentials is None or not credentials.credentials:
        raise ApiError(401, "AUTH_REQUIRED", "A bearer access token is required.")
    return await verify_access_token(credentials.credentials, request.app.state.settings)


def ownership_filter(user: AuthenticatedUser) -> dict[str, str]:
    """Use this scope for every future user-owned data query."""
    return {"user_id": user.user_id}


def require_owner(resource_user_id: str | UUID, user: AuthenticatedUser) -> None:
    """Hide another user's resource instead of revealing that it exists."""
    if str(resource_user_id) != user.user_id:
        raise ApiError(404, "NOT_FOUND", "Resource not found.")
