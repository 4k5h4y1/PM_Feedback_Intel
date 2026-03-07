// ─── PM Routing by product category ──────────────────────────────────────────
// Maps product areas to the owning PM role. Used for alert routing.
const PM_ROUTING: Record<string, string> = {
  workers:            'Workers PM',
  workers_ai:         'Workers AI PM',
  d1:                 'Developer Platform PM',
  kv:                 'Developer Platform PM',
  r2:                 'Developer Platform PM',
  pages:              'Pages PM',
  cloudflare_one:     'Zero Trust PM',
  access:             'Zero Trust PM',
  warp:               'Zero Trust PM',
  zero_trust:         'Zero Trust PM',
  gateway:            'Zero Trust PM',
  tunnel:             'Zero Trust PM',
  security_waf:       'Security PM',
  ddos:               'Security PM',
  bot_management:     'Security PM',
  api_shield:         'Security PM',
  cdn:                'Network PM',
  cache:              'Network PM',
  analytics:          'Data PM',
  logs:               'Data PM',
  billing_pricing:    'Growth PM',
  cli_dx:             'Developer Experience PM',
  docs_onboarding:    'Developer Experience PM',
  developer_platform: 'Developer Platform PM',
};

export function resolveOwnerPM(category: string | null): string {
  if (!category) return 'Platform PM';
  return PM_ROUTING[category] ?? 'Platform PM';
}

// ─── Alert payload ────────────────────────────────────────────────────────────
export interface AlertPayload {
  feedbackId: string;
  urgency: number;
  sentiment: string;
  summary: string;
  product_category: string;
  source_type: string;
  owner_team: string | null;
  feedback_type: string;
}

// ─── Send Slack block-kit message ─────────────────────────────────────────────
export async function sendUrgentAlert(
  webhookUrl: string,
  payload: AlertPayload,
): Promise<void> {
  const pm = payload.owner_team ?? resolveOwnerPM(payload.product_category);
  const emoji = payload.urgency >= 9 ? '🚨' : '⚠️';
  const label = payload.urgency >= 9 ? 'CRITICAL' : 'HIGH URGENCY';

  const body = {
    text: `${emoji} ${label}: ${payload.product_category} feedback (urgency ${payload.urgency}/10) — ${payload.summary.slice(0, 120)}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} ${label} — Urgency ${payload.urgency}/10`,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Product Area:*\n${payload.product_category}` },
          { type: 'mrkdwn', text: `*Source:*\n${payload.source_type}` },
          { type: 'mrkdwn', text: `*Type:*\n${payload.feedback_type}` },
          { type: 'mrkdwn', text: `*Assigned PM:*\n${pm}` },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Summary:*\n${payload.summary}`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            style: 'danger',
            text: { type: 'plain_text', text: 'View in SignalDesk' },
            url: 'https://signaldesk.ashar-0a8.workers.dev/',
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Feedback ID: \`${payload.feedbackId}\` · Sentiment: ${payload.sentiment} · Routed to: ${pm}`,
          },
        ],
      },
    ],
  };

  const resp = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    throw new Error(`Slack alert failed: HTTP ${resp.status}`);
  }
}
