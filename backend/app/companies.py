"""Company endpoints backed by Supabase using the caller's JWT and RLS."""

import json
from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated, Any
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.auth import AuthenticatedUser, bearer_scheme, get_authenticated_user
from app.errors import ApiError

router = APIRouter(prefix="/api/v1/companies", tags=["companies"])
Name = Annotated[str, Field(min_length=1, max_length=200)]
Currency = Annotated[str, Field(pattern=r"^[A-Z]{3}$")]
FiscalMonth = Annotated[int, Field(ge=1, le=12, strict=True)]
Money = Annotated[Decimal, Field(ge=0, allow_inf_nan=False)]


class CompanyFields(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("currency", mode="before", check_fields=False)
    @classmethod
    def uppercase_currency(cls, value: Any) -> Any:
        return value.strip().upper() if isinstance(value, str) else value


class CompanyCreate(CompanyFields):
    name: Name
    currency: Currency = "USD"
    fiscal_year_start_month: FiscalMonth = 1
    minimum_cash_threshold: Money = Decimal(0)


class CompanyUpdate(CompanyFields):
    name: Name | None = None
    currency: Currency | None = None
    fiscal_year_start_month: FiscalMonth | None = None
    minimum_cash_threshold: Money | None = None

    @model_validator(mode="after")
    def validate_patch(self) -> "CompanyUpdate":
        if not self.model_fields_set or any(
            getattr(self, field) is None for field in self.model_fields_set
        ):
            raise ValueError("Provide at least one non-null company setting")
        return self


class Company(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    currency: str
    fiscal_year_start_month: int
    minimum_cash_threshold: Decimal
    created_at: datetime
    updated_at: datetime


class CompanyStore:
    def __init__(self, client: httpx.AsyncClient, user: AuthenticatedUser) -> None:
        self.client = client
        self.user = user

    async def request(self, method: str, path: str, **kwargs: Any) -> httpx.Response:
        try:
            response = await self.client.request(method, path, **kwargs)
        except httpx.RequestError as error:
            raise ApiError(
                503, "DATA_UNAVAILABLE", "Company data is temporarily unavailable."
            ) from error
        if response.status_code in {401, 403}:
            raise ApiError(401, "AUTH_INVALID", "Your session expired. Please sign in again.")
        if response.status_code == 409:
            raise ApiError(409, "COMPANY_CONFLICT", "The company could not be changed. Try again.")
        if not response.is_success:
            raise ApiError(503, "DATA_UNAVAILABLE", "Company data is temporarily unavailable.")
        return response

    def scope(self, company_id: UUID | None = None) -> dict[str, str]:
        params = {"user_id": f"eq.{self.user.user_id}", "select": "*"}
        if company_id:
            params["id"] = f"eq.{company_id}"
        return params

    @staticmethod
    def rows(response: httpx.Response) -> list[dict[str, Any]]:
        # Preserve Postgres numeric precision rather than decoding it as a float.
        return json.loads(response.text, parse_float=Decimal)

    async def get(self, company_id: UUID) -> Company:
        response = await self.request("GET", "rest/v1/companies", params=self.scope(company_id))
        rows = self.rows(response)
        if not rows:
            raise ApiError(404, "NOT_FOUND", "Company not found.")
        return Company.model_validate(rows[0])

    async def clear_files(self, company_id: UUID) -> None:
        # Discover objects through Storage, not SQL, so deletion removes bytes too.
        # Every requested prefix is inside this verified owner's company folder.
        root = f"{self.user.user_id}/{company_id}"
        for bucket in ("fpna-imports", "fpna-reports"):
            pending = [root]
            paths: list[str] = []
            while pending:
                prefix = pending.pop()
                offset = 0
                while True:
                    result = await self.request(
                        "POST",
                        f"storage/v1/object/list/{bucket}",
                        json={
                            "prefix": prefix,
                            "limit": 100,
                            "offset": offset,
                            "sortBy": {"column": "name", "order": "asc"},
                        },
                    )
                    rows = result.json()
                    for row in rows:
                        name = row.get("name")
                        if (
                            not isinstance(name, str)
                            or not name
                            or name in {".", ".."}
                            or "/" in name
                            or "\\" in name
                        ):
                            raise ApiError(
                                503, "DATA_UNAVAILABLE", "File cleanup failed. Try again."
                            )
                        path = f"{prefix}/{name}"
                        if row.get("id") is None:
                            pending.append(path)
                        else:
                            paths.append(path)
                    if len(rows) < 100:
                        break
                    offset += len(rows)
            for index in range(0, len(paths), 100):
                await self.request(
                    "DELETE",
                    f"storage/v1/object/{bucket}",
                    json={"prefixes": paths[index : index + 100]},
                )


async def get_store(
    request: Request,
    user: Annotated[AuthenticatedUser, Depends(get_authenticated_user)],
):
    settings = request.app.state.settings
    credentials = await bearer_scheme(request)
    if not settings.supabase_url or not settings.supabase_publishable_key or not credentials:
        raise ApiError(503, "AUTH_NOT_CONFIGURED", "Authentication is not configured.")
    async with httpx.AsyncClient(
        base_url=f"{settings.supabase_url.rstrip('/')}/",
        timeout=15.0,
        headers={
            "apikey": settings.supabase_publishable_key,
            "Authorization": f"Bearer {credentials.credentials}",
        },
    ) as client:
        yield CompanyStore(client, user)


Store = Annotated[CompanyStore, Depends(get_store)]


@router.post("", response_model=Company, status_code=201)
async def create_company(payload: CompanyCreate, store: Store) -> Company:
    body = payload.model_dump(mode="json")
    body["user_id"] = store.user.user_id
    response = await store.request(
        "POST",
        "rest/v1/companies",
        json=body,
        headers={"Prefer": "return=representation"},
    )
    return Company.model_validate(store.rows(response)[0])


@router.get("", response_model=list[Company])
async def list_companies(store: Store) -> list[Company]:
    companies: list[Company] = []
    offset = 0
    while True:
        response = await store.request(
            "GET",
            "rest/v1/companies",
            params={
                **store.scope(),
                "order": "created_at.asc,id.asc",
                "limit": "100",
                "offset": str(offset),
            },
        )
        rows = store.rows(response)
        companies.extend(Company.model_validate(row) for row in rows)
        if len(rows) < 100:
            return companies
        offset += len(rows)


@router.get("/{company_id}", response_model=Company)
async def get_company(company_id: UUID, store: Store) -> Company:
    return await store.get(company_id)


@router.patch("/{company_id}", response_model=Company)
async def update_company(company_id: UUID, payload: CompanyUpdate, store: Store) -> Company:
    response = await store.request(
        "PATCH",
        "rest/v1/companies",
        params=store.scope(company_id),
        json={
            **payload.model_dump(mode="json", exclude_unset=True),
            "updated_at": datetime.now(UTC).isoformat(),
        },
        headers={"Prefer": "return=representation"},
    )
    rows = store.rows(response)
    if not rows:
        raise ApiError(404, "NOT_FOUND", "Company not found.")
    return Company.model_validate(rows[0])


@router.delete("/{company_id}", status_code=204)
async def delete_company(company_id: UUID, store: Store) -> Response:
    await store.get(company_id)
    await store.clear_files(company_id)
    result = await store.request(
        "DELETE",
        "rest/v1/companies",
        params=store.scope(company_id),
        headers={"Prefer": "return=representation"},
    )
    if not result.json():
        raise ApiError(404, "NOT_FOUND", "Company not found.")
    return Response(status_code=204)
