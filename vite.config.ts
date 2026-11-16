import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity';
import { z } from 'zod';

const profanityMatcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

const PlaneSubmissionSchema = z.object({
  text: z
    .string()
    .trim()
    .min(3, 'Write at least a few words before folding.')
    .max(320, 'Keep your note under 320 characters so the plane stays light.'),
  biome: z.string().trim().max(48).optional().default('Downtown Rooftops'),
  timeOfDay: z
    .enum(['dawn', 'morning', 'afternoon', 'dusk', 'evening', 'midnight'])
    .optional()
    .default('dusk'),
  paperTint: z
    .enum(['cream', 'rose', 'sky', 'sage', 'gold'])
    .optional()
    .default('cream'),
  stamp: z.string().trim().max(24).optional().default('AIRMAIL'),
}).strict();

interface StoredPlane {
  id: string;
  number: number;
  text: string;
  biome: string;
  timeOfDay: 'dawn' | 'morning' | 'afternoon' | 'dusk' | 'evening' | 'midnight';
  paperTint: 'cream' | 'rose' | 'sky' | 'sage' | 'gold';
  stamp: string;
  reads: number;
  distanceKm: number;
  createdAt: string;
  flags: number;
  shadowBlocked?: boolean;
}

const INITIAL_PLANES: StoredPlane[] = [
  {
    id: 'plane-101',
    number: 101,
    text: "I still keep the train ticket from the day we met in my winter coat pocket. You probably don't even remember which platform it was.",
    biome: 'Downtown Station',
    timeOfDay: 'dusk',
    paperTint: 'cream',
    stamp: 'PLATFORM 4',
    reads: 28,
    distanceKm: 14.2,
    createdAt: '2 hours ago',
    flags: 0,
  },
  {
    id: 'plane-104',
    number: 104,
    text: "To whoever catches this plane at night: unclench your jaw, drop your shoulders, and take a slow breath. You're doing better than you think.",
    biome: 'Seaside Boardwalk',
    timeOfDay: 'midnight',
    paperTint: 'sky',
    stamp: 'NIGHT WIND',
    reads: 64,
    distanceKm: 31.8,
    createdAt: '5 hours ago',
    flags: 0,
  },
  {
    id: 'plane-109',
    number: 109,
    text: "I finally handed in my resignation letter this morning. My hands were shaking at the crosswalk, but walking past the bakery felt like flying.",
    biome: 'Market Crosswalk',
    timeOfDay: 'morning',
    paperTint: 'gold',
    stamp: 'FIRST DAY',
    reads: 19,
    distanceKm: 8.5,
    createdAt: '6 hours ago',
    flags: 0,
  },
  {
    id: 'plane-115',
    number: 115,
    text: "Sometimes I sit on my balcony just watching the timber-framed cottage windows light up one by one and wonder what everyone is cooking for dinner.",
    biome: 'Cobblestone Village',
    timeOfDay: 'evening',
    paperTint: 'rose',
    stamp: 'HEARTH',
    reads: 41,
    distanceKm: 22.0,
    createdAt: '1 day ago',
    flags: 0,
  },
  {
    id: 'plane-122',
    number: 122,
    text: "I wish I had said 'stay a little longer' instead of 'text me when you get home.'",
    biome: 'Harbor Bridge',
    timeOfDay: 'midnight',
    paperTint: 'cream',
    stamp: 'UNSAID',
    reads: 93,
    distanceKm: 47.6,
    createdAt: '1 day ago',
    flags: 0,
  },
  {
    id: 'plane-128',
    number: 128,
    text: "Bought fresh peaches from the corner stall and sat by the valley waterfall for an hour with my phone in airplane mode. Best afternoon all month.",
    biome: 'Valley Waterfall',
    timeOfDay: 'afternoon',
    paperTint: 'sage',
    stamp: 'VALLEY',
    reads: 33,
    distanceKm: 19.4,
    createdAt: '2 days ago',
    flags: 0,
  },
  {
    id: 'plane-134',
    number: 134,
    text: "If you're unfolding this right now, I hope something unexpectedly gentle happens to you before the week ends.",
    biome: 'Lighthouse Point',
    timeOfDay: 'dawn',
    paperTint: 'gold',
    stamp: 'DAYBREAK',
    reads: 52,
    distanceKm: 39.1,
    createdAt: '2 days ago',
    flags: 0,
  },
  {
    id: 'plane-141',
    number: 141,
    text: "I'm terrified of starting over in a new city at 28, even though staying where I was scared me way more.",
    biome: 'Neon Arcade',
    timeOfDay: 'evening',
    paperTint: 'cream',
    stamp: 'ONE WAY',
    reads: 37,
    distanceKm: 16.9,
    createdAt: '3 days ago',
    flags: 0,
  },
  {
    id: 'plane-149',
    number: 149,
    text: "The rain on the terracotta roofs sounds like warm static on an old radio. Makes me miss childhood summers when nobody was in a rush.",
    biome: 'Timber Square',
    timeOfDay: 'dusk',
    paperTint: 'sage',
    stamp: 'RAINY DAY',
    reads: 29,
    distanceKm: 12.7,
    createdAt: '3 days ago',
    flags: 0,
  },
  {
    id: 'plane-156',
    number: 156,
    text: "I forgive you, even though you never asked for it. I'm just tired of carrying it up every hill.",
    biome: 'Pine Overlook',
    timeOfDay: 'dawn',
    paperTint: 'rose',
    stamp: 'LET GO',
    reads: 71,
    distanceKm: 54.3,
    createdAt: '4 days ago',
    flags: 0,
  },
  {
    id: 'plane-163',
    number: 163,
    text: "Saw a golden retriever carrying its own leash across the zebra crossing outside the convenience store today. 10/10 no notes.",
    biome: 'Downtown Crossing',
    timeOfDay: 'morning',
    paperTint: 'gold',
    stamp: 'GOOD BOY',
    reads: 84,
    distanceKm: 27.5,
    createdAt: '4 days ago',
    flags: 0,
  },
  {
    id: 'plane-170',
    number: 170,
    text: "I hope one day we run into each other at the corner coffee shop and neither of us feels awkward anymore.",
    biome: 'Corner Roastery',
    timeOfDay: 'afternoon',
    paperTint: 'cream',
    stamp: 'ESPRESSO',
    reads: 44,
    distanceKm: 18.2,
    createdAt: '5 days ago',
    flags: 0,
  },
  {
    id: 'plane-178',
    number: 178,
    text: "Made soup from scratch for the first time without calling my mom for the recipe. It actually tasted like hers.",
    biome: 'Hillside Cottage',
    timeOfDay: 'evening',
    paperTint: 'rose',
    stamp: 'HOME',
    reads: 59,
    distanceKm: 33.0,
    createdAt: '5 days ago',
    flags: 0,
  },
  {
    id: 'plane-185',
    number: 185,
    text: "Watching the fireworks reflect on the harbor water by myself, wishing you were on the bench next to me.",
    biome: 'Harbor Pier',
    timeOfDay: 'midnight',
    paperTint: 'sky',
    stamp: 'SPARK',
    reads: 48,
    distanceKm: 25.6,
    createdAt: '6 days ago',
    flags: 0,
  },
  {
    id: 'plane-192',
    number: 192,
    text: "Every paper plane drifting up here is a thought someone couldn't keep inside anymore. I'm glad this sky is big enough for all of us.",
    biome: 'Old Bell Tower',
    timeOfDay: 'dusk',
    paperTint: 'gold',
    stamp: 'FOREVER',
    reads: 112,
    distanceKm: 68.4,
    createdAt: '1 week ago',
    flags: 0,
  },
];

