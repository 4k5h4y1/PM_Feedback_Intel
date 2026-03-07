import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import type { Env, WorkflowParams } from '../types';
import { analyzeWithAI } from '../ai/parser';
import { persistAnalysis, updateRawPayloadRef } from '../db/queries';
import { invalidate, CACHE_KEYS } from '../cache/kv';

const LONG_FORM_SOURCES = new Set(['zoom', 'sales', 'email', 'support']);

export class FeedbackIngestWorkflow extends WorkflowEntrypoint<Env, WorkflowParams> {
  async run(event: WorkflowEvent<WorkflowParams>, step: WorkflowStep) {
    const { feedbackId } = event.payload;

    // ── Step 1: Validate and fetch (idempotency guard) ────────────────────────
    const feedback = await step.do('validate-and-fetch', async () => {
      const row = await this.env.DB.prepare(
        'SELECT id, source_type, raw_text, source_metadata, analysis_status FROM feedback WHERE id = ?'
      ).bind(feedbackId).first<{
        id: string;
        source_type: string;
        raw_text: string;
        source_metadata: string | null;
        analysis_status: string;
      }>();

      if (!row) throw new Error(`Feedback ${feedbackId} not found`);
      if (row.analysis_status === 'analyzed') return null; // already done, skip
      return row;
    });

    if (!feedback) {
      return { skipped: true, reason: 'already-analyzed', feedbackId };
    }

    // ── Step 2: Workers AI structured analysis (retries up to 2x) ────────────
    const analysisResult = await step.do(
      'analyze-with-ai',
      { retries: { limit: 2, delay: '1 second', backoff: 'linear' } },
      async () => {
        return await analyzeWithAI(
          this.env.AI,
          feedback.source_type,
          feedback.raw_text,
          feedback.source_metadata,
        );
      }
    );

    // ── Step 3: Persist analysis to D1 ───────────────────────────────────────
    await step.do('persist-to-d1', async () => {
      await persistAnalysis(
        this.env.DB,
        feedbackId,
        analysisResult,
        event.instanceId ?? 'workflow',
      );
    });

    // ── Step 4: Store raw payload in R2 (long-form sources only) ─────────────
    if (LONG_FORM_SOURCES.has(feedback.source_type)) {
      await step.do('store-raw-payload', async () => {
        const key = `${feedbackId}.json`;
        const payload = JSON.stringify({
          id: feedbackId,
          source_type: feedback.source_type,
          raw_text: feedback.raw_text,
          source_metadata: feedback.source_metadata,
          pii_detected: analysisResult.pii_detected,
          security_sensitive: analysisResult.security_sensitive,
          stored_at: new Date().toISOString(),
        });

        await this.env.RAW_PAYLOADS.put(key, payload, {
          httpMetadata: { contentType: 'application/json' },
          customMetadata: {
            source_type: feedback.source_type,
            pii_detected: String(analysisResult.pii_detected),
            security_sensitive: String(analysisResult.security_sensitive),
            feedback_id: feedbackId,
          },
        });

        await updateRawPayloadRef(this.env.DB, feedbackId, key);
      });
    }

    // ── Step 5: Invalidate KV stats cache ─────────────────────────────────────
    await step.do('invalidate-cache', async () => {
      await invalidate(this.env.CACHE, CACHE_KEYS.stats);
    });

    // ── Step 6: Send urgent alert via Slack (if configured + urgency ≥ 8) ──────
    if (this.env.SLACK_WEBHOOK_URL && analysisResult.urgency >= 8) {
      await step.do('send-urgent-alert', async () => {
        const { sendUrgentAlert } = await import('../alerts/slack');
        await sendUrgentAlert(this.env.SLACK_WEBHOOK_URL!, {
          feedbackId,
          urgency: analysisResult.urgency,
          sentiment: analysisResult.sentiment,
          summary: analysisResult.redacted_summary || analysisResult.summary,
          product_category: analysisResult.product_category,
          source_type: feedback.source_type,
          owner_team: analysisResult.owner_team,
          feedback_type: analysisResult.feedback_type,
        });
      });
    }

    return {
      success: true,
      feedbackId,
      sentiment: analysisResult.sentiment,
      urgency: analysisResult.urgency,
      product_category: analysisResult.product_category,
      alerted: this.env.SLACK_WEBHOOK_URL ? analysisResult.urgency >= 8 : false,
    };
  }
}

// Helper: trigger a Workflow instance for a new feedback record
export async function triggerIngestWorkflow(
  workflow: Workflow,
  feedbackId: string,
): Promise<string> {
  const instance = await workflow.create({ params: { feedbackId } });
  return instance.id;
}
