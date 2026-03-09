# PMI Dashboard — Voice of Customer

A secure, internal feedback intelligence platform for Product Managers built entirely on Cloudflare's developer stack. Ingests feedback from 8 channels, analyzes each record with Workers AI, and surfaces prioritized PM signal — all in a single Worker deployment.

**Live demo:** https://pmi-dashboard.ashar-0a8.workers.dev

---

## Features

- **Weighted Criticality Scoring** — 0–100 score per feedback record using source, segment, type, security, and competitor multipliers
- **Prioritization Buckets** — client-side auto-classification into Core Gaps · Quick Wins · Strategic Bets · Long-Term · Delighters
- **Segment Impact** — Enterprise / Mid-Market / Emerging breakdown with urgency, sentiment, and competitive pressure
- **Customer Sentiment Score** — composite 0–100 health metric replacing raw negative counts
- **Competitor Intelligence** — named competitor extraction with comparison context (switching_from / evaluating / mentioned)
- **Security & PII Controls** — server-side visibility scoping, PII auto-redaction, `security_team_only` content restriction
- **AI Weekly Digest** — PM-readable summary via Workers AI (Llama 3.1-8B), cached in KV at 1-hour TTL
- **Slack Alerting** — Block Kit alerts for urgency ≥ 8 records, routed to PM by product area

---

## Architecture

```
Feedback (8 sources) → POST /api/feedback
                              │
                              ▼
              Cloudflare Workflows (6 durable steps)
                Step 1: validate + idempotency check
                Step 2: Workers AI structured extraction
                Step 3: write to D1 (feedback + analysis)
                Step 4: archive raw payload to R2
                Step 5: invalidate KV cache
                Step 6: Slack alert (urgency ≥ 8)
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         D1 Database      R2 Bucket       KV Store
       (two-table schema) (raw payloads)  (cache 5min/1hr)
                              │
                              ▼
              Hono API + Dashboard HTML (single Worker)
```

### Cloudflare Products

| Product | Binding | Role |
|---|---|---|
| **Workers** | — | Hono API + dashboard HTML |
| **D1** | `DB` | Two-table schema: `feedback` + `analysis` |
| **Workers AI** | `AI` | Llama 3.1-8B structured JSON extraction |
| **Workflows** | `INGEST_WORKFLOW` | Durable 6-step ingest pipeline |
| **KV** | `CACHE` | Stats (5 min TTL) + AI digest (1 hr TTL) |
| **R2** | `RAW_PAYLOADS` | Raw payload archive for long-form sources |
| **Access** | — | Identity-aware auth (described below) |

---

## Setup from Scratch

### Prerequisites

