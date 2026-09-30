from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import RequestResponseEndpoint
from starlette.responses import Response

from app.config import Settings
from app.errors import register_error_handlers
from app.structured_logging import configure_logging


def create_app() -> FastAPI:
    settings = Settings.from_environment()
    logger = configure_logging(settings.log_level)
    application = FastAPI(
        title="Flow & Forecast API",
        version="0.1.0",
        description="Backend foundation for budget and cash flow management.",
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.frontend_origins),
        allow_credentials=True,
        allow_methods=["GET"],
        allow_headers=["Authorization", "Content-Type"],
    )
    register_error_handlers(application)

    @application.middleware("http")
    async def log_request(request: Request, call_next: RequestResponseEndpoint) -> Response:
        try:
            response = await call_next(request)
        except Exception:
            logger.error(
                "request_failed",
                extra={"method": request.method, "route": "<unhandled>", "status_code": 500},
            )
            raise
        route = request.scope.get("route")
        logger.info(
            "http_request",
            extra={
                "method": request.method,
                "route": route.path if route else "<unmatched>",
                "status_code": response.status_code,
            },
        )
        return response

    @application.get("/api/v1/health", tags=["health"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return application


app = create_app()
