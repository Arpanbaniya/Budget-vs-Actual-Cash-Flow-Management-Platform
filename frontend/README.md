# Flow & Forecast frontend

Next.js 16 App Router frontend for the single Vercel Services project.
[Live app](https://flow-forecast.vercel.app/).

Protected routes: `/dashboard`, `/companies`, `/imports`, `/variance`, `/cash`,
`/cash-forecast` (also `/forecast`), `/scenarios`, `/insights`, and `/reports`.
Server pages verify Supabase claims before rendering. Proxy refreshes sessions.
Client API requests attach the current bearer token; production uses relative
`/api/v1` URLs. Direct private Storage uploads use only their signed capability.

## Setup

Node.js 22 and pnpm 11.19.0:

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Set public Supabase values from `.env.example` in `.env.local`. For local use,
set `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000` and run the backend separately.
Leave the API base empty in production. Never put Groq or service-role keys here.

## Checks

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Tests cover forms, API errors, upload lifecycle, variance, cash editing, scenarios,
forecast display, dashboard missing data, safe commentary, reports, and decimal
formatting. Modern browsers are required for exact Intl decimal-string formatting.
Charts use approximate coordinates; tables show the finance service values.

Empty import templates are in `public/templates/`; populated demo samples and
hand-calculated results are in [the demo guide](../docs/samples/README.md).
See the [root README](../README.md) for architecture, security, and deployment.
