# Foundation architecture

The repository has two application services in one Vercel project. `frontend/` contains the Next.js App Router application. `backend/` contains the FastAPI application exported as `app` from `api/index.py`. The root `vercel.json` routes `/api/*` to FastAPI and all other paths to Next.js on one domain.

The API has public `GET /api/v1/health`, protected `GET /api/v1/me`, and protected company CRUD endpoints. The shared production domain makes browser requests same-origin. CORS is validated from `FRONTEND_ORIGINS` for local GET/POST/PATCH/DELETE requests. `LOG_LEVEL` controls JSON request logs, which include only method, route template, and status. API errors use the shape `{ "error": { "code", "message", "details" } }`.

The frontend has Supabase SSR/cookie auth utilities, a Next.js Proxy for session refresh, signup/login forms, and a dashboard protected by verified claims. FastAPI validates bearer access tokens against Supabase Auth. The flows require a linked Supabase project and environment values; see [auth setup](auth.md). `supabase/` holds Phase 2 migrations and private Storage policies.

Company management flows from the protected Next.js workspace to FastAPI, then to Supabase's Data API using the caller's JWT. The API sets `user_id` on creation and filters all other operations by verified user ID; RLS provides an additional ownership boundary. Cash thresholds use decimal values and are returned as strings to preserve precision. Company deletion discovers files only under the verified user's company prefix in both private buckets, removes their bytes through the Storage API, and then deletes the company row and its dependent records.

Later phases will add imports, deterministic finance services, optional Groq commentary, and Excel reports. The dashboard currently displays company settings.
