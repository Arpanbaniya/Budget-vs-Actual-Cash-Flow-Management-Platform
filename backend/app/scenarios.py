"""Owned scenario settings and pure transformations of planned cash items."""

from datetime import date, timedelta
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import Field

from app.cash import Fields, PatchFields, create_record, delete_record, owned_record, update_record
from app.companies import Store
from app.data import exact_json, money_precision, read_rows
from app.errors import ApiError
from app.imports import private_response

router = APIRouter(prefix="/api/v1", tags=["scenarios"], dependencies=[Depends(private_response)])
Percent = Annotated[Decimal, Field(ge=-100, le=500, allow_inf_nan=False, decimal_places=10)]
Delay = Annotated[int, Field(ge=0, le=365, strict=True)]
Name = Annotated[str, Field(min_length=1, max_length=200)]


class ScenarioCreate(Fields):
    name: Name
    inflow_adjustment_pct: Percent = Decimal(0)
    outflow_adjustment_pct: Percent = Decimal(0)
    collection_delay_days: Delay = 0


class ScenarioUpdate(PatchFields):
    name: Name | None = None
    inflow_adjustment_pct: Percent | None = None
    outflow_adjustment_pct: Percent | None = None
    collection_delay_days: Delay | None = None


@money_precision
def apply_scenario(items: list[dict], scenario: dict) -> list[dict]:
    result = []
    for item in items:
        row = dict(item)
        if row["status"] == "planned":
            pct = scenario[f"{row['direction']}_adjustment_pct"]
            row["amount"] = Decimal(str(row["amount"])) * (1 + Decimal(str(pct)) / 100)
            if row["direction"] == "inflow":
                try:
                    row["expected_date"] = (
                        date.fromisoformat(str(row["expected_date"]))
                        + timedelta(days=scenario["collection_delay_days"])
                    ).isoformat()
                except OverflowError as error:
                    raise ApiError(
                        422, "DATE_INVALID", "A delayed collection exceeds supported dates."
                    ) from error
        result.append(row)
    return result


@router.post("/companies/{company_id}/scenarios", status_code=201)
async def create_scenario(company_id: UUID, payload: ScenarioCreate, store: Store):
    return await create_record(store, "scenarios", company_id, payload)


@router.get("/companies/{company_id}/scenarios")
async def list_scenarios(company_id: UUID, store: Store):
    await store.get(company_id)
    return exact_json(
        await read_rows(store, "scenarios", company_id, order="created_at.asc,id.asc")
    )


@router.get("/scenarios/{scenario_id}")
async def get_scenario(scenario_id: UUID, store: Store):
    return exact_json(await owned_record(store, "scenarios", scenario_id))


@router.patch("/scenarios/{scenario_id}")
async def update_scenario(scenario_id: UUID, payload: ScenarioUpdate, store: Store):
    return await update_record(store, "scenarios", scenario_id, payload)


@router.delete("/scenarios/{scenario_id}", status_code=204)
async def delete_scenario(scenario_id: UUID, store: Store):
    return await delete_record(store, "scenarios", scenario_id)