- [Node.js](https://nodejs.org) ≥ 18
- Cloudflare account with Workers paid plan (required for Workflows)
- `wrangler` authenticated: `npx wrangler login`

### 1. Install dependencies

```bash
npm install
```

### 2. Create Cloudflare resources

```bash
# D1 database
npx wrangler d1 create signaldesk-db
# Copy the database_id into wrangler.toml → [[d1_databases]] → database_id

# KV namespace (requires both production + preview IDs)
npx wrangler kv namespace create signaldesk-cache
npx wrangler kv namespace create signaldesk-cache --preview
# Copy id → wrangler.toml [[kv_namespaces]] → id
# Copy preview id → wrangler.toml [[kv_namespaces]] → preview_id

# R2 bucket
npx wrangler r2 bucket create signaldesk-raw
```

### 3. Apply database schema

```bash
# Remote (production)
npx wrangler d1 execute signaldesk-db --remote --file=schema.sql

# Local dev
npx wrangler d1 execute signaldesk-db --local --file=schema.sql
```

### 4. Configure `wrangler.toml`

After creating resources, your `wrangler.toml` should have:

```toml
name = "pmi-dashboard"

[[d1_databases]]
binding = "DB"
database_name = "signaldesk-db"
database_id = "<your-database-id>"

[[kv_namespaces]]
binding = "CACHE"
id = "<your-kv-id>"
preview_id = "<your-kv-preview-id>"

[[r2_buckets]]
binding = "RAW_PAYLOADS"
bucket_name = "signaldesk-raw"

[[workflows]]
binding = "INGEST_WORKFLOW"
name = "feedback-ingest"
class_name = "FeedbackIngestWorkflow"
script_name = "pmi-dashboard"
```

### 5. Deploy

```bash
npx wrangler deploy
```

### 6. Seed demo data

```bash
curl -X POST https://pmi-dashboard.<account>.workers.dev/api/seed
```

This inserts 60 pre-analyzed mock records (idempotent — safe to run multiple times).

### 7. Optional: Slack alerts

```bash
npx wrangler secret put SLACK_WEBHOOK_URL
# Paste your Incoming Webhook URL when prompted
```

---

## Local Development

```bash
npm run dev
# → http://localhost:8787

# Seed local database
curl -X POST http://localhost:8787/api/seed
```

> **Note:** Workflows retry behavior, R2 writes inside steps, and Access policy evaluation differ between local dev and production. See Friction Log below for specifics.

---

## API Reference

```
GET  /                          Dashboard SPA
POST /api/seed                  Insert 60 mock records (idempotent)
POST /api/feedback              Submit feedback → triggers Workflow
GET  /api/stats                 Aggregate stats (KV cached, X-Cache-Hit header)
GET  /api/feedback              Paginated feed with filters:
                                  source, sentiment, product_category, urgency_min,
                                  competitor_only, security_only, pii_only, sort, limit, offset
GET  /api/feedback/:id          Single record (visibility-scoped)
GET  /api/feedback/:id/status   Workflow analysis status
GET  /api/themes                Theme clusters (volume, urgency, sentiment per theme)
GET  /api/competitors           Competitor mentions grouped by name + context
GET  /api/timeline              Daily volume with negative/urgency breakdown (30 days)
GET  /api/segments              Per-segment stats: Enterprise, Mid-Market, Emerging
GET  /api/digest                AI PM digest (KV cached 1 hr)
POST /api/digest/refresh        Force-regenerate digest
```

### Visibility scoping

`GET /api/feedback/:id` applies content rules server-side:

| `visibility_scope` | Behavior |
|---|---|
| `public` / `internal` | Full `raw_text` returned |
| `restricted` | Returns `redacted_summary` only |
| `security_team_only` | Returns a restricted notice string |

PII-flagged records always use `redacted_summary` regardless of scope.

---

## Dashboard Views

1. **Overview** — Priority Actions strip · 4-card exec summary · Trends · Segment Impact · What's Trending · PM Brief
2. **Prioritization** — 5 auto-buckets (Core Gaps / Quick Wins / Strategic Bets / Long-Term / Delighters) + trending themes
3. **Competitive Pressure** — Competitor cards with context, comparison type, and related product areas
4. **Security Issues** — Restricted records, PII breakdown, visibility scope model
5. **All Feedback** — Full paginated feed with filter/sort controls
6. **Weekly Digest** — AI-generated PM digest with Regenerate button

---

## Scoring Models

### Weighted Criticality Score (0–100, client-side)

```
base            = urgency × 10
source_weight   = sales:1.5 · email:1.4 · support:1.3 · zoom:1.2 · nps:1.1 · github:1.0 · discord:0.8 · twitter:0.7
segment_weight  = enterprise:1.3 · smb:1.0 · startup:0.9
type_weight     = churn_risk:1.4 · bug:1.2 · complaint:1.1 · feature_request:1.0 · praise:0.7
security_bonus  = security_sensitive ? +20 : 0
competitor_bonus = switching_from ? +15 : competitor_mentioned ? +5 : 0

score = clamp(0, 100, round(base × source_weight × segment_weight × type_weight + security_bonus + competitor_bonus))
```

Badge thresholds: red ≥ 75, amber 45–74, gray < 45.

### Customer Sentiment Score (0–100, client-side)

```
score = clamp(0, 100, round(((positive − negative×1.2 + neutral×0.4) / total) × 50 + 50))
```

Green ≥ 70 (healthy), amber 40–69 (at risk), red < 40 (critical).

---

## File Structure

```
pmi-dashboard/
├── wrangler.toml               # Bindings: D1, AI, KV, R2, Workflows
├── schema.sql                  # Two-table D1 schema
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                # Hono app entry, route mounting, Workflow export
    ├── types.ts                # Env, AnalysisResult, FeedbackWithAnalysis, SegmentStat
    ├── ai/
    │   ├── prompt.ts           # System prompt + per-source prompt builder
    │   └── parser.ts           # JSON parse, field validation, PII redaction
    ├── alerts/
    │   └── slack.ts            # Slack Block Kit alerts, PM routing table
    ├── cache/
    │   └── kv.ts               # KV get/set/invalidate, CACHE_KEYS, CACHE_TTL
    ├── db/
    │   ├── queries.ts          # Typed D1 query helpers
    │   └── seed.ts             # 60 pre-analyzed mock records
    ├── routes/
    │   ├── api.ts              # All /api/* endpoints
    │   └── dashboard.ts        # GET / → single-file HTML (inlined CSS/JS)
    └── workflows/
        └── ingest.ts           # FeedbackIngestWorkflow — 6 durable steps
```

---

## Friction Log

Seven developer experience gaps found while building this project.

**1. KV dual-ID requirement** — `wrangler dev` silently falls back to ephemeral in-memory KV when `preview_id` is missing. No warning. Data vanishes on restart. Fix: `wrangler kv namespace create <name> --preview`.

**2. Workers AI model discovery** — No in-dashboard model catalog. Model IDs, capability metadata, and JSON-mode support are scattered across docs. Suggest: model catalog with capability cards in the Workers AI binding UI.

**3. Access local testing gap** — No way to simulate Access policy evaluation with `wrangler dev`. Auth flow requires a deployed URL. Suggest: `--mock-access-email` flag to inject a fake identity header locally.

**4. Workflows local fidelity** — Retry behavior, step isolation, and sleep precision differ between local and production. No step-level trace in terminal. Suggest: `--workflows-verbose` mode mirroring the production dashboard execution log.

**5. D1 JSON array querying** — `json_each()` behavior in D1 is undocumented. Array-membership filtering falls back to fragile `LIKE '%value%'` patterns. Suggest: dedicated D1 docs section on JSON field querying with worked examples.

**6. Bindings dashboard scatter** — D1, KV, R2, AI, and Workflows each live in separate dashboard sections with no unified resource overview. Suggest: "Worker Resources" page showing all bindings, status, and quick-links in one place.

**7. R2 writes inside Workflow steps** — R2 `put()` inside a Workflow step appears to succeed locally but does not persist. Same code works in a regular Workers handler. No warning. Only discoverable in production.
