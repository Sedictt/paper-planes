import crypto from 'node:crypto';
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { getEnv, type AppEnv } from './env.js';
import { dispatchFeedbackEmail } from './feedback.js';
import { moderatePlaneText } from './moderation.js';
import { getPlanesRepository, type PlanesRepository } from './repository.js';
import {
  CountryCodeSchema,
  CreatePlaneSchema,
  FeedbackSchema,
  FlagPlaneSchema,
  ListPlanesQuerySchema,
  RandomPlaneQuerySchema,
  ReadPlaneSchema,
} from './schemas.js';

const MAX_BODY_BYTES = 8192;
const LAUNCH_RATE_LIMIT = { max: 8, windowMs: 10 * 60 * 1000 };
const FLAG_RATE_LIMIT = { max: 30, windowMs: 10 * 60 * 1000 };
const READ_RATE_LIMIT = { max: 60, windowMs: 60 * 1000 };
const LIST_RATE_LIMIT = { max: 120, windowMs: 60 * 1000 };
const FEEDBACK_RATE_LIMIT = { max: 5, windowMs: 10 * 60 * 1000 };

function hashClientIp(c: Context, salt: string, nodeEnv: AppEnv['NODE_ENV']): string {
  const vercelIp = c.req.header('x-vercel-forwarded-for')?.split(',')[0]?.trim();
  const realIp = c.req.header('x-real-ip')?.trim();
  const forwarded =
    nodeEnv !== 'production' ? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() : undefined;
  const rawIp = vercelIp || realIp || forwarded || 'local';
  return crypto.createHmac('sha256', salt).update(rawIp).digest('hex').slice(0, 32);
}

