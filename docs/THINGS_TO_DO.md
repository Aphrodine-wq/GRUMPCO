# Things to Do

Actionable checklist for the Vercel Serverless deployment. This document has been updated - most items are now automated or documented. Follow the steps below to deploy.

**Status: Ready for Deployment**

Last updated: 2026-01-30

---

## 1. Set up Cloud Infrastructure (Automated Setup Available)

**Prerequisites:**
1. Vercel CLI installed: `npm i -g vercel`
2. Supabase CLI installed: `npm i -g supabase` (optional)
3. Anthropic API key from https://console.anthropic.com

### Option A: Quick Deploy Script (Recommended)
Run the automated deployment script:
```bash
cd backend
npm run deploy:setup
```

### Option B: Manual Setup
See **[backend/DEPLOY_VERCEL.md](../backend/DEPLOY_VERCEL.md)** for detailed instructions.

**Required Services:**
- [ ] **Supabase Project** (Database):
    - [ ] Create at [supabase.com](https://supabase.com)
    - [ ] Run `backend/supabase-schema.sql` in SQL Editor
    - [ ] Copy Project URL and Service Role Key

- [ ] **QStash** (Async Jobs):
    - [ ] Create at [upstash.com](https://upstash.com/qstash)
    - [ ] Copy QStash token and URL

**Environment Variables to Set:**
- `ANTHROPIC_API_KEY` - Required
- `SUPABASE_URL` - Required
- `SUPABASE_SERVICE_KEY` - Required
- `QSTASH_TOKEN` - Required
- `QSTASH_URL` - Required (typically `https://qstash.upstash.io/v2/publish/`)
- `JOB_WORKER_SECRET` - Required (random secret)
- `PUBLIC_BASE_URL` - Required (your backend URL)
- `NODE_ENV` - Set to `production`

---

## 2. Deploy to Vercel

### Backend Deployment

```bash
cd backend
vercel --prod
```

**Verify deployment:**
```bash
curl https://your-backend.vercel.app/api/health
```

### Frontend Deployment

1. Set environment variable in Vercel dashboard or CLI:
```bash
cd frontend
vercel env add VITE_API_URL production
# Enter: https://your-backend.vercel.app/api
```

2. Deploy:
```bash
vercel --prod
```

**Verify deployment:**
- Visit your frontend URL
- Test the API connection
- Check browser console for errors

---

## 3. Resolve Conflicting Configurations

- [x] **Clean up `vercel.json` files**:
    - [x] Decide on a deployment strategy: monorepo (from root) or separate frontend/backend deployments.
    - [x] The `backend/DEPLOY_VERCEL.md` guide implies separate deployments.
    - [x] Remove or consolidate the conflicting `vercel.json` files to match the chosen strategy.
    - **DONE:** Root `vercel.json` deleted. Using separate frontend/backend deployments.

---

## 4. Production Safeguards (Security)

**CRITICAL:** Enable these for any production deployment accessible by untrusted users:

### Environment Variables
```bash
vercel env add BLOCK_SUSPICIOUS_PROMPTS production  # true
vercel env add REQUIRE_AUTH_FOR_API production      # true
```

### Additional Security Measures
- Set `GRUMP_WEBHOOK_SECRET` for webhook verification
- Configure `METRICS_AUTH` to protect `/metrics` endpoint
- Enable Vercel's built-in rate limiting (see PRODUCTION_CHECKLIST.md)
- Set up monitoring and alerting (see docs/monitoring.md)

### Rate Limiting Options
- **Option 1:** Use Upstash Redis + rate-limit-redis middleware
- **Option 2:** Rely on Vercel's built-in rate limiting
- **Option 3:** Use Vercel Pro for advanced rate limiting features

---

## Quick reference

| Topic | Links |
|-------|--------|
| Vercel Deploy Guide | [../backend/DEPLOY_VERCEL.md](../backend/DEPLOY_VERCEL.md) |
| Production Checklist | [PRODUCTION_CHECKLIST.md](PRODUCTION_CHECKLIST.md) |
| System Architecture | [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) |
| Capabilities & Architecture | [CAPABILITIES.md](CAPABILITIES.md) |

