# SignalDesk — Study Guide

This guide is written for someone building their first cloud application. It explains every concept, technology, and design decision in SignalDesk from first principles. No prior coding or cloud experience assumed.

---

## Part 1: What Is SignalDesk and Why Does It Exist?

### The Problem It Solves

Product Managers (PMs) at a software company receive feedback from many different places at once:
- GitHub: Developers filing bug reports
- Discord: Community members asking questions
- Support tickets: Customers with problems
- Email: Enterprise clients escalating issues
- Twitter/X: Public complaints or praise
- NPS surveys: Scored customer satisfaction responses
- Zoom call transcripts: Notes from customer calls
- Sales call notes: Prospects comparing you to competitors

Without a tool, a PM would have to check all 8 sources manually, read everything, and try to mentally track what's urgent. This is slow, error-prone, and means important signals get missed.

**SignalDesk automates this.** It collects all feedback in one place, uses AI to analyze each piece (is it urgent? is it a bug? is a competitor mentioned?), and presents a structured dashboard so a PM can walk in Monday morning and immediately know what needs attention.

### The Core PM Workflow

```
Feedback arrives → AI analyzes it → PM reviews dashboard → PM acts
```

Each step is handled by a different Cloudflare product. Understanding *which product does which step* is the key to understanding the architecture.

---

## Part 2: The Cloudflare Platform — Every Product Explained

### What Is Cloudflare?

Cloudflare is a company that operates one of the world's largest networks of servers — over 300 locations globally. They started as a security/CDN company (protecting websites from attacks, making them load faster) and have since built a full developer platform on top of that network.

The key advantage: every Cloudflare developer product runs *at the edge* — meaning your code runs in data centers close to your users, not in one central location. This makes responses faster and more reliable.

---

### Product 1: Cloudflare Workers — The Runtime

**What is it?**
Workers is the foundation. It's the environment where your application code actually runs. Think of it like a very fast, stripped-down version of a server.

**The analogy:** If your app were a restaurant, Workers is the kitchen — it's where all the actual work happens. Every request that comes in (someone loading the dashboard, submitting feedback) is processed in the Workers kitchen.

**How it's used in SignalDesk:**
- Serves the dashboard HTML to the browser
- Handles all API requests (`/api/stats`, `/api/feedback`, etc.)
- Runs the Hono web framework that routes requests to the right handlers
- Single file deployment — the entire app deploys as one Worker

**Key concepts:**
- **No servers to manage.** You write code; Cloudflare runs it. You never SSH into a machine.
- **Scales automatically.** If 1 person or 10,000 people use SignalDesk, Cloudflare handles it.
- **Cold starts are near-zero.** Unlike traditional serverless (AWS Lambda), Workers starts in <1ms because it uses a different isolation model (V8 isolates, not containers).
- **CPU time limit: 50ms** on the free plan, 30 seconds on paid. This is why long AI tasks run in Workflows (see below) instead of directly in the Worker.

**The code:** [src/index.ts](src/index.ts) — entry point, [src/routes/api.ts](src/routes/api.ts) — API handlers, [src/routes/dashboard.ts](src/routes/dashboard.ts) — the HTML dashboard

---

### Product 2: Cloudflare D1 — The Database

**What is it?**
D1 is Cloudflare's SQL database. SQL (Structured Query Language) is how you store and retrieve structured data — rows and columns, like a very powerful spreadsheet that can handle millions of records and complex queries.

**The analogy:** D1 is the filing cabinet. Every piece of feedback and its analysis gets stored here permanently.

**How it's used in SignalDesk:**
Two tables:
1. `feedback` — the raw record: the actual text, where it came from, when it arrived
2. `analysis` — what AI concluded: sentiment, urgency, themes, competitor mentioned, etc.

They're in separate tables so you can re-run AI analysis on old feedback without losing the original data. Think of it like keeping the original document and the notes about it in separate folders.

