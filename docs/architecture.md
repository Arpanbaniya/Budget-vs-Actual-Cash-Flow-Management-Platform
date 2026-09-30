# Foundation architecture

The repository has two independently deployable projects. `frontend/` contains the Next.js App Router application. `backend/` contains the FastAPI application exported as `app` from `api/index.py`. Vercel discovers that entrypoint through `backend/pyproject.toml`.

The only API route in the foundation is public `GET /api/v1/health`. CORS reads a comma-separated list from `FRONTEND_ORIGINS`, defaulting to `http://localhost:3000`.

Later phases will add Supabase Auth, Postgres, private Storage, deterministic finance services, optional Groq commentary, and Excel reports. No financial data is stored or processed by this foundation.
