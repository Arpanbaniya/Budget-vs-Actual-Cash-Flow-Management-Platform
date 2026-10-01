import pytest
from test_imports import COMPANY_A, auth


def test_balance_duplicate_edit_delete_and_owner(imports_api):
    client = imports_api["client"]
    path = f"/api/v1/companies/{COMPANY_A}/cash-balances"
    body = {"balance_date": "2026-10-01", "amount": "-12.345", "note": "Overdraft"}
    response = client.post(path, headers=auth(), json=body)
    assert response.status_code == 201 and response.json()["amount"] == "-12.345"
    id = response.json()["id"]
    assert client.post(path, headers=auth(), json=body).status_code == 409
    assert client.get(path, headers=auth()).json()["total"] == 1
    record_path = f"/api/v1/cash-balances/{id}"
    assert (
        client.patch(record_path, headers=auth("user-b"), json={"amount": "0"}).status_code == 404
    )
    assert (
        client.patch(record_path, headers=auth(), json={"balance_date": "2026-11-01"}).status_code
        == 422
    )
    assert client.patch(record_path, headers=auth(), json={"note": None}).status_code == 200
    assert client.delete(record_path, headers=auth("user-b")).status_code == 404
    assert client.delete(record_path, headers=auth()).status_code == 204


def test_cash_items_filters_pagination_and_imported_edit(imports_api):
    client = imports_api["client"]
    path = f"/api/v1/companies/{COMPANY_A}/cash-items"
    body = {
        "expected_date": "2026-10-05",
        "description": "Collection",
        "category": "Receipts",
        "direction": "inflow",
        "amount": "0.1234567891",
        "status": "planned",
    }
    response = client.post(path, headers=auth(), json=body)
    assert response.status_code == 201
    id = response.json()["id"]
    client.post(path, headers=auth(), json={**body, "direction": "outflow"})
    assert client.get(path + "?direction=inflow&page_size=1", headers=auth()).json()["total"] == 1
    assert client.get(path + "?from=2026-11-01", headers=auth()).json()["total"] == 0
    assert client.get(path + "?page=2&page_size=1", headers=auth()).json()["items"]
    item_path = f"/api/v1/cash-items/{id}"
    assert client.patch(item_path, headers=auth("user-b"), json={"amount": "1"}).status_code == 404
    imports_api["derived"]["cash_items"][0]["import_id"] = "source-import"
    result = client.patch(
        item_path, headers=auth(), json={"status": "confirmed", "amount": "5"}
    ).json()
    assert result["import_id"] == "source-import" and result["amount"] == "5"
    assert client.delete(item_path, headers=auth()).status_code == 204


@pytest.mark.parametrize(
    "change",
    [
        {"amount": "-1"},
        {"amount": "NaN"},
        {"amount": "1e21"},
        {"description": " "},
        {"direction": "bad"},
        {"status": "bad"},
        {"expected_date": "bad"},
        {"user_id": "other"},
        {"import_id": "other"},
    ],
)
def test_cash_input_rejects_bad_values(imports_api, change):
    body = {
        "expected_date": "2026-10-05",
        "description": "Collection",
        "category": "Receipts",
        "direction": "inflow",
        "amount": "10",
        "status": "planned",
        **change,
    }
    assert (
        imports_api["client"]
        .post(f"/api/v1/companies/{COMPANY_A}/cash-items", headers=auth(), json=body)
        .status_code
        == 422
    )
