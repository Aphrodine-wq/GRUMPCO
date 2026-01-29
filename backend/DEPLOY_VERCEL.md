# Deploying to Vercel

This guide covers deploying the Grump backend to [Vercel](https://vercel.com).

## Prerequisites

1. Install the Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Build the backend:
   ```bash
   cd backend
   npm run build
   ```

## Deployment

### First Time Setup

```bash
cd backend
vercel
```

Follow the prompts to link your project.

### Set Environment Variables

In the Vercel dashboard or via CLI:

```bash
vercel env add ANTHROPIC_API_KEY production
# Enter your API key when prompted

# Optional
vercel env add SUPABASE_URL production
vercel env add SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_KEY production
vercel env add REDIS_HOST production
vercel env add REDIS_PORT production
vercel env add SERVERLESS_MODE production
vercel env add EVENTS_MODE production
vercel env add PUBLIC_BASE_URL production
vercel env add QSTASH_TOKEN production
vercel env add QSTASH_URL production
vercel env add JOB_WORKER_SECRET production
```

## Supabase Database Setup

1. Go to [supabase.com](https://supabase.com) and create a project

2. In the Supabase Dashboard, go to **SQL Editor** and run the contents of `supabase-schema.sql`:
   ```sql
   -- Copy paste from backend/supabase-schema.sql
   ```

3. Get your credentials from **Settings > API**:
   - `SUPABASE_URL`: Project URL
   - `SUPABASE_ANON_KEY`: anon/public key
   - `SUPABASE_SERVICE_KEY`: service_role key (keep secret!)

4. Add these to Vercel:
   ```bash
   vercel env add SUPABASE_URL production
   vercel env add SUPABASE_SERVICE_KEY production
   ```

### Deploy to Production

```bash
vercel --prod
```

## Important Notes

> ⚠️ **Serverless Limitations**
> - SQLite won't persist between function invocations (use Supabase/Postgres instead)
> - Long-running tasks require async job dispatch (QStash)
> - Function timeout is 10s on Hobby, 60s on Pro (set maxDuration in vercel.json)

## Serverless Job Dispatch (QStash)

Codegen and SHIP run asynchronously in serverless mode. Configure Upstash QStash:

1. Create a QStash app at https://console.upstash.com
2. Copy the QStash token and set:
   - `QSTASH_TOKEN`
   - `PUBLIC_BASE_URL` (your Vercel URL)
   - `JOB_WORKER_SECRET` (random secret)
3. Set `EVENTS_MODE=poll` so clients use `/api/events/poll` instead of SSE.

The backend will enqueue jobs and QStash will call:
- `POST /api/jobs/ship`
- `POST /api/jobs/codegen`

## Monitoring

```bash
# View logs
vercel logs

# Open dashboard
vercel dashboard
```
