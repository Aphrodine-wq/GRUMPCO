# Production Integration Setup Guide

**Date:** February 04, 2026  
**Author:** Manus AI  
**Purpose:** Complete checklist for wiring up all integrations before launch

This is your comprehensive guide for setting up all the "boring stuff" - OAuth providers, AI API keys, billing, database, and everything else needed for production. Follow this step-by-step and you'll be ready to launch.

## 📋 Overview

This guide covers:

1. **Environment Variables** - Complete .env setup
2. **Database Setup** - Supabase/PostgreSQL configuration
3. **OAuth Providers** - GitHub, Google, Slack, etc.
4. **AI Provider API Keys** - OpenAI, Anthropic, NVIDIA, etc.
5. **Billing Integration** - Stripe setup
6. **Monitoring & Analytics** - Sentry, PostHog
7. **Testing Checklist** - Verify everything works

**Estimated Time:** 2-3 hours

---

## 1. Environment Variables Setup

### Step 1: Copy the template

```bash
cd backend
cp .env.example .env
```

### Step 2: Set your base configuration

```env
# =============================================================================
# CORE CONFIGURATION
# =============================================================================

# Environment
NODE_ENV=production

# Server
PORT=3000
PUBLIC_BASE_URL=https://your-domain.com  # CHANGE THIS

# Database (choose one)
DB_TYPE=postgres  # or sqlite for development
DATABASE_URL=postgresql://user:password@host:5432/grump  # CHANGE THIS

# Redis
REDIS_HOST=your-redis-host.com  # CHANGE THIS
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password  # CHANGE THIS

# Security
MASTER_KEY=generate-a-secure-random-key-here  # CHANGE THIS (use: openssl rand -hex 32)
JWT_SECRET=generate-another-secure-key  # CHANGE THIS (use: openssl rand -hex 32)
ENCRYPTION_KEY=generate-32-byte-key  # CHANGE THIS (use: openssl rand -hex 32)
```

**Action Items:**
- [ ] Set `PUBLIC_BASE_URL` to your production domain
- [ ] Generate secure keys using `openssl rand -hex 32`
- [ ] Configure database connection string
- [ ] Set up Redis connection

---

## 2. Database Setup (Supabase)

### Option A: Supabase (Recommended)

1. **Create a Supabase project**
   - Go to https://supabase.com/dashboard
   - Click "New Project"
   - Choose a region close to your users
   - Set a strong database password

2. **Get your credentials**
   - Go to Project Settings → API
   - Copy the following:
     - `URL` → `SUPABASE_URL`
     - `anon public` key → `SUPABASE_ANON_KEY`
     - `service_role` key → `SUPABASE_SERVICE_KEY`

3. **Set up the schema**
   ```bash
   # Run the schema migration
   psql $DATABASE_URL < backend/supabase-schema.sql
   ```

4. **Update .env**
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_KEY=your-service-role-key-here
   DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.your-project.supabase.co:5432/postgres
   ```

**Action Items:**
- [ ] Create Supabase project
- [ ] Copy API credentials to .env
- [ ] Run schema migration
- [ ] Test database connection

### Option B: Self-Hosted PostgreSQL

1. **Install PostgreSQL**
   ```bash
   # Ubuntu/Debian
   sudo apt install postgresql postgresql-contrib
   
   # macOS
   brew install postgresql
   ```

2. **Create database and user**
   ```sql
   CREATE DATABASE grump;
   CREATE USER grump_user WITH PASSWORD 'secure_password';
   GRANT ALL PRIVILEGES ON DATABASE grump TO grump_user;
   ```

3. **Run migrations**
   ```bash
   psql -U grump_user -d grump -f backend/supabase-schema.sql
   ```

**Action Items:**
- [ ] Install PostgreSQL
- [ ] Create database and user
- [ ] Run schema migration
- [ ] Update DATABASE_URL in .env

---

## 3. OAuth Provider Setup

### GitHub OAuth

1. **Create OAuth App**
   - Go to https://github.com/settings/developers
   - Click "New OAuth App"
   - Fill in:
     - Application name: `G-Rump`
     - Homepage URL: `https://your-domain.com`
     - Callback URL: `https://your-domain.com/api/integrations-v2/oauth/github/callback`

2. **Get credentials**
   - Copy Client ID and Client Secret

3. **Update .env**
   ```env
   GITHUB_OAUTH_CLIENT_ID=your_github_client_id
   GITHUB_OAUTH_CLIENT_SECRET=your_github_client_secret
   ```

**Action Items:**
- [ ] Create GitHub OAuth App
- [ ] Copy credentials to .env
- [ ] Test OAuth flow

### Google OAuth

1. **Create OAuth credentials**
   - Go to https://console.cloud.google.com/apis/credentials
   - Create a new project or select existing
   - Click "Create Credentials" → "OAuth client ID"
   - Choose "Web application"
   - Add authorized redirect URI: `https://your-domain.com/api/integrations-v2/oauth/google/callback`

2. **Enable APIs**
   - Go to "Library" and enable:
     - Google Calendar API
     - Gmail API
     - Google Drive API (if needed)

