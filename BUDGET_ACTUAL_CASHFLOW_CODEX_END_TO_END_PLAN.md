# Budget vs Actual + 13-Week Cash Flow Management
## End-to-End System Specification + Phase-by-Phase Codex Prompts

> **Goal:** Build, test, and deploy a complete FP&A portfolio application.
>
> Stack:
> - Next.js + TypeScript frontend
> - FastAPI + Python backend
> - Supabase Auth + Postgres + private Storage
> - Groq for optional commentary
> - deterministic Python fallback
> - GitHub + GitHub Actions
> - two Vercel projects from one monorepo
>
> Core rule: **financial calculations are deterministic; Groq only explains results.**

---

# 1. MVP Scope

The finished application must allow an authenticated user to:

1. create/manage a company
2. upload budget CSV/XLSX
3. upload actual CSV/XLSX
4. upload cash-plan CSV/XLSX
5. validate imports
6. calculate budget-vs-actual variances
7. classify favorable/unfavorable variances
8. calculate budget and actual operating profit
9. maintain dated cash balances
10. manage cash inflow/outflow items
11. generate a rolling 13-week cash forecast
12. create scenarios
13. compare base vs scenario cash forecasts
14. view dashboards/charts/tables
15. request Groq commentary
16. automatically fall back to deterministic commentary
17. generate/download Excel management reports
18. deploy frontend/backend to Vercel

Out of scope:

```text
PDF parsing
OCR
machine learning
RAG
fine-tuning
QuickBooks/Xero integrations
bank feeds
multi-user teams
enterprise RBAC
DCF
portfolio analytics
invoice processing
```

---

# 2. Production Architecture

Use one GitHub monorepo:

```text
fpna-budget-cashflow/
├── frontend/
├── backend/
├── supabase/
├── docs/
├── .github/
├── README.md
└── .gitignore
```

Deploy as two Vercel projects:

```text
                    GitHub Monorepo
                    /            \
                   /              \
          Vercel Frontend     Vercel Backend
          root=frontend/      root=backend/
          Next.js             FastAPI
                 \             /
                  \           /
                    Supabase
             Auth + DB + Storage
                         |
                         |
                     Groq API
                         |
                  on failure
                         |
               deterministic fallback
```

Why two Vercel projects:

- simple and stable
- clear frontend/backend boundaries
- no dependency on multi-service beta
- separate logs and environment variables
- still one GitHub repository

---

# 3. Upload Architecture

Do not proxy file bytes through FastAPI.

Flow:

```text
Browser
 ↓
POST reserve import
 ↓
FastAPI creates import record + signed Supabase upload URL
 ↓
Browser uploads directly to private Supabase Storage
 ↓
POST complete
 ↓
POST process
 ↓
FastAPI downloads file from Supabase
 ↓
parse + validate + persist rows
```

Allowed:

```text
.csv
.xlsx
```

Rejected:

```text
.pdf
.xls
.xlsm
.zip
```

Application max:

```text
5 MB
```

---

# 4. Repository Structure

```text
fpna-budget-cashflow/
│
├── frontend/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── signup/
│   │   ├── dashboard/
│   │   ├── companies/
│   │   ├── imports/
│   │   ├── variance/
│   │   ├── cash-forecast/
│   │   ├── scenarios/
│   │   ├── insights/
│   │   └── reports/
│   ├── components/
│   ├── lib/
│   │   ├── api/
│   │   ├── supabase/
│   │   ├── formatting/
│   │   └── types/
│   ├── public/templates/
│   ├── tests/
│   ├── package.json
│   └── .env.example
│
├── backend/
│   ├── api/index.py
│   ├── app/
│   │   ├── auth/
│   │   ├── config/
│   │   ├── routes/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── utils/
│   ├── domain/
│   │   ├── imports/
│   │   ├── variance/
│   │   ├── cashflow/
│   │   ├── scenarios/
│   │   ├── insights/
│   │   └── reports/
│   ├── tests/
│   ├── requirements.txt
│   ├── pyproject.toml
│   ├── .python-version
│   └── .env.example
│
├── supabase/
│   ├── migrations/
│   └── seed.sql
│
├── docs/
│   ├── architecture.md
│   ├── api.md
│   ├── finance-methodology.md
│   ├── import-formats.md
│   └── deployment.md
│
├── .github/workflows/ci.yml
├── README.md
└── .gitignore
```

---

# 5. Authentication

Use Supabase Auth.

Frontend:

```text
Supabase SSR/cookie session
```

FastAPI requests include:

```text
Authorization: Bearer <Supabase access token>
```

Backend must:

1. verify token
2. obtain user ID
3. scope every protected query to that user
4. verify ownership before accessing company/resource

Public endpoint only:

```text
GET /api/v1/health
```

Everything else protected.

---

# 6. Storage

Private buckets:

```text
fpna-imports
fpna-reports
```

Import path:

```text
{user_id}/{company_id}/{import_id}/{safe_filename}
```

