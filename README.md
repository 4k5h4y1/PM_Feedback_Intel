# PMI Dashboard — Voice of Customer

> **Product Manager Intelligence** — a secure internal VoC platform for PMs, built entirely on Cloudflare's developer platform.

**Live:** https://signaldesk.ashar-0a8.workers.dev

---

## Executive Summary

PMI Dashboard ingests feedback from 8 channels (GitHub, Discord, support tickets, email, Twitter/X, NPS surveys, Zoom call transcripts, and sales notes), analyzes each record with Workers AI, and surfaces actionable intelligence for PMs — urgency scoring, competitor tracking, PII redaction, and restricted visibility controls — all within a single Cloudflare Workers deployment.

The core PM workflow: **aggregate → normalize → analyze → filter → investigate → act**

Key outcomes from a 60-record demo dataset:
- 14 high-urgency issues (urgency 8-10) surfaced and ranked
- 14 competitor mentions extracted with context (switching_from / evaluating / mentioned)
- 6 security-sensitive records automatically restricted from the default view
- 9 PII-flagged records with emails/IPs/tokens replaced in all display fields
- AI-generated PM digest synthesizing top themes, risks, and recommended actions

---

## Architecture

```
Seed Data (60 records, 8 source types)
         │
         ▼
POST /api/seed ──────────────────────────────────────────┐
         │                                                │
         ▼ (live path for new submissions)                │
POST /api/feedback                                        │
         │                                                │
         ▼                                                │
Cloudflare Workflows (FeedbackIngestWorkflow)             │
  Step 1: validate-and-fetch (idempotency guard)          │
  Step 2: analyze-with-ai (Workers AI, retries: 2)        │
  Step 3: persist-to-d1 (write feedback + analysis)       │
  Step 4: store-raw-payload (R2, long-form sources only)  │
  Step 5: invalidate-cache (KV stats key)                 │
  Step 6: send-urgent-alert (Slack, urgency >= 8)         │
         │                          │               │
         ▼                          ▼               ▼
    D1 Database               R2 Bucket         KV Store
  (feedback + analysis       (raw payloads     (stats 5 min TTL
   two-table design)         for zoom/sales/    digest 1 hr TTL)
                              email records)
         │
         ▼
Workers API (Hono) + Dashboard HTML
         │
         ▼
Cloudflare Access (described — see section below)
         │
         ▼
Browser — PM Dashboard (6 views, vanilla JS, no bundler)
```

### Cloudflare Products Used

| # | Product | Binding | Role |
|---|---|---|---|
| 1 | **Workers** | — | Runtime, Hono API, dashboard HTML serving |
| 2 | **D1** | `DB` | Normalized feedback + AI analysis (two-table schema) |
| 3 | **Workers AI** | `AI` | Llama 3.1-8B structured JSON extraction |
| 4 | **Workflows** | `INGEST_WORKFLOW` | Durable 6-step ingest pipeline with retries |
| 5 | **KV** | `CACHE` | Stats cache (5 min TTL) + AI digest cache (1 hr TTL) |
| 6 | **R2** | `RAW_PAYLOADS` | Raw payload archive for long-form sources |
| 7 | **Cloudflare Access** | — | Identity-aware auth (see §Access Architecture) |

---

## Workers AI Design

### This is structured extraction, not an agent

Workers AI is used for **one-shot structured JSON extraction** — not reasoning, not tool use, not agentic loops. Each piece of feedback goes in, a validated JSON object comes out. The design is intentionally narrow and deterministic:

- Single inference call per feedback record
- Output: 22 typed fields (sentiment, urgency 1-10, product_category, competitor_name, pii_detected, visibility_scope, etc.)
- No tool calls, no multi-turn, no planning
- JSON-only output enforced at the prompt level ("No markdown. No code fences. Just the JSON object.")
- Parser validates and coerces every field with safe defaults — bad AI output degrades gracefully

**Why not an agent?** An agent (tool-calling loop, ReAct, etc.) would add latency, non-determinism, and cost for no gain. The extraction task is well-defined — given a piece of text and its source context, classify it across a fixed taxonomy. Structured extraction is the correct abstraction.

