# Database Migrations

Run these SQL files in Supabase SQL Editor in order:

1. `migrations/001_initial_schema.sql` – Profiles, projects, generation_sessions, api_calls, token_usage, billing_events, RLS, and trigger for new users.

For local Supabase via CLI:

```bash
supabase db push
```

Or paste each file into the Supabase Dashboard → SQL Editor and run.
