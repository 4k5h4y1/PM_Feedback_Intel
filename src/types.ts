// ─── Environment Bindings ─────────────────────────────────────────────────────
export interface Env {
  DB: D1Database;
  AI: Ai;
  CACHE: KVNamespace;
  RAW_PAYLOADS: R2Bucket;
  INGEST_WORKFLOW: Workflow;
  SLACK_WEBHOOK_URL?: string; // optional: set via wrangler secret to enable urgent alerts
}

// ─── Workflow Types ───────────────────────────────────────────────────────────
export interface WorkflowParams {
  feedbackId: string;
}

// ─── Source Types ─────────────────────────────────────────────────────────────
export type SourceType =
  | 'github'
  | 'discord'
  | 'support'
  | 'email'
  | 'twitter'
  | 'nps'
  | 'zoom'
  | 'sales';

export type StakeholderType =
  | 'customer'
  | 'developer'
  | 'sales'
  | 'support'
  | 'internal'
  | 'unknown';

// ─── Analysis Enums ───────────────────────────────────────────────────────────
export type FeedbackType =
  | 'bug'
  | 'feature_request'
  | 'praise'
  | 'complaint'
  | 'question'
  | 'comparison'
  | 'churn_risk';

export type Sentiment = 'positive' | 'neutral' | 'negative';
export type Actionability = 'low' | 'medium' | 'high';
export type VisibilityScope = 'public' | 'internal' | 'restricted' | 'security_team_only';
export type AnalysisStatus = 'pending' | 'analyzed' | 'failed';

export type CompetitorName =
  | 'fastly'
  | 'akamai'
  | 'aws_lambda_edge'
  | 'netlify'
  | 'vercel'
  | 'azure_functions'
  | 'other';

export type ComparisonContext =
  | 'pricing'
  | 'performance'
  | 'dx'
  | 'features'
  | 'reliability'
  | 'support'
  | 'compliance';

export type ComparisonType =
  | 'switching_from'
  | 'switching_to'
  | 'evaluating'
  | 'mentioned';

export type ProductCategory =
  | 'workers'
  | 'workers_ai'
  | 'd1'
  | 'kv'
  | 'r2'
  | 'pages'
  | 'cloudflare_one'
  | 'access'
  | 'warp'
  | 'zero_trust'
  | 'gateway'
  | 'tunnel'
  | 'security_waf'
  | 'ddos'
  | 'bot_management'
  | 'api_shield'
  | 'cdn'
  | 'cache'
  | 'analytics'
  | 'logs'
  | 'developer_platform'
  | 'cli_dx'
  | 'docs_onboarding'
  | 'billing_pricing'
  | 'unknown';

// ─── Database Row Types ───────────────────────────────────────────────────────
export interface FeedbackRow {
  id: string;
  source_type: SourceType;
  source_subtype: string | null;
  stakeholder_type: StakeholderType;
  title: string | null;
  raw_text: string;
  created_at: string;
  ingested_at: string;
  nps_score: number | null;
  csat_score: number | null;
  ces_score: number | null;
  engagement_score: number | null;
  raw_payload_ref: string | null;
  analysis_status: AnalysisStatus;
  workflow_run_id: string | null;
  source_metadata: string | null; // JSON string
}

export interface AnalysisRow {
  id: string;
  feedback_id: string;
  feedback_type: FeedbackType | null;
  sentiment: Sentiment | null;
  sentiment_score: number | null;
  urgency: number | null;
  product_category: ProductCategory | null;
  sub_product_area: string | null;
  themes: string | null; // JSON array string
  summary: string | null;
  redacted_summary: string | null;
  actionability: Actionability | null;
  competitor_mentioned: number; // SQLite boolean
  competitor_name: CompetitorName | null;
  comparison_context: ComparisonContext | null;
  comparison_type: ComparisonType | null;
  pii_detected: number; // SQLite boolean
  pii_types: string | null; // JSON array string
  security_sensitive: number; // SQLite boolean
  privacy_sensitive: number; // SQLite boolean
  visibility_scope: VisibilityScope;
  customer_segment: string | null;
  account_tier: string | null;
  owner_team: string | null;
  confidence: number;
  analyzed_at: string;
}