**Why Llama 3.1-8B?** It runs natively on Workers AI, supports JSON-mode-style prompting reliably, and is fast enough for synchronous analysis inside a Workflow step. The 8B parameter size is sufficient for classification; larger models would add latency without meaningfully improving taxonomy accuracy.

### AI for digest generation (separate path)

A second AI call powers `GET /api/digest` and `POST /api/digest/refresh`. This is **summarization over aggregated stats** — the model receives a structured data context and writes a PM-readable weekly digest in a fixed format (Top Signals, High-Urgency Issues, Competitor Intelligence, What Can Wait, Recommended Next Steps). Cached in KV at 1-hour TTL.

### Safety enforcement

If `pii_detected=true`, summaries are auto-sanitized before storage via regex patterns:
- Email addresses → `[REDACTED_EMAIL]`
- IP addresses → `[REDACTED_IP]`
- API keys / bearer tokens → `[REDACTED_TOKEN]`

This runs in the parser layer (not just the API layer) — PII never reaches D1 in display fields.

---

## D1 Schema — Two Tables

Separating raw feedback from AI-generated analysis means re-analysis can overwrite `analysis` without touching `feedback`. Clean audit trail; no data loss on model upgrades.

```sql
-- TABLE 1: feedback (raw + metadata)
CREATE TABLE feedback (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,       -- github|discord|support|email|twitter|nps|zoom|sales
  stakeholder_type TEXT NOT NULL,  -- customer|developer|sales|support|internal|unknown
  raw_text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  analysis_status TEXT DEFAULT 'pending',  -- pending|analyzed|failed
  nps_score INTEGER,               -- 0-10, NPS records only
  csat_score REAL,                 -- 1.0-5.0, support/CSAT records only
  raw_payload_ref TEXT,            -- R2 object key (long-form sources)
  workflow_run_id TEXT,            -- Workflow instance ID for debugging
  source_metadata TEXT             -- JSON blob (repo, ticket_id, channel, etc.)
);

-- TABLE 2: analysis (AI-generated structured output)
CREATE TABLE analysis (
  feedback_id TEXT REFERENCES feedback(id),
  sentiment TEXT,                  -- positive|neutral|negative
  urgency INTEGER,                 -- 1-10
  product_category TEXT,           -- workers|d1|r2|kv|pages|security_waf|...
  themes TEXT,                     -- JSON array: ["cold_start","latency"]
  summary TEXT,                    -- 1-2 sentence PM summary, no PII
  redacted_summary TEXT,           -- PII-scrubbed version for list views
  competitor_mentioned INTEGER,    -- 0|1
  competitor_name TEXT,            -- fastly|netlify|aws_lambda_edge|akamai|vercel|...
  comparison_context TEXT,         -- pricing|performance|dx|features|reliability|...
  pii_detected INTEGER,            -- 0|1
  pii_types TEXT,                  -- JSON array: ["email","ip_address","api_key"]
  security_sensitive INTEGER,      -- 0|1
  visibility_scope TEXT DEFAULT 'internal',  -- public|internal|restricted|security_team_only
  owner_team TEXT,                 -- routed PM/team owner
  confidence REAL                  -- 0.0-1.0
);
```

---

## Alerting

When `urgency >= 8` and a `SLACK_WEBHOOK_URL` environment variable is configured, Step 6 of the Workflow fires a Slack Block Kit alert. The alert includes:

- Urgency level and label (HIGH URGENCY vs CRITICAL)
- Product area, source type, feedback type
- Assigned PM (resolved from the `owner_team` field, with a fallback routing table mapping 25 product categories to PM roles)
- Redacted summary (never raw text)
- Link back to SignalDesk

To configure:
```bash
npx wrangler secret put SLACK_WEBHOOK_URL
# paste your Incoming Webhook URL
```

PM routing is defined in `src/alerts/slack.ts` — maps product categories (workers, d1, r2, security_waf, cloudflare_one, etc.) to PM role strings. Customize to match your org structure.

---

## API Routes

