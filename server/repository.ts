import crypto from 'node:crypto';
import postgres, { type Sql } from 'postgres';
import type { PaperPlaneNote, PaperTint, SkyStats, TimeOfDay } from '../src/types';
import { formatRelativeTime } from './moderation.js';
import { INITIAL_SEED_PLANES, type InternalPlaneRecord } from './seedData.js';

export interface ListPlanesOptions {
  limit: number;
  cursor?: string;
  biome?: string;
  timeOfDay?: TimeOfDay;
  country?: string;
}

export interface ListPlanesResult {
  planes: PaperPlaneNote[];
  totalCount: number;
  nextCursor: string | null;
  fallbackUsed: boolean;
}

export interface RandomPlaneResult {
  plane: PaperPlaneNote | null;
  fallbackUsed: boolean;
}

export interface CreatePlaneRecordInput {
  title?: string;
  text: string;
  biome: string;
  timeOfDay: TimeOfDay;
  paperTint: PaperTint;
  stamp: string;
  countryCode: string;
  shadowBlocked: boolean;
}

export interface CreatePlaneResult {
  plane: PaperPlaneNote;
  deduplicated: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
}

export interface PlanesRepository {
  readonly storageType: 'memory' | 'postgres';
  ping(): Promise<boolean>;
  listVisiblePlanes(options: ListPlanesOptions): Promise<ListPlanesResult>;
  getRandomVisiblePlane(excludeIds?: string[], country?: string): Promise<RandomPlaneResult>;
  createPlane(input: CreatePlaneRecordInput, idempotencyKey?: string): Promise<CreatePlaneResult>;
  incrementRead(id: string): Promise<{ ok: boolean; reads: number }>;
  flagPlane(id: string, ipHash: string, undo: boolean): Promise<{ ok: boolean }>;
  recordVisitor(ipHash: string): Promise<void>;
  getSkyStats(): Promise<SkyStats>;
  checkAndIncrementRateLimit(
    bucketKey: string,
    maxCount: number,
    windowMs: number
  ): Promise<RateLimitResult>;
}

function encodeCursor(createdAtIso: string, id: string): string {
  return Buffer.from(`${createdAtIso}|${id}`, 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): { createdAtIso: string; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const sep = decoded.indexOf('|');
    if (sep <= 0) return null;
    const createdAtIso = decoded.slice(0, sep);
    const id = decoded.slice(sep + 1);
    if (!id || Number.isNaN(Date.parse(createdAtIso))) return null;
    return { createdAtIso, id };
  } catch {
    return null;
  }
}

function toPublicNote(record: InternalPlaneRecord): PaperPlaneNote {
  return {
    id: record.id,
    number: record.number,
    ...(record.title ? { title: record.title } : {}),
    text: record.text,
    biome: record.biome,
    timeOfDay: record.timeOfDay,
    paperTint: record.paperTint,
    stamp: record.stamp,
    reads: record.reads,
    distanceKm: record.distanceKm,
    createdAt: formatRelativeTime(record.createdAtIso),
    flags: record.flags,
  };
}

/**
 * In-memory repository for local development and tests without a database.
 */
export class MemoryPlanesRepository implements PlanesRepository {
  readonly storageType = 'memory' as const;
  private planes: InternalPlaneRecord[];
  private idempotency = new Map<string, InternalPlaneRecord>();
  private rateLimits = new Map<string, { count: number; resetAtMs: number }>();
  private visitors = new Map<string, number>();
  private planeFlags = new Set<string>();
  private nextNumber = 200;

  constructor(seed: InternalPlaneRecord[] = INITIAL_SEED_PLANES) {
    this.planes = seed.map((p) => ({ ...p }));
  }

  async ping(): Promise<boolean> {
    return true;
  }

