import type { AnalysisResult } from '../types';

const VALID_FEEDBACK_TYPES = ['bug','feature_request','praise','complaint','question','comparison','churn_risk'];
const VALID_SENTIMENTS = ['positive','neutral','negative'];
const VALID_ACTIONABILITY = ['low','medium','high'];
const VALID_SCOPES = ['public','internal','restricted','security_team_only'];
const VALID_CATEGORIES = [
  'workers','workers_ai','d1','kv','r2','pages','cloudflare_one','access','warp',
  'zero_trust','gateway','tunnel','security_waf','ddos','bot_management','api_shield',
  'cdn','cache','analytics','logs','developer_platform','cli_dx','docs_onboarding',
  'billing_pricing','unknown',
];
const VALID_COMPETITORS = ['fastly','akamai','aws_lambda_edge','netlify','vercel','azure_functions','other'];
const VALID_COMPARISON_CONTEXTS = ['pricing','performance','dx','features','reliability','support','compliance'];
const VALID_COMPARISON_TYPES = ['switching_from','switching_to','evaluating','mentioned'];

// Regex patterns for PII scrubbing
const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const IP_RE = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;
const TOKEN_RE = /\b(sk[-_][a-zA-Z0-9\-_]{10,}|Bearer\s+[A-Za-z0-9\-_.~+/]+=*|api[-_]?key[-_]?[:=]\s*[A-Za-z0-9\-_]{8,})/gi;

export function sanitizeSummary(text: string): string {
  return text
    .replace(EMAIL_RE, '[REDACTED_EMAIL]')
    .replace(IP_RE, '[REDACTED_IP]')
    .replace(TOKEN_RE, '[REDACTED_TOKEN]');
}

function getDefaultAnalysis(): AnalysisResult {
  return {
    feedback_type: 'complaint',
    sentiment: 'neutral',
    sentiment_score: 0,
    urgency: 5,
    product_category: 'unknown',
    sub_product_area: null,
    themes: [],
    summary: 'Feedback received — AI analysis unavailable.',
    redacted_summary: 'Feedback received — AI analysis unavailable.',
    actionability: 'medium',
    competitor_mentioned: false,
    competitor_name: null,
    comparison_context: null,
    comparison_type: null,
    pii_detected: false,
    pii_types: [],
    security_sensitive: false,
    privacy_sensitive: false,
    visibility_scope: 'internal',
    customer_segment: 'unknown',
    account_tier: 'unknown',
    owner_team: null,
    confidence: 0.1,
  };
}

export function parseAnalysis(raw: string): AnalysisResult {
  // Strip markdown fences the model sometimes adds despite instructions
  const cleaned = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    // Try to extract a JSON object from mixed text response
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { parsed = JSON.parse(match[0]) as Record<string, unknown>; }
      catch { return getDefaultAnalysis(); }
    } else {
      return getDefaultAnalysis();
    }
  }

  const pii_detected = Boolean(parsed.pii_detected);
  const security_sensitive = Boolean(parsed.security_sensitive);

  let summary = String(parsed.summary ?? '').slice(0, 500);
  let redacted_summary = String(parsed.redacted_summary ?? parsed.summary ?? '').slice(0, 500);

  // Safety enforcement: if PII or security sensitive, always sanitize summaries
  if (pii_detected || security_sensitive) {
    summary = sanitizeSummary(summary);
    redacted_summary = sanitizeSummary(redacted_summary);
  }

  const result: AnalysisResult = {
    feedback_type: VALID_FEEDBACK_TYPES.includes(parsed.feedback_type as string)
      ? (parsed.feedback_type as AnalysisResult['feedback_type'])
      : 'complaint',
    sentiment: VALID_SENTIMENTS.includes(parsed.sentiment as string)
      ? (parsed.sentiment as AnalysisResult['sentiment'])
      : 'neutral',
    sentiment_score: Math.max(-1, Math.min(1, Number(parsed.sentiment_score) || 0)),
    urgency: Math.round(Math.max(1, Math.min(10, Number(parsed.urgency) || 5))),
    product_category: VALID_CATEGORIES.includes(parsed.product_category as string)
      ? (parsed.product_category as AnalysisResult['product_category'])
      : 'unknown',
    sub_product_area: parsed.sub_product_area
      ? String(parsed.sub_product_area).slice(0, 100)
      : null,
    themes: Array.isArray(parsed.themes)
      ? (parsed.themes as string[]).slice(0, 6).map(t => String(t).toLowerCase().replace(/\s+/g, '_'))
      : [],
    summary,
    redacted_summary,
    actionability: VALID_ACTIONABILITY.includes(parsed.actionability as string)
      ? (parsed.actionability as AnalysisResult['actionability'])
      : 'medium',
    competitor_mentioned: Boolean(parsed.competitor_mentioned),
    competitor_name: VALID_COMPETITORS.includes(parsed.competitor_name as string)
      ? (parsed.competitor_name as AnalysisResult['competitor_name'])
      : null,
    comparison_context: VALID_COMPARISON_CONTEXTS.includes(parsed.comparison_context as string)
      ? (parsed.comparison_context as AnalysisResult['comparison_context'])
      : null,
    comparison_type: VALID_COMPARISON_TYPES.includes(parsed.comparison_type as string)
      ? (parsed.comparison_type as AnalysisResult['comparison_type'])
      : null,
    pii_detected,
    pii_types: Array.isArray(parsed.pii_types)
      ? (parsed.pii_types as string[]).slice(0, 8)
      : [],
    security_sensitive,
    privacy_sensitive: Boolean(parsed.privacy_sensitive),
    visibility_scope: VALID_SCOPES.includes(parsed.visibility_scope as string)
      ? (parsed.visibility_scope as AnalysisResult['visibility_scope'])
      : 'internal',
    customer_segment: String(parsed.customer_segment ?? 'unknown'),
    account_tier: String(parsed.account_tier ?? 'unknown'),
    owner_team: parsed.owner_team ? String(parsed.owner_team).slice(0, 100) : null,
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
  };

  // If pii or security detected but scope was set too permissively, enforce minimum scope
  if (result.security_sensitive && result.visibility_scope === 'public') {
    result.visibility_scope = 'security_team_only';
  } else if (result.pii_detected && (result.visibility_scope === 'public' || result.visibility_scope === 'internal')) {
    result.visibility_scope = 'restricted';
  }

  return result;
}

// Run AI analysis with Workers AI binding
export async function analyzeWithAI(
  ai: Ai,
  sourceType: string,
  rawText: string,
  sourceMetadata: string | null,
): Promise<AnalysisResult> {
  const { buildUserPrompt, SYSTEM_PROMPT } = await import('./prompt');

  const userPrompt = buildUserPrompt(sourceType, rawText, sourceMetadata);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (ai as any).run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 1024,
    }) as { response?: string } | { result?: { response?: string } };

    // Handle both response shapes from different Workers AI SDK versions
    const rawResponse =
      ('response' in response ? response.response : null) ??
      ('result' in response && response.result ? response.result.response : null) ??
      '';

    return parseAnalysis(rawResponse ?? '');
  } catch (err) {
    console.error('Workers AI analysis failed:', err);
    return getDefaultAnalysis();
  }
}
