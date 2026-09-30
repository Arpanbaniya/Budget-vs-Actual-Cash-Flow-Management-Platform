# Flow & Forecast

Budget vs Actual + 13-Week Cash Flow Management is an FP&A portfolio application under development. This repository currently contains the **Phase 1 foundation**: a Next.js landing page, a gated dashboard placeholder, and a FastAPI health endpoint. The finance workflow described in the planning documents is not implemented yet.

## Live foundation

- Application: https://flow-forecast.vercel.app
- API health: https://flow-forecast.vercel.app/api/v1/health

One Vercel Services project imports this GitHub repository and deploys both services from `main`.

## Repository

- `frontend/` — Next.js 16, React 19, TypeScript, Tailwind CSS
- `backend/` — FastAPI with `GET /api/v1/health`
- `supabase/` — reserved for Phase 2 migrations and private Storage policies
- `docs/` — architecture and deployment notes
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

Then open `http://localhost:3000` and `http://localhost:8000/api/v1/health`. Visiting `/dashboard` redirects to the `/login` placeholder until Phase 3 adds real authentication.

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

## Current limitations

There is no authentication, data import, variance engine, cash forecast, scenario engine, AI commentary, or Excel reporting yet. Figures on the landing page are explicitly illustrative.