  async listVisiblePlanes(options: ListPlanesOptions): Promise<ListPlanesResult> {
    const parsedCursor = options.cursor ? decodeCursor(options.cursor) : null;

    const queryMatching = (countryFilter?: string) => {
      const filtered = this.planes
        .filter((p) => p.flags < 3 && !p.shadowBlocked)
        .filter((p) => (!options.biome ? true : p.biome === options.biome))
        .filter((p) => (!options.timeOfDay ? true : p.timeOfDay === options.timeOfDay))
        .filter((p) => (!countryFilter ? true : p.countryCode === countryFilter))
        .sort((a, b) => {
          if (a.createdAtIso !== b.createdAtIso) {
            return a.createdAtIso < b.createdAtIso ? 1 : -1;
          }
          return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
        });

      const afterCursor = parsedCursor
        ? filtered.filter(
            (p) =>
              p.createdAtIso < parsedCursor.createdAtIso ||
              (p.createdAtIso === parsedCursor.createdAtIso && p.id < parsedCursor.id)
          )
        : filtered;

      const page = afterCursor.slice(0, options.limit);
      const hasMore = afterCursor.length > options.limit;
      const last = page[page.length - 1];

      return {
        planes: page.map(toPublicNote),
        totalCount: filtered.length,
        nextCursor: hasMore && last ? encodeCursor(last.createdAtIso, last.id) : null,
      };
    };

    const primary = queryMatching(options.country);
    if (options.country && !parsedCursor && primary.planes.length === 0) {
      const fallback = queryMatching(undefined);
      return { ...fallback, fallbackUsed: true };
    }

    return { ...primary, fallbackUsed: false };
  }

  async getRandomVisiblePlane(excludeIds: string[] = [], country?: string): Promise<RandomPlaneResult> {
    const excluded = new Set(excludeIds);
    const visibleAll = this.planes.filter((p) => p.flags < 3 && !p.shadowBlocked);
    if (visibleAll.length === 0) return { plane: null, fallbackUsed: false };

    const countryVisible = country ? visibleAll.filter((p) => p.countryCode === country) : visibleAll;
    const fallbackUsed = Boolean(country && countryVisible.length === 0);
    const activePool = fallbackUsed ? visibleAll : countryVisible;

    const unexcluded = activePool.filter((p) => !excluded.has(p.id));
    const candidates = unexcluded.length > 0 ? unexcluded : activePool;
    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    return { plane: picked ? toPublicNote(picked) : null, fallbackUsed };
  }

  async createPlane(
    input: CreatePlaneRecordInput,
    idempotencyKey?: string
  ): Promise<CreatePlaneResult> {
    if (idempotencyKey) {
      const existing = this.idempotency.get(idempotencyKey);
      if (existing) {
        return { plane: toPublicNote(existing), deduplicated: true };
      }
    }

    const nowIso = new Date().toISOString();
    const record: InternalPlaneRecord = {
      id: `plane-${crypto.randomUUID().slice(0, 12)}`,
      number: this.nextNumber++,
      ...(input.title ? { title: input.title } : {}),
      text: input.text,
      biome: input.biome,
      timeOfDay: input.timeOfDay,
      paperTint: input.paperTint,
      stamp: input.stamp,
      countryCode: input.countryCode,
      reads: 1,
      distanceKm: 0.4,
      createdAt: 'Just now',
      createdAtIso: nowIso,
      flags: 0,
      shadowBlocked: input.shadowBlocked,
    };

    this.planes.unshift(record);
    if (idempotencyKey) {
      if (this.idempotency.size >= 5000) {
        const oldestKey = this.idempotency.keys().next().value;
        if (oldestKey) this.idempotency.delete(oldestKey);
      }
      this.idempotency.set(idempotencyKey, record);
    }

    return { plane: toPublicNote(record), deduplicated: false };
  }

  async incrementRead(id: string): Promise<{ ok: boolean; reads: number }> {
    const found = this.planes.find((p) => p.id === id);
    if (!found) {
      return { ok: true, reads: 1 };
    }
    found.reads += 1;
    found.distanceKm = Number((found.distanceKm + 0.3).toFixed(1));
    return { ok: true, reads: found.reads };
  }

