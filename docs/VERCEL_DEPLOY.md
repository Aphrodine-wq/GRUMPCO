# Deploy Backend to Vercel

Deploy the G-Rump backend as a serverless API on Vercel.

## Prerequisites

- Vercel account and CLI (`npm i -g vercel`) or connect the repo in the Vercel dashboard
- Backend env vars (see [ENV_SETUP.md](../ENV_SETUP.md) and `backend/.env.example`)

## Steps

1. **Set project root to backend**  
   In the Vercel project settings, set **Root Directory** to `backend` so install and build run in the backend folder.

2. **Environment variables**  
   In Vercel: Project → Settings → Environment Variables. Add the same variables you use in `backend/.env` (e.g. `NVIDIA_NIM_API_KEY`, `NODE_ENV`, `CORS_ORIGINS`, `PUBLIC_BASE_URL`, etc.).  
   Vercel sets `VERCEL=1` automatically so the app runs in serverless mode (no HTTP listen, workers disabled).

3. **Deploy**
   - **From repo:** Push to your connected Git branch; Vercel will build and deploy.
   - **From CLI:** From the repo root run:
     ```bash
     cd backend && vercel
     ```
     Or link first: `vercel link`, then `vercel --prod`.

4. **Build**  
   Vercel runs `npm run build` in the backend (from `vercel.json`). That produces `dist/`. The serverless function at `api/index.ts` loads the app from `dist/index.js` and forwards all requests to it.

5. **URLs**  
   After deploy you get a URL like `https://your-project.vercel.app`. Use it as the API base (e.g. `VITE_API_URL` or `PUBLIC_BASE_URL` in the frontend). All paths (`/`, `/api/chat`, `/api/health`, etc.) are handled by the same function.

## Limits

- **Duration:** Function `maxDuration` is 60s (configurable in `backend/vercel.json`).
- **Cold start:** First request after idle can be slower while the app initializes.
- **No long-lived workers:** Job workers, schedulers, and Discord bot are disabled in serverless mode (see `backend/src/config/runtime.ts` and lifecycle).

## Optional

- **Custom domain:** Add it in Vercel → Project → Settings → Domains.
- **CORS:** Set `CORS_ORIGINS` to your frontend origin(s), e.g. `https://your-frontend.vercel.app`.
