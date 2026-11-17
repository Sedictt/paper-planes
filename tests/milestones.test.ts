import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  buildMilestoneTemplates,
  getNextMilestone,
} from '../src/lib/milestoneCardGenerator';
import { fetchSkyStats } from '../src/lib/api';
import type { SkyStats } from '../src/types';

describe('Milestone helpers', () => {
  it('computes next milestone threshold and progress percentage', () => {
    expect(getNextMilestone(0)).toEqual({
      current: 0,
      previous: 0,
      next: 50,
      progressPct: 0,
    });

    expect(getNextMilestone(75)).toEqual({
      current: 75,
      previous: 50,
      next: 100,
      progressPct: 50,
    });

    expect(getNextMilestone(1000)).toEqual({
      current: 1000,
      previous: 1000,
      next: 2500,
      progressPct: 0,
    });

    expect(getNextMilestone(1_250_000)).toEqual({
      current: 1_250_000,
      previous: 1_000_000,
      next: 2_000_000,
      progressPct: 25,
    });
  });

  it('builds formatted social milestone templates from live sky stats', () => {
    const stats: SkyStats = {
      totalPlanes: 1250,
      totalUnfolds: 8420,
      totalDistanceKm: 3145.6,
      countriesCount: 19,
      planesToday: 42,
      mostUnfoldedReads: 108,
      updatedAt: '2026-11-17T03:00:00.000Z',
    };

    const templates = buildMilestoneTemplates(stats);
    expect(templates).toHaveLength(5);

    const planesTpl = templates.find((t) => t.id === 'planes_flying');
    expect(planesTpl?.heroValue).toBe('1,250');
    expect(planesTpl?.postCopy).toContain('1,250 paper planes');
    expect(planesTpl?.postCopy).toContain('19 countries');

    const unfoldsTpl = templates.find((t) => t.id === 'total_unfolds');
    expect(unfoldsTpl?.heroValue).toBe('8,420');
    expect(unfoldsTpl?.postCopy).toContain('8,420 times');

    const singleTpl = templates.find((t) => t.id === 'single_plane_unfolds');
    expect(singleTpl?.heroValue).toBe('108');
    expect(singleTpl?.postCopy).toContain('108 times');
  });

  it('handles singular grammar cleanly when counts are 1', () => {
    const stats: SkyStats = {
      totalPlanes: 1,
      totalUnfolds: 1,
      totalDistanceKm: 1.2,
      countriesCount: 1,
      planesToday: 1,
      mostUnfoldedReads: 1,
      updatedAt: '2026-11-17T03:00:00.000Z',
    };

    const templates = buildMilestoneTemplates(stats);
    const planesTpl = templates.find((t) => t.id === 'planes_flying');
    expect(planesTpl?.postCopy).toContain('1 paper plane flying');
    expect(planesTpl?.postCopy).toContain('1 country');

    const unfoldsTpl = templates.find((t) => t.id === 'total_unfolds');
    expect(unfoldsTpl?.postCopy).toContain('1 time');
  });
});

describe('fetchSkyStats', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches /api/stats and supports fresh=1 query parameter', async () => {
    const mockStats: SkyStats = {
      totalPlanes: 10,
      totalUnfolds: 25,
      totalDistanceKm: 12.4,
      countriesCount: 3,
      planesToday: 2,
      mostUnfoldedReads: 7,
      updatedAt: '2026-11-17T03:00:00.000Z',
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockStats), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    const res1 = await fetchSkyStats(false);
    expect(res1).toEqual(mockStats);
    expect(fetchSpy).toHaveBeenCalledWith('/api/stats', expect.any(Object));

    const res2 = await fetchSkyStats(true);
    expect(res2).toEqual(mockStats);
    expect(fetchSpy).toHaveBeenCalledWith('/api/stats?fresh=1', expect.any(Object));
  });
});
