# Database and private Storage

Phase 2 defines the data model in [the schema migration](../supabase/migrations/20260930120000_initial_schema.sql) and [the Storage migration](../supabase/migrations/20260930120100_private_storage.sql). Both migrations are recorded as applied in the `stfciijaeixrygvrgdrn` Supabase project, and the eight public tables are present. Phase 3 adds authentication, while company and finance data flows arrive in later phases.

## Tables

| Table | Purpose | Key constraints |
| --- | --- | --- |
| `companies` | User-owned companies and fiscal settings. | Fiscal year start is 1–12; default currency is USD. |
| `imports` | Uploaded budget, actual, and cash file records and processing state. | Kind is `budget`, `actual`, or `cash`; status follows reserved/uploaded/processing/processed/failed. |
| `financial_lines` | Normalized budget and actual rows. | Account type allowlist; company and import must have the same owner. Indexes support company, period, kind, department, and account code. |
| `cash_balances` | Dated opening cash balances. | One balance per company and date. |
| `cash_items` | Planned, confirmed, and actual cash inflows/outflows. | Amount is nonnegative; optional import must belong to the same company and owner. |
| `scenarios` | Adjustments to planned cash flows. | Percentages are −100 to 500; collection delay is 0–365 days. |
| `analysis_results` | Saved Groq or deterministic commentary and input parameters. | Provider is `groq` or `deterministic`. |
| `reports` | Excel generation state and private object path. | Status is generating/ready/failed. |

Every table has `user_id` and Row Level Security. Separate SELECT, INSERT, UPDATE, and DELETE policies allow an authenticated user to access only rows with their own `user_id`. Composite foreign keys prevent a user's child record from referencing another user's company or import. Backend ownership checks are still required when the API is implemented.

Deleting a company cascades to its related database records. The Phase 4 delete endpoint removes private objects under that company's user/company folders through the Storage API before deleting the company row. See [company management](companies.md) for failure and retry behavior.

## Private files

Both `fpna-imports` and `fpna-reports` are private buckets. Their object policies require the first path segment to equal the authenticated user's UUID for reads, uploads, updates, and deletes. Objects use these paths:

```text
fpna-imports/{user_id}/{company_id}/{import_id}/{safe_filename}
fpna-reports/{user_id}/{company_id}/{report_id}/management_report.xlsx
```

The future API will issue signed upload and download URLs. These paths do not make files publicly accessible.

## CSV templates

The downloadable header-only files are [budget](../frontend/public/templates/budget_template.csv), [actual](../frontend/public/templates/actual_template.csv), and [cash](../frontend/public/templates/cash_template.csv). Budget and actual rows need `period,department,account_code,account_name,account_type,amount`. `period` accepts `YYYY-MM` or `YYYY-MM-DD` and is normalized to the first of the month by the future importer. `account_type` is one of `revenue`, `cogs`, `operating_expense`, `other_income`, or `other_expense`. Signed amounts are allowed for budget and actual rows.

Cash rows need `expected_date,description,category,direction,amount,status`. Use a valid date, `inflow` or `outflow`, a nonnegative amount, and `planned`, `confirmed`, or `actual` status. Validation and import handling belong to later phases.

## Apply to another Supabase project

From the repository root, sign in to the Supabase CLI and link the intended project:

```powershell
pnpm dlx supabase login
pnpm dlx supabase link --project-ref <OTHER_PROJECT_REF>
pnpm dlx supabase db push
```

Get the project reference from the Supabase project dashboard. `db push` applies both migrations in order. The current production project already lists both migration versions, so no additional push is needed there. Do not run it against a project that already has conflicting tables or policies without reviewing the SQL and migration history first. See [Supabase setup](../supabase/README.md).
