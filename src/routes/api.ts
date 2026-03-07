import { Hono } from 'hono';
import type { Env, FeedbackSubmission, FeedbackWithAnalysis, SegmentStat } from '../types';
import {
  seedDatabase, getStats, getFeedback, getFeedbackById,
  insertFeedback, getThemes, getCompetitors, getDigestContext, getTimeline,
  getSegmentStats,
} from '../db/queries';
import {
  getCached, setCached, invalidate,
  CACHE_KEYS, CACHE_TTL,
} from '../cache/kv';
import { triggerIngestWorkflow } from '../workflows/ingest';

const api = new Hono<{ Bindings: Env }>();

// ─── POST /seed ───────────────────────────────────────────────────────────────
api.post('/seed', async (c) => {
  const seeded = await seedDatabase(c.env.DB);
  await invalidate(c.env.CACHE, CACHE_KEYS.stats);
  await invalidate(c.env.CACHE, CACHE_KEYS.digest);
  await invalidate(c.env.CACHE, CACHE_KEYS.segments);
  return c.json({ ok: true, seeded });
});

// ─── GET /stats ───────────────────────────────────────────────────────────────
api.get('/stats', async (c) => {
  const cached = await getCached(c.env.CACHE, CACHE_KEYS.stats);
  if (cached) {
    return c.json(cached, 200, { 'X-Cache-Hit': 'true' });
  }
  const stats = await getStats(c.env.DB);
  await setCached(c.env.CACHE, CACHE_KEYS.stats, stats, CACHE_TTL.stats);
  return c.json(stats, 200, { 'X-Cache-Hit': 'false' });
});

// ─── GET /feedback ────────────────────────────────────────────────────────────
api.get('/feedback', async (c) => {
  const q = c.req.query();
  const filters = {
    source: q.source || undefined,
    sentiment: q.sentiment || undefined,
    product_category: q.product_category || undefined,
    urgency_min: q.urgency_min ? parseInt(q.urgency_min) : undefined,
    competitor_only: q.competitor_only === 'true',
    security_only: q.security_only === 'true',
    pii_only: q.pii_only === 'true',
    scope: q.scope || undefined,
    stakeholder_type: q.stakeholder_type || undefined,
    sort: (q.sort as 'urgency_desc' | 'created_desc' | 'sentiment_asc') || 'urgency_desc',
    limit: q.limit ? Math.min(parseInt(q.limit), 100) : 20,
    offset: q.offset ? parseInt(q.offset) : 0,
  };

  const { items, total } = await getFeedback(c.env.DB, filters);

  // Apply visibility redaction for list view (always use redacted_summary)
  const safeItems = items.map(item => applyVisibilityRedaction(item, 'list'));

  return c.json({ items: safeItems, total, offset: filters.offset, limit: filters.limit });
});

// ─── GET /feedback/:id ────────────────────────────────────────────────────────
api.get('/feedback/:id', async (c) => {
  const id = c.req.param('id');
  const item = await getFeedbackById(c.env.DB, id);
  if (!item) return c.json({ error: 'Not found' }, 404);

  // Full record view — apply visibility rules to raw_text
  return c.json(applyVisibilityRedaction(item, 'detail'));
});

