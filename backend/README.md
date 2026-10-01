# Flow & Forecast API

The FastAPI service provides public `GET /api/v1/health` and protected `GET /api/v1/me`. The latter validates a Supabase bearer access token with the project's Auth server. See [authentication setup](../docs/auth.md).

Phase 4 adds POST/GET `/api/v1/companies` and GET/PATCH/DELETE `/api/v1/companies/{company_id}`. `app/companies.py` validates settings and forwards the user's JWT and publishable key to Supabase's Data API. Reads, updates, and deletes explicitly filter by user ID, in addition to database RLS. Foreign companies return 404. Deletion removes private company Storage objects before cascading database records. See [company management](../docs/companies.md).

`app.main` creates the application. `api/index.py` exports it for Vercel. Runtime configuration reads `FRONTEND_ORIGINS` and `LOG_LEVEL`; see `.env.example`. The error helpers return `{ "error": { "code", "message", "details" } }`. JSON request logs include an allowlist of metadata and omit headers, request bodies, and query strings.

## Local development

Use Python 3.12:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --no-access-log
```

Run the frontend separately on port 3000.

## Checks

```powershell
ruff check .
pytest
```

Tests simulate Supabase Auth, Data API, and Storage responses; they do not need a production database. Imports and finance endpoints belong to later phases.