Report path:

```text
{user_id}/{company_id}/{report_id}/management_report.xlsx
```

Use signed URLs for:

- upload
- report download

Never use public buckets.

---

# 7. Database Schema

## companies

```text
id                      uuid PK
user_id                 uuid NOT NULL
name                    text NOT NULL
currency                text NOT NULL default 'USD'
fiscal_year_start_month int NOT NULL default 1
minimum_cash_threshold  numeric NOT NULL default 0
created_at              timestamptz
updated_at              timestamptz
```

Constraint:

```text
fiscal_year_start_month between 1 and 12
```

## imports

```text
id              uuid PK
user_id         uuid NOT NULL
company_id      uuid FK companies
kind            text NOT NULL
filename        text NOT NULL
storage_path    text NOT NULL
mime_type       text
size_bytes      bigint
status          text NOT NULL
row_count       int
error_message   text
created_at      timestamptz
updated_at      timestamptz
processed_at    timestamptz
```

kind:

```text
budget
actual
cash
```

status:

```text
reserved
uploaded
processing
processed
failed
```

## financial_lines

Stores budget and actual.

```text
id              uuid PK
user_id         uuid NOT NULL
company_id      uuid FK
import_id       uuid FK
kind            text NOT NULL
period          date NOT NULL
department      text NOT NULL
account_code    text NOT NULL
account_name    text NOT NULL
account_type    text NOT NULL
amount          numeric NOT NULL
source_row      int
created_at      timestamptz
```

kind:

```text
budget
actual
```

account_type:

```text
revenue
cogs
operating_expense
other_income
other_expense
```

Indexes:

```text
(company_id, period)
(company_id, kind, period)
(company_id, department)
(company_id, account_code)
```

## cash_balances

```text
id              uuid PK
user_id         uuid NOT NULL
company_id      uuid FK
balance_date    date NOT NULL
amount          numeric NOT NULL
note            text
created_at      timestamptz
updated_at      timestamptz
```

Unique:

```text
(company_id, balance_date)
```

## cash_items

```text
id              uuid PK
user_id         uuid NOT NULL
company_id      uuid FK
import_id       uuid nullable FK
expected_date   date NOT NULL
description     text NOT NULL
category        text NOT NULL
direction       text NOT NULL
amount          numeric NOT NULL
status          text NOT NULL
source_row      int
created_at      timestamptz
updated_at      timestamptz
```

direction:

```text
inflow
outflow
```

status:

```text
planned
confirmed
actual
```

Constraint:

```text
amount >= 0
```

## scenarios

```text
id                       uuid PK
user_id                  uuid NOT NULL
company_id               uuid FK
name                     text NOT NULL
inflow_adjustment_pct    numeric NOT NULL default 0
outflow_adjustment_pct   numeric NOT NULL default 0
collection_delay_days    int NOT NULL default 0
created_at               timestamptz
updated_at               timestamptz
```

## analysis_results

```text
id              uuid PK
user_id         uuid NOT NULL
company_id      uuid FK
fact_hash       text NOT NULL
provider        text NOT NULL
fallback_used   boolean NOT NULL
analysis_text   text NOT NULL
parameters      jsonb NOT NULL
created_at      timestamptz
```

provider:

```text
groq
deterministic
```

## reports

```text
id              uuid PK
user_id         uuid NOT NULL
company_id      uuid FK
status          text NOT NULL
storage_path    text
parameters      jsonb NOT NULL
error_message   text
created_at      timestamptz
completed_at    timestamptz
```

status:

```text
generating
ready
failed
```

---

# 8. RLS

Enable Row Level Security for every user-owned table.

Core rule:

```sql
auth.uid() = user_id
```

Create explicit:

```text
SELECT
INSERT
UPDATE
DELETE
```

policies.

Storage policies must ensure first path segment is authenticated user's ID.

Backend ownership checks are still mandatory.

---

# 9. Input Formats

## Budget / Actual

Required:

```text
period
department
account_code
account_name
account_type
amount
```

Accepted period:

```text
YYYY-MM
YYYY-MM-DD
```

Normalize:

```text
2026-03
→ 2026-03-01
```

Rules:

- department required
- account_code required
- account_name required
- amount numeric
- account_type allowlist
- signed budget/actual amounts allowed but create warning when negative

## Cash

Required:

```text
expected_date
description
category
direction
amount
status
```

Rules:

- valid date
- description required
- category required
- direction inflow/outflow
- amount >= 0
- status planned/confirmed/actual

---

# 10. Finance Methodology

## Variance

```text
variance_amount =
actual_amount - budget_amount
```

If budget != 0:

```text
variance_percent =
variance_amount / abs(budget_amount)
```

If budget == 0:

```text
variance_percent = null
variance_label = unbudgeted
```

## Favorability

Revenue / other income:

```text
variance > 0 → favorable
variance < 0 → unfavorable
```

COGS / operating expense / other expense:

```text
variance < 0 → favorable
variance > 0 → unfavorable
```