function paperPlanesApiPlugin(): Plugin {
  const planes: StoredPlane[] = [...INITIAL_PLANES];
  const idempotencyCache = new Map<string, StoredPlane>();
  const ipRateLimits = new Map<string, { count: number; resetAt: number }>();

  return {
    name: 'paper-planes-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Security Headers per AGENTS.md Section 3
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

        if (!req.url?.startsWith('/api/planes')) {
          return next();
        }

        const url = new URL(req.url, 'http://localhost');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');

        // GET /api/planes (Cursor/bounded pagination + edge cache header)
        if (req.method === 'GET' && url.pathname === '/api/planes') {
          const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || 30)));
          const visiblePlanes = planes
            .filter((p) => p.flags < 3 && !p.shadowBlocked)
            .slice(0, limit);
          res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=45');
          res.statusCode = 200;
          res.end(JSON.stringify({ planes: visiblePlanes, total: visiblePlanes.length }));
          return;
        }

        // POST /api/planes (Fold & Launch with Idempotency-Key, Rate Limit, Zod & Obscenity)
        if (req.method === 'POST' && url.pathname === '/api/planes') {
          const idempotencyKey = req.headers['idempotency-key'];
          if (typeof idempotencyKey === 'string' && idempotencyCache.has(idempotencyKey)) {
            res.statusCode = 200;
            res.end(JSON.stringify({ plane: idempotencyCache.get(idempotencyKey), deduplicated: true }));
            return;
          }

          const clientIp = (req.socket.remoteAddress || 'local').toString();
          const now = Date.now();
          const rateRecord = ipRateLimits.get(clientIp);
          if (rateRecord && now < rateRecord.resetAt) {
            if (rateRecord.count >= 8) {
              res.statusCode = 429;
              res.end(
                JSON.stringify({
                  error: 'Sky breeze cooldown: You have launched several planes recently. Take a breath and try again in a few minutes.',
                })
              );
              return;
            }
            rateRecord.count += 1;
          } else {
            ipRateLimits.set(clientIp, { count: 1, resetAt: now + 10 * 60 * 1000 });
          }

          let rawBody = '';
          req.on('data', (chunk) => {
            rawBody += chunk;
            if (rawBody.length > 8192) req.destroy();
          });

          req.on('end', () => {
            try {
              const parsedJson = JSON.parse(rawBody || '{}');
              const validated = PlaneSubmissionSchema.safeParse(parsedJson);
              if (!validated.success) {
                res.statusCode = 400;
                res.end(
                  JSON.stringify({
                    error: validated.error.issues[0]?.message || 'Invalid paper plane note.',
                  })
                );
                return;
              }

              const { text, biome, timeOfDay, paperTint, stamp } = validated.data;

              // Reject URLs / promo links / emails / phone spam
              const hasLinkOrSpam = /(https?:\/\/|www\.|\.com\b|\.gg\b|\.io\b|@\w+\.\w+|discord\.gg|t\.me\/)/i.test(text);
              if (hasLinkOrSpam) {
                res.statusCode = 400;
                res.end(
                  JSON.stringify({
                    error: 'Links, handles, and web addresses cannot be folded into paper planes. Keep it personal and anonymous.',
                  })
                );
                return;
              }

              // Check profanity / hate speech with Obscenity
              if (profanityMatcher.hasMatch(text)) {
                res.statusCode = 400;
                res.end(
                  JSON.stringify({
                    error: "Let's keep this sky gentle and safe for everyone. Please rephrase your note without harsh language.",
                  })
                );
                return;
              }

              // Check repetitive character spam (e.g. "aaaaaaaaaaaa")
              const isRepetitive = /(.)\1{9,}/.test(text);

              const nextNum = 200 + planes.length * 7;
              const newPlane: StoredPlane = {
                id: `plane-${Date.now().toString(36)}`,
                number: nextNum,
                text,
                biome,
                timeOfDay,
                paperTint,
                stamp,
                reads: 1,
                distanceKm: 0.4,
                createdAt: 'Just now',
                flags: 0,
                shadowBlocked: isRepetitive,
              };

              planes.unshift(newPlane);
              if (typeof idempotencyKey === 'string' && idempotencyKey.length > 0) {
                idempotencyCache.set(idempotencyKey, newPlane);
              }

              res.statusCode = 201;
              res.end(JSON.stringify({ plane: newPlane }));
            } catch {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Malformed request payload.' }));
            }
          });
          return;
        }

        // POST /api/planes/read (Increment read counter)
        if (req.method === 'POST' && url.pathname === '/api/planes/read') {
          let rawBody = '';
          req.on('data', (c) => (rawBody += c));
          req.on('end', () => {
            try {
              const { id } = JSON.parse(rawBody || '{}');
              const found = planes.find((p) => p.id === id);
              if (found) {
                found.reads += 1;
                found.distanceKm = Number((found.distanceKm + 0.3).toFixed(1));
              }
              res.statusCode = 200;
              res.end(JSON.stringify({ ok: true, reads: found?.reads ?? 1 }));
            } catch {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid request' }));
            }
          });
          return;
        }

        // POST /api/planes/flag (Community moderation / crumple report + undo)
        if (req.method === 'POST' && url.pathname === '/api/planes/flag') {
          let rawBody = '';
          req.on('data', (c) => (rawBody += c));
          req.on('end', () => {
            try {
              const { id, undo } = JSON.parse(rawBody || '{}');
              const found = planes.find((p) => p.id === id);
              if (found) {
                found.flags = Math.max(0, found.flags + (undo ? -1 : 1));
              }
              res.statusCode = 200;
              res.end(JSON.stringify({ ok: true }));
            } catch {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid request' }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), paperPlanesApiPlugin()],
});