// ─── POST /feedback ───────────────────────────────────────────────────────────
api.post('/feedback', async (c) => {
  let body: FeedbackSubmission;
  try {
    body = await c.req.json<FeedbackSubmission>();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.raw_text?.trim()) {
    return c.json({ error: 'raw_text is required' }, 400);
  }
  if (!body.source_type) {
    return c.json({ error: 'source_type is required' }, 400);
  }

  const id = `fb-live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  await insertFeedback(c.env.DB, {
    id,
    source_type: body.source_type,
    source_subtype: body.source_subtype ?? null,
    stakeholder_type: body.stakeholder_type ?? 'unknown',
    title: body.title ?? null,
    raw_text: body.raw_text.trim(),
    nps_score: body.nps_score ?? null,
    csat_score: body.csat_score ?? null,
    engagement_score: body.engagement_score ?? null,
    source_metadata: body.source_metadata ? JSON.stringify(body.source_metadata) : null,
  });

  // Trigger Workflow for async AI analysis
  let workflowInstanceId: string | null = null;
  try {
    workflowInstanceId = await triggerIngestWorkflow(c.env.INGEST_WORKFLOW, id);
  } catch (err) {
    console.error('Workflow trigger failed, falling back to inline analysis:', err);
    // Fallback: inline AI analysis if Workflow fails
    try {
      const { analyzeWithAI } = await import('../ai/parser');
      const { persistAnalysis } = await import('../db/queries');
      const result = await analyzeWithAI(
        c.env.AI, body.source_type, body.raw_text, body.source_metadata ? JSON.stringify(body.source_metadata) : null,
      );
      await persistAnalysis(c.env.DB, id, result, 'inline-fallback');
      await invalidate(c.env.CACHE, CACHE_KEYS.stats);
    } catch (aiErr) {
      console.error('Inline AI fallback also failed:', aiErr);
    }
  }

  return c.json({ ok: true, id, status: 'pending', workflow_instance_id: workflowInstanceId }, 201);
});

// ─── GET /feedback/:id/status ─────────────────────────────────────────────────
api.get('/feedback/:id/status', async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare(
    'SELECT f.analysis_status, a.sentiment, a.urgency, a.product_category, a.summary FROM feedback f LEFT JOIN analysis a ON f.id = a.feedback_id WHERE f.id = ?'
  ).bind(id).first<{ analysis_status: string; sentiment: string | null; urgency: number | null; product_category: string | null; summary: string | null }>();

  if (!row) return c.json({ error: 'Not found' }, 404);

  return c.json({
    id,
    status: row.analysis_status,
    analysis: row.analysis_status === 'analyzed' ? {
      sentiment: row.sentiment,
      urgency: row.urgency,
      product_category: row.product_category,
      summary: row.summary,
    } : null,
  });
});

// ─── GET /themes ──────────────────────────────────────────────────────────────
api.get('/themes', async (c) => {
  const themes = await getThemes(c.env.DB);
  return c.json({ themes });
});

// ─── GET /competitors ─────────────────────────────────────────────────────────
api.get('/competitors', async (c) => {
  const competitors = await getCompetitors(c.env.DB);
  return c.json({ competitors });
});

// ─── GET /timeline ────────────────────────────────────────────────────────────
api.get('/timeline', async (c) => {
  const timeline = await getTimeline(c.env.DB);
  return c.json({ timeline });
});

// ─── GET /segments ────────────────────────────────────────────────────────────
api.get('/segments', async (c) => {
  const cached = await getCached<SegmentStat[]>(c.env.CACHE, CACHE_KEYS.segments);
  if (cached) return c.json({ segments: cached }, 200, { 'X-Cache-Hit': 'true' });
  const segments = await getSegmentStats(c.env.DB);
  await setCached(c.env.CACHE, CACHE_KEYS.segments, segments, CACHE_TTL.segments);
  return c.json({ segments }, 200, { 'X-Cache-Hit': 'false' });
});

// ─── GET /digest ──────────────────────────────────────────────────────────────
api.get('/digest', async (c) => {
  const cached = await getCached<string>(c.env.CACHE, CACHE_KEYS.digest);
  if (cached) {
    return c.json({ digest: cached, cached: true });
  }
  // Generate fresh digest
  const digest = await generateDigest(c.env);
  await setCached(c.env.CACHE, CACHE_KEYS.digest, digest, CACHE_TTL.digest);
  return c.json({ digest, cached: false });
});

// ─── POST /digest/refresh ─────────────────────────────────────────────────────
api.post('/digest/refresh', async (c) => {
  const digest = await generateDigest(c.env);
  await setCached(c.env.CACHE, CACHE_KEYS.digest, digest, CACHE_TTL.digest);
  return c.json({ ok: true, digest });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function applyVisibilityRedaction(
  item: FeedbackWithAnalysis,
  mode: 'list' | 'detail',
): Record<string, unknown> {
  const base = { ...item };

  // List view: always use redacted_summary instead of raw_text
  if (mode === 'list') {
    (base as Record<string, unknown>).raw_text = item.redacted_summary ?? item.summary ?? '[Content redacted]';
    return base as unknown as Record<string, unknown>;
  }

  // Detail view: apply scope-based rules
  if (item.visibility_scope === 'security_team_only') {
    (base as Record<string, unknown>).raw_text = '[RESTRICTED — contact security team to access full content]';
    (base as Record<string, unknown>).source_metadata = null;
  } else if (item.visibility_scope === 'restricted') {
    (base as Record<string, unknown>).raw_text = item.redacted_summary ?? '[RESTRICTED — elevated access required]';
  } else if (item.pii_detected) {
    // internal/public but has PII — show redacted version
    (base as Record<string, unknown>).raw_text = item.redacted_summary ?? '[Content contains PII — redacted for display]';
  }
  // 'internal' and 'public' with no PII: show full content

  return base as unknown as Record<string, unknown>;
}

async function generateDigest(env: Env): Promise<string> {
  const context = await getDigestContext(env.DB);
  const digestPrompt = `You are a senior Product Manager at a cloud/security company writing a concise weekly PM digest.
Based on the following feedback intelligence data, write a structured digest with these exact sections:

**Top Signals This Week**
[3-4 bullet points of most important themes with data]

**High-Urgency Issues Needing Action**
[2-3 specific issues requiring immediate attention]

**Competitor Intelligence**
[What competitors are being mentioned and why — keep it factual]

**What Can Wait**
[1-2 lower-priority items]

**Recommended Next Steps**
[2-3 concrete PM actions]

Keep it concise, data-driven, and written for a PM audience. No generic filler.

Data:
${context}`;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (env.AI as any).run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: 'You are a senior product manager writing a structured weekly digest. Be concise, data-driven, and specific.' },
        { role: 'user', content: digestPrompt },
      ],
      max_tokens: 800,
    }) as { response?: string } | { result?: { response?: string } };

    const text =
      ('response' in response ? response.response : null) ??
      ('result' in response && response.result ? response.result.response : null) ??
      'Digest unavailable — AI analysis failed.';

    return text;
  } catch (err) {
    console.error('Digest generation failed:', err);
    return `**Weekly PM Digest**\n\nDigest generation is temporarily unavailable. Check /api/stats for current data.\n\nContext data:\n${context}`;
  }
}

export { api };
