"""Weekly cash forecasting from dated opening snapshots and cash items."""

from datetime import date, timedelta
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.cash import owned_record
from app.companies import Company, CompanyStore, Store
from app.data import exact_json, money_precision, read_rows
from app.errors import ApiError
from app.imports import private_response
from app.scenarios import apply_scenario

router = APIRouter(
    prefix="/api/v1/companies", tags=["forecast"], dependencies=[Depends(private_response)]
)


@money_precision
def calculate_forecast(
    balance: dict, items: list[dict], start_date: date, weeks: int, threshold: Decimal
) -> dict:
    try:
        end = start_date + timedelta(days=weeks * 7 - 1)
    except OverflowError as error:
        raise ApiError(422, "DATE_INVALID", "Choose an earlier forecast start date.") from error
    inflows = [Decimal(0) for _ in range(weeks)]
    outflows = [Decimal(0) for _ in range(weeks)]
    for item in items:
        expected = date.fromisoformat(str(item["expected_date"]))
        if start_date <= expected <= end:
            index = (expected - start_date).days // 7
            (inflows if item["direction"] == "inflow" else outflows)[index] += Decimal(
                str(item["amount"])
            )
    opening = Decimal(str(balance["amount"]))
    weekly = []
    for index in range(weeks):
        week_start = start_date + timedelta(days=index * 7)
        closing = opening + inflows[index] - outflows[index]
        weekly.append(
            {
                "week_number": index + 1,
                "week_start": week_start,
                "week_end": week_start + timedelta(days=6),
                "opening_cash": opening,
                "inflows": inflows[index],
                "outflows": outflows[index],
                "closing_cash": closing,
                "threshold_breached": closing < threshold,
            }
        )
        opening = closing
    lowest = min(weekly, key=lambda week: week["closing_cash"])
    return {
        "start_date": start_date,
        "weeks": weeks,
        "opening_cash": Decimal(str(balance["amount"])),
        "balance_date": balance["balance_date"],
        "minimum_projected_cash": lowest["closing_cash"],
        "lowest_cash_week": lowest["week_number"],
        "minimum_cash_threshold": threshold,
        "first_threshold_breach_week": next(
            (week["week_number"] for week in weekly if week["threshold_breached"]), None
        ),
        "scenario": None,
        "weekly": weekly,
    }


async def forecast_data(
    store: CompanyStore,
    company: Company,
    start_date: date,
    weeks: int,
    scenario_id: UUID | None = None,
) -> dict:
    try:
        end = start_date + timedelta(days=weeks * 7 - 1)
    except OverflowError as error:
        raise ApiError(422, "DATE_INVALID", "Choose an earlier forecast start date.") from error
    scenario = None
    source_start = start_date
    if scenario_id:
        scenario = await owned_record(store, "scenarios", scenario_id)
        if scenario["company_id"] != str(company.id):
            raise ApiError(404, "NOT_FOUND", "Scenario not found for this company.")
        source_start = start_date - timedelta(
            days=min(scenario["collection_delay_days"], (start_date - date.min).days)
        )
    balances = await read_rows(
        store,
        "cash_balances",
        company.id,
        balance_date=f"lte.{start_date}",
        order="balance_date.desc,id.asc",
    )
    if not balances:
        raise ApiError(
            422,
            "CASH_BALANCE_REQUIRED",
            "Add a cash balance dated on or before the forecast start.",
        )
    items = await read_rows(
        store,
        "cash_items",
        company.id,
        **{"and": f"(expected_date.gte.{source_start},expected_date.lte.{end})"},
    )
    result = calculate_forecast(
        balances[0],
        apply_scenario(items, scenario) if scenario else items,
        start_date,
        weeks,
        company.minimum_cash_threshold,
    )
    result["scenario"] = scenario
    return result


@router.get("/{company_id}/cash-forecast")
async def get_forecast(
    company_id: UUID,
    store: Store,
    start_date: date,
    weeks: Annotated[int, Query(ge=1, le=26)] = 13,
    scenario_id: UUID | None = None,
) -> dict:
    company = await store.get(company_id)
    return exact_json(
        {
            "currency": company.currency,
            **await forecast_data(store, company, start_date, weeks, scenario_id),
        }
    )
