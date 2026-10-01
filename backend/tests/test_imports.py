"""Storage is mocked: no test uploads financial files or requires cloud credentials."""

import json
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient

from app.imports import MAX_FILE_BYTES, MIME_TYPES
from app.main import create_app

USER_A = "8e710e43-9806-4812-acd9-e223d6dc1918"
USER_B = "879fe027-1c26-4e87-8687-1b3d65e223ef"
COMPANY_A = "a17448cd-47b5-4baa-8780-5e2af9eb538a"
COMPANY_B = "6f57a54d-4121-4967-8ab4-63d511b7f1ea"
NOW = "2026-10-01T00:00:00+00:00"


@pytest.fixture
def imports_api(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "publishable-key")
    companies = {
        id: {
            "id": id,
            "user_id": owner,
            "name": name,
            "currency": "NPR",
            "fiscal_year_start_month": 7,
            "minimum_cash_threshold": "0",
            "created_at": NOW,
            "updated_at": NOW,
        }
        for id, owner, name in [
            (COMPANY_A, USER_A, "Nepal Demo"),
            (COMPANY_B, USER_B, "Other user"),
        ]
    }
    records: dict[str, dict] = {}
    objects: dict[str, dict] = {}
    derived = {"financial_lines": [], "cash_items": []}
    calls: list[httpx.Request] = []
    failures: dict[str, int] = {}
    controls: dict[str, object] = {}

    def handle(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        assert request.headers["apikey"] == "publishable-key"
        token = request.headers["authorization"].removeprefix("Bearer ")
        owner = {"user-a": USER_A, "user-b": USER_B}.get(token)
        path = request.url.path
        if path == "/auth/v1/user":
            return httpx.Response(200, json={"id": owner}) if owner else httpx.Response(401)
        if f"{request.method} {path}" in failures:
            return httpx.Response(
                failures[f"{request.method} {path}"], json={"message": "private error"}
            )
        if path == "/rest/v1/companies":
            assert request.url.params["user_id"] == f"eq.{owner}"
            selected = [row for row in companies.values() if row["user_id"] == owner]
            if "id" in request.url.params:
                selected = [
                    row for row in selected if request.url.params["id"] == f"eq.{row['id']}"
                ]
            return httpx.Response(200, json=selected)
        if path == "/rest/v1/imports":
            if request.method == "POST":
                body = json.loads(request.content)
                assert body["user_id"] == owner
                assert companies[body["company_id"]]["user_id"] == owner
                records[body["id"]] = {
                    "created_at": NOW,
                    "updated_at": NOW,
                    "row_count": None,
                    "error_message": None,
                    "processed_at": None,
                    **body,
                }
                return httpx.Response(201)
            assert request.url.params["user_id"] == f"eq.{owner}"
            selected = [row for row in records.values() if row["user_id"] == owner]
            for key in ["id", "company_id", "kind", "status"]:
                if key in request.url.params:
                    selected = [
                        row for row in selected if request.url.params[key] == f"eq.{row[key]}"
                    ]
            if request.method == "GET":
                offset = int(request.url.params.get("offset", 0))
                return httpx.Response(200, json=selected[offset : offset + 100])
            if request.method == "PATCH":
                assert request.url.params["status"] in {"eq.reserved", "eq.processing"}
                if "processing_token" in request.url.params:
                    selected = [
                        row
                        for row in selected
                        if request.url.params["processing_token"]
                        == f"eq.{row.get('processing_token')}"
                    ]
                if controls.get("race"):
                    return httpx.Response(200, json=[])
                for row in selected:
                    row.update(json.loads(request.content))
                return httpx.Response(200, json=selected)
            if request.method == "DELETE":
                for row in selected:
                    del records[row["id"]]
                    for table, entries in derived.items():
                        derived[table] = [
                            entry for entry in entries if entry["import_id"] != row["id"]
                        ]
                return httpx.Response(200, json=selected)
        if path == "/rest/v1/financial_lines":
            assert request.url.params["user_id"] == f"eq.{owner}"
            company_id = request.url.params["company_id"].removeprefix("eq.")
            selected = [
                entry
                for entry in derived["financial_lines"]
                if entry.get("company_id") == company_id
                and entry.get("user_id") == owner
                and records.get(entry["import_id"], {}).get("status") == "processed"
            ]
            for key in ("kind", "department", "account_type"):
                if key in request.url.params:
                    selected = [
                        entry for entry in selected if request.url.params[key] == f"eq.{entry[key]}"
                    ]
            start, end = request.url.params["and"].strip("()").split(",")
            start, end = start.removeprefix("period.gte."), end.removeprefix("period.lte.")
            selected = [entry for entry in selected if start <= entry["period"] <= end]
            offset = int(request.url.params.get("offset", 0))
            return httpx.Response(200, json=selected[offset : offset + 1000])
        if path.startswith("/rest/v1/rpc/"):
            body = json.loads(request.content)
            row = records.get(body["p_import_id"])
            if not row or row["user_id"] != owner:
                return httpx.Response(200, json=[])
            if path.endswith("claim_import"):
                if row["status"] not in {"uploaded", "failed"}:
                    return httpx.Response(200, json=[])
                row.update(status="processing", processing_token=body["p_token"])
            else:
                assert row["status"] == "processing" and row["processing_token"] == body["p_token"]
                table = "cash_items" if row["kind"] == "cash" else "financial_lines"
                derived[table] = [
                    entry for entry in derived[table] if entry["import_id"] != row["id"]
                ]
                derived[table].extend({**entry, "import_id": row["id"]} for entry in body["p_rows"])
                row.update(
                    status="processed", row_count=len(body["p_rows"]), warnings=body["p_warnings"]
                )
            return httpx.Response(200, json=[row])
        download = "/storage/v1/object/authenticated/fpna-imports/"
        if path.startswith(download):
            key = path.removeprefix(download)
            assert key.startswith(f"{owner}/")
            return httpx.Response(200, content=controls["file_bytes"])
        sign = "/storage/v1/object/upload/sign/fpna-imports/"
        if path.startswith(sign):
            key = path.removeprefix(sign)
            assert key.startswith(f"{owner}/")
            assert request.method == "POST" and json.loads(request.content) == {}
            assert request.headers.get("x-upsert") != "true"
            return httpx.Response(
                200,
                json={
                    "url": controls.get("signed_url")
                    or f"/object/upload/sign/fpna-imports/{key}?token=mock-upload-token"
                },
            )
        info = "/storage/v1/object/info/fpna-imports/"
        if path.startswith(info):
            key = path.removeprefix(info)
            assert request.method == "GET" and key.startswith(f"{owner}/")
            return httpx.Response(200, json=objects[key]) if key in objects else httpx.Response(404)
        if path == "/storage/v1/object/fpna-imports":
            assert request.method == "DELETE"
            for key in json.loads(request.content)["prefixes"]:
                assert key.startswith(f"{owner}/")
                objects.pop(key, None)
            return httpx.Response(200, json=[])
        raise AssertionError(f"Unexpected request: {request.method} {request.url}")

    original = httpx.AsyncClient
    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **kwargs: original(transport=httpx.MockTransport(handle), **kwargs),
    )
    yield {
        "client": TestClient(create_app()),
        "records": records,
        "objects": objects,
        "derived": derived,
        "calls": calls,
        "failures": failures,
        "controls": controls,
    }


