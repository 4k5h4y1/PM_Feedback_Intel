-- SignalDesk D1 Schema
-- Two-table design: feedback (raw + metadata) and analysis (AI output)
-- Re-analysis can overwrite `analysis` without touching `feedback`

-- ─── TABLE 1: feedback ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedback (
  id                TEXT PRIMARY KEY,
  source_type       TEXT NOT NULL,
    -- 'github'|'discord'|'support'|'email'|'twitter'|'nps'|'zoom'|'sales'
  source_subtype    TEXT,
    -- channel name (discord), repo (github), ticket tier (support)
  stakeholder_type  TEXT NOT NULL,
    -- 'customer'|'developer'|'sales'|'support'|'internal'|'unknown'
  title             TEXT,
  raw_text          TEXT NOT NULL,
  created_at        TEXT NOT NULL,      -- when the event happened (mocked ISO 8601)
  ingested_at       TEXT NOT NULL DEFAULT (datetime('now')),

  -- Source-specific scores (nullable, source-dependent)
  nps_score         INTEGER,            -- 0-10, NPS source only
  csat_score        REAL,               -- 1.0-5.0, support/CSAT only
  ces_score         REAL,               -- 1.0-7.0, customer effort score
  engagement_score  REAL,               -- normalized 0-1 (likes/reactions/reach)

  -- R2 reference for long-form sources (zoom, sales, email, support)
  raw_payload_ref   TEXT,               -- R2 object key e.g. "<uuid>.json"

  -- Workflow state tracking
  analysis_status   TEXT NOT NULL DEFAULT 'pending',
    -- 'pending'|'analyzed'|'failed'
  workflow_run_id   TEXT,               -- Workflow instance ID for debugging

  -- Source-specific metadata as JSON blob
  source_metadata   TEXT
    -- Examples:
    -- github: {"repo":"cloudflare/workers-sdk","labels":["bug"],"reactions":42,"comment_count":8}
    -- discord: {"channel":"#workers-help","thread_depth":12,"reactions":5}
    -- support: {"ticket_id":"T-84821","severity":"P1","escalated":true,"account_tier":"enterprise"}
    -- nps: {"score":3,"segment":"developer","classification":"detractor"}
    -- zoom: {"speaker_role":"customer_success","deal_stage":"renewal","churn_signal":true}
    -- sales: {"opportunity_stage":"evaluation","decision_timeline":"Q1","competitor_ref":"Fastly"}
);

-- ─── TABLE 2: analysis ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analysis (
  id                  TEXT PRIMARY KEY,    -- same UUID as feedback.id
  feedback_id         TEXT NOT NULL UNIQUE REFERENCES feedback(id),

  -- Classification
  feedback_type       TEXT,
    -- 'bug'|'feature_request'|'praise'|'complaint'|'question'|'comparison'|'churn_risk'
  sentiment           TEXT,               -- 'positive'|'neutral'|'negative'
  sentiment_score     REAL,               -- -1.0 to 1.0
  urgency             INTEGER,            -- 1-10

  -- Product context
  product_category    TEXT,               -- from product taxonomy
  sub_product_area    TEXT,               -- e.g. 'wrangler_cli', 'd1_migrations'
  themes              TEXT,               -- JSON array: ["cold_start","latency"]
  summary             TEXT,               -- 1-2 sentence PM summary (safe for broad display)
  redacted_summary    TEXT,               -- PII masked version, used in list views
  actionability       TEXT,               -- 'low'|'medium'|'high'

  -- Competitor intelligence
  competitor_mentioned  INTEGER DEFAULT 0,
  competitor_name       TEXT,
    -- 'fastly'|'akamai'|'aws_lambda_edge'|'netlify'|'vercel'|'azure_functions'|'other'
  comparison_context    TEXT,
    -- 'pricing'|'performance'|'dx'|'features'|'reliability'|'support'|'compliance'
  comparison_type       TEXT,
    -- 'switching_from'|'switching_to'|'evaluating'|'mentioned'

  -- Security and privacy flags
  pii_detected        INTEGER DEFAULT 0,
  pii_types           TEXT,               -- JSON array: ["email","phone","api_key","ip_address"]
  security_sensitive  INTEGER DEFAULT 0,
  privacy_sensitive   INTEGER DEFAULT 0,
  visibility_scope    TEXT DEFAULT 'internal',
    -- 'public'|'internal'|'restricted'|'security_team_only'

  -- Customer context
  customer_segment    TEXT,               -- 'enterprise'|'smb'|'developer'|'startup'|'unknown'
  account_tier        TEXT,               -- 'free'|'pro'|'business'|'enterprise'|'unknown'
  owner_team          TEXT,               -- 'workers_team'|'security_team' etc.

  -- Meta
  confidence          REAL DEFAULT 0.85,
  analyzed_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Indexes on feedback ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_f_source     ON feedback(source_type);
CREATE INDEX IF NOT EXISTS idx_f_status     ON feedback(analysis_status);
CREATE INDEX IF NOT EXISTS idx_f_created    ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_f_nps        ON feedback(nps_score);

-- ─── Indexes on analysis ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_a_sentiment  ON analysis(sentiment);
CREATE INDEX IF NOT EXISTS idx_a_urgency    ON analysis(urgency DESC);
CREATE INDEX IF NOT EXISTS idx_a_category   ON analysis(product_category);
CREATE INDEX IF NOT EXISTS idx_a_competitor ON analysis(competitor_mentioned);
CREATE INDEX IF NOT EXISTS idx_a_security   ON analysis(security_sensitive);
CREATE INDEX IF NOT EXISTS idx_a_pii        ON analysis(pii_detected);
CREATE INDEX IF NOT EXISTS idx_a_scope      ON analysis(visibility_scope);
CREATE INDEX IF NOT EXISTS idx_a_type       ON analysis(feedback_type);
CREATE INDEX IF NOT EXISTS idx_a_urgency_cat ON analysis(product_category, urgency DESC);
