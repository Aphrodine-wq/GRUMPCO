# Things to Do

Actionable checklist for the Vercel Serverless deployment. Tick items as you complete them.

---

## 1. Set up Cloud Infrastructure

**Operator tasks** (you run these). See **[backend/DEPLOY_VERCEL.md](../backend/DEPLOY_VERCEL.md)** for step-by-step instructions.

- [ ] **Create Supabase Project**:
    - [ ] Create a new project on [supabase.com](https://supabase.com).
    - [ ] Run the schema from `backend/supabase-schema.sql` in the SQL Editor.
    - [ ] Add `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` as secrets to your Vercel project.

- [ ] **Create QStash Service**:
    - [ ] Create a new QStash database on [upstash.com](https://upstash.com).
    - [ ] Add `QSTASH_TOKEN`, `QSTASH_URL`, and a new `JOB_WORKER_SECRET` as secrets to your Vercel project.
    - [ ] Set `PUBLIC_BASE_URL` in Vercel to your production backend URL.

- [ ] **Set Core Environment Variables**:
    - [ ] Add `ANTHROPIC_API_KEY` to Vercel secrets.
    - [ ] Set `NODE_ENV` to `production`.

---

## 2. Deploy to Vercel

- [ ] **Deploy Backend**:
    - [ ] From the `backend` directory, run `vercel --prod`.
    - [ ] Verify the deployment is successful and the API is live.

- [ ] **Deploy Frontend**:
    - [ ] Set the `VITE_API_URL` environment variable in Vercel to the URL of your deployed backend.
    - [ ] From the `frontend` directory, run `vercel --prod`.
    - [ ] Verify the frontend loads and can communicate with the backend.

---

## 3. Resolve Conflicting Configurations

- [x] **Clean up `vercel.json` files**:
    - [x] Decide on a deployment strategy: monorepo (from root) or separate frontend/backend deployments.
    - [x] The `backend/DEPLOY_VERCEL.md` guide implies separate deployments.
    - [x] Remove or consolidate the conflicting `vercel.json` files to match the chosen strategy.
    - **DONE:** Root `vercel.json` deleted. Using separate frontend/backend deployments.

---

## 4. Enable Production Safeguards

- [ ] Set `BLOCK_SUSPICIOUS_PROMPTS=true` in production environment variables.
- [ ] Set `REQUIRE_AUTH_FOR_API=true` if the backend is publicly accessible.
- [ ] Note: `REDIS_HOST` is listed for rate-limiting, but serverless environments may require a different approach or rely on Vercel's built-in protection. Confirm if Upstash Redis is used for more than just QStash.

---

## Quick reference

| Topic | Links |
|-------|--------|
| Vercel Deploy Guide | [../backend/DEPLOY_VERCEL.md](../backend/DEPLOY_VERCEL.md) |
| Production Checklist | [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) |
| System Architecture | [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) |
| Capabilities & Architecture | [CAPABILITIES.md](CAPABILITIES.md) |

