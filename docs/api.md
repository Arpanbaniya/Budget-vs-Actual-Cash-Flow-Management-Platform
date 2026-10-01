# API contract

Production origin: `https://flow-forecast.vercel.app`; prefix: `/api/v1`.
All workspace routes require `Authorization: Bearer <Supabase access token>`.
`GET /health` is public and returns `{"status":"ok"}`. `GET /me` returns the
verified user ID and email. Workspace responses are private and not cached.

Errors use `{"error":{"code":"...","message":"...","details":{}}}`.
Common statuses: 401 invalid/missing auth, 404 missing/foreign resource, 409 state
conflict, 413 oversized input, 422 invalid input or missing cash balance, 503
upstream temporarily unavailable. Decimal financial values are JSON strings.

| Resource | Routes | Contract |
| --- | --- | --- |
| Companies | POST/GET `/companies`; GET/PATCH/DELETE `/companies/{id}` | Name, currency, fiscal start 1–12, nonnegative threshold. [Details](companies.md) |
| Imports | POST `/companies/{id}/imports/reserve`; POST `/imports/{id}/complete`; POST `/imports/{id}/process`; GET `/companies/{id}/imports`; GET/DELETE `/imports/{id}` | Private upload reservation, verification, parsing, history, cleanup. [Details](imports.md) |
| Financial lines | GET `/companies/{id}/financial-lines` | `from`, `to`; optional `kind`, `department`, `account_type`, `page`, `page_size` |
| Variance | GET `/companies/{id}/variance` | `from`, `to`; optional `department`, `group_by=account|department|month` |
| Dashboard | GET `/companies/{id}/dashboard` | `from`, `to`; optional `cash_start_date`, `scenario_id`. [Details](dashboard.md) |
| Cash balances | POST/GET `/companies/{id}/cash-balances`; PATCH/DELETE `/cash-balances/{id}` | Dated opening snapshots; date immutable after creation. [Details](cash-records.md) |
| Cash items | POST/GET `/companies/{id}/cash-items`; PATCH/DELETE `/cash-items/{id}` | Expected date, description, category, direction, amount, status. [Details](cash-records.md) |
| Forecast | GET `/companies/{id}/cash-forecast` | `start_date`, `weeks=13` (1–26), optional `scenario_id` |
| Scenarios | POST/GET `/companies/{id}/scenarios`; GET/PATCH/DELETE `/scenarios/{id}` | Name, in/out adjustment percentages, collection delay. [Details](scenarios.md) |
| Insights | POST `/companies/{id}/insights` | Period/cash start/scenario body below. Returns provider, fallback_used, cached, text. [Details](insights.md) |
| Reports | POST `/companies/{id}/reports/excel`; GET `/companies/{id}/reports`; GET/DELETE `/reports/{id}` | Metadata lifecycle and fresh 300-second signed downloads. [Details](reports.md) |

Insights and Excel request example:

```json
{"from":"2026-09-01","to":"2026-09-30","cash_start_date":"2026-10-01","scenario_id":null}
```

Financial-line and cash lists return `items`, `total`, `page`, `page_size`, with
page size 1–100. Reports return `items`, `page`, `page_size` (default 20).
Company/import/scenario lists return arrays; database reads page internally.
Imports support `kind` and `status` filters; cash items support `from`, `to`,
`direction`, `status`, and `category`. Company/import list limits are 10,000;
analytical reads are limited to 200,000 rows. Missing financial groups count as zero.

Writes reject extra fields, invalid dates, empty/non-null patches, and ownership
fields. Creation returns 201; deletion returns 204. Every child resource verifies
its owned parent. Source amounts, company, import, and user IDs are never accepted
as arbitrary reassignment fields in patch operations.
