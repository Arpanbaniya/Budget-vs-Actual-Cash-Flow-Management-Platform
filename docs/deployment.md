# Vercel deployment

The GitHub repository deploys to one Vercel Services project in the **Arpanbaniya's projects** team.

| Project | Git branch | Production URL |
| --- | --- | --- |
| `flow-forecast` | `main` | https://flow-forecast.vercel.app |

The repository root is the Vercel root directory. [`vercel.json`](../vercel.json) defines two services: `backend` (FastAPI) and `frontend` (Next.js). Public routing sends `/api/*` to the backend and all other paths to the frontend. The browser and API share one origin, so production API calls can use relative paths such as `/api/v1/health`.

## Verification

- `https://flow-forecast.vercel.app/` returns the foundation page.
- `https://flow-forecast.vercel.app/api/v1/health` returns `{"status":"ok"}`.
- The Vercel production deployment is connected to the GitHub repository's `main` branch.

The public landing page and health route work without Supabase. Phase 3 account access requires the Supabase URL and publishable key for both services; see [authentication setup](auth.md). Keep secret and service-role keys out of `NEXT_PUBLIC_*` variables and Git.

## Import again if needed

1. Import `Arpanbaniya/Budget-vs-Actual-Cash-Flow-Management-Platform` in Vercel.
2. Keep Root Directory at `./` and select the Services preset.
3. Confirm that `vercel.json` detects both services and deploy.
4. Check the page and `/api/v1/health` on the project's production domain.
