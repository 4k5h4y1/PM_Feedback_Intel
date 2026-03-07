import type {
  FeedbackRow,
  AnalysisRow,
  FeedbackWithAnalysis,
  FeedbackFilters,
  StatsResponse,
  ThemeEntry,
  CompetitorEntry,
  AnalysisResult,
  TimelineEntry,
  SegmentStat,
} from '../types';
import { SEED_RECORDS } from './seed';

// ─── Join helper ──────────────────────────────────────────────────────────────
function mapJoinRow(row: Record<string, unknown>): FeedbackWithAnalysis {
  return {
    // feedback fields
    id: row.id as string,
    source_type: row.source_type as FeedbackRow['source_type'],
    source_subtype: row.source_subtype as string | null,
    stakeholder_type: row.stakeholder_type as FeedbackRow['stakeholder_type'],
    title: row.title as string | null,
    raw_text: row.raw_text as string,
    created_at: row.created_at as string,
    ingested_at: row.ingested_at as string,
    nps_score: row.nps_score as number | null,
    csat_score: row.csat_score as number | null,
    ces_score: row.ces_score as number | null,
    engagement_score: row.engagement_score as number | null,
    raw_payload_ref: row.raw_payload_ref as string | null,
    analysis_status: row.analysis_status as FeedbackRow['analysis_status'],
    workflow_run_id: row.workflow_run_id as string | null,
    source_metadata: row.source_metadata as string | null,
    // analysis fields (parsed)
    feedback_type: (row.feedback_type as string | null) as FeedbackWithAnalysis['feedback_type'],
    sentiment: (row.sentiment as string | null) as FeedbackWithAnalysis['sentiment'],
    sentiment_score: row.sentiment_score as number | null,
    urgency: row.urgency as number | null,
    product_category: (row.product_category as string | null) as FeedbackWithAnalysis['product_category'],
    sub_product_area: row.sub_product_area as string | null,
    themes: parseJsonArray(row.themes as string | null),
    summary: row.summary as string | null,
    redacted_summary: row.redacted_summary as string | null,
    actionability: (row.actionability as string | null) as FeedbackWithAnalysis['actionability'],
    competitor_mentioned: Boolean(row.competitor_mentioned),
    competitor_name: (row.competitor_name as string | null) as FeedbackWithAnalysis['competitor_name'],
    comparison_context: (row.comparison_context as string | null) as FeedbackWithAnalysis['comparison_context'],
    comparison_type: (row.comparison_type as string | null) as FeedbackWithAnalysis['comparison_type'],
    pii_detected: Boolean(row.pii_detected),
    pii_types: parseJsonArray(row.pii_types as string | null),
    security_sensitive: Boolean(row.security_sensitive),
    privacy_sensitive: Boolean(row.privacy_sensitive),
    visibility_scope: (row.visibility_scope as string ?? 'internal') as FeedbackWithAnalysis['visibility_scope'],
    customer_segment: row.customer_segment as string | null,
    account_tier: row.account_tier as string | null,
    owner_team: row.owner_team as string | null,
    confidence: (row.confidence as number) ?? 0.85,
  };
}

function parseJsonArray(val: string | null): string[] {
  if (!val) return [];
  try { return JSON.parse(val) as string[]; }
  catch { return []; }
}

const JOIN_SQL = `
  SELECT
    f.id, f.source_type, f.source_subtype, f.stakeholder_type, f.title, f.raw_text,
    f.created_at, f.ingested_at, f.nps_score, f.csat_score, f.ces_score,
    f.engagement_score, f.raw_payload_ref, f.analysis_status, f.workflow_run_id,
    f.source_metadata,
    a.feedback_type, a.sentiment, a.sentiment_score, a.urgency, a.product_category,
    a.sub_product_area, a.themes, a.summary, a.redacted_summary, a.actionability,
    a.competitor_mentioned, a.competitor_name, a.comparison_context, a.comparison_type,
    a.pii_detected, a.pii_types, a.security_sensitive, a.privacy_sensitive,
    a.visibility_scope, a.customer_segment, a.account_tier, a.owner_team, a.confidence
  FROM feedback f
  LEFT JOIN analysis a ON f.id = a.feedback_id
`;