Zero:

```text
neutral
```

## Operating profit

```text
Total Revenue =
revenue + other_income

Total Expenses =
cogs + operating_expense + other_expense

Operating Profit =
Total Revenue - Total Expenses
```

Profit variance:

```text
actual profit - budget profit
```

Positive:

```text
favorable
```

Negative:

```text
unfavorable
```

---

# 11. 13-Week Cash Forecast

Input:

```text
start_date
weeks
scenario_id optional
```

Default:

```text
13 weeks
```

Allowed:

```text
1..26 weeks
```

Starting cash:

Use latest cash balance where:

```text
balance_date <= start_date
```

If none:

```text
422 CASH_BALANCE_REQUIRED
```

Weekly formula:

```text
closing_balance =
opening_balance + inflows - outflows
```

Next week:

```text
opening_balance =
previous closing_balance
```

Calculate:

```text
minimum projected cash
lowest-cash week
first threshold breach
```

---

# 12. Scenario Rules

Only adjust:

```text
status = planned
```

Never change:

```text
confirmed
actual
```

Planned inflow:

```text
adjusted amount =
amount * (1 + inflow_adjustment_pct / 100)
```

Planned outflow:

```text
adjusted amount =
amount * (1 + outflow_adjustment_pct / 100)
```

Planned inflow date:

```text
adjusted date =
expected_date + collection_delay_days
```

Constraints:

```text
inflow_adjustment_pct  -100 .. 500
outflow_adjustment_pct -100 .. 500
collection_delay_days  0 .. 365
```

---

# 13. API Conventions

Base:

```text
/api/v1
```

Auth:

```text
Authorization: Bearer <Supabase access token>
```

Error shape:

```json
{
  "error": {
    "code": "IMPORT_INVALID",
    "message": "The import contains invalid rows.",
    "details": {}
  }
}
```

HTTP behavior:

```text
200 successful read/update
201 created
204 deleted
400 malformed request
401 missing/invalid auth
403 forbidden if intentionally used
404 resource not found / not owned
409 state conflict
413 file too large
422 business validation failure
500 unexpected server error
```

For ownership privacy, prefer returning `404` for resources that do not belong to the authenticated user.

---

# 14. Complete API Contract

## Public

### GET `/api/v1/health`

Response:

```json
{"status":"ok"}
```

No auth.

---

## Auth utility

### GET `/api/v1/me`

Protected.

Response:

```json
{
  "user_id": "uuid",
  "email": "safe-email-if-available"
}
```

---

## Companies

### POST `/api/v1/companies`

```json
{
  "name": "ABC Pvt Ltd",
  "currency": "NPR",
  "fiscal_year_start_month": 1,
  "minimum_cash_threshold": 500000
}
```

Response: `201`.

### GET `/api/v1/companies`

Response: `200`.

### GET `/api/v1/companies/{company_id}`

Response: `200` or `404`.

### PATCH `/api/v1/companies/{company_id}`

Updatable:

```text
name
currency
fiscal_year_start_month
minimum_cash_threshold
```

### DELETE `/api/v1/companies/{company_id}`

Deletes company-owned DB records and associated private import/report objects.

Response: `204`.

---

## Imports

### POST `/api/v1/companies/{company_id}/imports/reserve`

Request:

```json
{
  "kind": "budget",
  "filename": "budget_2026.xlsx",
  "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "size_bytes": 125432
}
```

Backend:

- validates kind
- validates extension
- checks 5 MB limit
- creates import row
- creates safe storage path
- creates signed upload URL

Response `201`:

```json
{
  "import_id": "uuid",
  "status": "reserved",
  "storage_path": "user/company/import/budget_2026.xlsx",
  "upload": {
    "signed_url": "...",
    "expires_in_seconds": 7200
  }
}
```

### POST `/api/v1/imports/{import_id}/complete`

Verifies:

- ownership
- state is reserved
- object exists

Sets:

```text
uploaded
```

Response `200`.

### POST `/api/v1/imports/{import_id}/process`

Allowed source state:

```text
uploaded
failed
```

Lifecycle:

```text
processing
→ processed
or
→ failed
```

Retry-safe.

Response:

```json
{
  "import_id": "uuid",
  "status": "processed",
  "kind": "budget",
  "row_count": 245,
  "warnings": []
}
```

### GET `/api/v1/companies/{company_id}/imports`

Filters:

```text
kind
status
```

### GET `/api/v1/imports/{import_id}`

Metadata only.

### DELETE `/api/v1/imports/{import_id}`

Deletes:

- derived rows from that import
- storage object
- import row

Response `204`.

---

## Financial lines

### GET `/api/v1/companies/{company_id}/financial-lines`

Query:

```text
kind=budget|actual
from=YYYY-MM-DD
to=YYYY-MM-DD
department=
account_type=
page=
page_size=
```

Paginated response.

---

## Variance

### GET `/api/v1/companies/{company_id}/variance`

Query:

