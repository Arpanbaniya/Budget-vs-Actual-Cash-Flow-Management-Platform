# Flow & Forecast API

Python 3.12 FastAPI service in the repository's single Vercel Services project.
`api/index.py` exports `app` from `app.main`. Public routing shares the frontend's
production domain. See [API contract](../docs/api.md).

The backend verifies Supabase bearer tokens, scopes requests to the owner, validates
inputs, processes stored imports, calculates variance/cash/scenarios with Decimal,
generates fact-backed commentary, and creates private Excel reports with openpyxl.
It uses the caller's JWT and publishable key for Supabase; no service-role key.

## Setup

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --no-access-log
```

Load values from `.env.example` into the shell environment. The application reads
process environment variables and does not automatically load `.env`.
Required for authenticated use: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`.
`FRONTEND_ORIGINS` is an explicit comma-separated origin list; local default is
`http://localhost:3000`. `LOG_LEVEL` defaults to INFO. Optional Groq settings are
explained in [insights](../docs/insights.md); deterministic mode needs no key.

## Checks

```powershell
ruff check .
python -m pytest -q
```

Tests simulate Auth, PostgreSQL REST, Storage, and Groq. They never require live
production data. Finance tests use hand-calculated results, Decimal precision,
period/week boundaries, planned-only scenarios, transactional import retries,
workbook cells, and formula-injection cases. Security tests cover ownership,
private paths, safe errors, date/amount bounds, and secret handling.

Uploads go browser → private Storage. FastAPI accepts JSON metadata and later
downloads the stored file for parsing. Excel generation runs in a thread pool,
uploads private bytes, and persists status metadata. These synchronous request
flows have explicit input/output limits and are not background jobs.

See [architecture](../docs/architecture.md), [finance methods](../docs/finance-methodology.md),
[reports](../docs/reports.md), and [security](../SECURITY.md).
