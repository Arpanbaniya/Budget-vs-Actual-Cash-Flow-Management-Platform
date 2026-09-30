# Flow & Forecast

Budget vs Actual + 13-Week Cash Flow Management is an FP&A portfolio application under development. This repository currently contains the **deployable foundation**: a Next.js landing page and a FastAPI health endpoint. The finance workflow described in the planning documents is not implemented yet.

## Live foundation

- Frontend: https://flow-forecast-web-plum.vercel.app
- Backend health: https://flow-forecast-api-one.vercel.app/api/v1/health

Both Vercel projects import this GitHub repository and deploy from `main`.

## Repository

- `frontend/` — Next.js 16, React 19, TypeScript, Tailwind CSS
- `backend/` — FastAPI with `GET /api/v1/health`
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
uvicorn app.main:app --reload
```

Then open `http://localhost:3000` and `http://localhost:8000/api/v1/health`.

## Checks

```powershell
cd frontend
pnpm lint
pnpm exec tsc --noEmit
pnpm build

cd ../backend
ruff check .
pytest
```

## Deployment

Import this GitHub repository twice in Vercel, once with root directory `backend` and once with root directory `frontend`. See [deployment notes](docs/deployment.md). The backend must be deployed first so its URL can be used for the frontend configuration in later phases.

## Current limitations

There is no authentication, data import, variance engine, cash forecast, scenario engine, AI commentary, or Excel reporting yet. Figures on the landing page are explicitly illustrative.