```text
from
to
department optional
group_by=account|department|month
```

Response:

```json
{
  "period": {
    "from": "2026-01-01",
    "to": "2026-09-30"
  },
  "summary": {
    "budget_revenue": 10000000,
    "actual_revenue": 9100000,
    "revenue_variance": -900000,
    "budget_expenses": 7000000,
    "actual_expenses": 6900000,
    "budget_operating_profit": 3000000,
    "actual_operating_profit": 2200000,
    "operating_profit_variance": -800000
  },
  "rows": []
}
```

---

## Dashboard

### GET `/api/v1/companies/{company_id}/dashboard`

Query:

```text
from
to
cash_start_date optional
scenario_id optional
```

Returns:

- variance summary
- latest cash
- minimum projected cash
- first threshold breach
- top unfavorable variance
- chart-ready series

Must reuse domain services rather than duplicate formulas.

---

## Cash balances

### POST `/api/v1/companies/{company_id}/cash-balances`

```json
{
  "balance_date": "2026-09-30",
  "amount": 4200000,
  "note": "Month-end bank balance"
}
```

Duplicate date:

```text
409
```

### GET `/api/v1/companies/{company_id}/cash-balances`

Newest first.

### PATCH `/api/v1/cash-balances/{balance_id}`

May change:

```text
amount
note
```

### DELETE `/api/v1/cash-balances/{balance_id}`

Response `204`.

---

## Cash items

### POST `/api/v1/companies/{company_id}/cash-items`

```json
{
  "expected_date": "2026-10-05",
  "description": "Customer A collection",
  "category": "Customer receipts",
  "direction": "inflow",
  "amount": 500000,
  "status": "planned"
}
```

### GET `/api/v1/companies/{company_id}/cash-items`

Filters:

```text
from
to
direction
status
category
page
page_size
```

### PATCH `/api/v1/cash-items/{cash_item_id}`

Updatable:

```text
expected_date
description
category
direction
amount
status
```

### DELETE `/api/v1/cash-items/{cash_item_id}`

Response `204`.

---

## Cash forecast

### GET `/api/v1/companies/{company_id}/cash-forecast`

Query:

```text
start_date
weeks=13
scenario_id optional
```

Response:

```json
{
  "start_date": "2026-10-01",
  "weeks": 13,
  "opening_cash": 4200000,
  "minimum_projected_cash": 1100000,
  "minimum_cash_threshold": 1500000,
  "first_threshold_breach_week": 8,
  "scenario": null,
  "weekly": [
    {
      "week_number": 1,
      "week_start": "2026-10-01",
      "week_end": "2026-10-07",
      "opening_cash": 4200000,
      "inflows": 500000,
      "outflows": 700000,
      "closing_cash": 4000000,
      "threshold_breached": false
    }
  ]
}
```

---

## Scenarios

### POST `/api/v1/companies/{company_id}/scenarios`

```json
{
  "name": "Downside",
  "inflow_adjustment_pct": -10,
  "outflow_adjustment_pct": 5,
  "collection_delay_days": 7
}
```

### GET `/api/v1/companies/{company_id}/scenarios`

### GET `/api/v1/scenarios/{scenario_id}`

### PATCH `/api/v1/scenarios/{scenario_id}`

### DELETE `/api/v1/scenarios/{scenario_id}`

Delete response `204`.

---

## Insights

### POST `/api/v1/companies/{company_id}/insights`

Request:

```json
{
  "from": "2026-01-01",
  "to": "2026-09-30",
  "cash_start_date": "2026-10-01",
  "scenario_id": null
}
```

Backend:

```text
variance
→ cash forecast
→ top unfavorable variances
→ fact pack
→ fact hash
→ cache check
→ Groq if enabled
→ deterministic fallback on failure
→ save analysis
```

Response:

```json
{
  "provider": "groq",
  "fallback_used": false,
  "cached": false,
  "text": "..."
}
```

Fallback:

```json
{
  "provider": "deterministic",
  "fallback_used": true,
  "cached": false,
  "text": "..."
}
```

Groq failure must not break the endpoint.

---

## Reports

### POST `/api/v1/companies/{company_id}/reports/excel`

Request:

```json
{
  "from": "2026-01-01",
  "to": "2026-09-30",
  "cash_start_date": "2026-10-01",
  "scenario_id": null
}
```

Workbook sheets:

```text
Executive Summary
Variance Analysis
Department Analysis
Cash Forecast
Scenario
Source Budget
Source Actual
Source Cash
```

Response `201`.

### GET `/api/v1/companies/{company_id}/reports`

Metadata list.

### GET `/api/v1/reports/{report_id}`

When ready:

```json
{
  "id": "uuid",
  "status": "ready",
  "created_at": "...",
  "download_url": "<signed private URL>",
  "expires_in_seconds": 300
}
```

### DELETE `/api/v1/reports/{report_id}`

Deletes report object + DB row.

Response `204`.

---

# 15. Frontend Routes

