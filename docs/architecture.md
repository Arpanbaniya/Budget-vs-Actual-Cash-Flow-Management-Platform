# Foundation architecture

The repository has two application services in one Vercel project. `frontend/` contains the Next.js App Router application. `backend/` contains the FastAPI application exported as `app` from `api/index.py`. The root `vercel.json` routes `/api/*` to FastAPI and all other paths to Next.js on one domain.

The API has public `GET /api/v1/health` and protected `GET /api/v1/me`. The shared production domain makes browser requests same-origin. CORS is validated from `FRONTEND_ORIGINS` for local development or other approved origins. `LOG_LEVEL` controls JSON request logs, which include only method, route template, and status. API errors use the shape `{ "error": { "code", "message", "details" } }`.

The frontend has Supabase SSR/cookie auth utilities, a Next.js Proxy for session refresh, signup/login forms, and a dashboard protected by verified claims. FastAPI validates bearer access tokens against Supabase Auth. The flows require a linked Supabase project and environment values; see [auth setup](auth.md). `supabase/` holds Phase 2 migrations and private Storage policies.

Later phases will connect company and finance flows, deterministic finance services, optional Groq commentary, and Excel reports. No financial data is stored or processed by the app yet.