function detectCountryFromRequest(c: Context): string | null {
  const raw = c.req.header('x-vercel-ip-country') || c.req.header('cf-ipcountry');
  if (!raw) return null;
  const parsed = CountryCodeSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

async function readJsonBody(c: Context): Promise<{ ok: true; data: unknown } | { ok: false; status: 400 | 413; error: string }> {
  const contentLength = Number(c.req.header('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return { ok: false, status: 413, error: 'Request payload is too large.' };
  }

  let rawText: string;
  try {
    rawText = await c.req.text();
  } catch {
    return { ok: false, status: 400, error: 'Malformed request payload.' };
  }

  if (Buffer.byteLength(rawText, 'utf8') > MAX_BODY_BYTES) {
    return { ok: false, status: 413, error: 'Request payload is too large.' };
  }

  try {
    return { ok: true, data: JSON.parse(rawText || '{}') };
  } catch {
    return { ok: false, status: 400, error: 'Malformed request payload.' };
  }
}

export interface CreateAppDeps {
  repo?: PlanesRepository;
  env?: AppEnv;
}

export function createApp(deps: CreateAppDeps = {}): Hono {
  const env = deps.env ?? getEnv();
  const repo = deps.repo ?? getPlanesRepository(env.DATABASE_URL);

  const app = new Hono().basePath('/api');

  // Security headers & request correlation ID
  app.use('*', async (c, next) => {
    const rawRequestId = c.req.header('x-request-id')?.trim();
    const requestId =
      rawRequestId && /^[a-zA-Z0-9_-]{1,64}$/.test(rawRequestId)
        ? rawRequestId
        : crypto.randomUUID();
    c.set('requestId' as never, requestId as never);

    await next();

    c.header('X-Request-Id', requestId);
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (env.NODE_ENV === 'production') {
      c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
  });

  // Explicit CORS allowlist when configured (never wildcard with credentials)
  const originAllowlist = env.ALLOWED_ORIGINS
    ? env.ALLOWED_ORIGINS.split(',')
        .map((o) => o.trim())
        .filter(Boolean)
    : null;

  if (originAllowlist) {
    app.use(
      '*',
      cors({
        origin: (origin) => (originAllowlist.includes(origin) ? origin : ''),
        allowMethods: ['GET', 'POST', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Idempotency-Key'],
      })
    );
  }

  // Reject cross-site state-changing requests (Sec-Fetch-Site / Origin check)
  app.use('*', async (c, next) => {
    if (c.req.method === 'POST') {
      const fetchSite = c.req.header('sec-fetch-site')?.toLowerCase();
      if (fetchSite === 'cross-site') {
        return c.json({ error: 'Cross-site requests are not allowed.' }, 403);
      }
      if (originAllowlist) {
        const origin = c.req.header('origin');
        if (origin && !originAllowlist.includes(origin)) {
          return c.json({ error: 'Origin not allowed.' }, 403);
        }
      }
    }
    return next();
  });

  app.onError((err, c) => {
    const requestId = (c.get('requestId' as never) as string | undefined) ?? 'unknown';
    console.error(
      JSON.stringify({
        level: 'error',
        requestId,
        path: c.req.path,
        message: err instanceof Error ? err.message : 'Unknown error',
      })
    );
    return c.json({ error: 'Internal server error.', requestId }, 500);
  });

  app.get('/health', async (c) => {
    try {
      await repo.ping();
      return c.json({ ok: true, storage: repo.storageType });
    } catch {
      return c.json({ ok: false, storage: repo.storageType }, 503);
    }
  });

  app.get('/region', async (c) => {
    const ipHash = hashClientIp(c, env.IP_HASH_SALT, env.NODE_ENV);
    const rate = await repo.checkAndIncrementRateLimit(
      `region:${ipHash}`,
      LIST_RATE_LIMIT.max,
      LIST_RATE_LIMIT.windowMs
    );
    if (!rate.allowed) {
      c.header('Retry-After', String(rate.retryAfterSec));
      return c.json({ error: 'Too many requests. Please wait a moment.' }, 429);
    }
    await repo.recordVisitor(ipHash).catch(() => {});
    c.header('Cache-Control', 'no-store');
    return c.json({ country: detectCountryFromRequest(c) });
  });

  app.get('/stats', async (c) => {
    const ipHash = hashClientIp(c, env.IP_HASH_SALT, env.NODE_ENV);
    const rate = await repo.checkAndIncrementRateLimit(
      `stats:${ipHash}`,
      LIST_RATE_LIMIT.max,
      LIST_RATE_LIMIT.windowMs
    );
    if (!rate.allowed) {
      c.header('Retry-After', String(rate.retryAfterSec));
      return c.json({ error: 'Too many requests. Please wait a moment.' }, 429);
    }
    const fresh = c.req.query('fresh') === '1';
    const stats = await repo.getSkyStats();
    c.header(
      'Cache-Control',
      fresh ? 'no-store' : 'public, s-maxage=30, stale-while-revalidate=60'
    );
    return c.json(stats);
  });

  app.get('/planes', async (c) => {
    const ipHash = hashClientIp(c, env.IP_HASH_SALT, env.NODE_ENV);
    const rate = await repo.checkAndIncrementRateLimit(
      `list:${ipHash}`,
      LIST_RATE_LIMIT.max,
      LIST_RATE_LIMIT.windowMs
    );
    if (!rate.allowed) {
      c.header('Retry-After', String(rate.retryAfterSec));
      return c.json({ error: 'Too many requests. Please wait a moment.' }, 429);
    }
    const parsedQuery = ListPlanesQuerySchema.safeParse({
      limit: c.req.query('limit'),
      cursor: c.req.query('cursor'),
      biome: c.req.query('biome'),
      timeOfDay: c.req.query('timeOfDay'),
      country: c.req.query('country'),
    });

    if (!parsedQuery.success) {
      return c.json(
        { error: parsedQuery.error.issues[0]?.message || 'Invalid query parameters.' },
        400
      );
    }

    const fresh = c.req.query('fresh') === '1';
    const { planes, totalCount, nextCursor, fallbackUsed } = await repo.listVisiblePlanes(parsedQuery.data);
    c.header(
      'Cache-Control',
      fresh ? 'no-store' : 'public, s-maxage=15, stale-while-revalidate=45'
    );
    return c.json({ planes, total: planes.length, totalCount, nextCursor, fallbackUsed });
  });

  app.get('/planes/random', async (c) => {
    const ipHash = hashClientIp(c, env.IP_HASH_SALT, env.NODE_ENV);
    const rate = await repo.checkAndIncrementRateLimit(
      `random:${ipHash}`,
      READ_RATE_LIMIT.max,
      READ_RATE_LIMIT.windowMs
    );
    if (!rate.allowed) {
      c.header('Retry-After', String(rate.retryAfterSec));
      return c.json({ error: 'Too many requests. Please wait a moment.' }, 429);
    }

    const parsedQuery = RandomPlaneQuerySchema.safeParse({
      exclude: c.req.query('exclude'),
      country: c.req.query('country'),
    });
    if (!parsedQuery.success) {
      return c.json({ error: 'Invalid query parameters.' }, 400);
    }

    const excludeIds = parsedQuery.data.exclude
      ? parsedQuery.data.exclude
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 20)
      : [];

    const { plane, fallbackUsed } = await repo.getRandomVisiblePlane(excludeIds, parsedQuery.data.country);
    c.header('Cache-Control', 'no-store');
    if (!plane) {
      return c.json({ error: 'The sky is quiet right now.' }, 404);
    }
    return c.json({ plane, fallbackUsed });
  });

  app.post('/planes', async (c) => {
    const ipHash = hashClientIp(c, env.IP_HASH_SALT, env.NODE_ENV);
    const rawIdempotency = c.req.header('idempotency-key')?.trim();
    const idempotencyKey =
      rawIdempotency && rawIdempotency.length >= 12 && rawIdempotency.length <= 128
        ? `${ipHash}:${rawIdempotency}`
        : undefined;

    const rate = await repo.checkAndIncrementRateLimit(
      `launch:${ipHash}`,
      LAUNCH_RATE_LIMIT.max,
      LAUNCH_RATE_LIMIT.windowMs
    );

    if (!rate.allowed) {
      c.header('Retry-After', String(rate.retryAfterSec));
      return c.json(
        {
          error:
            'Sky breeze cooldown: You have launched several planes recently. Take a breath and try again in a few minutes.',
        },
        429
      );
    }

    const bodyResult = await readJsonBody(c);
    if (!bodyResult.ok) {
      return c.json({ error: bodyResult.error }, bodyResult.status);
    }

    const validated = CreatePlaneSchema.safeParse(bodyResult.data);
    if (!validated.success) {
      return c.json(
        { error: validated.error.issues[0]?.message || 'Invalid paper plane note.' },
        400
      );
    }

    const { title, text, biome, timeOfDay, paperTint, stamp, countryCode } = validated.data;
    const moderation = moderatePlaneText(text, title);
    if (!moderation.allowed) {
      return c.json({ error: moderation.reason }, 400);
    }

    const resolvedCountry = countryCode ?? detectCountryFromRequest(c) ?? 'PH';

    const { plane, deduplicated } = await repo.createPlane(
      {
        title,
        text,
        biome,
        timeOfDay,
        paperTint,
        stamp,
        countryCode: resolvedCountry,
        shadowBlocked: moderation.shadowBlocked,
      },
      idempotencyKey
    );

    return c.json({ plane, ...(deduplicated ? { deduplicated: true } : {}) }, deduplicated ? 200 : 201);
  });

  app.post('/planes/read', async (c) => {
    const ipHash = hashClientIp(c, env.IP_HASH_SALT, env.NODE_ENV);
    const rate = await repo.checkAndIncrementRateLimit(
      `read:${ipHash}`,
      READ_RATE_LIMIT.max,
      READ_RATE_LIMIT.windowMs
    );
    if (!rate.allowed) {
      c.header('Retry-After', String(rate.retryAfterSec));
      return c.json({ ok: false, error: 'Too many read requests.' }, 429);
    }

    const bodyResult = await readJsonBody(c);
    if (!bodyResult.ok) {
      return c.json({ error: bodyResult.error }, bodyResult.status);
    }

    const validated = ReadPlaneSchema.safeParse(bodyResult.data);
    if (!validated.success) {
      return c.json({ error: 'Invalid request' }, 400);
    }

    const result = await repo.incrementRead(validated.data.id);
    return c.json(result);
  });

  app.post('/planes/flag', async (c) => {
    const ipHash = hashClientIp(c, env.IP_HASH_SALT, env.NODE_ENV);
    const rate = await repo.checkAndIncrementRateLimit(
      `flag:${ipHash}`,
      FLAG_RATE_LIMIT.max,
      FLAG_RATE_LIMIT.windowMs
    );
    if (!rate.allowed) {
      c.header('Retry-After', String(rate.retryAfterSec));
      return c.json({ error: 'Too many flag requests. Please wait a moment.' }, 429);
    }

    const bodyResult = await readJsonBody(c);
    if (!bodyResult.ok) {
      return c.json({ error: bodyResult.error }, bodyResult.status);
    }

    const validated = FlagPlaneSchema.safeParse(bodyResult.data);
    if (!validated.success) {
      return c.json({ error: 'Invalid request' }, 400);
    }

    const result = await repo.flagPlane(validated.data.id, ipHash, validated.data.undo);
    return c.json(result);
  });

  app.post('/feedback', async (c) => {
    const ipHash = hashClientIp(c, env.IP_HASH_SALT, env.NODE_ENV);
    const rate = await repo.checkAndIncrementRateLimit(
      `feedback:${ipHash}`,
      FEEDBACK_RATE_LIMIT.max,
      FEEDBACK_RATE_LIMIT.windowMs
    );
    if (!rate.allowed) {
      c.header('Retry-After', String(rate.retryAfterSec));
      return c.json(
        { error: 'You have sent several messages recently. Please wait a few minutes.' },
        429
      );
    }

    const bodyResult = await readJsonBody(c);
    if (!bodyResult.ok) {
      return c.json({ error: bodyResult.error }, bodyResult.status);
    }

    const validated = FeedbackSchema.safeParse(bodyResult.data);
    if (!validated.success) {
      return c.json(
        { error: validated.error.issues[0]?.message || 'Invalid feedback submission.' },
        400
      );
    }

    const requestId = (c.get('requestId' as never) as string | undefined) ?? 'unknown';
    try {
      const result = await dispatchFeedbackEmail(
        {
          kind: validated.data.kind,
          message: validated.data.message,
          replyTo: validated.data.replyTo,
          context: validated.data.context,
          requestId,
        },
        env
      );
      return c.json(result, 201);
    } catch {
      return c.json({ error: 'Could not send your message right now. Please try again later.' }, 503);
    }
  });

  return app;
}

export const app = createApp();