```text
/
 /login
 /signup
 /dashboard
 /companies
 /imports
 /variance
 /cash-forecast
 /scenarios
 /insights
 /reports
```

Protected pages:

```text
/dashboard
/companies
/imports
/variance
/cash-forecast
/scenarios
/insights
/reports
```

Dashboard widgets:

```text
Budget Revenue
Actual Revenue
Revenue Variance
Budget Expenses
Actual Expenses
Budget Operating Profit
Actual Operating Profit
Latest Cash
13-Week Minimum Cash
First Threshold Breach
Top Unfavorable Variance
```

Charts:

```text
Budget vs Actual
Monthly Revenue/Expense/Profit
13-Week Cash Forecast
Base vs Scenario
```

---

# 16. Environment Variables

## backend/.env.example

```bash
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=

AI_PROVIDER=none
GROQ_API_KEY=
GROQ_MODEL=
AI_TIMEOUT_SECONDS=20

FRONTEND_ORIGINS=http://localhost:3000
MAX_IMPORT_MB=5
```

Do not add a service-role key unless truly necessary.

## frontend/.env.example

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Never create:

```text
NEXT_PUBLIC_GROQ_API_KEY
```

---

# 17. Groq Requirements

Groq receives only structured facts.

Do not send raw spreadsheets.

System prompt must require:

```text
use only supplied facts
do not invent numbers
do not recalculate authoritative figures
do not provide investment advice
do not claim causes without evidence
state uncertainty
```

Fallback must work for:

```text
AI_PROVIDER=none
missing key
timeout
429 rate limit
provider error
invalid response
```

---

# 18. Security Requirements

Implement:

- private buckets
- RLS
- bearer token verification
- ownership checks
- file extension allowlist
- file-size limit
- MIME check where practical
- randomized/scoped storage paths
- pagination
- bounded `weeks`
- Pydantic validation
- restricted CORS
- no secrets in logs
- no stack traces to production users
- no secrets in frontend
- safe Excel generation

Excel formula injection protection:

For user-controlled text that begins with:

```text
=
+
-
@
```

escape/sanitize it before writing to an Excel cell.

---

# 19. Testing Requirements

Backend tests:

## Variance

```text
revenue over budget → favorable
revenue under budget → unfavorable
expense over budget → unfavorable
expense under budget → favorable
zero budget → variance % null
operating profit
```

## Cash

```text
opening + inflows - outflows
roll forward
threshold breach
latest starting balance
scenario planned-only
confirmed unchanged
actual unchanged
collection delay
```

## Imports

```text
missing columns
invalid date
invalid account type
negative cash amount
invalid direction
invalid status
CSV
XLSX
idempotent retry
```

## Insights

```text
Groq success
Groq missing
timeout
429
invalid response
fallback
cache
```

## Auth

```text
missing token
invalid token
cross-user company access blocked
cross-user import access blocked
```

Frontend:

```text
protected route
upload validation
variance formatting
empty state
API error
insight provider label
```

---

# 20. GitHub CI

Run on:

```text
push main
pull_request
```

Backend:

```text
install
lint
pytest
```

Frontend:

```text
npm ci
lint
typecheck
test
npm run build
```

No live Groq.

No production Supabase dependency for unit tests.

---

# 21. PHASED CODEX PROMPTS

Run each phase separately.

Never ask Codex to continue automatically.

---

## Phase 0 — Review Scope

```text
Read this entire specification.

Before coding:
1. inspect the repository
2. summarize existing files
3. identify reusable code
4. identify conflicts with this plan
5. confirm monorepo structure:
   frontend/
   backend/
   supabase/
   docs/
6. produce an implementation checklist

Scope restrictions:
- CSV/XLSX only
- no PDF
- no ML
- no RAG
- no bank feeds
- Groq explanation only
- deterministic fallback mandatory
- Supabase Auth/Postgres/private Storage
- two Vercel projects

Do not modify code yet.
Stop after the review.
```

---

## Phase 1 — Skeleton

```text
Implement Phase 1 only.

Create the monorepo.

Frontend:
- Next.js
- TypeScript
- Tailwind
- landing page
- placeholder protected dashboard
- lint/typecheck/test setup

Backend:
- FastAPI
- Pydantic
- pytest
- environment configuration
- CORS from environment
- standardized error helpers
- GET /api/v1/health
- Vercel-compatible backend/api/index.py
- structured logging without secrets

Create:
- README.md
- frontend/.env.example
- backend/.env.example
- docs/architecture.md

Run:
- backend tests
- frontend lint/typecheck/build

Do not implement Supabase, uploads, finance logic, Groq, or reports.

Explain local run commands.
Stop.
```

---

## Phase 2 — Supabase Schema + RLS + Storage

