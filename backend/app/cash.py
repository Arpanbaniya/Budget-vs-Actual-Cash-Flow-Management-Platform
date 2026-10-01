"""Owner-scoped cash records. Forecast calculations live in a separate service."""

from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.companies import CompanyStore, Store
from app.data import check_period, exact_json, read_rows
from app.errors import ApiError
from app.imports import private_response

router = APIRouter(prefix="/api/v1", tags=["cash"], dependencies=[Depends(private_response)])
Direction = Literal["inflow", "outflow"]
CashStatus = Literal["planned", "confirmed", "actual"]
Amount = Annotated[
    Decimal, Field(allow_inf_nan=False, ge=Decimal("-1e20"), le=Decimal("1e20"), decimal_places=10)
]
CashAmount = Annotated[
    Decimal, Field(allow_inf_nan=False, ge=0, le=Decimal("1e20"), decimal_places=10)
]
Text = Annotated[str, Field(min_length=1, max_length=500)]


class Fields(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class BalanceCreate(Fields):
    balance_date: date
    amount: Amount
    note: Annotated[str | None, Field(max_length=500)] = None


class PatchFields(Fields):
    @model_validator(mode="after")
    def nonempty_patch(self):
        if not self.model_fields_set or any(
            getattr(self, field) is None for field in self.model_fields_set if field != "note"
        ):
            raise ValueError("Provide at least one non-null field")
        return self


class BalanceUpdate(PatchFields):
    amount: Amount | None = None
    note: Annotated[str | None, Field(max_length=500)] = None


class CashCreate(Fields):
    expected_date: date
    description: Text
    category: Text
    direction: Direction
    amount: CashAmount
    status: CashStatus = "planned"


class CashUpdate(PatchFields):
    expected_date: date | None = None
    description: Text | None = None
    category: Text | None = None
    direction: Direction | None = None
    amount: CashAmount | None = None
    status: CashStatus | None = None


def record_scope(store: CompanyStore, id: UUID) -> dict:
    return {"id": f"eq.{id}", "user_id": f"eq.{store.user.user_id}", "select": "*"}


async def owned_record(store: CompanyStore, table: str, id: UUID) -> dict:
    result = await store.request("GET", f"rest/v1/{table}", params=record_scope(store, id))
    rows = store.rows(result)
    if not rows:
        raise ApiError(404, "NOT_FOUND", "Record not found.")
    await store.get(UUID(rows[0]["company_id"]))
    return rows[0]


async def create_record(store: CompanyStore, table: str, company_id: UUID, payload: BaseModel):
    await store.get(company_id)
    result = await store.request(
        "POST",
        f"rest/v1/{table}",
        json={
            **payload.model_dump(mode="json"),
            "company_id": str(company_id),
            "user_id": store.user.user_id,
        },
        headers={"Prefer": "return=representation"},
    )
    return exact_json(store.rows(result)[0])


async def update_record(store: CompanyStore, table: str, id: UUID, payload: BaseModel):
    await owned_record(store, table, id)
    result = await store.request(
        "PATCH",
        f"rest/v1/{table}",
        params=record_scope(store, id),
        json={
            **payload.model_dump(mode="json", exclude_unset=True),
            "updated_at": datetime.now(UTC).isoformat(),
        },
        headers={"Prefer": "return=representation"},
    )
    rows = store.rows(result)
    if not rows:
        raise ApiError(404, "NOT_FOUND", "Record not found.")
    return exact_json(rows[0])


async def delete_record(store: CompanyStore, table: str, id: UUID):
    await owned_record(store, table, id)
    result = await store.request(
        "DELETE",
        f"rest/v1/{table}",
        params=record_scope(store, id),
        headers={"Prefer": "return=representation"},
    )
    if not store.rows(result):
        raise ApiError(404, "NOT_FOUND", "Record not found.")
    return Response(status_code=204, headers={"Cache-Control": "private, no-store"})


@router.post("/companies/{company_id}/cash-balances", status_code=201)
async def create_balance(company_id: UUID, payload: BalanceCreate, store: Store):
    return await create_record(store, "cash_balances", company_id, payload)


@router.get("/companies/{company_id}/cash-balances")
async def list_balances(
    company_id: UUID,
    store: Store,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
):
    await store.get(company_id)
    rows = await read_rows(store, "cash_balances", company_id, order="balance_date.desc,id.asc")
    return exact_json(
        {
            "items": rows[(page - 1) * page_size : page * page_size],
            "total": len(rows),
            "page": page,
            "page_size": page_size,
        }
    )


@router.patch("/cash-balances/{balance_id}")
async def update_balance(balance_id: UUID, payload: BalanceUpdate, store: Store):
    return await update_record(store, "cash_balances", balance_id, payload)


@router.delete("/cash-balances/{balance_id}", status_code=204)
async def delete_balance(balance_id: UUID, store: Store):
    return await delete_record(store, "cash_balances", balance_id)


@router.post("/companies/{company_id}/cash-items", status_code=201)
async def create_cash_item(company_id: UUID, payload: CashCreate, store: Store):
    return await create_record(store, "cash_items", company_id, payload)


@router.get("/companies/{company_id}/cash-items")
async def list_cash_items(
    company_id: UUID,
    store: Store,
    start: Annotated[date | None, Query(alias="from")] = None,
    end: Annotated[date | None, Query(alias="to")] = None,
    direction: Direction | None = None,
    status: CashStatus | None = None,
    category: Annotated[str | None, Query(max_length=500)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
):
    await store.get(company_id)
    if start and end:
        check_period(start, end)
    filters = {"order": "expected_date.asc,id.asc"}
    dates = []
    if start:
        dates.append(f"expected_date.gte.{start}")
    if end:
        dates.append(f"expected_date.lte.{end}")
    if dates:
        filters["and"] = f"({','.join(dates)})"
    for field, value in (("direction", direction), ("status", status), ("category", category)):
        if value:
            filters[field] = f"eq.{value}"
    rows = await read_rows(store, "cash_items", company_id, **filters)
    return exact_json(
        {
            "items": rows[(page - 1) * page_size : page * page_size],
            "total": len(rows),
            "page": page,
            "page_size": page_size,
        }
    )


@router.patch("/cash-items/{cash_item_id}")
async def update_cash_item(cash_item_id: UUID, payload: CashUpdate, store: Store):
    return await update_record(store, "cash_items", cash_item_id, payload)


@router.delete("/cash-items/{cash_item_id}", status_code=204)
async def delete_cash_item(cash_item_id: UUID, store: Store):
    return await delete_record(store, "cash_items", cash_item_id)