```
GET  /                          Dashboard HTML
POST /api/seed                  Insert 60 mock records (idempotent — INSERT OR IGNORE)
POST /api/feedback              Submit new feedback → triggers Workflow
GET  /api/stats                 Aggregate stats (KV cached 5 min, X-Cache-Hit header)
GET  /api/feedback              Paginated feed with filters:
                                  source, sentiment, product_category, urgency_min,
                                  competitor_only, security_only, pii_only,
                                  scope, stakeholder_type, sort, limit, offset
GET  /api/feedback/:id          Single record (visibility-scoped raw_text)
GET  /api/feedback/:id/status   Workflow analysis status polling
GET  /api/themes                Theme intelligence (volume + urgency + sentiment per theme)
GET  /api/competitors           Competitor intel grouped by name + comparison context
GET  /api/timeline              Daily feedback volume with negative/urgency breakdown (30 days)
GET  /api/segments              Per-segment stats: Enterprise, Mid-Market, Emerging (KV cached 5 min)
GET  /api/digest                AI weekly PM digest (KV cached 1 hr)
POST /api/digest/refresh        Force regenerate digest via Workers AI
```

### Visibility Scoping

The `/api/feedback/:id` endpoint applies server-side content rules:

| Scope | Behavior |
|---|---|
| `public` | Full raw_text returned |
| `internal` | Full raw_text returned |
| `restricted` | Returns `redacted_summary` only |
| `security_team_only` | Returns `[RESTRICTED — contact security team to access full content]` |

PII-flagged records (`pii_detected=true`) always substitute `redacted_summary` for `raw_text` in both list and detail views, regardless of `visibility_scope`.

List view (`GET /api/feedback`) always uses `redacted_summary` — raw text is never exposed in paginated results.

---

## Dashboard Views

The single-page dashboard (inline HTML/CSS/JS, no bundler, no framework) has six views:

1. **Overview** — PM briefing surface: Priority Actions strip, 4-card executive summary, trend charts, segment comparison table, top-5 theme preview, collapsed PM Brief
2. **Prioritization** — Feedback auto-bucketed into 5 categories: Core Gaps · Quick Wins · Strategic Bets · Long-Term · Delighters (client-side weighted scoring + trending themes table)
3. **Competitive Pressure** — Competitor intelligence grouped by name with context, comparison type, and related product areas
4. **Security Issues** — Restricted signals, PII-flagged records, visibility scope model
5. **All Feedback** — Full paginated feed with filter/sort controls (source, sentiment, product, stakeholder, sort by urgency/date/sentiment)
6. **Weekly Digest** — AI-generated PM digest with a Regenerate button

### Overview Page — PM Briefing Structure

The overview is designed as a PM briefing surface, not an operational dashboard. It surfaces the most actionable signal first and builds context progressively:

**Section 1 — Priority Actions**
Top 5 items from urgency-8+ feedback, sorted by Weighted Criticality Score. Each card shows a color-coded criticality badge, source + product area, truncated summary, a one-line "why urgent" reason, and a direct link to the full record.

**Section 2 — Executive Summary (4 cards)**
- **Action Required** — count of urgency ≥ 8 records
- **Customer Sentiment** — composite 0–100 score (see formula below)
- **Competitive Pressure** — named competitor mention count
- **Total Signals** — total analyzed records

Removed from hero: Negative count, Restricted count, PII Flagged count (operational detail, not PM executive signal). NPS average is surfaced as subtext on the Customer Sentiment card.

**Section 3 — Trends**
- Feedback Volume: 30-day bar chart, orange = total, red = negative
- Product Areas Under Pressure: horizontal bar chart by category volume

**Section 4 — Segment Impact**
Enterprise / Mid-Market / Emerging comparison table. Columns: Volume (+ urgent count), Avg Urgency, Sentiment Health, Top Issue Area, Competitive Pressure.

**Section 5 — What's Trending**
Top 5 themes from `/api/themes` with "See all → Prioritization" link.

**Section 6 — PM Brief**
First ~300 characters of the AI digest with "Full brief → Weekly Digest" link.

---

## Prioritization Buckets

The **Prioritization** view classifies every feedback record client-side into one of five actionable buckets using the fields already returned by `/api/feedback`. No extra API calls, no DB changes.