// ─── Combined view (JOIN result) ──────────────────────────────────────────────
export interface FeedbackWithAnalysis extends FeedbackRow {
  // Parsed analysis fields (joined from analysis table)
  feedback_type: FeedbackType | null;
  sentiment: Sentiment | null;
  sentiment_score: number | null;
  urgency: number | null;
  product_category: ProductCategory | null;
  sub_product_area: string | null;
  themes: string[]; // parsed from JSON string
  summary: string | null;
  redacted_summary: string | null;
  actionability: Actionability | null;
  competitor_mentioned: boolean;
  competitor_name: CompetitorName | null;
  comparison_context: ComparisonContext | null;
  comparison_type: ComparisonType | null;
  pii_detected: boolean;
  pii_types: string[]; // parsed from JSON string
  security_sensitive: boolean;
  privacy_sensitive: boolean;
  visibility_scope: VisibilityScope;
  customer_segment: string | null;
  account_tier: string | null;
  owner_team: string | null;
  confidence: number;
}

// ─── AI Analysis Result ───────────────────────────────────────────────────────
export interface AnalysisResult {
  feedback_type: FeedbackType;
  sentiment: Sentiment;
  sentiment_score: number;
  urgency: number;
  product_category: ProductCategory;
  sub_product_area: string | null;
  themes: string[];
  summary: string;
  redacted_summary: string;
  actionability: Actionability;
  competitor_mentioned: boolean;
  competitor_name: CompetitorName | null;
  comparison_context: ComparisonContext | null;
  comparison_type: ComparisonType | null;
  pii_detected: boolean;
  pii_types: string[];
  security_sensitive: boolean;
  privacy_sensitive: boolean;
  visibility_scope: VisibilityScope;
  customer_segment: string;
  account_tier: string;
  owner_team: string | null;
  confidence: number;
}

// ─── API Request/Response Types ───────────────────────────────────────────────
export interface FeedbackSubmission {
  source_type: SourceType;
  source_subtype?: string;
  stakeholder_type?: StakeholderType;
  title?: string;
  raw_text: string;
  nps_score?: number;
  csat_score?: number;
  engagement_score?: number;
  source_metadata?: Record<string, unknown>;
}

export interface StatsResponse {
  total: number;
  by_sentiment: { positive: number; neutral: number; negative: number };
  by_source: Record<string, number>;
  by_category: Record<string, number>;
  high_urgency_count: number;
  competitor_count: number;
  security_sensitive_count: number;
  pii_count: number;
  nps_avg: number | null;
  nps_detractors: number;
  nps_promoters: number;
}

export interface ThemeEntry {
  theme: string;
  count: number;
  negative_pct: number;
  avg_urgency: number;
  top_category: string | null;
}

export interface CompetitorEntry {
  competitor_name: string;
  count: number;
  contexts: string[];
  categories: string[];
  comparison_types: string[];
}

export interface FeedbackFilters {
  source?: string;
  sentiment?: string;
  product_category?: string;
  urgency_min?: number;
  competitor_only?: boolean;
  security_only?: boolean;
  pii_only?: boolean;
  scope?: string;
  stakeholder_type?: string;
  sort?: 'urgency_desc' | 'created_desc' | 'sentiment_asc';
  limit?: number;
  offset?: number;
}

export interface TimelineEntry {
  day: string;
  count: number;
  negative: number;
  high_urgency: number;
  competitor: number;
}

export interface SegmentStat {
  segment: string;               // 'enterprise' | 'smb' | 'startup' | 'unknown'
  count: number;
  avg_urgency: number;
  negative_count: number;
  competitor_count: number;
  high_urgency_count: number;
  top_product_category: string | null;
}
