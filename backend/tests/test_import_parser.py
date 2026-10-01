import io
from datetime import date

import pytest
from openpyxl import Workbook

from app.import_parser import ImportValidationError, parse_import

HEADER = "period,department,account_code,account_name,account_type,amount\n"
ROW = "2026-10-12,Sales,001,Sales,revenue,123.456\n"


def test_csv_preserves_precision_codes_and_source_row():
    result = parse_import((HEADER + ROW).encode(), "a.csv", "budget")
    assert result.rows[0] == {
        "period": "2026-10-01",
        "department": "Sales",
        "account_code": "001",
        "account_name": "Sales",
        "account_type": "revenue",
        "amount": "123.456",
        "source_row": 2,
    }


@pytest.mark.parametrize("replacement", ["NaN", "Infinity", "abc", "1e100", "-1"])
def test_cash_rejects_invalid_amounts(replacement):
    data = f"expected_date,description,category,direction,amount,status\n2026-10-01,Pay,Sales,inflow,{replacement},planned\n"
    with pytest.raises(ImportValidationError) as error:
        parse_import(data.encode(), "cash.csv", "cash")
    assert error.value.issues[0]["row"] == 2


def test_signed_financial_amount_warns():
    result = parse_import((HEADER + ROW.replace("123.456", "-12")).encode(), "a.csv", "actual")
    assert result.rows[0]["amount"] == "-12"
    assert result.warnings[0]["row"] == 2


@pytest.mark.parametrize(
    "data",
    [
        "",
        HEADER,
        HEADER + ROW.replace("2026-10-12", "2026-02-30"),
        HEADER + ROW.replace("revenue", "wrong"),
        HEADER + ROW.replace("Sales,001", ",001"),
        HEADER + ROW.replace("123.456", "123,456"),
        HEADER.replace("amount", "period"),
    ],
)
def test_invalid_csv_has_readable_errors(data):
    with pytest.raises(ImportValidationError) as error:
        parse_import(data.encode(), "a.csv", "budget")
    assert error.value.issues[0]["message"]


def workbook_bytes(formula=False):
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(HEADER.strip().split(","))
    sheet.append(
        [date(2026, 10, 12), "Sales", "001", "Sales", "revenue", "=1+2" if formula else 123]
    )
    workbook.create_sheet("Ignored").append(["invalid"])
    buffer = io.BytesIO()
    workbook.save(buffer)
    workbook.close()
    return buffer.getvalue()


def test_xlsx_uses_first_sheet_and_excel_dates():
    result = parse_import(workbook_bytes(), "a.xlsx", "actual")
    assert len(result.rows) == 1
    assert result.rows[0]["period"] == "2026-10-01"


@pytest.mark.parametrize("data", [b"not a zip", workbook_bytes(True)])
def test_invalid_xlsx(data):
    with pytest.raises(ImportValidationError):
        parse_import(data, "a.xlsx", "budget")