def auth(token: str = "user-a") -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def reserve(env, **changes):
    payload = {
        "kind": "budget",
        "filename": "budget.csv",
        "mime_type": "text/csv",
        "size_bytes": 12,
        **changes,
    }
    return env["client"].post(
        f"/api/v1/companies/{COMPANY_A}/imports/reserve", headers=auth(), json=payload
    )


def test_process_is_atomic_and_not_repeatable(imports_api):
    env = imports_api
    data = b"period,department,account_code,account_name,account_type,amount\n2026-10,Sales,001,Sales,revenue,123.45\n"
    reservation = reserve(env, size_bytes=len(data)).json()
    id = reservation["import_id"]
    env["objects"][reservation["storage_path"]] = {"size": len(data)}
    env["controls"]["file_bytes"] = data
    env["client"].post(f"/api/v1/imports/{id}/complete", headers=auth())
    response = env["client"].post(f"/api/v1/imports/{id}/process", headers=auth())
    assert response.status_code == 200 and response.json()["row_count"] == 1
    assert len(env["derived"]["financial_lines"]) == 1
    assert env["client"].post(f"/api/v1/imports/{id}/process", headers=auth()).status_code == 409
    assert (
        env["client"].post(f"/api/v1/imports/{id}/process", headers=auth("user-b")).status_code
        == 404
    )


def test_failed_import_has_row_errors_and_retry_does_not_duplicate(imports_api):
    env = imports_api
    data = b"period,department,account_code,account_name,account_type,amount\n2026-10,Sales,001,Sales,revenue,bad\n"
    reservation = reserve(env, size_bytes=len(data)).json()
    id = reservation["import_id"]
    env["objects"][reservation["storage_path"]] = {"size": len(data)}
    env["controls"]["file_bytes"] = data
    env["client"].post(f"/api/v1/imports/{id}/complete", headers=auth())
    for _ in range(2):
        response = env["client"].post(f"/api/v1/imports/{id}/process", headers=auth())
        assert response.status_code == 422
        assert response.json()["error"]["details"]["issues"][0]["row"] == 2
        assert env["records"][id]["status"] == "failed"
        assert env["derived"]["financial_lines"] == []


