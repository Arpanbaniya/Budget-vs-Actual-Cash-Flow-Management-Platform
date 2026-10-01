"""Deterministic variance math and authenticated financial reads."""

from collections import defaultdict
from datetime import date
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.companies import CompanyStore, Store
from app.data import check_period, exact_json, money_precision, read_rows
from app.imports import private_response

router = APIRouter(
    prefix="/api/v1/companies", tags=["variance"], dependencies=[Depends(private_response)]
)
Group = Literal["account", "department", "month"]
AccountType = Literal["revenue", "cogs", "operating_expense", "other_income", "other_expense"]
INCOME = {"revenue", "other_income"}


def favorability(variance: Decimal, income: bool) -> str:
    if variance == 0:
        return "neutral"
    return "favorable" if (variance > 0) == income else "unfavorable"


@money_precision
def calculate_variance(lines: list[dict], group_by: Group = "account") -> dict:
    buckets = defaultdict(lambda: {"budget": Decimal(0), "actual": Decimal(0)})
    summary = {
        f"{kind}_{category}": Decimal(0)
        for kind in ("budget", "actual")
        for category in ("revenue", "expenses")
    }
    for line in lines:
        amount, kind, account_type = (
            Decimal(str(line["amount"])),
            line["kind"],
            line["account_type"],
        )
        label = line[
            {"account": "account_code", "department": "department", "month": "period"}[group_by]
        ]
        label = str(label)
        bucket = buckets[(label, account_type)]
        bucket[kind] += amount
        bucket["account_name"] = line["account_name"] if group_by == "account" else label
        summary[f"{kind}_{'revenue' if account_type in INCOME else 'expenses'}"] += amount
    for kind in ("budget", "actual"):
        summary[f"{kind}_operating_profit"] = (
            summary[f"{kind}_revenue"] - summary[f"{kind}_expenses"]
        )
    for category in ("revenue", "expenses", "operating_profit"):
        summary[f"{category}_variance"] = (
            summary[f"actual_{category}"] - summary[f"budget_{category}"]
        )
    rows = []
    for (label, account_type), bucket in sorted(buckets.items()):
        budget, actual = bucket["budget"], bucket["actual"]
        variance = actual - budget
        rows.append(
            {
                "label": label,
                "account_name": bucket["account_name"],
                "account_type": account_type,
                "budget_amount": budget,
                "actual_amount": actual,
                "variance_amount": variance,
                "variance_percent": variance / abs(budget) * 100 if budget else None,
                "variance_label": "unbudgeted" if not budget else "budgeted",
                "favorability": favorability(variance, account_type in INCOME),
            }
        )
    unfavorable = sorted(
        (row for row in rows if row["favorability"] == "unfavorable"),
        key=lambda row: (-abs(row["variance_amount"]), row["label"]),
    )[:10]
    return {
        "summary": summary,
        "rows": rows,
        "top_unfavorable": unfavorable,
        "has_data": bool(lines),
        "budget_row_count": sum(row["kind"] == "budget" for row in lines),
        "actual_row_count": sum(row["kind"] == "actual" for row in lines),
    }


async def financial_data(
    store: CompanyStore,
    company_id: UUID,
    start: date,
    end: date,
    department: str | None = None,
    **filters,
) -> list[dict]:
    check_period(start, end)
    params = {
        "select": "*,imports!inner(status)",
        "imports.status": "eq.processed",
        "and": f"(period.gte.{start},period.lte.{end})",
        **filters,
    }
    if department:
        params["department"] = f"eq.{department}"
    return await read_rows(store, "financial_lines", company_id, **params)


@router.get("/{company_id}/financial-lines")
async def list_financial_lines(
    company_id: UUID,
    store: Store,
    start: Annotated[date, Query(alias="from")],
    end: Annotated[date, Query(alias="to")],
    kind: Literal["budget", "actual"] | None = None,
    department: Annotated[str | None, Query(max_length=500)] = None,
    account_type: AccountType | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 50,
) -> dict:
    await store.get(company_id)
    filters = {}
    if kind:
        filters["kind"] = f"eq.{kind}"
    if account_type:
        filters["account_type"] = f"eq.{account_type}"
    rows = await financial_data(store, company_id, start, end, department, **filters)
    return exact_json(
        {
            "items": rows[(page - 1) * page_size : page * page_size],
            "total": len(rows),
            "page": page,
            "page_size": page_size,
        }
    )


@router.get("/{company_id}/variance")
async def get_variance(
    company_id: UUID,
    store: Store,
    start: Annotated[date, Query(alias="from")],
    end: Annotated[date, Query(alias="to")],
    department: Annotated[str | None, Query(max_length=500)] = None,
    group_by: Group = "account",
) -> dict:
    company = await store.get(company_id)
    lines = await financial_data(store, company_id, start, end, department)
    return exact_json(
        {
            "period": {"from": start, "to": end},
            "currency": company.currency,
            "group_by": group_by,
            **calculate_variance(lines, group_by),
        }
    )
