# Flow & Forecast frontend

The Next.js 16 application is the frontend service in the repository's single Vercel Services project. The [live app](https://flow-forecast.vercel.app/) includes CSV template downloads from `public/templates/`.

The landing page previews the intended workflow and labels sample figures as illustrative. Phase 3 adds Supabase email/password signup, login, logout, and a private workspace. Phase 4 adds `/companies` with a company list, create form, selector, settings editor, and deletion confirmation. `/dashboard` shows the selected company's currency, fiscal year start, and minimum cash threshold. Company selection is saved per user in the browser. See [authentication setup](../docs/auth.md) and [company management](../docs/companies.md).

Phase 5 adds `/imports`: choose a company, kind, and CSV/XLSX file (up to 5 MB), reserve the upload, transfer bytes directly to private Supabase Storage, and confirm the stored object. It includes history, kind/status filters, retry/confirmation controls, and deletion confirmation. Financial rows are not parsed yet. See [direct imports](../docs/imports.md).

## Local development

```powershell
pnpm install
pnpm dev
```

Open http://localhost:3000. Copy `.env.example` to `.env.local` and add the Supabase public settings. Run the FastAPI backend separately on port 8000 with its Supabase environment variables. `NEXT_PUBLIC_API_BASE_URL` points to the local backend; production leaves it unset so browser API calls use relative `/api/v1/...` paths. Every protected API request attaches the current Supabase access token. Storage upload requests use their signed URL directly and do not forward the application's token or cookies.

## Checks

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The root [README](../README.md) covers the full repository and deployment.