// ─── Seed ─────────────────────────────────────────────────────────────────────
export async function seedDatabase(db: D1Database): Promise<number> {
  const stmts: D1PreparedStatement[] = [];

  for (const r of SEED_RECORDS) {
    const now = new Date().toISOString();
    stmts.push(
      db.prepare(`
        INSERT OR IGNORE INTO feedback
          (id, source_type, source_subtype, stakeholder_type, title, raw_text,
           created_at, ingested_at, nps_score, csat_score, ces_score,
           engagement_score, source_metadata, analysis_status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'analyzed')
      `).bind(
        r.id, r.source_type, r.source_subtype, r.stakeholder_type,
        r.title, r.raw_text, r.created_at, now,
        r.nps_score, r.csat_score, r.ces_score, r.engagement_score,
        r.source_metadata,
      )
    );

    stmts.push(
      db.prepare(`
        INSERT OR IGNORE INTO analysis
          (id, feedback_id, feedback_type, sentiment, sentiment_score, urgency,
           product_category, sub_product_area, themes, summary, redacted_summary,
           actionability, competitor_mentioned, competitor_name, comparison_context,
           comparison_type, pii_detected, pii_types, security_sensitive,
           privacy_sensitive, visibility_scope, customer_segment, account_tier,
           owner_team, confidence)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).bind(
        r.id, r.id, r.feedback_type, r.sentiment, r.sentiment_score, r.urgency,
        r.product_category, r.sub_product_area, r.themes, r.summary, r.redacted_summary,
        r.actionability, r.competitor_mentioned, r.competitor_name,
        r.comparison_context, r.comparison_type,
        r.pii_detected, r.pii_types, r.security_sensitive, r.privacy_sensitive,
        r.visibility_scope, r.customer_segment, r.account_tier,
        r.owner_team, r.confidence,
      )
    );
  }

  // D1 batch limit: 100 statements. Split into chunks.
  const CHUNK = 100;
  let inserted = 0;
  for (let i = 0; i < stmts.length; i += CHUNK) {
    await db.batch(stmts.slice(i, i + CHUNK));
    inserted += Math.floor(Math.min(CHUNK, stmts.length - i) / 2);
  }
  return inserted;
}

// ─── Stats ────────────────────────────────────────────────────────────────────
export async function getStats(db: D1Database): Promise<StatsResponse> {
  const [counts, sentiments, sources, categories, specials, npsData] = await db.batch([
    db.prepare('SELECT COUNT(*) as total FROM feedback WHERE analysis_status = ?').bind('analyzed'),
    db.prepare(`
      SELECT
        SUM(CASE WHEN sentiment='positive' THEN 1 ELSE 0 END) as positive,
        SUM(CASE WHEN sentiment='neutral'  THEN 1 ELSE 0 END) as neutral,
        SUM(CASE WHEN sentiment='negative' THEN 1 ELSE 0 END) as negative
      FROM analysis
    `),
    db.prepare('SELECT source_type, COUNT(*) as cnt FROM feedback GROUP BY source_type'),
    db.prepare('SELECT product_category, COUNT(*) as cnt FROM analysis WHERE product_category IS NOT NULL GROUP BY product_category ORDER BY cnt DESC'),
    db.prepare(`
      SELECT
        SUM(CASE WHEN urgency >= 8 THEN 1 ELSE 0 END) as high_urgency,
        SUM(CASE WHEN competitor_mentioned = 1 THEN 1 ELSE 0 END) as competitor,
        SUM(CASE WHEN security_sensitive = 1 THEN 1 ELSE 0 END) as security,
        SUM(CASE WHEN pii_detected = 1 THEN 1 ELSE 0 END) as pii
      FROM analysis
    `),
    db.prepare(`
      SELECT
        AVG(CAST(source_metadata_val AS REAL)) as avg_nps,
        SUM(CASE WHEN CAST(source_metadata_val AS INTEGER) <= 6 THEN 1 ELSE 0 END) as detractors,
        SUM(CASE WHEN CAST(source_metadata_val AS INTEGER) >= 9 THEN 1 ELSE 0 END) as promoters
      FROM (
        SELECT json_extract(f.source_metadata, '$.score') as source_metadata_val
        FROM feedback f WHERE f.source_type = 'nps' AND f.source_metadata IS NOT NULL
      )
    `),
  ]);

  const total = (counts.results[0] as { total: number })?.total ?? 0;
  const s = sentiments.results[0] as { positive: number; neutral: number; negative: number } ?? {};
  const specRow = specials.results[0] as { high_urgency: number; competitor: number; security: number; pii: number } ?? {};
  const npsRow = npsData.results[0] as { avg_nps: number | null; detractors: number; promoters: number } ?? {};

  const by_source: Record<string, number> = {};
  for (const row of sources.results as { source_type: string; cnt: number }[]) {
    by_source[row.source_type] = row.cnt;
  }

  const by_category: Record<string, number> = {};
  for (const row of categories.results as { product_category: string; cnt: number }[]) {
    by_category[row.product_category] = row.cnt;
  }

  return {
    total,
    by_sentiment: { positive: s.positive ?? 0, neutral: s.neutral ?? 0, negative: s.negative ?? 0 },
    by_source,
    by_category,
    high_urgency_count: specRow.high_urgency ?? 0,
    competitor_count: specRow.competitor ?? 0,
    security_sensitive_count: specRow.security ?? 0,
    pii_count: specRow.pii ?? 0,
    nps_avg: npsRow.avg_nps ? Math.round(npsRow.avg_nps * 10) / 10 : null,
    nps_detractors: npsRow.detractors ?? 0,
    nps_promoters: npsRow.promoters ?? 0,
  };
}

// ─── Feedback list ────────────────────────────────────────────────────────────
export async function getFeedback(
  db: D1Database,
  filters: FeedbackFilters,
): Promise<{ items: FeedbackWithAnalysis[]; total: number }> {
  const conditions: string[] = ['1=1'];
  const params: (string | number)[] = [];

  if (filters.source) { conditions.push('f.source_type = ?'); params.push(filters.source); }
  if (filters.sentiment) { conditions.push('a.sentiment = ?'); params.push(filters.sentiment); }
  if (filters.product_category) { conditions.push('a.product_category = ?'); params.push(filters.product_category); }
  if (filters.urgency_min) { conditions.push('a.urgency >= ?'); params.push(filters.urgency_min); }
  if (filters.competitor_only) { conditions.push('a.competitor_mentioned = 1'); }
  if (filters.security_only) { conditions.push('a.security_sensitive = 1'); }
  if (filters.pii_only) { conditions.push('a.pii_detected = 1'); }
  if (filters.scope) { conditions.push('a.visibility_scope = ?'); params.push(filters.scope); }
  if (filters.stakeholder_type) { conditions.push('f.stakeholder_type = ?'); params.push(filters.stakeholder_type); }

  const where = conditions.join(' AND ');

  const sortMap: Record<string, string> = {
    urgency_desc: 'a.urgency DESC, f.created_at DESC',
    created_desc: 'f.created_at DESC',
    sentiment_asc: 'a.sentiment_score ASC',
  };
  const orderBy = sortMap[filters.sort ?? 'urgency_desc'] ?? sortMap.urgency_desc;

  const limit = Math.min(filters.limit ?? 20, 100);
  const offset = filters.offset ?? 0;

  const [rows, countRow] = await db.batch([
    db.prepare(`${JOIN_SQL} WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
      .bind(...params, limit, offset),
    db.prepare(`SELECT COUNT(*) as total FROM feedback f LEFT JOIN analysis a ON f.id = a.feedback_id WHERE ${where}`)
      .bind(...params),
  ]);

  return {
    items: (rows.results as Record<string, unknown>[]).map(mapJoinRow),
    total: (countRow.results[0] as { total: number })?.total ?? 0,
  };
}

// ─── Single feedback item ─────────────────────────────────────────────────────
export async function getFeedbackById(
  db: D1Database,
  id: string,
): Promise<FeedbackWithAnalysis | null> {
  const result = await db.prepare(`${JOIN_SQL} WHERE f.id = ?`).bind(id).first<Record<string, unknown>>();
  if (!result) return null;
  return mapJoinRow(result);
}

// ─── Insert new feedback (pending analysis) ───────────────────────────────────
export async function insertFeedback(
  db: D1Database,
  data: {
    id: string;
    source_type: string;
    source_subtype: string | null;
    stakeholder_type: string;
    title: string | null;
    raw_text: string;
    nps_score: number | null;
    csat_score: number | null;
    engagement_score: number | null;
    source_metadata: string | null;
  },
): Promise<void> {
  await db.prepare(`
    INSERT INTO feedback
      (id, source_type, source_subtype, stakeholder_type, title, raw_text,
       created_at, ingested_at, nps_score, csat_score, engagement_score,
       source_metadata, analysis_status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'pending')
  `).bind(
    data.id, data.source_type, data.source_subtype, data.stakeholder_type,
    data.title, data.raw_text,
    new Date().toISOString(), new Date().toISOString(),
    data.nps_score, data.csat_score, data.engagement_score, data.source_metadata,
  ).run();
}

// ─── Persist AI analysis result ───────────────────────────────────────────────
export async function persistAnalysis(
  db: D1Database,
  feedbackId: string,
  result: AnalysisResult,
  workflowRunId: string,
): Promise<void> {
  await db.batch([
    db.prepare(`
      INSERT OR REPLACE INTO analysis
        (id, feedback_id, feedback_type, sentiment, sentiment_score, urgency,
         product_category, sub_product_area, themes, summary, redacted_summary,
         actionability, competitor_mentioned, competitor_name, comparison_context,
         comparison_type, pii_detected, pii_types, security_sensitive,
         privacy_sensitive, visibility_scope, customer_segment, account_tier,
         owner_team, confidence)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      feedbackId, feedbackId,
      result.feedback_type, result.sentiment, result.sentiment_score, result.urgency,
      result.product_category, result.sub_product_area,
      JSON.stringify(result.themes), result.summary, result.redacted_summary,
      result.actionability,
      result.competitor_mentioned ? 1 : 0,
      result.competitor_name, result.comparison_context, result.comparison_type,
      result.pii_detected ? 1 : 0,
      JSON.stringify(result.pii_types),
      result.security_sensitive ? 1 : 0,
      result.privacy_sensitive ? 1 : 0,
      result.visibility_scope, result.customer_segment, result.account_tier,
      result.owner_team, result.confidence,
    ),
    db.prepare(
      `UPDATE feedback SET analysis_status = 'analyzed', workflow_run_id = ? WHERE id = ?`
    ).bind(workflowRunId, feedbackId),
  ]);
}

// ─── Update raw_payload_ref ───────────────────────────────────────────────────
export async function updateRawPayloadRef(
  db: D1Database,
  feedbackId: string,
  r2Key: string,
): Promise<void> {
  await db.prepare('UPDATE feedback SET raw_payload_ref = ? WHERE id = ?')
    .bind(r2Key, feedbackId).run();
}

// ─── Mark analysis failed ─────────────────────────────────────────────────────
export async function markFailed(db: D1Database, feedbackId: string): Promise<void> {
  await db.prepare(`UPDATE feedback SET analysis_status = 'failed' WHERE id = ?`)
    .bind(feedbackId).run();
}

// ─── Themes ───────────────────────────────────────────────────────────────────
export async function getThemes(db: D1Database): Promise<ThemeEntry[]> {
  // We store themes as a JSON array string — extract and count via multiple queries
  // For MVP: fetch all analyzed themes and aggregate in JS (D1 doesn't support json_each well in all runtimes)
  const rows = await db.prepare(`
    SELECT a.themes, a.sentiment, a.urgency, a.product_category
    FROM analysis a
    WHERE a.themes IS NOT NULL AND a.themes != '[]'
  `).all<{ themes: string; sentiment: string; urgency: number; product_category: string | null }>();

  const themeMap: Map<string, { count: number; negCount: number; urgencies: number[]; categories: string[] }> = new Map();

  for (const row of rows.results) {
    const themes = parseJsonArray(row.themes);
    for (const theme of themes) {
      if (!themeMap.has(theme)) {
        themeMap.set(theme, { count: 0, negCount: 0, urgencies: [], categories: [] });
      }
      const entry = themeMap.get(theme)!;
      entry.count++;
      if (row.sentiment === 'negative') entry.negCount++;
      if (row.urgency) entry.urgencies.push(row.urgency);
      if (row.product_category) entry.categories.push(row.product_category);
    }
  }

  return Array.from(themeMap.entries())
    .map(([theme, data]) => ({
      theme,
      count: data.count,
      negative_pct: data.count > 0 ? Math.round((data.negCount / data.count) * 100) : 0,
      avg_urgency: data.urgencies.length > 0
        ? Math.round((data.urgencies.reduce((a, b) => a + b, 0) / data.urgencies.length) * 10) / 10
        : 0,
      top_category: topItem(data.categories),
    }))
    .filter(t => t.count >= 2) // only themes with enough signal
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}

function topItem(arr: string[]): string | null {
  if (arr.length === 0) return null;
  const freq: Record<string, number> = {};
  for (const v of arr) freq[v] = (freq[v] ?? 0) + 1;
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
}

// ─── Competitors ──────────────────────────────────────────────────────────────
export async function getCompetitors(db: D1Database): Promise<CompetitorEntry[]> {
  const rows = await db.prepare(`
    SELECT
      a.competitor_name,
      COUNT(*) as count,
      GROUP_CONCAT(DISTINCT a.comparison_context) as contexts,
      GROUP_CONCAT(DISTINCT a.product_category) as categories,
      GROUP_CONCAT(DISTINCT a.comparison_type) as comparison_types
    FROM analysis a
    WHERE a.competitor_mentioned = 1 AND a.competitor_name IS NOT NULL
    GROUP BY a.competitor_name
    ORDER BY count DESC
  `).all<{
    competitor_name: string;
    count: number;
    contexts: string | null;
    categories: string | null;
    comparison_types: string | null;
  }>();

  return rows.results.map(row => ({
    competitor_name: row.competitor_name,
    count: row.count,
    contexts: row.contexts ? row.contexts.split(',').filter(Boolean) : [],
    categories: row.categories ? row.categories.split(',').filter(Boolean) : [],
    comparison_types: row.comparison_types ? row.comparison_types.split(',').filter(Boolean) : [],
  }));
}

// ─── AI digest query helper ───────────────────────────────────────────────────
export async function getDigestContext(db: D1Database): Promise<string> {
  const [stats, topThemes, topCompetitors, topUrgent] = await db.batch([
    db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN sentiment='negative' THEN 1 ELSE 0 END) as neg,
        SUM(CASE WHEN urgency >= 8 THEN 1 ELSE 0 END) as high_urg,
        SUM(CASE WHEN competitor_mentioned=1 THEN 1 ELSE 0 END) as comp,
        AVG(urgency) as avg_urg
      FROM analysis
    `),
    db.prepare(`SELECT product_category, COUNT(*) as cnt FROM analysis GROUP BY product_category ORDER BY cnt DESC LIMIT 5`),
    db.prepare(`SELECT competitor_name, COUNT(*) as cnt FROM analysis WHERE competitor_mentioned=1 GROUP BY competitor_name ORDER BY cnt DESC LIMIT 4`),
    db.prepare(`SELECT a.summary, a.urgency, a.product_category FROM analysis a WHERE a.urgency >= 8 ORDER BY a.urgency DESC, a.analyzed_at DESC LIMIT 5`),
  ]);

  const s = stats.results[0] as { total: number; neg: number; high_urg: number; comp: number; avg_urg: number };
  const themes = (topThemes.results as { product_category: string; cnt: number }[])
    .map(r => `${r.product_category} (${r.cnt})`).join(', ');
  const comps = (topCompetitors.results as { competitor_name: string; cnt: number }[])
    .map(r => `${r.competitor_name} (${r.cnt})`).join(', ');
  const urgent = (topUrgent.results as { summary: string; urgency: number; product_category: string }[])
    .map(r => `- [urgency ${r.urgency}] ${r.product_category}: ${r.summary}`).join('\n');

  return `
Total feedback records: ${s.total}
Negative sentiment: ${s.neg} (${Math.round((s.neg/s.total)*100)}%)
High urgency (8+): ${s.high_urg}
Average urgency: ${Math.round(s.avg_urg * 10) / 10}
Competitor mentions: ${s.comp}
Top product categories: ${themes}
Competitors mentioned: ${comps}

Highest urgency signals:
${urgent}
  `.trim();
}

// ─── Timeline ─────────────────────────────────────────────────────────────────
export async function getTimeline(db: D1Database): Promise<TimelineEntry[]> {
  const rows = await db.prepare(`
    SELECT
      date(f.created_at) as day,
      COUNT(*) as count,
      SUM(CASE WHEN a.sentiment = 'negative' THEN 1 ELSE 0 END) as negative,
      SUM(CASE WHEN a.urgency >= 8 THEN 1 ELSE 0 END) as high_urgency,
      SUM(CASE WHEN a.competitor_mentioned = 1 THEN 1 ELSE 0 END) as competitor
    FROM feedback f
    LEFT JOIN analysis a ON f.id = a.feedback_id
    GROUP BY day
    ORDER BY day ASC
    LIMIT 60
  `).all<{ day: string; count: number; negative: number; high_urgency: number; competitor: number }>();

  return rows.results.map(r => ({
    day: r.day,
    count: r.count,
    negative: r.negative ?? 0,
    high_urgency: r.high_urgency ?? 0,
    competitor: r.competitor ?? 0,
  }));
}

// ─── Segment Stats ────────────────────────────────────────────────────────────
export async function getSegmentStats(db: D1Database): Promise<SegmentStat[]> {
  const rows = await db.prepare(`
    SELECT
      COALESCE(a.customer_segment, 'unknown') as segment,
      COUNT(*) as count,
      ROUND(AVG(a.urgency), 1) as avg_urgency,
      SUM(CASE WHEN a.sentiment = 'negative' THEN 1 ELSE 0 END) as negative_count,
      SUM(CASE WHEN a.competitor_mentioned = 1 THEN 1 ELSE 0 END) as competitor_count,
      SUM(CASE WHEN a.urgency >= 8 THEN 1 ELSE 0 END) as high_urgency_count
    FROM analysis a
    GROUP BY COALESCE(a.customer_segment, 'unknown')
    ORDER BY count DESC
  `).all<{ segment: string; count: number; avg_urgency: number; negative_count: number; competitor_count: number; high_urgency_count: number }>();

  // Top product_category per segment requires a second query (D1 lacks FIRST_VALUE/FILTER)
  const catRows = await db.prepare(`
    SELECT
      COALESCE(a.customer_segment, 'unknown') as segment,
      a.product_category,
      COUNT(*) as cnt
    FROM analysis a
    WHERE a.product_category IS NOT NULL
    GROUP BY COALESCE(a.customer_segment, 'unknown'), a.product_category
    ORDER BY cnt DESC
  `).all<{ segment: string; product_category: string; cnt: number }>();

  const topCatMap: Record<string, string> = {};
  for (const row of catRows.results) {
    if (!topCatMap[row.segment]) topCatMap[row.segment] = row.product_category;
  }

  return rows.results.map(row => ({
    segment: row.segment,
    count: row.count,
    avg_urgency: row.avg_urgency ?? 0,
    negative_count: row.negative_count ?? 0,
    competitor_count: row.competitor_count ?? 0,
    high_urgency_count: row.high_urgency_count ?? 0,
    top_product_category: topCatMap[row.segment] ?? null,
  }));
}

// Re-export AnalysisRow for use in workflow
export type { AnalysisRow };