| Bucket | Icon | Classification Rule |
|---|---|---|
| **Core Gaps** | 🔥 | `urgency ≥ 8` + type in `(bug, complaint, churn_risk)` + segment `enterprise` or `smb` |
| **Quick Wins** | 🎯 | `urgency 6–8` + `actionability ≥ 0.7` + type in `(bug, feature_request, complaint)` |
| **Strategic Bets** | 🚀 | `feedback_type = feature_request` + `urgency ≥ 5` + (`competitor_mentioned OR enterprise`) |
| **Long-Term** | 🌱 | `feedback_type = feature_request` + `urgency < 6` |
| **Delighters** | ✨ | `feedback_type = praise` OR (`sentiment = positive` AND `urgency < 7`) |

Items within each bucket are sorted descending by `criticalityScore()`. The top 3–4 items per bucket are shown, each linking to the full detail modal.

---

## Weighted Criticality Score

A 0–100 score computed client-side from data already returned by `/api/feedback`. No new DB fields, no schema changes, no extra API calls. The formula is fully transparent and shown in the Priority Actions section.

```
base = urgency × 10   (0–100)

source_weight:
  sales: 1.5 · email: 1.4 · support: 1.3 · zoom: 1.2
  nps: 1.1 · github: 1.0 · discord: 0.8 · twitter: 0.7

segment_weight:
  enterprise: 1.3 · smb: 1.0 · startup: 0.9 · unknown: 0.9

feedback_type_weight:
  churn_risk: 1.4 · bug: 1.2 · complaint: 1.1 · comparison: 1.1
  feature_request: 1.0 · question: 0.8 · praise: 0.7

security_bonus  = security_sensitive ? +20 : 0
competitor_bonus = comparison_type === 'switching_from' ? +15 : competitor_mentioned ? +5 : 0

criticality = clamp(0, 100, round(base × source_weight × segment_weight × feedback_type_weight + security_bonus + competitor_bonus))
```

**Badge colors:** red ≥ 75 (critical), amber 45–74 (high), muted < 45 (standard)

**Sanity checks:**
- Sales / churn_risk / enterprise / urgency 9: `90 × 1.5 × 1.3 × 1.4 = 245.7 → clamped to 100` ✓
- Twitter / praise / startup / urgency 3: `30 × 0.7 × 0.9 × 0.7 ≈ 13` ✓

---

## Customer Sentiment Composite Score

Replaces the raw "Negative" count card with a 0–100 composite health score. Computed client-side from `/api/stats`.

```
score = clamp(0, 100, round(((positive - negative×1.2 + neutral×0.4) / total) × 50 + 50))
```

Negative feedback is weighted 1.2× (more damaging than positive is beneficial). Neutral is weighted 0.4× (slight positive signal). The `×50+50` maps the result to a 0–100 scale centered at 50.

**Color bands:** green ≥ 70 (healthy), amber 40–69 (at risk), red < 40 (critical)

With the seed data (~36 negative, 18 positive, 6 neutral out of 60): expected score ≈ 30 → red band. This reflects the intentionally skewed seed data (45% negative) designed to surface PM pain points.

---

## Segment Insights (`/api/segments`)

New endpoint returning per-segment aggregations from the `analysis` table.

**Response shape:**
```json
{
  "segments": [
    {
      "segment": "enterprise",
      "count": 17,
      "avg_urgency": 7.2,
      "negative_count": 9,
      "competitor_count": 4,
      "high_urgency_count": 6,
      "top_product_category": "workers"
    }
  ]
}
```

**Display name mapping:**
| `segment` value | Display name |
|---|---|
| `enterprise` | Enterprise |
| `smb` | Mid-Market |
| `startup` | Emerging |
| `unknown` | Unknown |

**Caching:** KV key `dashboard:segments:v1`, TTL 300 seconds (5 minutes). Invalidated on `POST /api/seed`.

**Query design:** Two D1 queries (mirrors `getThemes()` pattern). First query aggregates counts and averages per segment. Second query finds top product category per segment (D1 lacks reliable `FIRST_VALUE`/`FILTER` support, so JS post-processing picks the first result per segment from the already-sorted rows).

---

## Geospatial Visualization — Not Implemented

A geographic view was considered during design. The decision was **not to implement it**.

