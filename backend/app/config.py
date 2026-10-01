"""Validated runtime settings for the API."""

import os
from typing import Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, field_validator, model_validator


class Settings(BaseModel):
    frontend_origins: tuple[str, ...]
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    supabase_url: str | None = None
    supabase_publishable_key: str | None = None

    @field_validator("frontend_origins")
    @classmethod
    def validate_origins(cls, origins: tuple[str, ...]) -> tuple[str, ...]:
        if not origins:
            raise ValueError("FRONTEND_ORIGINS must include at least one origin")
        for origin in origins:
            parsed = urlsplit(origin)
            try:
                _ = parsed.port
            except ValueError as error:
                raise ValueError("FRONTEND_ORIGINS contains an invalid port") from error
            if (
                parsed.scheme not in {"http", "https"}
                or not parsed.hostname
                or parsed.path
                or parsed.query
                or parsed.fragment
                or parsed.username
                or parsed.password
                or "*" in origin
            ):
                raise ValueError("FRONTEND_ORIGINS must contain HTTP(S) origins only")
        return origins

    @model_validator(mode="after")
    def validate_supabase(self) -> "Settings":
        if bool(self.supabase_url) != bool(self.supabase_publishable_key):
            raise ValueError("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set together")
        if self.supabase_url:
            parsed = urlsplit(self.supabase_url)
            if (
                parsed.scheme != "https"
                and not (parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1"})
            ) or not parsed.hostname or parsed.path not in {"", "/"} or parsed.query or parsed.fragment:
                raise ValueError("SUPABASE_URL must be an HTTPS origin (or local HTTP origin)")
        return self

    @classmethod
    def from_environment(cls) -> "Settings":
        origins = tuple(
            origin.strip().rstrip("/")
            for origin in os.getenv("FRONTEND_ORIGINS", "http://localhost:3000").split(",")
            if origin.strip()
        )
        return cls(
            frontend_origins=origins,
            log_level=os.getenv("LOG_LEVEL", "INFO").upper(),
            supabase_url=os.getenv("SUPABASE_URL") or None,
            supabase_publishable_key=os.getenv("SUPABASE_PUBLISHABLE_KEY") or None,
        )
