# Foundation architecture

The repository has two application services in one Vercel project. `frontend/` contains the Next.js App Router application. `backend/` contains the FastAPI application exported as `app` from `api/index.py`. The root `vercel.json` routes `/api/*` to FastAPI and all other paths to Next.js on one domain.

The only API route in the foundation is public `GET /api/v1/health`. The shared production domain makes browser requests same-origin. CORS is validated from `FRONTEND_ORIGINS` for local development or other approved origins. `LOG_LEVEL` controls JSON request logs, which include only method, route template, and status. API errors use the shape `{ "error": { "code", "message", "details" } }`.

The frontend's `/dashboard` route redirects to `/login` until Phase 3 adds Supabase Auth and server-side session checks. The login route is an informational placeholder, not a working sign-in form. `supabase/` is reserved for Phase 2 migrations and private Storage policies.

Later phases will add Supabase Auth, Postgres, private Storage, deterministic finance services, optional Groq commentary, and Excel reports. No financial data is stored or processed by this foundation.