**Reason:** No structured geographic field exists in the schema. The fields `source_type`, `customer_segment`, `account_tier`, and `stakeholder_type` have no geographic component. The string "eu-west" appears in the raw text and themes of approximately 2–3 records in the seed data — this is not queryable in a structured way and represents incidental geographic mention rather than a geographic attribute of the record.

A geospatial view built on `LIKE '%eu%'` pattern matching would be entirely decorative (and inaccurate). Segment-based insights (Enterprise / Mid-Market / Emerging) are far more actionable for PMs and are backed by structured, queryable fields.

---

## Terminology Reference

| Location | Previous label | Current label |
|---|---|---|
| Product name | SignalDesk | PMI Dashboard |
| Product subtitle | PM Feedback Intelligence | Voice of Customer |
| Sidebar nav | Key Issues | Prioritization |
| Page title / tab | Key Issues / Priority Issues | Prioritization |
| Issues view heading | Key Issues / Priority Issues | Prioritization |
| Issues view theme card | Issue Patterns | What's Trending |
| Sidebar nav | Competitor Intel | Competitive Pressure |
| Page title / tab | Competitor Intel | Competitive Pressure |
| Competitors view heading | Competitor Intelligence | Competitive Pressure |
| Sidebar nav | Security & Privacy | Security Issues |
| Security view heading | Security & Privacy | Security Issues |
| Stat card | Negative | *(replaced by Customer Sentiment)* |
| Stat card | Competitor Mentions | Competitive Pressure |
| Stat card | Total Feedback | Total Signals |
| Overview alert strip | Action Required — High Urgency | Priority Actions — Needs PM Attention |
| Topbar shortcut button | Weekly Digest | Prioritization |

---

## Cloudflare Access Architecture

Access wraps the Workers application at the Cloudflare edge. Unauthenticated requests redirect to a login page before the Worker processes them.

**What Access handles:** Authentication, identity assertion, SSO (Google / GitHub / Cloudflare), session token validation.

**What the application handles:** Content-level visibility rules (`visibility_scope`), PII redaction, route-level content restrictions. Access is a door-lock; the application is the content policy.

**Proposed policy design:**
```
Application: SignalDesk
URL: signaldesk.<account>.workers.dev

Policy 1: Default internal access
  Rule: Email domain = @cloudflare.com
  Action: Allow

Policy 2: Security-sensitive routes
  Rule: Email in security-team group
  Action: Allow + require WARP device posture
  Applies to: /api/feedback?security_only=true
```

**Local testing gap:** `wrangler dev` does not simulate Access policy evaluation. See Friction Log #3.

---

## Architecture Tradeoffs

**Single Worker vs. microservices:** Everything runs in one Worker. This simplifies deployment (one `wrangler deploy`, one set of bindings) and eliminates service-to-service latency for the dashboard/API. The tradeoff is that the dashboard HTML (the largest component) increases the bundle size. Acceptable for an internal tool at this scale.

**Pre-analyzed seed data vs. live AI on seed:** The 60 mock records are pre-analyzed (AI results stored in `seed.ts`). This makes the demo stable — it doesn't depend on Workers AI availability or response consistency during a demo. New feedback submitted via `POST /api/feedback` goes through the live AI pipeline.

**Inline Workflow fallback:** If the Workflow trigger fails on `POST /api/feedback`, the handler falls back to inline synchronous AI analysis. This means no data loss on Workflow service disruptions, at the cost of blocking the HTTP response briefly.

**KV caching vs. D1 query cost:** Stats queries aggregate across both tables with several SUMs and COUNTs. At 60 records this is instantaneous, but at scale (10k+ records) the query cost increases. The 5-minute KV cache means most dashboard loads are a single KV read instead of a D1 aggregate query. The cache is invalidated on every new feedback record processed through the Workflow.

**Two-table D1 schema:** Separating `feedback` (raw + metadata) from `analysis` (AI output) allows re-running AI analysis on existing records without touching the original data. The `analysis` record can be overwritten if the model is updated or a record needs re-classification. The `feedback` record is immutable after insert.

---

## Mock Seed Data

60 pre-analyzed records across 8 source types:

