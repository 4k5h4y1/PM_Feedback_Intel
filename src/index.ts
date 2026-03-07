import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Env } from './types';
import { api } from './routes/api';
import { ui } from './routes/dashboard';

// ─── Hono app ─────────────────────────────────────────────────────────────────
const app = new Hono<{ Bindings: Env }>();

app.use('*', logger());
app.use('/api/*', cors());

// Mount routes
app.route('/api', api);
app.route('/', ui);

export default app;

// ─── Workflow export ──────────────────────────────────────────────────────────
// Wrangler requires named exports for Workflow class bindings.
// The class_name in wrangler.toml must match this export name exactly.
export { FeedbackIngestWorkflow } from './workflows/ingest';