3. **Update .env**
   ```env
   GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   ```

**Action Items:**
- [ ] Create Google OAuth credentials
- [ ] Enable required APIs
- [ ] Copy credentials to .env
- [ ] Test OAuth flow

### Slack OAuth

1. **Create Slack App**
   - Go to https://api.slack.com/apps
   - Click "Create New App" → "From scratch"
   - Set redirect URL: `https://your-domain.com/api/integrations-v2/oauth/slack/callback`

2. **Add OAuth scopes**
   - Go to "OAuth & Permissions"
   - Add scopes: `chat:write`, `channels:read`, `users:read`

3. **Update .env**
   ```env
   SLACK_CLIENT_ID=your_slack_client_id
   SLACK_CLIENT_SECRET=your_slack_client_secret
   SLACK_SIGNING_SECRET=your_slack_signing_secret
   ```

**Action Items:**
- [ ] Create Slack App
- [ ] Add OAuth scopes
- [ ] Copy credentials to .env
- [ ] Test OAuth flow

### Additional OAuth Providers

For other providers (Notion, Linear, GitLab, Bitbucket), follow the same pattern:

1. Create OAuth app at provider's developer portal
2. Set redirect URI to: `https://your-domain.com/api/integrations-v2/oauth/{provider}/callback`
3. Copy credentials to .env

**Providers to set up:**
- [ ] Notion (`NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`)
- [ ] GitLab (`GITLAB_CLIENT_ID`, `GITLAB_CLIENT_SECRET`)
- [ ] Bitbucket (`BITBUCKET_CLIENT_ID`, `BITBUCKET_CLIENT_SECRET`)

---

## 4. AI Provider API Keys

### NVIDIA NIM (Primary)

1. **Get API key**
   - Go to https://build.nvidia.com/
   - Sign up or log in
   - Go to "API Keys" and generate a new key

2. **Update .env**
   ```env
   NVIDIA_NIM_API_KEY=nvapi-your-key-here
   ```

**Action Items:**
- [ ] Create NVIDIA Build account
- [ ] Generate API key
- [ ] Copy to .env
- [ ] Test with a simple request

### OpenAI

1. **Get API key**
   - Go to https://platform.openai.com/api-keys
   - Create a new key

2. **Update .env**
   ```env
   OPENAI_API_KEY=sk-your-key-here
   ```

**Action Items:**
- [ ] Create OpenAI API key
- [ ] Copy to .env
- [ ] Set up billing limits

### Anthropic (Claude)

1. **Get API key**
   - Go to https://console.anthropic.com/
   - Create a new API key

2. **Update .env**
   ```env
   ANTHROPIC_API_KEY=sk-ant-your-key-here
   ```

**Action Items:**
- [ ] Create Anthropic API key
- [ ] Copy to .env

### Google AI (Gemini)

1. **Get API key**
   - Go to https://makersuite.google.com/app/apikey
   - Create a new API key

2. **Update .env**
   ```env
   GOOGLE_API_KEY=AIzaSy-your-key-here
   ```

**Action Items:**
- [ ] Create Google AI API key
- [ ] Copy to .env

### Groq

1. **Get API key**
   - Go to https://console.groq.com/keys
   - Create a new API key

2. **Update .env**
   ```env
   GROQ_API_KEY=gsk_your-key-here
   ```

**Action Items:**
- [ ] Create Groq API key
- [ ] Copy to .env

### OpenRouter (Optional)

1. **Get API key**
   - Go to https://openrouter.ai/keys
   - Create a new API key

2. **Update .env**
   ```env
   OPENROUTER_API_KEY=sk-or-your-key-here
   ```

**Action Items:**
- [ ] Create OpenRouter API key
- [ ] Copy to .env

---

## 5. Billing Integration (Stripe)

### Step 1: Create Stripe Account

1. **Sign up**
   - Go to https://dashboard.stripe.com/register
   - Complete account setup

2. **Get API keys**
   - Go to Developers → API keys
   - Copy both test and live keys

### Step 2: Set up products and prices

1. **Create products**
   - Go to Products → Add product
   - Create pricing tiers:
     - **Free**: $0/month
     - **Pro**: $29/month
     - **Team**: $99/month
     - **Enterprise**: Custom

2. **Copy price IDs**
   - Click on each price
   - Copy the price ID (starts with `price_`)

### Step 3: Set up webhooks

1. **Create webhook endpoint**
   - Go to Developers → Webhooks
   - Add endpoint: `https://your-domain.com/api/billing/webhook`
   - Select events:
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`

2. **Get webhook secret**
   - Copy the signing secret (starts with `whsec_`)

### Step 4: Update .env

```env
# Stripe (use test keys for staging, live keys for production)
STRIPE_SECRET_KEY=sk_live_your-key-here
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret-here