@pytest.mark.parametrize("kind", ["budget", "actual", "cash"])
def test_reserve_complete_and_metadata(imports_api, kind):
    env = imports_api
    result = reserve(env, kind=kind)
    assert result.status_code == 201
    reservation = result.json()
    id = reservation["import_id"]
    assert reservation["status"] == "reserved"
    assert reservation["storage_path"] == f"{USER_A}/{COMPANY_A}/{id}/budget.csv"
    assert reservation["upload"]["expires_in_seconds"] == 7200
    assert reservation["upload"]["signed_url"].startswith(
        "https://example.supabase.co/storage/v1/object/upload/sign/fpna-imports/"
    )
    assert result.headers["cache-control"] == "private, no-store"
    path = f"/api/v1/imports/{id}"
    record = env["client"].get(path, headers=auth()).json()
    assert record["kind"] == kind and record["status"] == "reserved"
    assert "upload" not in record
    env["objects"][record["storage_path"]] = {"size": 12, "content_type": "text/csv"}
    result = env["client"].post(f"{path}/complete", headers=auth())
    assert result.status_code == 200
    assert result.json()["status"] == "uploaded"
    assert result.json()["updated_at"] != record["updated_at"]
    assert result.json()["row_count"] is None and result.json()["processed_at"] is None
    assert env["client"].post(f"{path}/complete", headers=auth()).status_code == 409
    assert not any(request.method == "PUT" for request in env["calls"])


def test_xlsx_boundary_and_safe_filename(imports_api):
    result = reserve(
        imports_api,
        filename=r"..\private\नेपाल Budget 2026.XLSX",
        mime_type=MIME_TYPES[".xlsx"],
        size_bytes=MAX_FILE_BYTES,
    )
    assert result.status_code == 201
    assert result.json()["storage_path"].endswith("/Budget_2026.xlsx")
    assert ".." not in result.json()["storage_path"]


@pytest.mark.parametrize(
    "changes,status",
    [
        ({"kind": "forecast"}, 422),
        ({"filename": "data.pdf"}, 422),
        ({"filename": "data.xls"}, 422),
        ({"filename": "data.xlsm"}, 422),
        ({"filename": "data.csv.exe"}, 422),
        ({"filename": ""}, 422),
        ({"size_bytes": MAX_FILE_BYTES + 1}, 413),
        ({"size_bytes": 0}, 422),
        ({"size_bytes": -1}, 422),
        ({"size_bytes": True}, 422),
        ({"size_bytes": 1.5}, 422),
        ({"mime_type": "image/png"}, 422),
        ({"user_id": USER_B}, 422),
    ],
)
def test_invalid_reservation_does_not_create_row(imports_api, changes, status):
    assert reserve(imports_api, **changes).status_code == status
    assert imports_api["records"] == {}
    assert not any("/storage/" in request.url.path for request in imports_api["calls"])


def test_missing_upload_cannot_complete(imports_api):
    record = reserve(imports_api).json()
    response = imports_api["client"].post(
        f"/api/v1/imports/{record['import_id']}/complete", headers=auth()
    )
    assert response.status_code == 409 and response.json()["error"]["code"] == "UPLOAD_MISSING"
    assert imports_api["records"][record["import_id"]]["status"] == "reserved"


@pytest.mark.parametrize(
    "size,status", [(13, 422), (MAX_FILE_BYTES + 1, 413), (None, 503), (True, 503)]
)
def test_stored_size_is_verified(imports_api, size, status):
    reservation = reserve(imports_api).json()
    imports_api["objects"][reservation["storage_path"]] = {"size": size}
    response = imports_api["client"].post(
        f"/api/v1/imports/{reservation['import_id']}/complete", headers=auth()
    )
    assert response.status_code == status
    assert imports_api["records"][reservation["import_id"]]["status"] == "reserved"


def test_ownership_before_any_storage_access(imports_api):
    id = reserve(imports_api).json()["import_id"]
    imports_api["calls"].clear()
    client = imports_api["client"]
    for method, path in [
        ("GET", f"/imports/{id}"),
        ("POST", f"/imports/{id}/complete"),
        ("DELETE", f"/imports/{id}"),
        ("GET", f"/companies/{COMPANY_A}/imports"),
    ]:
        assert client.request(method, f"/api/v1{path}", headers=auth("user-b")).status_code == 404
    assert (
        client.post(
            f"/api/v1/companies/{COMPANY_B}/imports/reserve",
            headers=auth(),
            json={
                "kind": "cash",
                "filename": "cash.csv",
                "mime_type": "text/csv",
                "size_bytes": 10,
            },
        ).status_code
        == 404
    )
    assert not any("/storage/" in request.url.path for request in imports_api["calls"])


