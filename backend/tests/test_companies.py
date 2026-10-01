import json
import re
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import create_app

USER_A = "8e710e43-9806-4812-acd9-e223d6dc1918"
USER_B = "879fe027-1c26-4e87-8687-1b3d65e223ef"
NOW = "2026-10-01T00:00:00+00:00"


@pytest.fixture
def companies_api(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "publishable-key")
    rows: dict[str, dict] = {}
    files: dict[str, set[str]] = {"fpna-imports": set(), "fpna-reports": set()}
    calls: list[httpx.Request] = []
    failures: dict[str, int] = {}

    def database_response(status: int, data: list[dict]) -> httpx.Response:
        # PostgREST returns numeric columns as JSON numbers, including values
        # that cannot be represented exactly by a binary floating point value.
        content = re.sub(
            r'"minimum_cash_threshold": "([0-9.eE+\-]+)"',
            r'"minimum_cash_threshold": \1',
            json.dumps(data),
        )
        return httpx.Response(status, text=content, headers={"Content-Type": "application/json"})

    def handle(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        assert request.headers["apikey"] == "publishable-key"
        token = request.headers["authorization"].removeprefix("Bearer ")
        user_id = {"user-a": USER_A, "user-b": USER_B}.get(token)
        if request.url.path == "/auth/v1/user":
            return httpx.Response(200, json={"id": user_id}) if user_id else httpx.Response(401)
        if request.url.path in failures:
            return httpx.Response(failures[request.url.path], json={"message": "private details"})
        if request.url.path == "/rest/v1/companies":
            if request.method == "POST":
                body = json.loads(request.content)
                assert body["user_id"] == user_id
                record = {"id": str(uuid4()), "created_at": NOW, "updated_at": NOW, **body}
                rows[record["id"]] = record
                return database_response(201, [record])
            assert request.url.params["user_id"] == f"eq.{user_id}"
            selected = [row for row in rows.values() if row["user_id"] == user_id]
            if "id" in request.url.params:
                selected = [
                    row for row in selected if f"eq.{row['id']}" == request.url.params["id"]
                ]
            if request.method == "GET":
                offset = int(request.url.params.get("offset", 0))
                return database_response(200, selected[offset : offset + 100])
            if request.method == "PATCH":
                for row in selected:
                    row.update(json.loads(request.content))
                return database_response(200, selected)
            if request.method == "DELETE":
                for row in selected:
                    del rows[row["id"]]
                return httpx.Response(200, json=selected)
        if request.url.path.startswith("/storage/v1/object/list/"):
            bucket = request.url.path.rsplit("/", 1)[1]
            body = json.loads(request.content)
            prefix = body["prefix"] + "/"
            assert prefix.startswith(f"{user_id}/")
            entries = {}
            for path in files[bucket]:
                if path.startswith(prefix):
                    remainder = path[len(prefix) :]
                    name = remainder.split("/", 1)[0]
                    entries[name] = {"name": name, "id": None if "/" in remainder else str(uuid4())}
            result = sorted(entries.values(), key=lambda row: row["name"])
            offset = body["offset"]
            return httpx.Response(200, json=result[offset : offset + body["limit"]])
        if request.url.path.startswith("/storage/v1/object/") and request.method == "DELETE":
            bucket = request.url.path.rsplit("/", 1)[1]
            for path in json.loads(request.content)["prefixes"]:
                assert path.startswith(f"{user_id}/")
                files[bucket].discard(path)
            return httpx.Response(200, json=[])
        raise AssertionError(f"Unexpected request: {request.method} {request.url}")

    original = httpx.AsyncClient

    def make_client(**kwargs):
        return original(transport=httpx.MockTransport(handle), **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", make_client)
    yield TestClient(create_app()), rows, files, calls, failures


def headers(token: str = "user-a") -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_crud_defaults_and_partial_settings_update(companies_api) -> None:
    client, _, _, _, _ = companies_api
    created = client.post("/api/v1/companies", headers=headers(), json={"name": "  Acme Nepal  "})
    assert created.status_code == 201
    company = created.json()
    assert company["name"] == "Acme Nepal"
    assert company["currency"] == "USD"
    assert company["fiscal_year_start_month"] == 1
    assert company["minimum_cash_threshold"] == "0"
    path = f"/api/v1/companies/{company['id']}"
    assert client.get(path, headers=headers()).json() == company
    assert client.get("/api/v1/companies", headers=headers()).json() == [company]
    updated = client.patch(
        path,
        headers=headers(),
        json={
            "currency": "npr",
            "fiscal_year_start_month": 7,
            "minimum_cash_threshold": "500000.25",
        },
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Acme Nepal"
    assert updated.json()["currency"] == "NPR"
    assert updated.json()["minimum_cash_threshold"] == "500000.25"
    assert updated.json()["updated_at"] != company["updated_at"]
    assert client.delete(path, headers=headers()).status_code == 204
    assert client.get(path, headers=headers()).status_code == 404
    assert client.get("/api/v1/companies", headers=headers()).json() == []


def test_cash_threshold_keeps_decimal_precision(companies_api) -> None:
    client, _, _, _, _ = companies_api
    amount = "9007199254740993.123456789"
    response = client.post(
        "/api/v1/companies",
        headers=headers(),
        json={
            "name": "Exact cash",
            "minimum_cash_threshold": amount,
        },
    )
    assert response.json()["minimum_cash_threshold"] == amount
    company_id = response.json()["id"]
    assert (
        client.get(f"/api/v1/companies/{company_id}", headers=headers()).json()[
            "minimum_cash_threshold"
        ]
        == amount
    )


@pytest.mark.parametrize("month", [0, 13, -1, 1.5, True, "1"])
def test_invalid_fiscal_month_on_create_and_patch(companies_api, month) -> None:
    client, _, _, _, _ = companies_api
    company = client.post("/api/v1/companies", headers=headers(), json={"name": "Acme"}).json()
    create = client.post(
        "/api/v1/companies",
        headers=headers(),
        json={"name": "Acme", "fiscal_year_start_month": month},
    )
    patch = client.patch(
        f"/api/v1/companies/{company['id']}",
        headers=headers(),
        json={"fiscal_year_start_month": month},
    )
    assert create.status_code == patch.status_code == 422
    assert patch.json()["error"]["code"] == "REQUEST_INVALID"


@pytest.mark.parametrize(
    "payload",
    [
        {"name": " "},
        {"name": "x" * 201},
        {"currency": "US"},
        {"minimum_cash_threshold": "-1"},
        {"minimum_cash_threshold": "NaN"},
        {"user_id": USER_B},
        {},
        {"name": None},
    ],
)
def test_invalid_settings_are_rejected(companies_api, payload) -> None:
    client, _, _, _, _ = companies_api
    response = client.patch(f"/api/v1/companies/{uuid4()}", headers=headers(), json=payload)
    assert response.status_code == 422


def test_all_endpoints_require_valid_auth(companies_api) -> None:
    client, _, _, _, _ = companies_api
    for method, path, payload in [
        ("GET", "/api/v1/companies", None),
        ("POST", "/api/v1/companies", {"name": "Acme"}),
        ("GET", f"/api/v1/companies/{uuid4()}", None),
        ("PATCH", f"/api/v1/companies/{uuid4()}", {"name": "Acme"}),
        ("DELETE", f"/api/v1/companies/{uuid4()}", None),
    ]:
        assert client.request(method, path, json=payload).status_code == 401
        assert (
            client.request(method, path, json=payload, headers=headers("invalid")).status_code
            == 401
        )


def test_cross_user_isolation_and_no_foreign_storage_cleanup(companies_api) -> None:
    client, rows, _, calls, _ = companies_api
    company = client.post("/api/v1/companies", headers=headers(), json={"name": "Private"}).json()
    path = f"/api/v1/companies/{company['id']}"
    assert client.get("/api/v1/companies", headers=headers("user-b")).json() == []
    assert client.get(path, headers=headers("user-b")).status_code == 404
    assert (
        client.patch(path, headers=headers("user-b"), json={"name": "Changed"}).status_code == 404
    )
    assert client.delete(path, headers=headers("user-b")).status_code == 404
    assert rows[company["id"]]["name"] == "Private"
    assert not any("/storage/" in request.url.path for request in calls)


def test_delete_removes_only_this_company_files_and_paginates(companies_api) -> None:
    client, _, files, _, _ = companies_api
    company = client.post("/api/v1/companies", headers=headers(), json={"name": "Acme"}).json()
    root = f"{USER_A}/{company['id']}"
    files["fpna-imports"] = {f"{root}/import-id/{i:03}.csv" for i in range(105)}
    untouched = f"{USER_A}/{uuid4()}/other.csv"
    foreign = f"{USER_B}/{uuid4()}/private.csv"
    files["fpna-imports"].update({untouched, foreign})
    files["fpna-reports"] = {f"{root}/report-id/management_report.xlsx"}
    assert client.delete(f"/api/v1/companies/{company['id']}", headers=headers()).status_code == 204
    assert files["fpna-imports"] == {untouched, foreign}
    assert files["fpna-reports"] == set()


def test_cleanup_failure_keeps_company_and_hides_provider_details(companies_api) -> None:
    client, rows, _, _, failures = companies_api
    company = client.post("/api/v1/companies", headers=headers(), json={"name": "Acme"}).json()
    failures["/storage/v1/object/list/fpna-imports"] = 500
    response = client.delete(f"/api/v1/companies/{company['id']}", headers=headers())
    assert response.status_code == 503
    assert company["id"] in rows
    assert "private details" not in response.text


def test_list_reads_beyond_first_database_page(companies_api) -> None:
    client, rows, _, _, _ = companies_api
    for i in range(105):
        company_id = str(uuid4())
        rows[company_id] = {
            "id": company_id,
            "user_id": USER_A,
            "name": f"Company {i}",
            "currency": "USD",
            "fiscal_year_start_month": 1,
            "minimum_cash_threshold": 0,
            "created_at": NOW,
            "updated_at": NOW,
        }
    assert len(client.get("/api/v1/companies", headers=headers()).json()) == 105
