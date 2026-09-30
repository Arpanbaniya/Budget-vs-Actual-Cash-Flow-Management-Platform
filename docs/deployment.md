# Vercel deployment

Create **two Vercel projects from the same GitHub repository**. Keep Git integration enabled for deployments on push.

## Backend project

1. Import `Arpanbaniya/Budget-vs-Actual-Cash-Flow-Management-Platform`.
2. Set **Root Directory** to `backend`.
3. Use the detected FastAPI/Python framework settings. `pyproject.toml` points Vercel at `api.index:app`.
4. Set `FRONTEND_ORIGINS` to the frontend production origin after the frontend is deployed.
5. Deploy and verify `https://<backend-domain>/api/v1/health` returns `{"status":"ok"}`.

## Frontend project

1. Import the **same repository** again.
2. Set **Root Directory** to `frontend`.
3. Use the detected Next.js settings.
4. Set `NEXT_PUBLIC_API_BASE_URL` to the backend production URL when API calls are introduced.
5. Deploy and verify the landing page loads.

No Supabase or Groq credentials are needed for this foundation. Future phases must set secrets in Vercel environment variables, never in the repository.
