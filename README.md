# Flow & Forecast

Budget vs Actual + 13-Week Cash Flow Management is an FP&A portfolio application under development. The repository now includes **Phase 3 authentication**: signup, login, logout, protected dashboard, and FastAPI bearer-token verification. It is connected to the Supabase project for this repository. The finance workflow described in the planning documents is not implemented yet.

## Live app

- [https://flow-forecast.vercel.app/](https://flow-forecast.vercel.app/)

One Vercel Services project imports this GitHub repository and deploys both services from `main`.

## Repository

- `frontend/` — Next.js 16, React 19, TypeScript, Tailwind CSS
- `backend/` — FastAPI with public health and protected `GET /api/v1/me`
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

## Current limitations

Supabase's default email sender only sends confirmation email to members of the Supabase organization. Public signup needs a custom SMTP provider. There is no company management, data import, variance engine, cash forecast, scenario engine, AI commentary, or Excel reporting yet. Figures on the landing page are explicitly illustrative.