```text
Implement Phase 2 only.

Create Supabase migrations for:
- companies
- imports
- financial_lines
- cash_balances
- cash_items
- scenarios
- analysis_results
- reports

Use the exact schema/constraints in the specification.

Add:
- indexes
- RLS
- SELECT/INSERT/UPDATE/DELETE ownership policies
- private buckets fpna-imports and fpna-reports
- storage policies based on authenticated user folder

Create:
frontend/public/templates/budget_template.csv
frontend/public/templates/actual_template.csv
frontend/public/templates/cash_template.csv

Create docs/database.md explaining each table.

If Supabase CLI is authenticated and linked, apply migrations.
Otherwise provide exact commands and stop for the one required login/link step.

Do not implement app auth yet.
Stop.
```

---

## Phase 3 — Authentication

```text
Implement Phase 3 only.

Frontend:
- current recommended Supabase Next.js SSR/cookie auth
- signup
- login
- logout
- protected dashboard
- browser/server Supabase utilities
- session refresh

Backend:
- bearer-token auth dependency
- verify Supabase access token
- get authenticated user ID
- reusable ownership helpers
- GET /api/v1/me

Rules:
- no service secret in browser
- protected routes require auth
- /api/v1/health remains public

Tests:
- missing token
- invalid token mock
- auth dependency

Create docs/auth.md.

Do not implement companies yet.
Stop.
```

---

## Phase 4 — Company CRUD

```text
Implement Phase 4 only.

Endpoints:
POST   /api/v1/companies
GET    /api/v1/companies
GET    /api/v1/companies/{company_id}
PATCH  /api/v1/companies/{company_id}
DELETE /api/v1/companies/{company_id}

Use exact request/validation rules from spec.

Frontend:
- company list
- create form
- selector
- settings editor

Tests:
- CRUD
- invalid fiscal month
- ownership isolation

Do not implement imports.
Stop.
```

---

## Phase 5 — Direct Upload Reservation

```text
Implement Phase 5 only.

Endpoints:
POST /api/v1/companies/{company_id}/imports/reserve
POST /api/v1/imports/{import_id}/complete
GET  /api/v1/companies/{company_id}/imports
GET  /api/v1/imports/{import_id}
DELETE /api/v1/imports/{import_id}

Requirements:
- budget/actual/cash kinds
- .csv/.xlsx only
- 5 MB app limit
- private Supabase Storage
- signed upload URL
- user/company/import path
- reserved -> uploaded lifecycle
- complete verifies object exists
- delete removes storage + derived rows
- strict ownership

Frontend:
- import page
- choose kind/file
- validate extension/size
- reserve
- direct upload
- complete
- status
- template downloads

Do not proxy file bytes through FastAPI.

Mock storage in tests.
Do not parse files yet.
Stop.
```

---

## Phase 6 — Import Parser

```text
Implement Phase 6 only.

Endpoint:
POST /api/v1/imports/{import_id}/process

Budget/actual columns:
period
department
account_code
account_name
account_type
amount

Cash columns:
expected_date
description
category
direction
amount
status

Requirements:
- CSV
- XLSX first worksheet only
- row-numbered validation errors
- period normalization to first of month
- account type allowlist
- direction/status allowlist
- reject negative cash amount
- signed financial amounts allowed with warning
- source_row stored
- uploaded -> processing -> processed/failed
- retry-safe
- no duplicate rows on retry

Frontend:
- Process button
- processing state
- readable errors
- row count

Tests for valid and invalid CSV/XLSX.
Stop.
```

---

## Phase 7 — Variance Engine

```text
Implement Phase 7 only.

Create pure backend domain functions.

Endpoints:
GET /api/v1/companies/{company_id}/financial-lines
GET /api/v1/companies/{company_id}/variance

Implement:
- aggregation
- variance amount
- variance %
- zero-budget handling
- account-type favorability
- revenue
- expenses
- operating profit
- top unfavorable variances

Filters:
from
to
department
group_by account|department|month

Frontend:
- variance summary cards
- filters
- variance table
- favorable/unfavorable badges
- top unfavorable list
- budget-vs-actual chart

Use hand-calculated tests.

Create docs/variance-methodology.md.
Stop.
```

---

## Phase 8 — Cash Balances + Items

```text
Implement Phase 8 only.

Endpoints:
POST   /api/v1/companies/{company_id}/cash-balances
GET    /api/v1/companies/{company_id}/cash-balances
PATCH  /api/v1/cash-balances/{balance_id}
DELETE /api/v1/cash-balances/{balance_id}

POST   /api/v1/companies/{company_id}/cash-items
GET    /api/v1/companies/{company_id}/cash-items
PATCH  /api/v1/cash-items/{cash_item_id}
DELETE /api/v1/cash-items/{cash_item_id}

Implement:
- validation
- ownership
- pagination
- filters
- duplicate balance date conflict

Frontend:
- balance form
- cash item table
- add/edit/delete items
- imported items visible

No forecast math yet.
Stop.
```

---

## Phase 9 — Cash Forecast

