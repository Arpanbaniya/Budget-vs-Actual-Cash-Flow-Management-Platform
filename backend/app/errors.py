"""Consistent, client-safe API errors."""

from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class ApiError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details or {}


def error_response(
    status_code: int, code: str, message: str, details: dict[str, Any] | None = None
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message, "details": details or {}}},
    )


def register_error_handlers(application: FastAPI) -> None:
    @application.exception_handler(ApiError)
    async def handle_api_error(_request: Request, error: ApiError) -> JSONResponse:
        return error_response(error.status_code, error.code, error.message, error.details)

    @application.exception_handler(RequestValidationError)
    async def handle_validation_error(
        _request: Request, error: RequestValidationError
    ) -> JSONResponse:
        issues = [
            {"location": list(issue["loc"]), "type": issue["type"]}
            for issue in error.errors()
        ]
        return error_response(422, "REQUEST_INVALID", "The request is invalid.", {"issues": issues})

    @application.exception_handler(HTTPException)
    async def handle_http_error(_request: Request, error: HTTPException) -> JSONResponse:
        code = "NOT_FOUND" if error.status_code == 404 else "HTTP_ERROR"
        message = error.detail if isinstance(error.detail, str) else "The request failed."
        return error_response(error.status_code, code, message)

    @application.exception_handler(Exception)
    async def handle_unexpected_error(_request: Request, _error: Exception) -> JSONResponse:
        return error_response(500, "INTERNAL_ERROR", "An unexpected error occurred.")
