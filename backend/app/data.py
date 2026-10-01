"""Shared owner-scoped reads and exact JSON money serialization."""

from datetime import date
from decimal import Decimal, localcontext
from functools import wraps
from uuid import UUID

from app.companies import CompanyStore
from app.errors import ApiError


def money_precision(function):
    @wraps(function)
    def wrapped(*args, **kwargs):
        with localcontext() as context:
            context.prec = 50
            return function(*args, **kwargs)

    return wrapped


def exact_json(value):
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, (date, UUID)):
        return str(value)
    if isinstance(value, dict):
        money_fields = {
            "amount",
            "minimum_cash_threshold",
            "inflow_adjustment_pct",
            "outflow_adjustment_pct",
        }
        return {
            key: str(item) if key in money_fields and item is not None else exact_json(item)
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [exact_json(item) for item in value]
    return value


def check_period(start: date, end: date) -> None:
    if start > end:
        raise ApiError(422, "PERIOD_INVALID", "From date must not be after To date.")


async def read_rows(store: CompanyStore, table: str, company_id: UUID, **filters) -> list[dict]:
    params = {
        "user_id": f"eq.{store.user.user_id}",
        "company_id": f"eq.{company_id}",
        "select": "*",
        "order": "id.asc",
        **filters,
    }
    rows = []
    while True:
        result = await store.request(
            "GET",
            f"rest/v1/{table}",
            params={
                **params,
                "limit": "1000",
                "offset": str(len(rows)),
            },
        )
        page = store.rows(result)
        rows.extend(page)
        if len(rows) > 200000:
            raise ApiError(422, "DATA_LIMIT", "Narrow the date range to analyze fewer rows.")
        if len(page) < 1000:
            return rows