```text
Implement Phase 9 only.

Endpoint:
GET /api/v1/companies/{company_id}/cash-forecast

Inputs:
start_date
weeks default 13, allowed 1..26
scenario_id optional but do not apply scenario yet

Rules:
- latest cash balance <= start date
- no balance -> 422 CASH_BALANCE_REQUIRED
- weekly buckets
- opening + inflows - outflows = closing
- roll closing forward
- minimum projected cash
- lowest week
- first threshold breach

Frontend:
- start date
- weeks
- forecast table
- line chart
- threshold warning

Tests:
- no balance
- arithmetic
- boundary dates
- empty weeks
- threshold
- negative cash

Create docs/cash-forecast-methodology.md.
Stop.
```

---

## Phase 10 — Scenarios

```text
Implement Phase 10 only.

Endpoints:
POST   /api/v1/companies/{company_id}/scenarios
GET    /api/v1/companies/{company_id}/scenarios
GET    /api/v1/scenarios/{scenario_id}
PATCH  /api/v1/scenarios/{scenario_id}
DELETE /api/v1/scenarios/{scenario_id}

Integrate scenario_id into cash forecast.

Rules:
- only planned items adjusted
- confirmed unchanged
- actual unchanged
- planned inflow amount uses inflow %
- planned outflow amount uses outflow %
- planned inflow date delayed by collection_delay_days

Frontend:
- CRUD scenarios
- scenario selector
- base vs scenario comparison

Tests for every rule.
Stop.
```

---

## Phase 11 — Dashboard

```text
Implement Phase 11 only.

Endpoint:
GET /api/v1/companies/{company_id}/dashboard

Inputs:
from
to
cash_start_date optional
scenario_id optional

Reuse variance/cash services; do not duplicate formulas.

Frontend dashboard:
- revenue budget/actual/variance
- expenses budget/actual
- operating profit budget/actual
- latest cash
- minimum 13-week cash
- first threshold breach
- top unfavorable variance
- budget-vs-actual chart
- cash forecast chart
- top variance table
- useful missing-data states

Stop.
```

---

## Phase 12 — Groq + Fallback

```text
Implement Phase 12 only.

Endpoint:
POST /api/v1/companies/{company_id}/insights

Create:
- fact pack builder
- fact hash
- cached analysis lookup
- deterministic fallback
- Groq provider
- insight service

Rules:
- calculations happen before Groq
- raw files never sent to Groq
- GROQ_API_KEY server-side
- GROQ_MODEL configurable
- timeout configurable
- no investment advice
- no invented numbers
- Groq failure always falls back
- return provider/fallback_used/cached

Frontend:
- Explain button
- insight text
- label source:
  Groq AI
  or Deterministic fallback

Tests:
- success
- missing key
- timeout
- 429
- invalid output
- fallback
- cache

CI uses mocks only.
Stop.
```

---

## Phase 13 — Excel Reports

```text
Implement Phase 13 only.

Endpoints:
POST /api/v1/companies/{company_id}/reports/excel
GET  /api/v1/companies/{company_id}/reports
GET  /api/v1/reports/{report_id}
DELETE /api/v1/reports/{report_id}

Use openpyxl.

Sheets:
1 Executive Summary
2 Variance Analysis
3 Department Analysis
4 Cash Forecast
5 Scenario
6 Source Budget
7 Source Actual
8 Source Cash

Requirements:
- company/period/currency
- generation timestamp
- formatting
- frozen headers
- no macros
- formula-injection sanitization
- private report bucket
- signed download URL for 5 minutes
- status metadata

Frontend:
- generate/list/download/delete

Tests:
- workbook opens
- sheets exist
- important cells
- formula-injection protection

Stop.
```

---

## Phase 14 — Security Hardening

```text
Implement Phase 14 only.

Audit and fix:
- RLS
- Storage policies
- user ownership
- bearer auth
- CORS
- private buckets
- extension validation
- size checks
- no secrets in client/logs
- generic production errors
- pagination
- bounded forecast weeks
- safe Excel output
- retry-safe imports
- delete semantics
- scenario ownership
- report ownership

Add regression tests for confirmed issues.

Create SECURITY.md.

Do not add enterprise complexity.
Stop.
```

---

## Phase 15 — GitHub CI + Documentation

```text
Implement Phase 15 only.

Create GitHub Actions:

Backend:
- install
- lint
- pytest

Frontend:
- npm ci
- lint
- typecheck
- tests
- npm build

Triggers:
- pull_request
- push main

No live Groq.
No production Supabase for unit tests.

Complete:
README.md
docs/architecture.md
docs/api.md
docs/import-formats.md
docs/finance-methodology.md
docs/deployment.md

README:
- problem
- features
- architecture
- setup
- screenshots placeholders
- sample imports
- Groq/fallback
- security
- limitations
- deployment

Run all checks.
Stop.
```

---

## Phase 16 — Deploy Backend to Vercel

