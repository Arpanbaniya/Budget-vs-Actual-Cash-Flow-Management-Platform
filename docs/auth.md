# Authentication setup

Phase 3 uses Supabase email/password Auth with cookie-backed sessions in Next.js and a bearer token on protected FastAPI requests. Production is connected to the `stfciijaeixrygvrgdrn` Supabase project.

## Connect the Supabase project

The production project already records both Phase 2 migrations as applied. For future migrations, authenticate and link the CLI from the repository root:

```powershell
pnpm dlx supabase login
pnpm dlx supabase link --project-ref stfciijaeixrygvrgdrn
pnpm dlx supabase db push
```

Run `db push` only when there are new, reviewed migrations. Get the project URL and **publishable** key from the Supabase project dashboard. The publishable key is meant for browser use; do not put a secret or service-role key in a `NEXT_PUBLIC_*` variable.

For local development, copy the frontend example to a local environment file and enter this project's URL and publishable key. The backend reads process environment variables directly, so set those in the terminal before starting Uvicorn:

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

The four variables are configured for Production in the single `flow-forecast` Vercel project. Configure Preview separately if you deploy a preview branch. The frontend variables must be available at build time. No service-role key is required for Phase 3.

## Email confirmation

The Supabase Auth Site URL is `https://flow-forecast.vercel.app`. The redirect allowlist contains `https://flow-forecast.vercel.app/auth/confirm` and `http://localhost:3000/auth/confirm`, as well as the `/auth/callback` URLs used by the default email template.

When a custom SMTP provider is configured, the **Confirm signup** email template can use this server-side link:

```text
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

This project's free tier currently uses Supabase's default SMTP, which does not allow template editing. Signup therefore sends the default confirmation link to `/auth/callback`; its browser client completes Supabase's PKCE exchange and writes the session cookies. The `/auth/confirm` route remains available for a future custom token-hash template. Email confirmation remains enabled. If email confirmation is disabled later, signup creates a session immediately and goes directly to the dashboard.

Supabase's default SMTP only sends to email addresses belonging to this project's Supabase organization and has a low rate limit. To allow public signup, configure a custom SMTP provider in Supabase Authentication → Emails → SMTP Settings. Do not disable email confirmation to work around this limit.

## Request flow

1. `/signup` and `/login` submit to server actions. The Supabase server client writes the session to cookies.
2. The Next.js 16 Proxy refreshes an expiring session and copies the updated cookies to the browser. The dashboard checks verified `getClaims()` output before rendering private content.
3. `/dashboard` offers a sign-out action that clears the Supabase session.
4. `GET /api/v1/me` requires `Authorization: Bearer <access_token>`. FastAPI asks the project's Supabase Auth server to validate the token and returns the user ID and email. Missing/invalid tokens return 401. `GET /api/v1/health` stays public.

The Phase 4 frontend API helper attaches the session access token to each company request. FastAPI verifies it, forwards it to Supabase, and filters data by `user_id` in addition to RLS. A cross-user company returns 404. Future data endpoints must follow the same ownership rules.

Without local Supabase environment values, the public site remains available, the login/signup forms show a setup message, and the dashboard remains closed.

References: [Supabase SSR client setup](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [Supabase default SMTP restrictions](https://supabase.com/docs/guides/auth/auth-smtp), [Supabase JWT verification](https://supabase.com/docs/guides/auth/jwts).
