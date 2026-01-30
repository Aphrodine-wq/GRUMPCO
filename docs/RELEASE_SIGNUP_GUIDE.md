# G-Rump Release & Signup Guide

## What You Need to Sign Up For

### Required (Pick at least ONE AI provider)

| Service | Purpose | Signup URL | Free Tier |
|---------|---------|------------|-----------|
| **NVIDIA NIM** | Kimi K2.5 AI (recommended) | https://build.nvidia.com | 1,000 free credits |
| **OpenRouter** | Multi-model access | https://openrouter.ai | Pay-as-you-go |
| **Groq** | Fast inference | https://groq.com | Free tier available |

### Required for Production

| Service | Purpose | Signup URL | Free Tier |
|---------|---------|------------|-----------|
| **Vercel** | Backend + Frontend hosting | https://vercel.com | Hobby plan free |
| **Supabase** | Database (serverless needs this) | https://supabase.com | Free tier: 500MB |

### Optional (Enhanced Features)

| Service | Purpose | Signup URL | Notes |
|---------|---------|------------|-------|
| **npm** | Publish CLI package | https://npmjs.com | Free |
| **Upstash** | Redis (rate limiting, cache) | https://upstash.com | Free tier available |
| **QStash** | Background jobs | https://upstash.com/qstash | Free tier available |
| **Stripe** | Billing/payments | https://stripe.com | Test mode free |
| **Twilio** | SMS/Voice | https://twilio.com | Trial credits |

---

## Quick Setup Steps

### 1. Vercel (5 min)
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy (from project root)
vercel --prod
```

### 2. Supabase (10 min)
1. Create project at https://supabase.com
2. Go to Settings → API
3. Copy: Project URL, anon key, service key
4. Add to Vercel env vars

### 3. NVIDIA NIM (5 min)
1. Sign up at https://build.nvidia.com
2. Go to API Keys
3. Create new key
4. Add `NVIDIA_NIM_API_KEY` to Vercel env vars

### 4. npm (CLI publishing) (5 min)
```bash
# Create account at npmjs.com, then:
npm login

# Publish CLI
cd packages/cli
npm publish
```

---

## Vercel Environment Variables

Set these in Vercel Dashboard → Project → Settings → Environment Variables:

```env
# Required
NODE_ENV=production
NVIDIA_NIM_API_KEY=nvapi-xxx

# Database (Supabase)
DB_TYPE=supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_KEY=xxx

# Security
CORS_ORIGINS=https://your-domain.vercel.app
ALLOWED_HOSTS=your-domain.vercel.app
SECURITY_STRICT_PROD=true

# Serverless mode
SERVERLESS_MODE=vercel
EVENTS_MODE=poll
```

---

## Deployment Commands

```bash
# Deploy everything to Vercel
vercel --prod

# Or deploy frontend and backend separately:
cd frontend && vercel --prod
cd backend && vercel --prod

# Publish CLI to npm
cd packages/cli && npm publish
```

---

## Post-Deploy Checklist

- [ ] Test `/health` endpoint returns 200
- [ ] Test `/api/chat` with a simple message
- [ ] Test CLI: `npx grump-cli fortune`
- [ ] Verify CORS works from frontend
- [ ] Check Vercel logs for errors

---

## Cost Estimates (Monthly)

| Tier | Setup | Monthly Cost |
|------|-------|--------------|
| **Hobby** | Vercel Free + Supabase Free + NIM Free | $0 |
| **Startup** | Vercel Pro + Supabase Pro + NIM | ~$45 |
| **Scale** | Vercel Enterprise + Supabase Team | ~$200+ |

---

## Need Help?

- Vercel Docs: https://vercel.com/docs
- Supabase Docs: https://supabase.com/docs
- NVIDIA NIM: https://docs.nvidia.com/nim
