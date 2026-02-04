-- G-Rump Database Schema
-- PostgreSQL schema for verdict system with full history, outcomes, and feedback loops

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "hstore";

-- ============================================================================
-- Core Founder & Session Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS founders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  founder_id VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  email VARCHAR(255),
  github_handle VARCHAR(255),
  twitter_handle VARCHAR(255),
  linkedin_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  founder_id UUID REFERENCES founders(id),
  session_token VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Verdict History & Requests
-- ============================================================================

CREATE TABLE IF NOT EXISTS verdict_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id VARCHAR(255) UNIQUE NOT NULL,
  founder_id UUID REFERENCES founders(id),
  raw_intent TEXT NOT NULL,
  market_domain VARCHAR(255),
  team_size INT,
  funding_stage VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address INET,
  user_agent TEXT
);

CREATE TABLE IF NOT EXISTS verdicts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id VARCHAR(255) UNIQUE NOT NULL REFERENCES verdict_requests(request_id),
  verdict VARCHAR(50) NOT NULL, -- BuildNow, BuildButPivot, Skip, ThinkHarder
  confidence FLOAT NOT NULL,
  success_probability FLOAT NOT NULL,

  -- Semantic Analysis
  intent_type VARCHAR(50),
  complexity_score FLOAT,
  clarity_score FLOAT,
  extracted_features TEXT[], -- ARRAY of features

  -- Founder Psychology
  archetype VARCHAR(50),
  consistency_score FLOAT,
  learning_orientation FLOAT,
  resilience_score FLOAT,
  burnout_risk FLOAT,
  overconfidence_risk FLOAT,

  -- Market Intelligence
  tam VARCHAR(100),
  growth_rate FLOAT,
  competition_level VARCHAR(100),
  opportunity_score FLOAT,

  -- Network Analysis
  network_size INT,
  mentor_strength FLOAT,
  investor_credibility FLOAT,
  peer_quality FLOAT,
  winning_pattern VARCHAR(255),

  -- ML Prediction
  ml_success_probability FLOAT,
  revenue_potential VARCHAR(100),
  success_factors TEXT[],
  risk_factors TEXT[],

  -- Implicit Requirements & Contradictions
  implicit_requirements TEXT[],
  contradictions TEXT[],
  reasoning TEXT[],

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  cached BOOLEAN DEFAULT FALSE
);

-- ============================================================================
-- Outcome Tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS outcome_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  founder_id UUID REFERENCES founders(id),
  event_type VARCHAR(50) NOT NULL, -- ProductLaunched, RaisedFunding, Shutdown, etc
  event_date DATE,
  description TEXT,
  metrics JSONB, -- Flexible key-value metrics

  -- Link to original verdict
  verdict_request_id VARCHAR(255) REFERENCES verdict_requests(request_id),
  days_since_verdict INT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  source VARCHAR(100), -- user_report, api_scrape, manual_entry
  confidence FLOAT -- How confident are we in this outcome?
);

CREATE TABLE IF NOT EXISTS verdict_accuracy_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  verdict_id UUID REFERENCES verdicts(id),
  founder_id UUID REFERENCES founders(id),

  original_verdict VARCHAR(50),
  original_confidence FLOAT,
  outcome_realized VARCHAR(50), -- Actual outcome

  -- Accuracy classification
  accuracy_classification VARCHAR(50), -- correct, incorrect, partial, etc
  days_to_confirmation INT,

  -- Learning signals
  predictive_factors TEXT[],
  missed_signals TEXT[],
  suggested_weight_updates JSONB,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Founder Network & Relationships
-- ============================================================================

CREATE TABLE IF NOT EXISTS network_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  founder_id UUID REFERENCES founders(id),
  node_id VARCHAR(255),
  node_type VARCHAR(50), -- Mentor, Investor, Peer, Supporter, Expert
  name VARCHAR(255),
  influence_score FLOAT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS network_edges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_node_id UUID REFERENCES network_nodes(id),
  target_node_id UUID REFERENCES network_nodes(id),
  relationship_type VARCHAR(50), -- Mentorship, Funding, Collaboration, etc
  strength FLOAT,
  interaction_count INT DEFAULT 0,
  last_interaction TIMESTAMP,
  mutual_success BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- ML Training & Models
-- ============================================================================

CREATE TABLE IF NOT EXISTS training_datasets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dataset_name VARCHAR(255) UNIQUE NOT NULL,
  dataset_version INT,
  total_examples INT,
  positive_class_ratio FLOAT,
  feature_count INT,

  train_size INT,
  validation_size INT,
  test_size INT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trained_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_id VARCHAR(255) UNIQUE NOT NULL,
  model_version INT,
  training_dataset_id UUID REFERENCES training_datasets(id),

  -- Performance metrics
  accuracy FLOAT,
  precision FLOAT,
  recall FLOAT,
  f1_score FLOAT,
  auc_roc FLOAT,

  -- Training metadata
  training_loss FLOAT,
  validation_loss FLOAT,
  epochs_trained INT,
  training_time_hours FLOAT,

  is_production BOOLEAN DEFAULT FALSE,
  is_best BOOLEAN DEFAULT FALSE,

  feature_importance JSONB, -- {feature_name: importance_score}

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  promoted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS model_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_id UUID REFERENCES trained_models(id),
  verdict_id UUID REFERENCES verdicts(id),

  predicted_verdict VARCHAR(50),
  predicted_confidence FLOAT,
  prediction_latency_ms FLOAT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Founder Cohort Analysis
-- ============================================================================

