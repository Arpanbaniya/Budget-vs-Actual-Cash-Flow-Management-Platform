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
| MAX_IMPORT_MB | Server: 5 by default; integer 1–5 |

The application enforces the configured import limit at reservation, completion,
and streamed processing, with a hard maximum of five MB. Lowering the limit can
reject an earlier reservation; its visible record can be removed and re-uploaded.
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
Phase 16 production settings are explicit: `AI_PROVIDER=none`,
`GROQ_MODEL=llama-3.3-70b-versatile`, `AI_TIMEOUT_SECONDS=20`, `MAX_IMPORT_MB=5`,
`LOG_LEVEL=INFO`, and `FRONTEND_ORIGINS=https://flow-forecast.vercel.app`.
The existing four Supabase server/public variables are production-scoped.
No Groq key has been supplied; optional live Groq execution is not verified.
Phase 17 inspected the existing frontend public Supabase URL, matching the
connected project, and the production Site URL and four confirmation/callback
redirects. The API base remains unset, so requests use this same domain.
The landing page's obsolete foundation notice is replaced with the implemented
workflow. Successful account login and authenticated API calls are pending the
confirmed account handoff for Phase 18.
Unauthenticated `/dashboard` redirects to the configured login form without
browser console warnings or errors. Phase 17 deployment checks can be finished
independently, but its authenticated acceptance checks require the user's login
before proceeding to the Phase 18 demo workflow.
Before authenticated production verification is complete, local synthetic browser
checks and unit tests must not be described as proof of the live end-to-end flow.
