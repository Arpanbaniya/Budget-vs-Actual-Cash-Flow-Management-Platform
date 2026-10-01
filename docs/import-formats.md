# Import formats

Upload CSV (UTF-8 with optional BOM) or XLSX (first worksheet only), up to five MB.
Choose budget, actual, or cash. XLSX formulas/macros are rejected. Maximum 50,000
data rows and 64 columns; ZIP entry/expanded-size limits apply. Headers must be
unique and include all required columns. Extra columns are ignored with a warning.

Budget/actual:

```csv
period,department,account_code,account_name,account_type,amount
2026-09,Sales,004000,Sales,revenue,100000
```

`period` is `YYYY-MM` or `YYYY-MM-DD`, normalized to the first day of the month.
Account types: revenue, cogs, operating_expense, other_income, other_expense.
Account codes are text; use text cells in Excel to preserve leading zeros.
Amounts must be finite decimal values; signed adjustments are allowed and warned.
No thousands separators or currency symbols. Magnitude at most 1e20 and at most
ten decimal places. Required text is trimmed and limited to 500 characters.

Cash:

```csv
expected_date,description,category,direction,amount,status
2026-10-02,Customer collection,Receipts,inflow,50000,planned
```

Dates are `YYYY-MM-DD`. Direction is inflow/outflow; amount is nonnegative.
Status is planned/confirmed/actual. All statuses contribute to the base forecast;
only planned rows change under scenarios.

Validation failure persists readable errors and inserts no partial rows. Fix the
source and upload a new import, or retry a failed/transient run. Processing leases
recover interruptions after ten minutes. Multiple processed imports add together;
delete superseded imports to avoid duplicate totals. Deletion cascades derived rows.

See [upload/retry contract](imports.md) and [populated demo samples](samples/README.md).