| Source | Count | Notes |
|---|---|---|
| github | 12 | Technical bugs, feature requests, repro steps |
| discord | 10 | Community troubleshooting, education gaps |
| support | 10 | Enterprise tickets, billing, reliability escalations |
| email | 7 | Enterprise escalations, renewal risk, churn signals |
| twitter | 7 | Public sentiment, outage mentions, competitor references |
| nps | 6 | Structured scores (2 promoter / 2 passive / 2 detractor) + free-form |
| zoom | 4 | Customer call snippets, churn signals, objections |
| sales | 4 | Sales call notes, enterprise requirements, competitive deals |

**Sentiment:** 45% negative, 30% neutral, 25% positive (reflects PM pain-point perspective).

**Urgency distribution:** 14 records at urgency 8-10, 30 at 5-7, 16 at 1-4.

**Special cases:**
- Competitor mentions: 14 total (Fastly 5, Netlify 3, AWS Lambda@Edge 3, Akamai 2, Vercel 1)
- PII detected: 9 records (emails, IPs, API keys in raw text — all scrubbed in summaries)
- Security-sensitive: 6 records (WAF bypass, leaked key, compliance risk, incident escalation)
- `visibility_scope = security_team_only`: 2 records
- `visibility_scope = restricted`: 4 records

---

## Local Development

```bash
npm install
npx wrangler dev

# Seed local database
curl -X POST http://localhost:8787/api/seed

# View dashboard
open http://localhost:8787
```

---

## Deploy

```bash
# Create D1 database
npx wrangler d1 create signaldesk-db
# → paste database_id into wrangler.toml

# Apply schema
npx wrangler d1 execute signaldesk-db --file ./schema.sql

# Create KV namespace (requires both production and preview IDs)
npx wrangler kv namespace create signaldesk-cache
npx wrangler kv namespace create signaldesk-cache --preview
# → paste id and preview_id into wrangler.toml

# Create R2 bucket
npx wrangler r2 bucket create signaldesk-raw

# Deploy
npx wrangler deploy

# Seed remote database
curl -X POST https://signaldesk.<account>.workers.dev/api/seed

# Optional: configure Slack alerts
npx wrangler secret put SLACK_WEBHOOK_URL
```

---

## File Structure

```
signaldesk/
├── wrangler.toml               # Bindings: D1, AI, KV, R2, Workflows
├── schema.sql                  # D1 two-table schema + indexes
├── README.md
└── src/
    ├── index.ts                # Hono app, route mounting, Workflow named export
    ├── types.ts                # Env interface, AnalysisResult, FeedbackWithAnalysis, TimelineEntry
    ├── db/
    │   ├── queries.ts          # D1 typed query helpers (seed, stats, feedback, themes, competitors, timeline)
    │   └── seed.ts             # 60 mock records (pre-analyzed, all fields populated)
    ├── ai/
    │   ├── prompt.ts           # System prompt + per-source user prompt builder
    │   └── parser.ts           # JSON parse, field validation/coercion, PII safety enforcement
    ├── cache/
    │   └── kv.ts               # KV get/set/invalidate, CACHE_KEYS, CACHE_TTL constants
    ├── alerts/
    │   └── slack.ts            # Slack Block Kit alerting, PM routing table
    ├── workflows/
    │   └── ingest.ts           # FeedbackIngestWorkflow — 6 durable steps
    └── routes/
        ├── api.ts              # All /api/* endpoints + visibility redaction helpers
        └── dashboard.ts        # GET / → single-file HTML (inlined CSS + JS, no bundler)
```

---

## Friction Log

Seven developer experience gaps discovered while building this project.

---

### 1. KV Namespace Dual-ID Requirement

**Problem:** `wrangler kv namespace create` generates a production `id`. Local `wrangler dev` requires a separate `preview_id` from a second `--preview` flag invocation. If `preview_id` is missing, wrangler silently falls back to an ephemeral in-memory store that doesn't persist across restarts — no warning, no error. KV writes appear to succeed. Data disappears on restart. Took significant debugging to identify because the failure mode was invisible.

**Suggestion:** `wrangler dev` should emit a warning when a KV binding has `id` but no `preview_id`, and surface the exact command to fix it: `wrangler kv namespace create <name> --preview`. The silent in-memory fallback is an invisible footgun for first-time users.

---

### 2. Workers AI Model Discovery