def test_storage_path_cannot_escape_import(imports_api):
    id = reserve(imports_api).json()["import_id"]
    imports_api["records"][id]["storage_path"] = f"{USER_A}/{COMPANY_A}/another-import/budget.csv"
    imports_api["calls"].clear()
    assert imports_api["client"].delete(f"/api/v1/imports/{id}", headers=auth()).status_code == 409
    assert not any("/storage/" in request.url.path for request in imports_api["calls"])


def test_delete_removes_only_this_object_and_cascades_derived_rows(imports_api):
    first = reserve(imports_api).json()
    second = reserve(imports_api, kind="cash").json()
    for reservation in [first, second]:
        imports_api["objects"][reservation["storage_path"]] = {"size": 12}
        for table in imports_api["derived"]:
            imports_api["derived"][table].append({"import_id": reservation["import_id"]})
    result = imports_api["client"].delete(f"/api/v1/imports/{first['import_id']}", headers=auth())
    assert result.status_code == 204
    assert first["import_id"] not in imports_api["records"]
    assert first["storage_path"] not in imports_api["objects"]
    assert second["storage_path"] in imports_api["objects"]
    assert all(
        rows == [{"import_id": second["import_id"]}] for rows in imports_api["derived"].values()
    )
    assert (
        imports_api["client"]
        .get(f"/api/v1/imports/{first['import_id']}", headers=auth())
        .status_code
        == 404
    )


def test_delete_missing_file_and_cleanup_failure_retry(imports_api):
    reservation = reserve(imports_api).json()
    path = f"/api/v1/imports/{reservation['import_id']}"
    imports_api["failures"]["DELETE /storage/v1/object/fpna-imports"] = 500
    result = imports_api["client"].delete(path, headers=auth())
    assert result.status_code == 503 and "private error" not in result.text
    assert reservation["import_id"] in imports_api["records"]
    imports_api["failures"].clear()
    assert imports_api["client"].delete(path, headers=auth()).status_code == 204


def test_bad_signing_response_rolls_back_reservation(imports_api):
    imports_api["controls"]["signed_url"] = "https://attacker.example/file?token=bad"
    assert reserve(imports_api).status_code == 503
    assert imports_api["records"] == {}


def test_storage_signing_failure_can_leave_visible_reservation_when_rollback_fails(imports_api):
    imports_api["controls"]["signed_url"] = "invalid"
    imports_api["failures"]["DELETE /rest/v1/imports"] = 500
    assert reserve(imports_api).status_code == 503
    result = imports_api["client"].get(f"/api/v1/companies/{COMPANY_A}/imports", headers=auth())
    assert len(result.json()) == 1 and result.json()[0]["status"] == "reserved"


def test_completion_compare_and_set_handles_race(imports_api):
    reservation = reserve(imports_api).json()
    imports_api["objects"][reservation["storage_path"]] = {"size": 12}
    imports_api["controls"]["race"] = True
    assert (
        imports_api["client"]
        .post(f"/api/v1/imports/{reservation['import_id']}/complete", headers=auth())
        .status_code
        == 409
    )


def test_list_filters_and_pagination(imports_api):
    reservation = reserve(imports_api).json()
    record = imports_api["records"][reservation["import_id"]]
    for _ in range(104):
        id = str(uuid4())
        imports_api["records"][id] = {**record, "id": id}
    reserve(imports_api, kind="actual")
    client = imports_api["client"]
    path = f"/api/v1/companies/{COMPANY_A}/imports"
    assert len(client.get(path, headers=auth()).json()) == 106
    assert len(client.get(f"{path}?kind=budget&status=reserved", headers=auth()).json()) == 105
    assert client.get(f"{path}?status=uploaded", headers=auth()).json() == []
    assert client.get(f"{path}?kind=forecast", headers=auth()).status_code == 422


def test_all_routes_require_auth(imports_api):
    id = str(uuid4())
    for method, path in [
        ("POST", f"/companies/{COMPANY_A}/imports/reserve"),
        ("GET", f"/companies/{COMPANY_A}/imports"),
        ("GET", f"/imports/{id}"),
        ("POST", f"/imports/{id}/complete"),
        ("DELETE", f"/imports/{id}"),
    ]:
        assert imports_api["client"].request(method, f"/api/v1{path}").status_code == 401
    assert imports_api["calls"] == []