CREATE TABLE IF NOT EXISTS verdict_cohorts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  verdict_type VARCHAR(50), -- BuildNow, Skip, etc
  cohort_year INT,
  cohort_month INT,

  size INT,
  pmf_rate FLOAT,
  funding_rate FLOAT,
  revenue_rate FLOAT,
  pivot_rate FLOAT,
  shutdown_rate FLOAT,

  avg_time_to_first_customer INT,
  avg_time_to_funding INT,
  median_satisfaction FLOAT,

  confidence FLOAT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Psychological Profiling
-- ============================================================================

CREATE TABLE IF NOT EXISTS founder_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  founder_id UUID UNIQUE REFERENCES founders(id),

  primary_archetype VARCHAR(50),

  -- Signals extracted from GitHub
  github_consistency FLOAT,
  github_follow_through FLOAT,
  github_learning_signals FLOAT,
  github_refactoring FLOAT,

  -- Signals extracted from Twitter
  twitter_transparency FLOAT,
  twitter_resilience FLOAT,
  twitter_learning FLOAT,
  twitter_burnout_risk FLOAT,

  -- Aggregate psychology
  success_probability FLOAT,
  confidence FLOAT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Market Data & Intelligence
-- ============================================================================

CREATE TABLE IF NOT EXISTS market_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  market_domain VARCHAR(255),

  tam_usd BIGINT,
  growth_rate_yoy FLOAT,
  competitor_count INT,
  market_maturity FLOAT,
  regulatory_risk FLOAT,

  consolidation_phase BOOLEAN,
  winner_emerging BOOLEAN,
  opportunity_window_years INT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS competitor_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  market_domain VARCHAR(255),

  company_name VARCHAR(255),
  founded_year INT,
  total_raised BIGINT,
  last_funding_date DATE,
  employee_count INT,

  momentum_score FLOAT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Batch Processing & Jobs
-- ============================================================================

CREATE TABLE IF NOT EXISTS batch_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id VARCHAR(255) UNIQUE NOT NULL,
  founder_id UUID REFERENCES founders(id),

  status VARCHAR(50), -- pending, processing, completed, failed
  total_founders INT,
  processed_count INT,

  started_at TIMESTAMP,
  completed_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS batch_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id VARCHAR(255) REFERENCES batch_jobs(batch_id),
  verdict_id UUID REFERENCES verdicts(id),

  processing_order INT,
  processing_time_ms FLOAT
);

-- ============================================================================
-- Real-time Events & WebSocket
-- ============================================================================

CREATE TABLE IF NOT EXISTS verdict_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  verdict_id UUID REFERENCES verdicts(id),
  founder_id UUID REFERENCES founders(id),

  event_type VARCHAR(50), -- verdict_created, verdict_updated, outcome_added, etc
  event_data JSONB,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id VARCHAR(255),
  founder_id UUID REFERENCES founders(id),

  connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  is_active BOOLEAN DEFAULT TRUE
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

CREATE INDEX idx_founders_handle ON founders(github_handle, twitter_handle);
CREATE INDEX idx_verdict_requests_founder ON verdict_requests(founder_id);
CREATE INDEX idx_verdict_requests_created ON verdict_requests(created_at DESC);
CREATE INDEX idx_verdicts_verdict ON verdicts(verdict);
CREATE INDEX idx_verdicts_confidence ON verdicts(confidence DESC);
CREATE INDEX idx_outcome_events_founder ON outcome_events(founder_id);
CREATE INDEX idx_outcome_events_verdict ON outcome_events(verdict_request_id);
CREATE INDEX idx_outcome_events_date ON outcome_events(event_date DESC);
CREATE INDEX idx_feedback_verdict ON verdict_accuracy_feedback(verdict_id);
CREATE INDEX idx_feedback_created ON verdict_accuracy_feedback(created_at DESC);
CREATE INDEX idx_network_nodes_founder ON network_nodes(founder_id);
CREATE INDEX idx_trained_models_version ON trained_models(model_id, model_version DESC);
CREATE INDEX idx_trained_models_production ON trained_models(is_production) WHERE is_production = TRUE;
CREATE INDEX idx_batch_jobs_status ON batch_jobs(status);
CREATE INDEX idx_verdict_events_created ON verdict_events(created_at DESC);

-- ============================================================================
-- Views for Analytics
-- ============================================================================

CREATE VIEW v_verdict_accuracy_rate AS
SELECT
  v.verdict,
  COUNT(*) as total_verdicts,
  SUM(CASE WHEN vaf.accuracy_classification = 'correct' THEN 1 ELSE 0 END) as correct_count,
  ROUND(100.0 * SUM(CASE WHEN vaf.accuracy_classification = 'correct' THEN 1 ELSE 0 END) / COUNT(*), 2) as accuracy_percent
FROM verdicts v
LEFT JOIN verdict_accuracy_feedback vaf ON v.id = vaf.verdict_id
GROUP BY v.verdict;

CREATE VIEW v_founder_success_rate AS
SELECT
  f.founder_id,
  f.name,
  COUNT(v.id) as total_verdicts,
  AVG(v.success_probability) as avg_success_probability,
  COUNT(CASE WHEN oe.event_type IN ('ProductLaunched', 'RaisedFunding') THEN 1 END) as successful_outcomes
FROM founders f
LEFT JOIN verdict_requests vr ON f.id = vr.founder_id
LEFT JOIN verdicts v ON vr.request_id = v.request_id
LEFT JOIN outcome_events oe ON f.id = oe.founder_id
GROUP BY f.id, f.founder_id, f.name;

CREATE VIEW v_model_performance_trend AS
SELECT
  tm.model_id,
  tm.model_version,
  tm.accuracy,
  tm.f1_score,
  tm.created_at,
  LAG(tm.accuracy) OVER (PARTITION BY tm.model_id ORDER BY tm.model_version) as prev_accuracy
FROM trained_models tm
ORDER BY tm.model_id, tm.model_version DESC;