  async flagPlane(id: string, ipHash: string, undo: boolean): Promise<{ ok: boolean }> {
    const found = this.planes.find((p) => p.id === id);
    if (!found) return { ok: true };

    const flagKey = `${id}:${ipHash}`;
    if (undo) {
      if (this.planeFlags.delete(flagKey)) {
        found.flags = Math.max(0, found.flags - 1);
      }
    } else if (!this.planeFlags.has(flagKey)) {
      this.planeFlags.add(flagKey);
      found.flags += 1;
    }
    return { ok: true };
  }

  async recordVisitor(ipHash: string): Promise<void> {
    this.visitors.set(ipHash, Date.now());
  }

  async getSkyStats(): Promise<SkyStats> {
    const visible = this.planes.filter((p) => p.flags < 3 && !p.shadowBlocked);
    const dayAgoMs = Date.now() - 24 * 60 * 60 * 1000;
    const countries = new Set<string>();

    let totalUnfolds = 0;
    let totalDistanceKm = 0;
    let planesToday = 0;
    let mostUnfoldedReads = 0;
    let visitorsToday = 0;

    for (const plane of visible) {
      totalUnfolds += plane.reads;
      totalDistanceKm += plane.distanceKm;
      if (plane.reads > mostUnfoldedReads) {
        mostUnfoldedReads = plane.reads;
      }
      if (plane.countryCode) {
        countries.add(plane.countryCode);
      }
      if (Date.parse(plane.createdAtIso) >= dayAgoMs) {
        planesToday += 1;
      }
    }

    for (const lastSeenMs of this.visitors.values()) {
      if (lastSeenMs >= dayAgoMs) {
        visitorsToday += 1;
      }
    }

    return {
      totalPlanes: visible.length,
      totalUnfolds,
      totalDistanceKm: Number(totalDistanceKm.toFixed(1)),
      countriesCount: countries.size,
      planesToday,
      mostUnfoldedReads,
      uniqueVisitors: this.visitors.size,
      visitorsToday,
      updatedAt: new Date().toISOString(),
    };
  }