**Why SQL?** Because you need to ask complex questions like:
- "Show me all feedback from enterprise customers with urgency ≥ 8, sorted by newest"
- "Count how many records mention each competitor"
- "What's the average urgency per customer segment?"

SQL makes these queries simple and fast.

**Key concepts:**
- **SQLite-compatible:** D1 uses SQLite syntax, which is the most widely-used database format in the world (it's in every iPhone and Android phone)
- **Serverless:** Like Workers, no server to manage — you just run queries
- **Binding:** The Worker accesses D1 via `env.DB` — a "binding" is how Workers connect to other Cloudflare services

**The code:** [src/db/queries.ts](src/db/queries.ts) — all database queries, [src/db/schema.sql](src/db/schema.sql) — table definitions

---

### Product 3: Workers AI — The Intelligence Layer

**What is it?**
Workers AI lets you run AI/ML models directly on Cloudflare's network. You send text in, you get structured analysis out. No external API keys, no OpenAI account needed — the models run on Cloudflare's own GPU infrastructure.

**The analogy:** Workers AI is the analyst. You hand them a piece of feedback and they come back with a completed report: "This is a bug report, urgency 8/10, about the Workers product, negative sentiment, mentions Vercel as an alternative."

**The model used:** `@cf/meta/llama-3.1-8b-instruct` — Meta's Llama 3.1 model with 8 billion parameters. "8B" means it has 8 billion numerical weights that define how it thinks. It's a capable model for classification and structured extraction tasks.

**How it's used in SignalDesk:**
Two uses:
1. **Structured extraction** (per feedback record): Given a piece of feedback text, extract 22 typed fields as JSON: sentiment, urgency, themes, competitor mention, PII detected, visibility scope, etc.
2. **Digest generation** (weekly PM summary): Given aggregated stats from all records, write a structured PM briefing document.

**The prompt engineering:** The AI is told to output only valid JSON, no markdown fences, with exactly the fields required. The parser then validates every field and applies safe defaults if the AI produces unexpected output.

**Key concepts:**
- **Structured extraction ≠ chatbot.** This is not conversational AI. The model sees one prompt, returns one response. No back-and-forth.
- **One-shot classification.** Each feedback record is analyzed once. The output is deterministic enough to be stored permanently.
- **JSON-mode prompting.** The prompt explicitly instructs the model to return only JSON with no prose. This is a prompting technique, not a model feature.
- **Confidence score.** The AI returns a 0-1 confidence value indicating how certain it is about its analysis.

**The code:** [src/ai/parser.ts](src/ai/parser.ts) — the AI prompt and response parser

---

### Product 4: Cloudflare Workflows — The Durable Pipeline

**What is it?**
Workflows lets you run a series of steps that are guaranteed to complete, even if something fails partway through. Each step can be retried automatically if it errors. The workflow state is saved between steps.

**The analogy:** Workflows is like a checklist that gets saved after each item is ticked off. If the power goes out halfway through, you pick up exactly where you left off instead of starting over.

**Why it's needed:**
When a new piece of feedback is submitted, several things need to happen in order:
1. Validate it exists and hasn't been processed already
2. Run AI analysis (takes ~2-5 seconds, could fail)
3. Save the analysis to D1
4. Archive the raw text to R2 (for long-form sources)
5. Invalidate the KV stats cache
6. Send a Slack alert if urgency ≥ 8

If step 3 fails (D1 is briefly unavailable), should step 2 run again? No — wasting money and time. Workflows saves the result of step 2 and only retries step 3.

**The 6-step ingest pipeline:**

```
Step 1: validate-and-fetch     Check feedback exists, not already processed
Step 2: analyze-with-ai        Run Workers AI (retries: 2 if fails)
Step 3: persist-to-d1          Write analysis to database
Step 4: store-raw-payload      Archive to R2 (zoom/sales/email only)
Step 5: invalidate-cache       Delete KV stats cache so next load is fresh
Step 6: send-urgent-alert      Slack webhook if urgency >= 8
```

**Key concepts:**
- **Durable execution:** Workflow state survives crashes, redeploys, even Cloudflare outages.
- **Step isolation:** Each step runs independently; failures don't cascade.
- **Idempotency:** Step 1 uses "INSERT OR IGNORE" so re-running the workflow on the same record is safe.
- **Async processing:** The HTTP response (201 Created) returns immediately after step 1. The user doesn't wait for AI analysis. The dashboard polls `/api/feedback/:id/status` every 2 seconds to check when analysis completes.

**The code:** [src/workflows/ingest.ts](src/workflows/ingest.ts)

---

### Product 5: Cloudflare KV — The Cache

**What is it?**
KV (Key-Value store) is an extremely fast storage system. Unlike D1 (SQL, structured), KV stores simple key → value pairs. You put something in by key, you get it back by key. That's it.

**The analogy:** KV is a sticky note on the fridge. Instead of re-cooking dinner every time someone is hungry, you put a note saying "dinner is pizza, cooked at 7pm." Anyone who arrives within a few hours reads the note instead of asking you to cook again. After the note expires, the next person to ask triggers fresh cooking.

**How it's used in SignalDesk:**
Three cached items:

| Key | What's cached | TTL (expiry) |
|-----|--------------|--------------|
| `dashboard:stats:v1` | The stats dashboard data | 5 minutes |
| `dashboard:segments:v1` | Segment breakdown table | 5 minutes |
| `dashboard:digest:weekly` | AI-generated PM digest | 1 hour |

**Why cache?**
- Stats require SQL aggregation across 60+ records (multiple SUM/COUNT operations). At scale (10,000+ records), this could take 100-500ms per request.
- With KV caching, most dashboard loads are a single KV read taking ~5ms.
- The AI digest costs real money and time to generate. Caching for 1 hour means 60 people can view the digest in an hour with only one AI call.

**Cache invalidation:**
When new feedback is analyzed (Workflow step 5), the stats cache is deleted from KV. The next stats request hits D1 fresh and repopulates the cache. This keeps the data accurate without constant DB queries.

**Key concepts:**
- **Eventually consistent:** KV is replicated globally, but changes take ~60 seconds to propagate everywhere. For a PM dashboard, this is fine.
- **TTL (Time-To-Live):** Every cached item has an expiry. After 5 minutes, the stats key is gone and the next request regenerates it.
- **X-Cache-Hit header:** The API returns `X-Cache-Hit: true` or `false` in the response, telling you if data came from cache or DB.

**The code:** [src/cache/kv.ts](src/cache/kv.ts)

---

### Product 6: Cloudflare R2 — The Object Store

**What is it?**
R2 is Cloudflare's file storage service — like AWS S3 or Google Cloud Storage. It stores arbitrary files (objects) by name. No SQL, no structure — just store a file, retrieve a file.

**The analogy:** R2 is the archive room. When you have a 50-page document (a long Zoom transcript or detailed email), you don't put the full text in the filing cabinet (D1) — you put a reference number in the filing cabinet and store the actual document in the archive room.

**How it's used in SignalDesk:**
For long-form feedback sources (zoom transcripts, sales call notes, detailed emails), the full raw payload is stored in R2 with a unique key. The D1 `feedback.raw_payload_ref` column stores that key. This keeps the D1 database lean while preserving the full original content.

**Why not just store everything in D1?**
- D1 rows have size limits
- Large text blobs make SQL queries slower
- R2 storage is cheaper than D1 storage for large files
- R2 can serve files directly via URL if needed

**Key concepts:**
- **Object storage vs. block storage:** R2 stores files (objects) by name. It doesn't know anything about the content — it's just bytes.
- **Egress-free:** Unlike AWS S3, R2 charges zero egress fees. Reading data out of R2 is free, regardless of how much data you transfer.

---

### Product 7: Cloudflare Access — The Gatekeeper

**What is it?**
Cloudflare Access is a Zero Trust security layer that sits in front of your application. Before any request reaches your Worker, Access checks: is this person allowed in?

**The analogy:** Access is the security guard at the building entrance. Even if you know the building address, you can't get in without showing your badge.

**How it protects SignalDesk:**
- Only `@cloudflare.com` email addresses can access the dashboard
- The security team additionally requires a WARP device posture check to see security-sensitive records
- All authentication happens at Cloudflare's edge — the Worker never sees unauthenticated requests

**Key concepts (Zero Trust):**
Traditional security assumed: "if you're inside the building (corporate network), you're trusted." Zero Trust inverts this: "trust nobody by default, verify every request regardless of where it comes from."

This means even if a bad actor gets onto the corporate WiFi, they still can't access SignalDesk without proper identity verification.

---

## Part 3: How Everything Fits Together — The Full Flow

### Flow 1: Loading the Dashboard

```
Browser → Cloudflare Edge → Workers (serves HTML)
                                    ↓
Browser renders HTML + JS
                                    ↓
JS calls /api/stats → Workers
                            ↓
                    KV cache hit? → Return cached JSON
                    KV cache miss? → Query D1 → Cache result → Return JSON
                                    ↓
Dashboard renders charts, cards, tables
```

### Flow 2: Submitting New Feedback

```
PM submits feedback form
        ↓
POST /api/feedback → Workers
        ↓
INSERT into D1 (status: 'pending')
        ↓
Trigger Workflow → Returns 201 immediately
        ↓
(Background, async):
  Step 1: Verify record exists
  Step 2: Workers AI analyzes text → returns 22 fields
  Step 3: INSERT analysis into D1, UPDATE status to 'analyzed'
  Step 4: PUT raw text to R2 (if long-form)
  Step 5: DELETE KV cache (stats will regenerate)
  Step 6: POST to Slack (if urgency >= 8)
        ↓
Browser polling /api/feedback/:id/status every 2s
        ↓
Status = 'analyzed' → Display results
```

### Flow 3: Viewing the Priority Actions Section

```
Overview loads → JS calls /api/feedback?urgency_min=8&limit=20
                                    ↓
                    Returns top 20 high-urgency records
                                    ↓
JS runs criticalityScore() on each record:
  score = urgency×10 × source_weight × segment_weight × type_weight
        + security_bonus + competitor_bonus
                                    ↓
Sort by score descending
                                    ↓
Show top 3 with color-coded criticality badge
```

---

## Part 4: Key Technical Concepts Explained Simply

### What is an API?

API stands for Application Programming Interface. It's a defined way for two pieces of software to communicate.

In SignalDesk: the browser (front-end) and the database (back-end) never talk directly. The Worker sits in the middle exposing API endpoints — URLs that accept requests and return structured data (JSON).

- `GET /api/stats` → browser asks for stats → Worker queries D1 → returns numbers as JSON → browser displays them
- `POST /api/feedback` → browser sends new text → Worker saves it → returns confirmation

**JSON** (JavaScript Object Notation) is the format data travels in. It looks like:
```json
{
  "total": 60,
  "high_urgency_count": 14,
  "by_sentiment": { "positive": 15, "negative": 36, "neutral": 9 }
}
```

### What is a Framework?

Writing raw HTTP handling code is tedious and repetitive. A framework does the boilerplate for you.

**Hono** is the framework SignalDesk uses. Instead of manually parsing URLs, it lets you write:
```typescript
api.get('/stats', async (c) => {
  // handle GET /api/stats here
});
```

Hono handles everything else: parsing the URL, routing to the right function, setting headers, etc.

### What is TypeScript?

TypeScript is JavaScript with types added. JavaScript is flexible but lets you make certain mistakes (passing a number where text is expected). TypeScript catches these mistakes before the code runs.

Example: If `urgency` must be a number 1-10, TypeScript will warn you at development time if you accidentally pass a text string like `"high"` instead.

All SignalDesk code is TypeScript, which is why you see type definitions like `interface FeedbackRow { id: string; urgency: number; ... }`.

### What is Caching?

Computing results is expensive (slow, costly). Caching means: compute it once, store the result, serve the stored result to everyone until it expires.

**Why 5 minutes for stats?** A PM checking the dashboard 10 times in 5 minutes gets the same data each time instead of 10 database queries. When new feedback arrives, the cache is invalidated so the next load is fresh.

### What is a Schema?

A database schema is the blueprint — it defines what tables exist and what columns each table has. Before you can store data, you define the structure.

SignalDesk's schema is in [src/db/schema.sql](src/db/schema.sql). It defines:
- `feedback` table with ~15 columns
- `analysis` table with ~25 columns
- Indexes (which make queries fast by creating sorted lookup structures)

### What is an Index?

Without an index, finding all records with `urgency >= 8` requires scanning every single row. With an index on `urgency`, the database can jump directly to the relevant rows. Like a book's index vs. reading every page to find a topic.

SignalDesk has indexes on the most-queried fields: sentiment, urgency, product_category, competitor_mentioned.

---

## Part 5: The Scoring Models

### Weighted Criticality Score (0–100)

This is the key innovation of the PM-facing dashboard. Instead of showing raw urgency (1-10), it combines multiple signals:

```
score = urgency×10 × source_weight × segment_weight × type_weight
      + security_bonus + competitor_bonus
```

**Why each multiplier:**

- **source_weight:** A Sales call note (1.5×) represents a potential deal at risk — higher stakes than a Twitter comment (0.7×). Support tickets (1.3×) are paying customers with problems.

- **segment_weight:** Enterprise feedback (1.3×) affects high-value accounts with SLAs and contracts. A startup complaint (0.9×) is real signal but lower business impact.

- **type_weight:** A churn_risk signal (1.4×) means a customer is about to leave — maximum urgency for a PM. A praise response (0.7×) is positive news that rarely needs action.

- **security_bonus (+20):** Security issues can become incidents or breaches. Always elevated.

- **competitor_bonus (+15 or +5):** If someone is actively switching away from Cloudflare (switching_from), that's an emergency. If a competitor is just mentioned, it's signal worth tracking.

### Customer Sentiment Score (0–100)

```
score = clamp(0, 100, ((positive - negative×1.2 + neutral×0.4) / total) × 50 + 50)
```

**Why weighted this way:**
- Negative feedback counts 1.2× (slightly more damaging than positive is beneficial)
- Neutral is 0.4× (slight positive signal — at least not a complaint)
- The `×50+50` maps the range to 0-100 centered at 50
- 70-100 = green (healthy), 40-69 = amber (at risk), <40 = red (critical)

With the seed data (60% negative), the score is ~30 — red band, which is intentional for a demo that showcases PM pain points.

---

## Part 6: Security & Privacy Architecture

### PII (Personally Identifiable Information)

PII is any data that can identify a specific person: email addresses, phone numbers, IP addresses, API keys, full names.

**How SignalDesk handles PII:**
1. Workers AI detects PII in the feedback text during analysis
2. The `pii_detected` flag is set to true
3. A `redacted_summary` is generated with PII replaced: `user@company.com` → `[REDACTED_EMAIL]`
4. All API endpoints serve `redacted_summary` instead of `raw_text` for PII-flagged records
5. This happens at the server level — browsers never receive the raw PII text

### Visibility Scope

Four levels of access control on content:

| Scope | Who can see full content |
|-------|--------------------------|
| `public` | Everyone |
| `internal` | Cloudflare employees |
| `restricted` | Elevated access (summary only for others) |
| `security_team_only` | Security team + WARP device posture verified |

This is **content-level access control** — different from who can log into the app. Even authenticated users see redacted content if they don't have the right scope clearance.

---

## Part 7: Interview Questions & Answers

### Architecture & Design

**Q: Why use Cloudflare Workers instead of a traditional server (AWS EC2, etc.)?**

A: Traditional servers require you to provision capacity, manage scaling, and pay for idle time. Workers runs at the edge with automatic scaling to zero — you pay per request, not per hour. For an internal PM tool with variable traffic, this is more cost-efficient and operationally simpler. The trade-off is the CPU time limit (no long-running processes), which is why AI analysis runs in Workflows instead of the Worker directly.

**Q: Why separate the `feedback` and `analysis` tables?**

A: Two reasons. First, separation of concerns — the raw feedback is immutable (it's what the user said), while analysis can be improved over time as AI models improve. Second, re-analysis: if you upgrade the AI model or change the taxonomy, you can re-run analysis on all existing records by truncating and repopulating the `analysis` table without touching `feedback`.

**Q: Why use Workflows for AI analysis instead of running it inline in the POST /api/feedback handler?**

A: Workers have a CPU time limit — running AI inference (which takes 2-5 seconds) would exceed it on the free plan and create timeout risk. Workflows provides durable execution with automatic retries. If Workers AI is briefly unavailable, the Workflow retries the step automatically. The user gets an immediate 201 response and the analysis completes asynchronously.

**Q: Why cache stats in KV instead of computing them on every request?**

A: The stats query runs multiple aggregate functions (SUM, COUNT, AVG) across two joined tables. At 60 records this is fast, but at 10,000+ records it could take 200-500ms per request. KV serves cached results in ~5ms. The 5-minute TTL means PMs see data that's at most 5 minutes stale — acceptable for a dashboard refreshed periodically. Cache is proactively invalidated when new data arrives.

**Q: Why compute the criticality score on the client instead of storing it in the database?**

A: The score formula needs to be transparent and adjustable. Storing it in DB means running a migration every time the weights change. Computing client-side means you can update the formula by deploying new JS — no schema change, no data migration. It also keeps the DB schema stable and lets different views weight the same data differently if needed.

### Cloudflare Platform

**Q: What's the difference between KV and D1?**

A: KV is a simple key→value store optimized for read speed — you get data by exact key. D1 is a relational database (SQL) that lets you query, filter, join, and aggregate data in complex ways. KV is ideal for caching (fast reads of pre-computed results). D1 is ideal for the primary data store where you need to query by many dimensions.

**Q: What is the Workers AI structured extraction approach vs. using it as a chatbot?**

A: In chatbot mode, the AI has a conversation — multiple messages, maintains state, generates free-form text. In structured extraction mode, you send one carefully crafted prompt with the feedback text and receive one JSON response with exactly the fields you need. There's no state, no conversation, no back-and-forth. This is more reliable, cheaper, and faster for classification tasks. The prompt explicitly instructs the model: "No markdown. No code fences. Return only valid JSON."

**Q: How does Cloudflare Access differ from building authentication yourself?**

A: Building auth yourself means managing user accounts, passwords, sessions, tokens, reset flows — all potential security vulnerabilities. Cloudflare Access offloads all of this to Cloudflare's identity infrastructure. You configure a policy (allow `@company.com` emails) and Cloudflare handles SSO, session management, and token validation. Your Worker never sees unauthenticated requests — they're blocked at the edge before reaching your code.

### Security

**Q: Why is PII handled at the server level rather than the client?**

A: Client-side redaction can be bypassed by inspecting network responses. If the API returns raw PII and the browser hides it, a developer with browser DevTools can still see the data. Server-side redaction means the PII never leaves the server — the API response only contains the redacted version. The raw data lives in D1 but never reaches the browser for PII-flagged records.

**Q: What is Zero Trust and how does it apply here?**

A: Traditional network security assumes: "traffic from inside the corporate network is trusted." Zero Trust inverts this: "no traffic is trusted by default; every request must be verified." In practice for SignalDesk: even if someone is on the Cloudflare corporate network, they still need to authenticate via Access and potentially pass a WARP device posture check to see security-sensitive records. The security perimeter is the identity verification, not the network boundary.

### Product/PM Thinking

**Q: How would you scale SignalDesk to handle 100,000 feedback records?**

A: Several changes: (1) Add pagination to all D1 queries that currently return full result sets. (2) Move theme aggregation from JavaScript to SQL using proper GROUP BY — the current JS-based aggregation loads all records into memory. (3) Extend KV caching to cover more expensive queries (theme table, competitor table). (4) Add D1 composite indexes for common filter combinations. (5) Consider archiving old records to R2 and only keeping recent N months in D1 for fast queries.

**Q: Why show top 3 Priority Actions instead of more?**

A: Cognitive load. If a PM sees 10 urgent items every morning, "urgency" loses meaning. The criticality score formula already orders items by true business impact. Showing 3 forces the tool to surface only the most critical signals, making the PM more decisive rather than overwhelmed. "See all → Priority Issues" is always one click away.

---

## Part 8: Glossary

| Term | Plain English |
|------|---------------|
| **API endpoint** | A URL that your code exposes so other software can interact with it |
| **Async** | "Do this in the background, don't wait for it to finish" |
| **Binding** | How a Cloudflare Worker connects to another service (D1, KV, R2) |
| **Cache** | Stored results that are served quickly instead of recomputed each time |
| **CDN** | Content Delivery Network — servers distributed globally to serve content faster |
| **CPU time** | How much computing work a request is allowed to do before being stopped |
| **D1** | Cloudflare's SQL database |
| **Edge** | Cloudflare's network of servers close to users worldwide |
| **Endpoint** | A specific URL path handled by the API (e.g., `/api/stats`) |
| **Idempotent** | Safe to run multiple times — same result every time |
| **Index (database)** | A pre-sorted lookup structure that makes queries fast |
| **JSON** | JavaScript Object Notation — the standard format for data exchange |
| **KV** | Key-Value store — simple fast storage by key name |
| **LLM** | Large Language Model — AI trained on text (like Llama 3.1) |
| **PII** | Personally Identifiable Information (emails, IPs, names) |
| **R2** | Cloudflare's file storage (like AWS S3) |
| **REST API** | A standard convention for building web APIs using HTTP methods |
| **Schema** | The blueprint/structure definition for a database |
| **SQL** | Structured Query Language — how you talk to relational databases |
| **SSO** | Single Sign-On — one login works across multiple services |
| **TTL** | Time-To-Live — how long cached data is kept before expiring |
| **TypeScript** | JavaScript with type checking added |
| **Workflow** | A durable series of steps that survive failures and retries |
| **Worker** | A piece of code running on Cloudflare's edge network |
| **Zero Trust** | Security model where nothing is trusted by default, everything is verified |

---

## Part 9: Files Reference

```
signaldesk/
├── src/
│   ├── index.ts              Entry point — sets up the app and routing
│   ├── types.ts              All TypeScript type definitions (what each field is)
│   ├── routes/
│   │   ├── api.ts            All API endpoints (/api/stats, /api/feedback, etc.)
│   │   └── dashboard.ts      The entire dashboard HTML/CSS/JS (one file)
│   ├── db/
│   │   ├── schema.sql        Database table definitions
│   │   ├── queries.ts        All database query functions
│   │   └── seed.ts           60 pre-analyzed mock records for the demo
│   ├── ai/
│   │   └── parser.ts         Workers AI prompt + response parser
│   ├── workflows/
│   │   └── ingest.ts         6-step Workflow for processing new feedback
│   ├── alerts/
│   │   └── slack.ts          Slack webhook alerting for urgent feedback
│   └── cache/
│       └── kv.ts             KV cache helper functions
├── wrangler.toml             Cloudflare configuration (bindings, routes)
├── package.json              Dependencies and build scripts
├── tsconfig.json             TypeScript compiler configuration
└── README.md                 Full technical documentation
```

---

*This guide covers SignalDesk v1 as deployed on Cloudflare Workers. All products referenced (Workers, D1, KV, R2, Workers AI, Workflows, Access) are Cloudflare's proprietary platform products as of 2025.*