# Stripe Price IDs
STRIPE_PRICE_ID_PRO=price_your-pro-price-id
STRIPE_PRICE_ID_TEAM=price_your-team-price-id
STRIPE_PRICE_ID_ENTERPRISE=price_your-enterprise-price-id
```

**Action Items:**
- [ ] Create Stripe account
- [ ] Set up products and pricing
- [ ] Create webhook endpoint
- [ ] Copy all credentials to .env
- [ ] Test checkout flow
- [ ] Test webhook events

---

## 6. Monitoring & Analytics

### Sentry (Error Tracking)

1. **Create Sentry project**
   - Go to https://sentry.io/
   - Create a new project (Node.js)

2. **Get DSN**
   - Copy the DSN from project settings

3. **Update .env**
   ```env
   SENTRY_DSN=https://your-key@sentry.io/your-project-id
   ```

**Action Items:**
- [ ] Create Sentry project
- [ ] Copy DSN to .env
- [ ] Test error reporting

### PostHog (Analytics)

1. **Create PostHog project**
   - Go to https://posthog.com/
   - Create a new project

2. **Get API key**
   - Go to Project Settings
   - Copy the API key

3. **Update .env**
   ```env
   POSTHOG_API_KEY=phc_your-key-here
   POSTHOG_HOST=https://us.i.posthog.com
   ANALYTICS_ENABLED=true
   ```

**Action Items:**
- [ ] Create PostHog project
- [ ] Copy API key to .env
- [ ] Test event tracking

---

## 7. Additional Services

### Twilio (SMS/Voice - Optional)

```env
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_REPLY_TO_NUMBER=+1234567890
TWILIO_WEBHOOK_SECRET=your-webhook-secret
```

### Telegram (Bot - Optional)

```env
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_WEBHOOK_SECRET=your-webhook-secret
```

### Discord (Bot - Optional)

```env
DISCORD_BOT_TOKEN=your-bot-token
```

---

## 8. Testing Checklist

### Database

```bash
# Test connection
psql $DATABASE_URL -c "SELECT version();"

# Verify tables exist
psql $DATABASE_URL -c "\dt"
```

- [ ] Database connection works
- [ ] All tables exist
- [ ] Can insert and query data

### OAuth Providers

For each provider:

1. Start the backend: `npm run dev`
2. Go to `http://localhost:3000/api/integrations-v2/oauth/{provider}`
3. Complete OAuth flow
4. Verify token is saved in database

- [ ] GitHub OAuth works
- [ ] Google OAuth works
- [ ] Slack OAuth works
- [ ] Other providers work

### AI Providers

```bash
# Test NVIDIA NIM
curl -X POST http://localhost:3000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello", "model": "nvidia/llama-3.1-nemotron-70b-instruct"}'

# Test OpenAI
curl -X POST http://localhost:3000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello", "model": "gpt-4"}'
```

- [ ] NVIDIA NIM works
- [ ] OpenAI works
- [ ] Anthropic works
- [ ] Google AI works
- [ ] Groq works

### Billing

1. Go to checkout page
2. Use test card: `4242 4242 4242 4242`
3. Complete checkout
4. Verify webhook received

- [ ] Checkout flow works
- [ ] Webhook events received
- [ ] Subscription created in database

### Monitoring

1. Trigger an error intentionally
2. Check Sentry dashboard
3. Trigger an analytics event
4. Check PostHog dashboard

- [ ] Sentry receives errors
- [ ] PostHog receives events

---

## 9. Final Checklist

Before launch, verify:

- [ ] All environment variables are set
- [ ] Database is set up and migrated
- [ ] OAuth providers are configured and tested
- [ ] AI provider API keys are valid
- [ ] Billing integration works end-to-end
- [ ] Monitoring is active
- [ ] All tests pass
- [ ] Production domain is configured
- [ ] SSL certificate is valid
- [ ] Backups are configured

---

## 10. Quick Reference

### Generate Secure Keys

```bash
# Generate a secure random key
openssl rand -hex 32

# Generate multiple keys at once
for i in {1..3}; do openssl rand -hex 32; done
```

### Test Database Connection

```bash
psql $DATABASE_URL -c "SELECT version();"
```

### Test API Endpoint

```bash
curl http://localhost:3000/health
```

### View Logs

```bash
# Backend logs
npm run dev --prefix backend

# Docker logs
docker logs grump-backend
```

---

## 11. Troubleshooting

### "Database connection failed"

- Check `DATABASE_URL` is correct
- Verify database is running
- Check firewall rules

### "OAuth redirect mismatch"

- Verify redirect URI in provider settings matches exactly
- Check `PUBLIC_BASE_URL` in .env

### "Stripe webhook not receiving events"

- Verify webhook URL is publicly accessible
- Check webhook secret is correct
- Use Stripe CLI for local testing: `stripe listen --forward-to localhost:3000/api/billing/webhook`

### "AI provider rate limit"

- Check API key is valid
- Verify billing is set up
- Check rate limits in provider dashboard

---

## 12. Support

If you run into issues:

1. Check the logs: `npm run dev --prefix backend`
2. Review the documentation: `docs/`
3. Check GitHub issues: https://github.com/Aphrodine-wq/GRUMPCO/issues

---

**You've got this! 🚀**
