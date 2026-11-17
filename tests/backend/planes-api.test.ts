import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Hono } from 'hono';
import { createApp } from '../../server/app';
import { getEnv, resetEnvCache } from '../../server/env';
import { MemoryPlanesRepository } from '../../server/repository';

describe('Paper Planes Backend API', () => {
  let app: Hono;

  beforeEach(() => {
    const repo = new MemoryPlanesRepository();
    app = createApp({
      repo,
      env: {
        NODE_ENV: 'test',
        IP_HASH_SALT: 'test-salt-123456',
      },
    });
  });

  it('GET /api/health returns ok and security headers', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, storage: 'memory' });
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('x-request-id')).toBeTruthy();
  });

  it('GET /api/planes returns seeded planes with edge cache header and cursor pagination', async () => {
    const res1 = await app.request('/api/planes?limit=5');
    expect(res1.status).toBe(200);
    expect(res1.headers.get('cache-control')).toBe('public, s-maxage=15, stale-while-revalidate=45');

    const body1 = (await res1.json()) as {
      planes: Array<{ id: string }>;
      total: number;
      nextCursor: string | null;
    };
    expect(body1.planes).toHaveLength(5);
    expect(body1.total).toBe(5);
    expect(body1.nextCursor).toBeTruthy();

    const res2 = await app.request(`/api/planes?limit=5&cursor=${encodeURIComponent(body1.nextCursor!)}`);
    expect(res2.status).toBe(200);
    const body2 = (await res2.json()) as { planes: Array<{ id: string }> };
    expect(body2.planes).toHaveLength(5);
    const ids1 = new Set(body1.planes.map((p) => p.id));
    for (const p of body2.planes) {
      expect(ids1.has(p.id)).toBe(false);
    }
  });

  it('POST /api/planes creates a plane and deduplicates via Idempotency-Key scoped per IP', async () => {
    const payload = {
      text: 'The lantern shrine looks warm from above the clouds tonight.',
      biome: '⛩️ Lantern Shrine',
      timeOfDay: 'dusk',
      paperTint: 'gold',
      stamp: 'LANTERN',
    };

    const res1 = await app.request('/api/planes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-key-123456',
        'x-real-ip': '203.0.113.10',
      },
      body: JSON.stringify(payload),
    });

    expect(res1.status).toBe(201);
    const created1 = (await res1.json()) as { plane: { id: string; text: string; reads: number } };
    expect(created1.plane.text).toBe(payload.text);
    expect(created1.plane.reads).toBe(1);

    // Retry with same Idempotency-Key and same IP -> deduplicated
    const res2 = await app.request('/api/planes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-key-123456',
        'x-real-ip': '203.0.113.10',
      },
      body: JSON.stringify(payload),
    });

    expect(res2.status).toBe(200);
    const created2 = (await res2.json()) as {
      plane: { id: string };
      deduplicated?: boolean;
    };
    expect(created2.deduplicated).toBe(true);
    expect(created2.plane.id).toBe(created1.plane.id);

    // Different IP using the same Idempotency-Key creates its own plane
    const res3 = await app.request('/api/planes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-key-123456',
        'x-real-ip': '203.0.113.11',
      },
      body: JSON.stringify(payload),
    });
    expect(res3.status).toBe(201);
  });

  it('POST /api/planes rejects invalid schema, links, and profanity', async () => {
    const tooShort = await app.request('/api/planes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'hi' }),
    });
    expect(tooShort.status).toBe(400);

    const unknownField = await app.request('/api/planes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Valid note text here', admin: true }),
    });
    expect(unknownField.status).toBe(400);

    const withLink = await app.request('/api/planes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Check out https://spam.example.com for deals' }),
    });
    expect(withLink.status).toBe(400);

    const withProfanity = await app.request('/api/planes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'What the fuck is this sky' }),
    });
    expect(withProfanity.status).toBe(400);
  });

  it('POST /api/planes shadow-blocks repetitive spam without revealing it in GET', async () => {
    const spamRes = await app.request('/api/planes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'aaaaaaaaaaaaaaaaaaaa' }),
    });
    expect(spamRes.status).toBe(201);
    const { plane } = (await spamRes.json()) as { plane: { id: string } };

    const listRes = await app.request('/api/planes?limit=50');
    const listBody = (await listRes.json()) as { planes: Array<{ id: string }> };
    expect(listBody.planes.some((p) => p.id === plane.id)).toBe(false);
  });

  it('POST /api/planes enforces rate limit after 8 launches per IP', async () => {
    for (let i = 0; i < 8; i++) {
      const res = await app.request('/api/planes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '198.51.100.42',
        },
        body: JSON.stringify({ text: `Quiet sky thought number ${i + 1}` }),
      });
      expect(res.status).toBe(201);
    }

    const blocked = await app.request('/api/planes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '198.51.100.42',
      },
      body: JSON.stringify({ text: 'Ninth note should hit rate limit' }),
    });
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('POST /api/planes/read increments reads and distanceKm', async () => {
    const res = await app.request('/api/planes/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'plane-101' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; reads: number };
    expect(body).toEqual({ ok: true, reads: 29 });
  });

  it('POST /api/planes/flag deduplicates per IP, hides at 3 distinct IPs, and only undoes own flag', async () => {
    // Same IP flagging 3 times only counts once
    for (let i = 0; i < 3; i++) {
      const flagRes = await app.request('/api/planes/flag', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-real-ip': '198.51.100.1',
        },
        body: JSON.stringify({ id: 'plane-101', undo: false }),
      });
      expect(flagRes.status).toBe(200);
    }

    const stillVisible = await app.request('/api/planes?limit=50');
    const stillBody = (await stillVisible.json()) as { planes: Array<{ id: string }> };
    expect(stillBody.planes.some((p) => p.id === 'plane-101')).toBe(true);

    // Two more distinct IPs push flags to 3 -> hidden
    for (const ip of ['198.51.100.2', '198.51.100.3']) {
      await app.request('/api/planes/flag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-real-ip': ip },
        body: JSON.stringify({ id: 'plane-101', undo: false }),
      });
    }

    const listHidden = await app.request('/api/planes?limit=50');
    const hiddenBody = (await listHidden.json()) as { planes: Array<{ id: string }> };
    expect(hiddenBody.planes.some((p) => p.id === 'plane-101')).toBe(false);

    // Unrelated IP cannot undo another user's flag
    await app.request('/api/planes/flag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-real-ip': '198.51.100.99' },
      body: JSON.stringify({ id: 'plane-101', undo: true }),
    });
    const stillHidden = await app.request('/api/planes?limit=50');
    const stillHiddenBody = (await stillHidden.json()) as { planes: Array<{ id: string }> };
    expect(stillHiddenBody.planes.some((p) => p.id === 'plane-101')).toBe(false);

    // One of the flagging IPs undoes its own flag -> restored
    const undoRes = await app.request('/api/planes/flag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-real-ip': '198.51.100.1' },
      body: JSON.stringify({ id: 'plane-101', undo: true }),
    });
    expect(undoRes.status).toBe(200);

    const listRestored = await app.request('/api/planes?limit=50');
    const restoredBody = (await listRestored.json()) as { planes: Array<{ id: string }> };
    expect(restoredBody.planes.some((p) => p.id === 'plane-101')).toBe(true);
  });

  it('GET /api/planes/random returns a random visible plane with no-store cache and respects exclude', async () => {
    const res = await app.request('/api/planes/random?exclude=plane-101,plane-104');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = (await res.json()) as { plane: { id: string } };
    expect(body.plane.id).toBeTruthy();
    expect(body.plane.id).not.toBe('plane-101');
    expect(body.plane.id).not.toBe('plane-104');
  });

  it('POST /api/planes/read enforces rate limit after 60 reads per minute', async () => {
    for (let i = 0; i < 60; i++) {
      const res = await app.request('/api/planes/read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '198.51.100.77',
        },
        body: JSON.stringify({ id: 'plane-101' }),
      });
      expect(res.status).toBe(200);
    }

    const blocked = await app.request('/api/planes/read', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '198.51.100.77',
      },
      body: JSON.stringify({ id: 'plane-101' }),
    });
    expect(blocked.status).toBe(429);
  });

  it('POST /api/feedback validates input, accepts feedback/bug reports, and enforces rate limits', async () => {
    const bad = await app.request('/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '198.51.100.87',
      },
      body: JSON.stringify({ kind: 'feedback', message: 'hi' }),
    });
    expect(bad.status).toBe(400);

    for (let i = 0; i < 5; i++) {
      const ok = await app.request('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '198.51.100.88',
        },
        body: JSON.stringify({
          kind: i % 2 === 0 ? 'feedback' : 'bug',
          message: 'Really enjoying the paper planes experience!',
          replyTo: 'reader@example.com',
          context: { biome: 'overview', timeOfDay: 'dusk', viewport: '1280x720' },
        }),
      });
      expect(ok.status).toBe(201);
      const data = (await ok.json()) as { ok: boolean };
      expect(data.ok).toBe(true);
    }

    const rateLimited = await app.request('/api/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '198.51.100.88',
      },
      body: JSON.stringify({
        kind: 'feedback',
        message: 'One more message that should be rate limited.',
      }),
    });
    expect(rateLimited.status).toBe(429);
  });

  it('GET /api/region detects x-vercel-ip-country with no-store and ignores invalid codes', async () => {
    const phRes = await app.request('/api/region', {
      headers: { 'x-vercel-ip-country': 'ph' },
    });
    expect(phRes.status).toBe(200);
    expect(phRes.headers.get('cache-control')).toBe('no-store');
    expect(await phRes.json()).toEqual({ country: 'PH' });

    const invalidRes = await app.request('/api/region', {
      headers: { 'x-vercel-ip-country': 'XX' },
    });
    expect(invalidRes.status).toBe(200);
    expect(await invalidRes.json()).toEqual({ country: null });
  });

  it('filters planes and random catch by country with Global fallback and keeps cards anonymous', async () => {
    // Empty country falls back to Global with fallbackUsed: true
    const emptyListRes = await app.request('/api/planes?country=JP&limit=5');
    expect(emptyListRes.status).toBe(200);
    const emptyListBody = (await emptyListRes.json()) as {
      planes: Array<Record<string, unknown>>;
      fallbackUsed: boolean;
    };
    expect(emptyListBody.fallbackUsed).toBe(true);
    expect(emptyListBody.planes.length).toBeGreaterThan(0);
    expect(emptyListBody.planes[0]).not.toHaveProperty('countryCode');

    const emptyRandomRes = await app.request('/api/planes/random?country=JP');
    expect(emptyRandomRes.status).toBe(200);
    const emptyRandomBody = (await emptyRandomRes.json()) as {
      plane: Record<string, unknown>;
      fallbackUsed: boolean;
    };
    expect(emptyRandomBody.fallbackUsed).toBe(true);
    expect(emptyRandomBody.plane).not.toHaveProperty('countryCode');

    // Create a JP plane via explicit countryCode override (overriding PH IP header)
    const createRes = await app.request('/api/planes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vercel-ip-country': 'PH',
        'x-real-ip': '203.0.113.55',
      },
      body: JSON.stringify({
        text: 'A quiet lantern note drifting over Kyoto tonight.',
        biome: '⛩️ Lantern Shrine',
        timeOfDay: 'evening',
        paperTint: 'gold',
        countryCode: 'JP',
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { plane: { id: string } };
    expect(created.plane).not.toHaveProperty('countryCode');

    // Now JP returns only the JP plane with fallbackUsed: false
    const jpListRes = await app.request('/api/planes?country=JP&limit=5');
    expect(jpListRes.status).toBe(200);
    const jpListBody = (await jpListRes.json()) as {
      planes: Array<{ id: string }>;
      fallbackUsed: boolean;
    };
    expect(jpListBody.fallbackUsed).toBe(false);
    expect(jpListBody.planes.map((p) => p.id)).toEqual([created.plane.id]);

    const jpRandomRes = await app.request('/api/planes/random?country=JP');
    expect(jpRandomRes.status).toBe(200);
    const jpRandomBody = (await jpRandomRes.json()) as {
      plane: { id: string };
      fallbackUsed: boolean;
    };
    expect(jpRandomBody.fallbackUsed).toBe(false);
    expect(jpRandomBody.plane.id).toBe(created.plane.id);
  });
});

describe('Environment validation', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSalt = process.env.IP_HASH_SALT;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalSalt === undefined) {
      delete process.env.IP_HASH_SALT;
    } else {
      process.env.IP_HASH_SALT = originalSalt;
    }
    resetEnvCache();
  });

  it('rejects default IP_HASH_SALT in production', () => {
    resetEnvCache();
    process.env.NODE_ENV = 'production';
    delete process.env.IP_HASH_SALT;
    expect(() => getEnv()).toThrow(/IP_HASH_SALT/);
  });
});
