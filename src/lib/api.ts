import type { PaperPlaneNote, PaperTint, SkyStats, TimeOfDay } from '../types';

let activeFetchController: AbortController | null = null;
let cachedPool: { timestamp: number; country: string; planes: PaperPlaneNote[]; fallbackUsed: boolean } | null =
  null;

export interface PlanesPoolResult {
  planes: PaperPlaneNote[];
  fallbackUsed: boolean;
}

export async function fetchDetectedRegion(): Promise<string | null> {
  try {
    const res = await fetch('/api/region', {
      method: 'GET',
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { country?: string | null };
    return data.country ?? null;
  } catch {
    return null;
  }
}

export async function fetchPlanesPool(forceRefresh = false, country?: string): Promise<PlanesPoolResult> {
  const cacheKey = country ?? '';
  // Stale-while-revalidate client cache (30s fresh window, keyed by country)
  if (!forceRefresh && cachedPool && cachedPool.country === cacheKey && Date.now() - cachedPool.timestamp < 30_000) {
    return { planes: cachedPool.planes, fallbackUsed: cachedPool.fallbackUsed };
  }

  if (activeFetchController) {
    activeFetchController.abort();
  }
  activeFetchController = new AbortController();

  const timeoutSignal = AbortSignal.timeout(6000);
  const signal =
    typeof AbortSignal.any === 'function'
      ? AbortSignal.any([activeFetchController.signal, timeoutSignal])
      : activeFetchController.signal;
  const query = new URLSearchParams({ limit: '15' });
  if (country) query.set('country', country);
  const res = await fetch(`/api/planes?${query.toString()}`, {
    method: 'GET',
    signal,
  });

  if (!res.ok) {
    throw new Error('Could not load paper planes from the sky.');
  }

  const data = (await res.json()) as { planes: PaperPlaneNote[]; fallbackUsed?: boolean };
  const fallbackUsed = Boolean(data.fallbackUsed);
  cachedPool = { timestamp: Date.now(), country: cacheKey, planes: data.planes, fallbackUsed };
  return { planes: data.planes, fallbackUsed };
}

export interface CreatePlaneInput {
  title?: string;
  text: string;
  biome: string;
  timeOfDay: TimeOfDay;
  paperTint: PaperTint;
  stamp?: string;
  countryCode?: string;
  idempotencyKey: string;
}

export async function launchNewPlane(input: CreatePlaneInput): Promise<PaperPlaneNote> {
  const res = await fetch('/api/planes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': input.idempotencyKey,
    },
    body: JSON.stringify({
      ...(input.title ? { title: input.title } : {}),
      text: input.text,
      biome: input.biome,
      timeOfDay: input.timeOfDay,
      paperTint: input.paperTint,
      ...(input.stamp ? { stamp: input.stamp } : {}),
      ...(input.countryCode ? { countryCode: input.countryCode } : {}),
    }),
    signal: AbortSignal.timeout(6000),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Could not launch paper plane right now.');
  }

  if (cachedPool && (!cachedPool.country || cachedPool.country === input.countryCode)) {
    cachedPool.planes = [data.plane, ...cachedPool.planes].slice(0, 15);
    cachedPool.fallbackUsed = false;
  }
  return data.plane as PaperPlaneNote;
}

export async function fetchRandomPlane(
  excludeIds: string[] = [],
  country?: string
): Promise<{ plane: PaperPlaneNote; fallbackUsed: boolean }> {
  const query = new URLSearchParams();
  if (excludeIds.length > 0) {
    query.set('exclude', excludeIds.slice(-15).join(','));
  }
  if (country) {
    query.set('country', country);
  }
  const qs = query.toString();
  const res = await fetch(`/api/planes/random${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    throw new Error('Could not catch a plane from the sky.');
  }

  const data = (await res.json()) as { plane: PaperPlaneNote; fallbackUsed?: boolean };
  return { plane: data.plane, fallbackUsed: Boolean(data.fallbackUsed) };
}

export async function recordPlaneRead(id: string): Promise<void> {
  try {
    await fetch('/api/planes/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    // Non-critical telemetry
  }
}

export function removePlaneFromPoolCache(id: string): void {
  if (!cachedPool) return;
  cachedPool.planes = cachedPool.planes.filter((p) => p.id !== id);
}

export function restorePlaneInPoolCache(plane: PaperPlaneNote): void {
  if (!cachedPool) return;
  if (cachedPool.planes.some((p) => p.id === plane.id)) return;
  cachedPool.planes = [plane, ...cachedPool.planes].slice(0, 15);
}

export async function flagPlaneNote(id: string, undo = false): Promise<void> {
  const res = await fetch('/api/planes/flag', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, undo }),
    signal: AbortSignal.timeout(4000),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'Could not update plane status right now.');
  }
}

export interface SubmitFeedbackInput {
  kind: 'feedback' | 'bug';
  message: string;
  replyTo?: string;
  context?: {
    biome?: string;
    timeOfDay?: TimeOfDay;
    viewport?: string;
  };
}

export async function submitFeedback(input: SubmitFeedbackInput): Promise<{ ok: boolean; delivered: boolean }> {
  const res = await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: input.kind,
      message: input.message,
      ...(input.replyTo?.trim() ? { replyTo: input.replyTo.trim() } : {}),
      ...(input.context ? { context: input.context } : {}),
    }),
    signal: AbortSignal.timeout(6000),
  });

  const data = (await res.json()) as { ok?: boolean; delivered?: boolean; error?: string };
  if (!res.ok) {
    throw new Error(data.error || 'Could not send your message right now.');
  }

  return { ok: true, delivered: Boolean(data.delivered) };
}

export async function fetchSkyStats(fresh = false): Promise<SkyStats> {
  const res = await fetch(fresh ? '/api/stats?fresh=1' : '/api/stats', {
    method: 'GET',
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    throw new Error('Could not load sky milestone stats.');
  }

  return (await res.json()) as SkyStats;
}
