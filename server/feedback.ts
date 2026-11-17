import type { AppEnv } from './env';

export interface FeedbackEmailPayload {
  kind: 'feedback' | 'bug';
  message: string;
  replyTo?: string;
  context?: {
    biome?: string;
    timeOfDay?: string;
    viewport?: string;
  };
  requestId: string;
}

export interface FeedbackDispatchResult {
  ok: true;
  delivered: boolean;
}

/**
 * Dispatches user feedback or bug reports to the configured server-only recipient
 * via Resend's REST API. Never exposes recipient email or API keys to callers.
 */
export async function dispatchFeedbackEmail(
  payload: FeedbackEmailPayload,
  env: AppEnv
): Promise<FeedbackDispatchResult> {
  if (!env.FEEDBACK_TO_EMAIL || !env.RESEND_API_KEY) {
    if (env.NODE_ENV === 'production') {
      throw new Error('Feedback delivery is not configured.');
    }

    // In local dev/test without RESEND_API_KEY, record a redacted notice in server logs
    console.info(
      JSON.stringify({
        level: 'info',
        event: 'feedback_dev_preview',
        requestId: payload.requestId,
        kind: payload.kind,
        hasReplyTo: Boolean(payload.replyTo),
        messageLength: payload.message.length,
      })
    );
    return { ok: true, delivered: false };
  }

  const label = payload.kind === 'bug' ? 'Bug Report' : 'Feedback';
  const lines = [
    `Type: ${label}`,
    ...(payload.replyTo ? [`Reply-To: ${payload.replyTo}`] : []),
    ...(payload.context?.biome ? [`Biome: ${payload.context.biome}`] : []),
    ...(payload.context?.timeOfDay ? [`Time of Day: ${payload.context.timeOfDay}`] : []),
    ...(payload.context?.viewport ? [`Viewport: ${payload.context.viewport}`] : []),
    `Request ID: ${payload.requestId}`,
    '',
    payload.message,
  ];

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL || 'Paper Planes <onboarding@resend.dev>',
      to: [env.FEEDBACK_TO_EMAIL],
      subject: `[Paper Planes] ${label}`,
      text: lines.join('\n'),
      ...(payload.replyTo ? { reply_to: payload.replyTo } : {}),
    }),
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'feedback_email_failed',
        requestId: payload.requestId,
        status: response.status,
      })
    );
    throw new Error('Could not deliver feedback right now.');
  }

  return { ok: true, delivered: true };
}
