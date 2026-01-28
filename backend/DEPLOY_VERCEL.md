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
```

### Deploy to Production

```bash
vercel --prod
```

## Important Notes

> ⚠️ **Serverless Limitations**
> - SQLite won't persist between function invocations (use Supabase/Postgres instead)
> - Long-running tasks (BullMQ workers) need a separate service
> - Function timeout is 10s on Hobby, 60s on Pro

## Monitoring

```bash
# View logs
vercel logs

# Open dashboard
vercel dashboard
```