```text
Implement/deploy Phase 16 only.

Goal:
Deploy backend/ as a dedicated Vercel project.

Before deployment:
- verify backend/api/index.py exports `app = FastAPI(...)`
- run tests
- keep dependency bundle minimal
- pin a Vercel-supported Python version

If Vercel CLI is not installed, install it.
If not authenticated, ask me to authenticate; do not invent credentials.

Create/link backend Vercel project with root directory backend/.

Set production environment variables:

SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
AI_PROVIDER
GROQ_API_KEY
GROQ_MODEL
AI_TIMEOUT_SECONDS
FRONTEND_ORIGINS
MAX_IMPORT_MB

For the first deployment, FRONTEND_ORIGINS can temporarily include localhost.

Deploy production.

Verify:
GET https://<backend-domain>/api/v1/health

Expected:
{"status":"ok"}

Record backend URL in docs/deployment.md.

Never print secrets.

Stop.
```

---

## Phase 17 — Deploy Frontend to Vercel

```text
Implement/deploy Phase 17 only.

Before deployment:
- lint
- typecheck
- tests
- npm build

Create/link frontend Vercel project with root directory frontend/.

Set:

NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_API_BASE_URL=<backend-production-url>

Deploy production.

Record frontend URL.

Update backend Vercel:
FRONTEND_ORIGINS=<frontend-production-url>

Redeploy backend if needed.

Update Supabase Auth site/redirect URLs for frontend production domain if required.

Verify:
- frontend loads
- signup/login works
- protected dashboard works
- authenticated FastAPI call works
- no CORS error

Update docs/deployment.md.

Stop.
```

---

## Phase 18 — Production Smoke Test

```text
Perform Phase 18 only.

Use small demo data.

Production test sequence:

1 signup/login
2 create company
3 set cash threshold
4 upload budget CSV
5 complete/process budget
6 upload actual CSV
7 complete/process actual
8 verify hand-calculated variance
9 upload cash CSV
10 process cash
11 enter dated cash balance
12 view 13-week forecast
13 create downside scenario
14 verify only planned items changed
15 request Groq insight
16 verify deterministic fallback through safe test configuration or automated test
17 generate Excel report
18 download report
19 create second test user and verify first user's company is inaccessible
20 delete demo import/report

Fix only confirmed bugs.
Add regression tests.

Produce:
- smoke-test results
- production frontend URL
- production backend URL
- known limitations
- CV-ready summary

Do not add features.
Stop.
```

---

# 22. Global Codex Rules

Paste this with every phase:

```text
GLOBAL RULES

1. Read the specification before changing code.
2. Implement only the requested phase.
3. Never continue automatically.
4. Do not add PDF, OCR, ML, RAG, bank feeds, or unrelated features.
5. Finance calculations live in pure backend domain functions.
6. Never calculate finance metrics in frontend code.
7. Groq explains; deterministic code calculates.
8. Fallback must always work.
9. Never expose GROQ_API_KEY.
10. Never expose server secrets through NEXT_PUBLIC_*.
11. Every protected record is user-owned.
12. Enforce ownership in backend and Supabase RLS.
13. Storage buckets remain private.
14. Upload file bytes directly to Supabase Storage.
15. Never silently change source financial data.
16. Import errors should identify rows where practical.
17. Use hand-calculated fixtures for finance tests.
18. CI never calls live Groq.
19. Avoid unnecessary dependencies.
20. Before coding:
    - inspect repository
    - summarize current state
    - list files to change
    - explain plan
21. After coding:
    - run tests
    - run lint/type/build checks
    - summarize changes
    - explain finance logic
    - list limitations
    - list manual checks
```

---

# 23. Definition of Done

```text
[ ] monorepo complete
[ ] Supabase migrations applied
[ ] RLS tested
[ ] private Storage tested
[ ] signup/login works
[ ] company CRUD works
[ ] budget upload/process works
[ ] actual upload/process works
[ ] cash upload/process works
[ ] variance correct
[ ] favorability correct
[ ] operating profit correct
[ ] cash balances/items work
[ ] 13-week forecast correct
[ ] cash threshold works
[ ] scenarios work
[ ] dashboard works
[ ] Groq works
[ ] deterministic fallback works
[ ] Excel report works
[ ] security tests pass
[ ] GitHub Actions passes
[ ] backend deployed to Vercel
[ ] frontend deployed to Vercel
[ ] production auth works
[ ] no CORS error
[ ] production smoke test passes
```

---

# 24. Official References

Vercel FastAPI:

```text
https://vercel.com/kb/fastapi
https://vercel.com/docs/functions/runtimes/python
```

Vercel function request-size limit:

```text
https://vercel.com/docs/errors/function_payload_too_large
```

Supabase Auth:

```text
https://supabase.com/docs/guides/auth/server-side
https://supabase.com/docs/guides/auth/quickstarts/nextjs
```

Supabase private Storage and signed upload URLs:

```text
https://supabase.com/docs/guides/storage/buckets/fundamentals
https://supabase.com/docs/reference/python/storage-from-createsigneduploadurl
```

Groq:

```text
https://console.groq.com/docs/quickstart
https://console.groq.com/docs/api-reference
```
