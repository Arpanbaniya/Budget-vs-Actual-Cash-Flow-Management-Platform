# Flow & Forecast API

The FastAPI service provides the Phase 1 foundation at `GET /api/v1/health`. Its live endpoint is https://flow-forecast.vercel.app/api/v1/health.

`app.main` creates the application. `api/index.py` exports it for Vercel. Runtime configuration reads `FRONTEND_ORIGINS` and `LOG_LEVEL`; see `.env.example`. The error helpers return `{ "error": { "code", "message", "details" } }`. JSON request logs include an allowlist of metadata and omit headers, request bodies, and query strings.

## Local development

Use Python 3.12:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --no-access-log
```

Open http://localhost:8000/api/v1/health. Run the frontend separately on port 3000.

## Checks

```powershell
ruff check .
pytest
```

Auth, storage, imports, and finance endpoints belong to later phases.
