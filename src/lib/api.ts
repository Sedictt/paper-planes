import type { PaperPlaneNote, PaperTint, TimeOfDay } from '../types';

let activeFetchController: AbortController | null = null;
let cachedPool: { timestamp: number; planes: PaperPlaneNote[] } | null = null;

export async function fetchPlanesPool(forceRefresh = false): Promise<PaperPlaneNote[]> {
  // Stale-while-revalidate client cache (30s fresh window)
  if (!forceRefresh && cachedPool && Date.now() - cachedPool.timestamp < 30_000) {
    return cachedPool.planes;
  }

  if (activeFetchController) {
    activeFetchController.abort();
  }
  activeFetchController = new AbortController();

  const timeoutSignal = AbortSignal.timeout(6000);
  const res = await fetch('/api/planes?limit=35', {
    method: 'GET',
    signal: timeoutSignal,
  });

  if (!res.ok) {
    throw new Error('Could not load paper planes from the sky.');
  }

  const data = (await res.json()) as { planes: PaperPlaneNote[] };
  cachedPool = { timestamp: Date.now(), planes: data.planes };
  return data.planes;
}

export interface CreatePlaneInput {
  text: string;
  biome: string;
  timeOfDay: TimeOfDay;
  paperTint: PaperTint;
  stamp: string;
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
      text: input.text,
      biome: input.biome,
      timeOfDay: input.timeOfDay,
      paperTint: input.paperTint,
      stamp: input.stamp,
    }),
    signal: AbortSignal.timeout(6000),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Could not launch paper plane right now.');
  }

  if (cachedPool) {
    cachedPool.planes = [data.plane, ...cachedPool.planes];
  }
  return data.plane as PaperPlaneNote;
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

export async function flagPlaneNote(id: string, undo = false): Promise<void> {
  await fetch('/api/planes/flag', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, undo }),
    signal: AbortSignal.timeout(4000),
  });
}
