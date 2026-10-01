"""Company dashboard composed from the shared financial services."""

import asyncio
from datetime import UTC, date, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.companies import Company, CompanyStore, Store
from app.data import exact_json
from app.errors import ApiError
from app.forecast import forecast_data
from app.imports import private_response
from app.variance import calculate_variance, financial_data

router = APIRouter(
    prefix="/api/v1/companies", tags=["dashboard"], dependencies=[Depends(private_response)]
)


async def dashboard_data(
    store: CompanyStore,
    company: Company,
    start: date,
    end: date,
    cash_start: date,
    scenario_id: UUID | None = None,
) -> dict:
    async def cash():
        try:
            return await forecast_data(store, company, cash_start, 13, scenario_id)
        except ApiError as error:
            if error.code != "CASH_BALANCE_REQUIRED":
                raise
            return None

    lines, forecast = await asyncio.gather(financial_data(store, company.id, start, end), cash())
    variance = calculate_variance(lines)
    return {
        "period": {"from": start, "to": end},
        "cash_start_date": cash_start,
        "currency": company.currency,
        "variance": variance,
        "cash_forecast": forecast,
        "latest_cash": (
            {"amount": forecast["opening_cash"], "balance_date": forecast["balance_date"]}
            if forecast
            else None
        ),
    }


@router.get("/{company_id}/dashboard")
async def get_dashboard(
    company_id: UUID,
    store: Store,
    start: Annotated[date, Query(alias="from")],
    end: Annotated[date, Query(alias="to")],
    cash_start_date: date | None = None,
    scenario_id: UUID | None = None,
) -> dict:
    company = await store.get(company_id)
    return exact_json(
        await dashboard_data(
            store, company, start, end, cash_start_date or datetime.now(UTC).date(), scenario_id
        )
    )
