-- G-Rump Web Platform - Initial Supabase Schema
-- Run in Supabase SQL Editor or via migration tool

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Profiles: extends auth.users (1:1), stores display name, subscription tier
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'team', 'enterprise')),
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- Projects: user-owned workspaces (architectures, PRDs, codegen sessions)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_owner ON public.projects(owner_id);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own projects"
  ON public.projects FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- Sessions: generation/spec/plan/ship sessions (linked to project or standalone)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.generation_sessions (
  id TEXT PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('generation', 'ship', 'spec', 'plan')),
  status TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_generation_sessions_user ON public.generation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_sessions_project ON public.generation_sessions(project_id);

ALTER TABLE public.generation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own sessions"
  ON public.generation_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Usage tracking: api_calls, token_usage for billing and analytics
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.api_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  model TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  latency_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_calls_user_created ON public.api_calls(user_id, created_at DESC);

ALTER TABLE public.api_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own api_calls"
  ON public.api_calls FOR SELECT
  USING (auth.uid() = user_id);

-- Insert allowed only by service role / backend
CREATE POLICY "Service role can insert api_calls"
  ON public.api_calls FOR INSERT
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- token_usage: aggregated or per-request token usage for cost tracking
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.token_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd DECIMAL(12, 6) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_token_usage_user_created ON public.token_usage(user_id, created_at DESC);

ALTER TABLE public.token_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own token_usage"
  ON public.token_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert token_usage"
  ON public.token_usage FOR INSERT
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- billing_events: subscription and usage-based events for Stripe sync
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  stripe_event_id TEXT,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_user ON public.billing_events(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_events_stripe ON public.billing_events(stripe_event_id) WHERE stripe_event_id IS NOT NULL;

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own billing_events"
  ON public.billing_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert billing_events"
  ON public.billing_events FOR INSERT
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Trigger: create profile on signup
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
