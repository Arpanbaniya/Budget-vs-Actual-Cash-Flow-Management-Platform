# Flow & Forecast

Budget vs Actual + 13-Week Cash Flow Management is an FP&A portfolio application under development. The repository now includes **Phase 5 direct file uploads** alongside email/password authentication and company management. Signed-in users can manage their companies and upload budget, actual, and cash files directly to private Supabase Storage. The import page includes CSV templates, upload history, status filters, retry controls, and deletion. File parsing and finance analysis belong to later phases.

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

Phase 5 uses the existing private `fpna-imports` bucket and schema. See [direct imports](docs/imports.md) for the reserve/upload/complete flow, the 5 MB limit, API examples, and recovery behavior. File bytes travel from the browser directly to Supabase; FastAPI handles metadata only.

## Current limitations

Supabase's default email sender only sends confirmation email to members of the Supabase organization. Public signup needs a custom SMTP provider. Uploaded files are stored privately but are not yet parsed into financial rows. There is no variance engine, cash forecast, scenario engine, AI commentary, or Excel reporting yet. Figures on the landing page are explicitly illustrative.
