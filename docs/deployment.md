# Vercel deployment

One project, `flow-forecast`, in Arpanbaniya's projects imports the repository's
`main` branch. Production frontend: **https://flow-forecast.vercel.app/**.
Production backend origin: **https://flow-forecast.vercel.app**, API prefix `/api/v1`.

Keep Vercel Root Directory at `./` and use the Services preset. The root
`vercel.json` defines FastAPI in `backend/` and Next.js in `frontend/`; `/api/*`
goes to FastAPI. The user's single-project requirement overrides the original
plan's separate-project deployment examples. Do not create another API project.

## Environment variables

| Variable | Scope / value |
| --- | --- |
| SUPABASE_URL | Server: connected HTTPS Supabase project origin |
| SUPABASE_PUBLISHABLE_KEY | Server: same project's publishable key |
| NEXT_PUBLIC_SUPABASE_URL | Frontend: same project origin |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Frontend: publishable key only |
| NEXT_PUBLIC_API_BASE_URL | Frontend: empty/unset in production; local backend origin for development |
| FRONTEND_ORIGINS | Server: https://flow-forecast.vercel.app; explicit local origin when developing |
| LOG_LEVEL | Server: INFO by default; logs omit headers/body/query data |
| AI_PROVIDER | Server: none by default; groq only when deliberately configured |
| GROQ_API_KEY | Server-only optional secret; never NEXT_PUBLIC_* or committed |
| GROQ_MODEL | Server: llama-3.3-70b-versatile by default |
| AI_TIMEOUT_SECONDS | Server: 20 by default; 1–60 |

The application currently enforces a hard five MB import limit. Backend deployment
verification will record any additional configurable import limit explicitly.
Changing public settings requires a rebuild. Changing server settings also needs a
new deployment to take effect. Keep secrets out of screenshots, logs, Git, and
client bundles. Deterministic commentary works without Groq credentials.

## Database and authentication

Apply the three existing migrations in timestamp order: initial schema, private
Storage, and transactional import processing. See [database](database.md).
Production Supabase Auth Site URL must be the frontend domain; allowed redirect
URLs must cover the confirmation/callback routes documented in [auth setup](auth.md).
Keep email confirmation enabled. Public signup requires a custom SMTP provider
because the default sender restricts recipients.

## Checks and deployment

1. Run backend Ruff/pytest and frontend lint/typecheck/tests/build.
2. Push `main`; GitHub CI and Vercel Git integration build that commit.
3. Confirm both CI jobs passed and Vercel reports Ready for that same commit.
4. Verify `/api/v1/health` returns `{"status":"ok"}` and unauthenticated workspace
   APIs return 401 with safe errors and no-store headers.
5. Verify frontend login, protected routes, authenticated API calls, imports,
   forecast/scenarios, insights, and downloads using disposable demo data.

Python is pinned to 3.12 by backend project/runtime files. `backend/api/index.py`
exports the FastAPI app. Node.js 22 and the pnpm lockfile govern frontend builds.
Use the Vercel project's existing authenticated account/team; do not silently link
another account. This workspace's CLI account may differ from the project owner;
Git integration is the established deployment path.

Phases 16–18 record final production configuration and smoke-test results separately.
Before authenticated production verification is complete, local synthetic browser
checks and unit tests must not be described as proof of the live end-to-end flow.
