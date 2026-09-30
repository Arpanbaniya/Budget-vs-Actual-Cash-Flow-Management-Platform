# Flow & Forecast frontend

The Next.js 16 application is the frontend service in the repository's single Vercel Services project. The live Phase 1 foundation is at https://flow-forecast.vercel.app/. Phase 2 adds header-only CSV templates in `public/templates/` for later import flows.

The landing page previews the intended workflow and labels sample figures as illustrative. `/dashboard` currently redirects to `/login`, which explains that authentication arrives in Phase 3. No finance or account data is exposed by these placeholder routes.

## Local development

```powershell
pnpm install
pnpm dev
```

Open http://localhost:3000. Run the FastAPI backend separately on port 8000 if you want to check the API. `NEXT_PUBLIC_API_BASE_URL` in `.env.example` shows the local backend URL; future production API calls should use the shared origin and relative `/api/v1/...` paths.

## Checks

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The root [README](../README.md) covers the full repository and deployment.