  async checkAndIncrementRateLimit(
    bucketKey: string,
    maxCount: number,
    windowMs: number
  ): Promise<RateLimitResult> {
    const nowMs = Date.now();
    if (this.rateLimits.size > 2000) {
      for (const [key, entry] of this.rateLimits) {
        if (nowMs >= entry.resetAtMs) {
          this.rateLimits.delete(key);
        }
      }
    }
    const existing = this.rateLimits.get(bucketKey);

    if (existing && nowMs < existing.resetAtMs) {
      if (existing.count >= maxCount) {
        return {
          allowed: false,
          retryAfterSec: Math.max(1, Math.ceil((existing.resetAtMs - nowMs) / 1000)),
        };
      }
      existing.count += 1;
      return { allowed: true, retryAfterSec: 0 };
    }

    this.rateLimits.set(bucketKey, { count: 1, resetAtMs: nowMs + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }
}

interface PostgresPlaneRow {
  id: string;
  number: number;
  title: string | null;
  text: string;
  biome: string;
  time_of_day: TimeOfDay;
  paper_tint: PaperTint;
  stamp: string;
  reads: number;
  distance_km: string | number;
  flags: number;
  created_at: Date | string;
}

function rowToPublicNote(row: PostgresPlaneRow): PaperPlaneNote {
  const createdAtDate = row.created_at instanceof Date ? row.created_at : new Date(row.created_at);
  return {
    id: row.id,
    number: Number(row.number),
    ...(row.title ? { title: row.title } : {}),
    text: row.text,
    biome: row.biome,
    timeOfDay: row.time_of_day,
    paperTint: row.paper_tint,
    stamp: row.stamp,
    reads: Number(row.reads),
    distanceKm: Number(row.distance_km),
    createdAt: formatRelativeTime(createdAtDate),
    flags: Number(row.flags),
  };
}

/**
 * PostgreSQL repository compatible with Supabase Transaction Pooler & Neon serverless.
 */
export class PostgresPlanesRepository implements PlanesRepository {
  readonly storageType = 'postgres' as const;
  private sql: Sql;

  constructor(databaseUrl: string) {
    this.sql = postgres(databaseUrl, {
      prepare: false, // Required for Supabase PgBouncer transaction pooler
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }

  async ping(): Promise<boolean> {
    await this.sql`SELECT 1`;
    return true;
  }

  async listVisiblePlanes(options: ListPlanesOptions): Promise<ListPlanesResult> {
    const parsedCursor = options.cursor ? decodeCursor(options.cursor) : null;
    const fetchLimit = options.limit + 1;

    const queryMatching = async (countryFilter?: string) => {
      const [rows, countRows] = await Promise.all([
        this.sql<PostgresPlaneRow[]>`
          SELECT id, number, title, text, biome, time_of_day, paper_tint, stamp, reads, distance_km, flags, created_at
          FROM planes
          WHERE flags < 3
            AND shadow_blocked = FALSE
            ${options.biome ? this.sql`AND biome = ${options.biome}` : this.sql``}
            ${options.timeOfDay ? this.sql`AND time_of_day = ${options.timeOfDay}` : this.sql``}
            ${countryFilter ? this.sql`AND country_code = ${countryFilter}` : this.sql``}
            ${
              parsedCursor
                ? this.sql`AND (created_at, id) < (${parsedCursor.createdAtIso}::timestamptz, ${parsedCursor.id})`
                : this.sql``
            }
          ORDER BY created_at DESC, id DESC
          LIMIT ${fetchLimit}
        `,
        this.sql<{ total_count: number }[]>`
          SELECT COUNT(*)::int AS total_count
          FROM planes
          WHERE flags < 3
            AND shadow_blocked = FALSE
            ${options.biome ? this.sql`AND biome = ${options.biome}` : this.sql``}
            ${options.timeOfDay ? this.sql`AND time_of_day = ${options.timeOfDay}` : this.sql``}
            ${countryFilter ? this.sql`AND country_code = ${countryFilter}` : this.sql``}
        `,
      ]);

      const hasMore = rows.length > options.limit;
      const pageRows = hasMore ? rows.slice(0, options.limit) : rows;
      const last = pageRows[pageRows.length - 1];
      const lastCreatedIso =
        last && (last.created_at instanceof Date ? last.created_at.toISOString() : String(last.created_at));

      return {
        planes: pageRows.map(rowToPublicNote),
        totalCount: Number(countRows[0]?.total_count ?? pageRows.length),
        nextCursor: hasMore && last && lastCreatedIso ? encodeCursor(lastCreatedIso, last.id) : null,
      };
    };

    const primary = await queryMatching(options.country);
    if (options.country && !parsedCursor && primary.planes.length === 0) {
      const fallback = await queryMatching(undefined);
      return { ...fallback, fallbackUsed: true };
    }

    return { ...primary, fallbackUsed: false };
  }

  async getRandomVisiblePlane(excludeIds: string[] = [], country?: string): Promise<RandomPlaneResult> {
    const cleanExclude = excludeIds.slice(0, 20);

    const pickRandom = async (countryFilter?: string): Promise<PaperPlaneNote | null> => {
      const rows =
        cleanExclude.length > 0
          ? await this.sql<PostgresPlaneRow[]>`
              SELECT id, number, title, text, biome, time_of_day, paper_tint, stamp, reads, distance_km, flags, created_at
              FROM planes
              WHERE flags < 3
                AND shadow_blocked = FALSE
                ${countryFilter ? this.sql`AND country_code = ${countryFilter}` : this.sql``}
                AND NOT (id = ANY(${cleanExclude}::text[]))
              ORDER BY RANDOM()
              LIMIT 1
            `
          : [];

      if (rows[0]) {
        return rowToPublicNote(rows[0]);
      }

      const fallbackRows = await this.sql<PostgresPlaneRow[]>`
        SELECT id, number, title, text, biome, time_of_day, paper_tint, stamp, reads, distance_km, flags, created_at
        FROM planes
        WHERE flags < 3
          AND shadow_blocked = FALSE
          ${countryFilter ? this.sql`AND country_code = ${countryFilter}` : this.sql``}
        ORDER BY RANDOM()
        LIMIT 1
      `;
      return fallbackRows[0] ? rowToPublicNote(fallbackRows[0]) : null;
    };

    if (country) {
      const countryPlane = await pickRandom(country);
      if (countryPlane) {
        return { plane: countryPlane, fallbackUsed: false };
      }
      const globalPlane = await pickRandom(undefined);
      return { plane: globalPlane, fallbackUsed: Boolean(globalPlane) };
    }

    const globalPlane = await pickRandom(undefined);
    return { plane: globalPlane, fallbackUsed: false };
  }

  async createPlane(
    input: CreatePlaneRecordInput,
    idempotencyKey?: string
  ): Promise<CreatePlaneResult> {
    return this.sql.begin(async (tx) => {
      const q = tx as unknown as Sql;

      if (idempotencyKey) {
        const existingRows = await q<PostgresPlaneRow[]>`
          SELECT p.id, p.number, p.title, p.text, p.biome, p.time_of_day, p.paper_tint, p.stamp, p.reads, p.distance_km, p.flags, p.created_at
          FROM idempotency_keys ik
          JOIN planes p ON p.id = ik.plane_id
          WHERE ik.key = ${idempotencyKey}
          LIMIT 1
        `;
        if (existingRows[0]) {
          return { plane: rowToPublicNote(existingRows[0]), deduplicated: true };
        }
      }

      const id = `plane-${crypto.randomUUID().slice(0, 12)}`;
      const insertedRows = await q<PostgresPlaneRow[]>`
        INSERT INTO planes (id, title, text, biome, time_of_day, paper_tint, stamp, country_code, shadow_blocked)
        VALUES (
          ${id},
          ${input.title ?? null},
          ${input.text},
          ${input.biome},
          ${input.timeOfDay},
          ${input.paperTint},
          ${input.stamp},
          ${input.countryCode},
          ${input.shadowBlocked}
        )
        RETURNING id, number, title, text, biome, time_of_day, paper_tint, stamp, reads, distance_km, flags, created_at
      `;

      if (idempotencyKey) {
        await q`
          INSERT INTO idempotency_keys (key, plane_id)
          VALUES (${idempotencyKey}, ${id})
          ON CONFLICT (key) DO NOTHING
        `;
      }

      return { plane: rowToPublicNote(insertedRows[0]), deduplicated: false };
    });
  }

  async incrementRead(id: string): Promise<{ ok: boolean; reads: number }> {
    const rows = await this.sql<{ reads: number }[]>`
      UPDATE planes
      SET reads = reads + 1,
          distance_km = ROUND((distance_km + 0.3)::numeric, 1)
      WHERE id = ${id}
      RETURNING reads
    `;
    return { ok: true, reads: rows[0]?.reads ?? 1 };
  }

  async flagPlane(id: string, ipHash: string, undo: boolean): Promise<{ ok: boolean }> {
    await this.sql.begin(async (tx) => {
      const q = tx as unknown as Sql;
      if (undo) {
        const deleted = await q<{ plane_id: string }[]>`
          DELETE FROM plane_flags
          WHERE plane_id = ${id} AND ip_hash = ${ipHash}
          RETURNING plane_id
        `;
        if (deleted.length > 0) {
          await q`
            UPDATE planes
            SET flags = GREATEST(0, flags - 1)
            WHERE id = ${id}
          `;
        }
      } else {
        const inserted = await q<{ plane_id: string }[]>`
          INSERT INTO plane_flags (plane_id, ip_hash)
          SELECT ${id}, ${ipHash}
          WHERE EXISTS (SELECT 1 FROM planes WHERE id = ${id})
          ON CONFLICT (plane_id, ip_hash) DO NOTHING
          RETURNING plane_id
        `;
        if (inserted.length > 0) {
          await q`
            UPDATE planes
            SET flags = flags + 1
            WHERE id = ${id}
          `;
        }
      }
    });
    return { ok: true };
  }

  async recordVisitor(ipHash: string): Promise<void> {
    await this.sql`
      INSERT INTO visitors (ip_hash, first_seen_at, last_seen_at)
      VALUES (${ipHash}, NOW(), NOW())
      ON CONFLICT (ip_hash) DO UPDATE
      SET last_seen_at = NOW()
    `.catch(() => {
      // Allow graceful operation before migration 003_add_visitors.sql is applied
    });
  }

  async getSkyStats(): Promise<SkyStats> {
    const [planeRows, visitorRows] = await Promise.all([
      this.sql<
        {
          total_planes: number;
          total_unfolds: number;
          total_distance_km: number;
          countries_count: number;
          planes_today: number;
          most_unfolded_reads: number;
        }[]
      >`
        SELECT
          COUNT(*)::int AS total_planes,
          COALESCE(SUM(reads), 0)::int AS total_unfolds,
          COALESCE(ROUND(SUM(distance_km)::numeric, 1), 0)::float8 AS total_distance_km,
          COUNT(DISTINCT country_code)::int AS countries_count,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS planes_today,
          COALESCE(MAX(reads), 0)::int AS most_unfolded_reads
        FROM planes
        WHERE flags < 3 AND shadow_blocked = FALSE
      `,
      this.sql<{ unique_visitors: number; visitors_today: number }[]>`
        SELECT
          COUNT(*)::int AS unique_visitors,
          COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '24 hours')::int AS visitors_today
        FROM visitors
      `.catch(() => [{ unique_visitors: 0, visitors_today: 0 }]),
    ]);

    const row = planeRows[0];
    const vRow = visitorRows[0];
    return {
      totalPlanes: Number(row?.total_planes ?? 0),
      totalUnfolds: Number(row?.total_unfolds ?? 0),
      totalDistanceKm: Number(row?.total_distance_km ?? 0),
      countriesCount: Number(row?.countries_count ?? 0),
      planesToday: Number(row?.planes_today ?? 0),
      mostUnfoldedReads: Number(row?.most_unfolded_reads ?? 0),
      uniqueVisitors: Number(vRow?.unique_visitors ?? 0),
      visitorsToday: Number(vRow?.visitors_today ?? 0),
      updatedAt: new Date().toISOString(),
    };
  }

  async checkAndIncrementRateLimit(
    bucketKey: string,
    maxCount: number,
    windowMs: number
  ): Promise<RateLimitResult> {
    const resetAt = new Date(Date.now() + windowMs).toISOString();
    const rows = await this.sql<{ count: number; reset_at: Date | string }[]>`
      INSERT INTO rate_limits (bucket_key, count, reset_at)
      VALUES (${bucketKey}, 1, ${resetAt}::timestamptz)
      ON CONFLICT (bucket_key) DO UPDATE
      SET
        count = CASE
          WHEN rate_limits.reset_at <= NOW() THEN 1
          ELSE rate_limits.count + 1
        END,
        reset_at = CASE
          WHEN rate_limits.reset_at <= NOW() THEN EXCLUDED.reset_at
          ELSE rate_limits.reset_at
        END
      RETURNING count, reset_at
    `;

    const record = rows[0];
    if (!record) return { allowed: true, retryAfterSec: 0 };

    // Opportunistically prune stale rate-limit buckets and old idempotency keys (~2% of calls)
    if (Math.random() < 0.02) {
      this.sql`DELETE FROM rate_limits WHERE reset_at < NOW() - INTERVAL '1 hour'`.catch(() => {});
      this.sql`DELETE FROM idempotency_keys WHERE created_at < NOW() - INTERVAL '24 hours'`.catch(() => {});
    }

    if (record.count > maxCount) {
      const resetMs =
        record.reset_at instanceof Date
          ? record.reset_at.getTime()
          : new Date(record.reset_at).getTime();
      return {
        allowed: false,
        retryAfterSec: Math.max(1, Math.ceil((resetMs - Date.now()) / 1000)),
      };
    }

    return { allowed: true, retryAfterSec: 0 };
  }
}

let singletonRepo: PlanesRepository | null = null;

/**
 * Returns the configured repository (PostgreSQL if DATABASE_URL is set, otherwise Memory).
 */
export function getPlanesRepository(databaseUrl?: string): PlanesRepository {
  if (singletonRepo) return singletonRepo;
  singletonRepo = databaseUrl
    ? new PostgresPlanesRepository(databaseUrl)
    : new MemoryPlanesRepository();
  return singletonRepo;
}
