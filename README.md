# Flow & Forecast

A budget-versus-actual and cash-flow management application for finance teams.
It brings financial imports, variance analysis, a 13-week cash outlook, scenario
comparison, management commentary, and private Excel reports into one workspace.

## Live app

[Open Flow & Forecast](https://flow-forecast.vercel.app/)

One GitHub repository and one Vercel Services project deploy the Next.js frontend
and FastAPI backend on the same domain. Phases 0–16 are implemented and deployed.
The authenticated production smoke test is tracked separately; test counts and
phase commits are in [implementation progress](docs/phases.md).

## Features

- Confirmed Supabase email/password authentication and a protected workspace.
- Company settings: currency, fiscal-year start, and minimum cash threshold.
- Private direct CSV/XLSX uploads, validation, transactional processing, and retry recovery.
- Decimal-based budget/actual variance by account, department, or month.
- Cash balances and manual/imported cash-item management.
- Weekly cash forecasts, lowest balances, and threshold alerts; 13 weeks by default.
- Planned-item scenarios with inflow/outflow adjustments and collection delays.
- Dashboard cards, charts, top unfavorable variances, and useful missing-data states.
- Cached management commentary, optional Groq prioritization, and deterministic fallback.
- Eight-sheet private Excel reports with five-minute signed download links.

## Architecture

| Component | Technology | Responsibility |
| --- | --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind | Authentication, forms, charts, workspace |
| Backend | Python 3.12, FastAPI, Pydantic, Decimal, openpyxl | Validation, finance calculations, insights, reports |
| Database/Auth | Supabase PostgreSQL and Auth | Owned data, RLS, confirmed accounts |
| Files | Private Supabase Storage | Imports and reports |
| Deployment | One Vercel Services project | `/api/*` → backend; other paths → frontend |
| CI | GitHub Actions | Backend lint/tests; frontend lint/types/tests/build |

See [architecture](docs/architecture.md), [API contract](docs/api.md), and
[database setup](docs/database.md). Finance calculations run before commentary.
The backend uses the caller's JWT and publishable key; no service-role key is needed.

## Local setup

Requires Python 3.12, Node.js 22, pnpm 11.19.0, and a Supabase project with the
[migrations](supabase/migrations/) applied in timestamp order.

Frontend:

```powershell
cd frontend
pnpm install --frozen-lockfile
# Copy .env.example to .env.local and fill in your project's public settings.
pnpm dev
```

Backend, in another terminal:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
# Copy .env.example to .env and load those values into your shell.
uvicorn app.main:app --reload --no-access-log
```

The backend reads process environment variables; it does not automatically load
`.env`. See [authentication setup](docs/auth.md) for the required values. Local
frontend API requests use `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`.
Production leaves this setting empty to use the shared origin.

## Demo imports and finance methods

Start with [demo budget](docs/samples/budget.csv), [demo actual](docs/samples/actual.csv),
and [demo cash](docs/samples/cash.csv). The [demo guide](docs/samples/README.md)
contains opening cash, scenario settings, and expected results. Empty templates
are available on the app and in `frontend/public/templates/`.

Read [import formats](docs/import-formats.md) and [finance methodology](docs/finance-methodology.md)
before importing. Multiple imports are additive; delete superseded imports to
avoid double counting. An opening cash snapshot is used directly, without rolling
forward earlier cash items. Missing budget/actual amounts are shown as zero and flagged.

## Groq and fallback

`AI_PROVIDER=none` is the default and works without a key. Optional Groq mode uses
server-only `GROQ_API_KEY`, configurable `GROQ_MODEL`, and a bounded timeout.
Groq prioritizes calculated facts and authored review actions. It cannot introduce
new figures or claimed causes. Missing keys, invalid output, timeouts, and rate
limits fall back to deterministic commentary. See [insights](docs/insights.md).

## Checks and CI

```powershell
cd backend
ruff check .
python -m pytest -q
cd ../frontend
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

GitHub Actions runs on pull requests and pushes to `main`. Tests mock Supabase and
Groq; they require no production credentials or live provider calls. The committed
pnpm lockfile is the frontend installation source. Current regression coverage:
153 backend tests and 21 frontend tests.

## Screenshots

Production screenshot placeholders will be replaced after the authenticated
smoke test: dashboard, variance, cash forecast/scenario comparison, and report list.
Local browser checks used explicitly labeled synthetic data. See
[screenshot notes](docs/screenshots/README.md).

## Security and limits

Read [SECURITY.md](SECURITY.md) for ownership, private Storage, input bounds,
logging, download links, deletion, and vulnerability reporting. [Excel reports](docs/reports.md)
sanitize user text and retain amounts beyond Excel's numeric precision as text.

Supabase's default confirmation sender restricts recipients; public signup needs
custom SMTP. No Groq key is configured by this repository. Landing-page figures
are illustrative. There is no background job worker, automatic orphan cleanup,
application rate limiter, or shared-company collaboration. Imports are limited
to five MB, 50,000 rows, and 64 columns; forecasts to 26 weeks; analysis reads to
200,000 rows; reports to 100,000 source rows and 20 MB. Direct writes to your own
Supabase data can bypass application validation. Reports read live data in several
requests rather than one database snapshot.

## Deployment

The single project `flow-forecast` imports this repository's `main` branch using
the root Services configuration. See [deployment](docs/deployment.md),
[frontend setup](frontend/README.md), and [backend setup](backend/README.md).
Keep secret keys and credentials out of Git and `NEXT_PUBLIC_*` variables.
