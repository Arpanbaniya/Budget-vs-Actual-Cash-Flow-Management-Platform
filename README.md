# Flow & Forecast

Budget vs Actual + 13-Week Cash Flow Management is an FP&A portfolio application under development. **Phase 11 financial dashboard** is implemented alongside authentication, company management, private CSV/XLSX imports, variance analysis, and cash records. Users can analyze budget versus actual and project weekly cash, minimum balances, and threshold breaches over 1–26 weeks (13 by default). Scenarios apply planned cash adjustments and collection delays, with base comparisons. See [scenarios](docs/scenarios.md), [variance methodology](docs/variance-methodology.md), [cash records](docs/cash-records.md), and [forecast methodology](docs/cash-forecast-methodology.md).

## Live app

- [https://flow-forecast.vercel.app/](https://flow-forecast.vercel.app/)

One Vercel Services project imports this GitHub repository and deploys both services from `main`.

## Repository

- `frontend/` — Next.js 16, React 19, TypeScript, Tailwind CSS
- `backend/` — FastAPI with authentication verification, company CRUD, and import upload lifecycle
- `supabase/` — Phase 2 migrations, RLS, and private Storage policies
- `docs/` — architecture, database, authentication, and deployment notes
- `BUDGET_ACTUAL_CASHFLOW_CODEX_END_TO_END_PLAN.md` — full implementation specification
- `BUDGET_ACTUAL_CASHFLOW_LEARNING_GUIDE.md` — finance and phase guide

## Local development

Frontend:

```powershell
cd frontend
pnpm install
pnpm dev
```

Backend (Python 3.12):

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --no-access-log
```

Then open `http://localhost:3000`. Add the local Supabase environment values described in [authentication setup](docs/auth.md) to use signup, login, and the private dashboard.

## Checks

```powershell
cd frontend
pnpm lint
pnpm typecheck
pnpm test
pnpm build

cd ../backend
ruff check .
pytest
```

## Deployment

Import the repository once in Vercel with the repository root (`./`) and the Services preset. The root [vercel.json](vercel.json) routes `/api/*` to FastAPI and all other requests to Next.js. See [deployment notes](docs/deployment.md).

Both Phase 2 database migrations are applied to the connected Supabase project; see [database notes](docs/database.md). The single Vercel project has the Phase 3 production environment variables; see [authentication setup](docs/auth.md).

Phase 4 uses those same environment variables and existing tables. See [company management](docs/companies.md) for API examples, validation rules, and deletion behavior. Production requests use the shared Vercel origin; local browser requests use `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`.

Uploads go directly from the browser to the private `fpna-imports` bucket. FastAPI downloads stored files only when processing is requested. See [imports](docs/imports.md) for formats and recovery behavior. The Phase 6 migration adds transactional row persistence and processing leases and is applied to production.

## Current limitations

Supabase's default email sender only sends confirmation email to members of the Supabase organization. Public signup needs a custom SMTP provider. AI commentary and Excel reporting belong to later phases. Figures on the landing page are explicitly illustrative.

