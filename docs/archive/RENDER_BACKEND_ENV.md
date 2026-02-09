# Render Backend – Environment Variables

Set these in your **Render** backend service (Dashboard → your backend service → **Environment**) so the frontend can connect.

---

## Required for frontend to connect

### 1. **CORS_ORIGINS** (most important)

List every **origin** (scheme + host + port) that will call your API. The browser sends this as the `Origin` header; if it’s not in this list, the backend blocks the request.

**Local dev (frontend at http://localhost:5173):**

```bash
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

**If you also have a deployed frontend on Render or another host, add it (comma‑separated, no spaces):**

```bash
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://your-frontend.onrender.com,https://g-rump.com
```

Use your real frontend URL(s). Without the origin you’re actually using, the app will stay “not connected.”

---

### 2. **PUBLIC_BASE_URL**

Your backend’s public URL (used for OAuth callbacks, links, etc.):

```bash
PUBLIC_BASE_URL=https://grump-backend.onrender.com
```

Replace with your exact Render backend URL if different (e.g. `https://grump-backend.onrender.com`).

---

### 3. **ALLOWED_HOSTS** (if the app uses strict production checks)

Hostnames allowed in the `Host` header of requests to this backend. For Render, that’s your backend’s hostname:

```bash
ALLOWED_HOSTS=grump-backend.onrender.com
```

If your Render URL is different, use that hostname (no `https://`, no path).

---

## Relaxing strict production (if the backend won’t start)

If the backend fails validation in production, you can relax it until CORS is working:

```bash
SECURITY_STRICT_PROD=false
```

With `SECURITY_STRICT_PROD=false`, you still **must** set **CORS_ORIGINS** so the browser can call the API. The other strict vars (MASTER_KEY, METRICS_AUTH, etc.) are only required when `SECURITY_STRICT_PROD=true`.

---

## Optional but useful

| Variable | Example | Purpose |
|----------|---------|--------|
| **NODE_ENV** | `production` | Usually set by Render. |
| **FRONTEND_URL** | `http://localhost:5173` or your deployed frontend URL | Where to send users after OAuth. |
| **MOCK_AI_MODE** | `true` | No API keys; mock AI responses (good for testing). |
| **NVIDIA_NIM_API_KEY** | `nvapi-...` | Real AI (e.g. [NVIDIA NIM](https://build.nvidia.com)). |

---

## Cloud dashboard

`GET /api/cloud/dashboard` returns **integrations** from the integrations API/DB (real data when users connect providers). **Deployments**, **resources**, and **costs** are empty until deploy/cost backends are wired; the frontend handles empty arrays.

---

## Checklist

1. In Render → your **backend** service → **Environment**:
   - Add **CORS_ORIGINS** = `http://localhost:5173,http://127.0.0.1:5173` (and any other frontend origins).
   - Add **PUBLIC_BASE_URL** = `https://grump-backend.onrender.com` (or your backend URL).
   - If the service won’t start: set **ALLOWED_HOSTS** = `grump-backend.onrender.com` and/or **SECURITY_STRICT_PROD** = `false` as above.
2. Save and let Render redeploy.
3. Reload the frontend at http://localhost:5173 and check connection again.

If it still fails, open DevTools (F12) → **Network**, trigger a request to the backend, and check whether the response is **CORS** or **4xx/5xx**; that will narrow it down.
