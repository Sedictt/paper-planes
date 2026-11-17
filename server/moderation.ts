import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity';

const profanityMatcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

const LINK_OR_SPAM_PATTERN =
  /(https?:\/\/|www\.|\.com\b|\.gg\b|\.io\b|@\w+\.\w+|discord\.gg|t\.me\/)/i;

const REPETITIVE_CHAR_PATTERN = /(.)\1{9,}/;

export interface ModerationResult {
  allowed: boolean;
  shadowBlocked: boolean;
  reason?: string;
}

/**
 * Checks a plane note against link spam, profanity, and repetitive character spam.
 */
export function moderatePlaneText(text: string, title?: string): ModerationResult {
  const combined = title ? `${title}\n${text}` : text;

  if (LINK_OR_SPAM_PATTERN.test(combined)) {
    return {
      allowed: false,
      shadowBlocked: false,
      reason:
        'Links, handles, and web addresses cannot be folded into paper planes. Keep it personal and anonymous.',
    };
  }

  if (profanityMatcher.hasMatch(combined)) {
    return {
      allowed: false,
      shadowBlocked: false,
      reason:
        "Let's keep this sky gentle and safe for everyone. Please rephrase your note without harsh language.",
    };
  }

  return {
    allowed: true,
    shadowBlocked: REPETITIVE_CHAR_PATTERN.test(combined),
  };
}

/**
 * Formats an ISO timestamp or Date into a human-friendly relative label
 * matching the existing frontend display expectations.
 */
export function formatRelativeTime(input: Date | string, nowMs = Date.now()): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  const diffSec = Math.max(0, Math.floor((nowMs - date.getTime()) / 1000));

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `${diffWeeks} ${diffWeeks === 1 ? 'week' : 'weeks'} ago`;
  return date.toISOString().slice(0, 10);
}
