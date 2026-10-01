# Authentication setup

Phase 3 uses Supabase email/password Auth with cookie-backed sessions in Next.js and a bearer token on protected FastAPI requests. The code is ready, but account creation and sign-in require a Supabase project and the environment values below.

## Connect the Supabase project

Create or select a Supabase project. From the repository root, authenticate and apply the Phase 2 migrations if they are not already applied:

```powershell
pnpm dlx supabase login
pnpm dlx supabase link --project-ref <YOUR_PROJECT_REF>
pnpm dlx supabase db push
```

Get the project URL and **publishable** key from the Supabase project dashboard. The publishable key is meant for browser use; do not put a secret or service-role key in a `NEXT_PUBLIC_*` variable.

For local development, copy the frontend example to a local environment file and replace the placeholders. The backend reads process environment variables directly, so set those in the terminal before starting Uvicorn:

```powershell
Copy-Item frontend/.env.example frontend/.env.local
$env:SUPABASE_URL = "https://YOUR_PROJECT_REF.supabase.co"
$env:SUPABASE_PUBLISHABLE_KEY = "YOUR_SUPABASE_PUBLISHABLE_KEY"
```

Set these values:

| Service | Variable | Value |
| --- | --- | --- |
| Frontend | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| Frontend | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key |
| Backend | `SUPABASE_URL` | Same project URL |
| Backend | `SUPABASE_PUBLISHABLE_KEY` | Same publishable key |

Set the four variables in the single Vercel project for Production (and Preview if needed), then redeploy. The frontend variables must be available at build time. No service-role key is required for Phase 3.

## Email confirmation

In Supabase Auth URL configuration, set the production Site URL to `https://flow-forecast.vercel.app` (without a trailing slash). For local development, use `http://localhost:3000`; add the local and production callback URLs to the redirect allowlist as needed.

For the cookie-based confirmation flow, edit the **Confirm signup** email template in Supabase to use:

```text
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

The `/auth/confirm` route verifies the one-time token and stores the session in cookies, then sends the user to `/dashboard`. It also accepts a PKCE `code` callback. If email confirmation is disabled in Supabase, signup creates a session immediately and goes directly to the dashboard. Hosted Supabase projects usually require email confirmation, so the email template and Site URL matter.

## Request flow

1. `/signup` and `/login` submit to server actions. The Supabase server client writes the session to cookies.
2. The Next.js 16 Proxy refreshes an expiring session and copies the updated cookies to the browser. The dashboard checks verified `getClaims()` output before rendering private content.
3. `/dashboard` offers a sign-out action that clears the Supabase session.
4. `GET /api/v1/me` requires `Authorization: Bearer <access_token>`. FastAPI asks the project's Supabase Auth server to validate the token and returns the user ID and email. Missing/invalid tokens return 401. `GET /api/v1/health` stays public.

Future frontend API calls must attach the access token to their request. Future data endpoints must filter by `user_id` and check resource ownership even though the database also has RLS. A cross-user resource should return 404.

Without Supabase environment values, the public site remains available, the login/signup forms show a setup message, and the dashboard remains closed.

References: [Supabase SSR client setup](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Next.js Supabase tutorial](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs), [Supabase JWT verification](https://supabase.com/docs/guides/auth/jwts).
