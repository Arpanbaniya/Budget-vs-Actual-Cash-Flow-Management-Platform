"""Validated runtime settings for the Phase 1 API foundation."""

import os
from typing import Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, field_validator


class Settings(BaseModel):
    frontend_origins: tuple[str, ...]
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"

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

    @classmethod
    def from_environment(cls) -> "Settings":
        origins = tuple(
            origin.strip().rstrip("/")
            for origin in os.getenv("FRONTEND_ORIGINS", "http://localhost:3000").split(",")
            if origin.strip()
        )
        return cls(frontend_origins=origins, log_level=os.getenv("LOG_LEVEL", "INFO").upper())