**Problem:** There is no model browser in the Cloudflare dashboard. Using Workers AI requires knowing the exact model ID string (e.g. `@cf/meta/llama-3.1-8b-instruct`) from documentation. No autocomplete in wrangler.toml. Model capability metadata — context window, JSON mode support, token throughput, recommended use cases — is scattered across multiple documentation pages and blog posts. The correct model for structured JSON extraction was identified only after testing several candidates.

**Suggestion:** Add an in-dashboard model catalog with capability cards (input/output types, context length, benchmarks, example wrangler.toml binding). Surface it from the Workers AI binding configuration screen so developers can make informed model choices without leaving the dashboard.

---

### 3. Cloudflare Access Local Testing Gap

**Problem:** No way to test Access-protected routes with `wrangler dev`. Configuring an Access application requires a deployed Workers URL and Zero Trust dashboard setup. The local/production gap means auth flow cannot be validated until after deployment. No `--simulate-access` flag, no mock identity token support, no local policy evaluation.

**Suggestion:** Provide a `wrangler dev` option (flag or plugin) that simulates Access policy evaluation using mock identity headers. Even `--mock-access-email=test@cloudflare.com` injecting a fake JWT would allow developers to test role-based routing, redirect behavior, and identity-gated content before deploying. The current gap forces a deploy-to-test cycle for any auth-sensitive code path.

---

### 4. Workflows Local Dev Fidelity

**Problem:** `wrangler dev` simulates Workflows locally, but retry behavior, step isolation, sleep durations, and execution timeout limits don't match production. A step that completes locally can fail in production due to different size and time limits. The local simulation doesn't expose the Workflows execution log visible in the production dashboard — no step-by-step trace appears in the terminal. Debugging a failing Workflow step required repeated production deployments.

**Suggestion:** Add a `--workflows-verbose` mode to `wrangler dev` that prints step execution state to the terminal, matching what the dashboard shows in production. Document which Workflow behaviors differ between local and production (retry timing, step payload size limits, sleep precision). A local execution timeline would dramatically reduce the deploy-debug cycle.

---

### 5. D1 JSON Array Querying

**Problem:** Filtering records where a JSON array column contains a specific value (e.g., the `themes` column containing `"cold_start"`) requires `LIKE '%cold_start%'` in D1, rather than a proper array membership query. D1 documentation shows basic `json_extract()` examples but does not cover array filtering patterns. The `json_each()` function exists in SQLite but its behavior in D1's runtime is not documented. This produced fragile `LIKE`-based filters in the codebase that break on partial substring matches.

**Suggestion:** Add a dedicated D1 documentation section on JSON field querying patterns, including array membership with `json_each()`, indexing JSON fields, and NULL handling. Worked examples for the patterns developers actually encounter (array contains, nested object access, range filters on JSON numbers) would prevent the fallback to fragile LIKE queries.

---

### 6. Workers Dashboard Bindings Scatter

**Problem:** After connecting a Worker to D1, KV, R2, Workers AI, and Workflows, the bindings are listed in Settings > Bindings — but each resource lives in a completely different dashboard section. Navigating from "check D1 table contents" to "view KV namespace" to "inspect R2 bucket" requires four separate navigation journeys. There is no unified resource overview showing health, usage, and quick-links for all attached bindings in one place.

**Suggestion:** Create a unified "Worker Resources" page showing all bindings with inline status (storage used, request count, error rate) and single-click navigation to each resource's management page. This would eliminate the context switching that currently fragments the development workflow across multiple dashboard sections.

---

### 7. R2 Writes Inside Workflow Steps

**Problem:** Writing objects to R2 inside a Workflow step behaves differently in local development vs. production. In `wrangler dev`, `put()` inside a Workflow step appears to succeed (no exception, step completes), but the object is not actually persisted to local R2 storage. The same code works correctly in a regular Workers handler locally. The discrepancy was only discovered after deploying to production — making local testing of the R2 archive step impossible.

**Suggestion:** Either make R2 writes inside Workflow steps fully functional in `wrangler dev`, or throw an explicit warning when an R2 operation inside a Workflow step cannot be simulated. Surfacing this in the Workflow execution log (see Friction Log #4) would immediately indicate when a step's side effects aren't being persisted during local development.
