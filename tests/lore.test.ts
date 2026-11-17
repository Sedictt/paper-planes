import { describe, it, expect } from 'vitest';
import {
  advanceLoreSequence,
  FROG_AMBIENT_LINES,
  FROG_LORE_LINES,
  getInteriorPropContent,
  getOutdoorPropContent,
  isTwilightOrNight,
  OUTDOOR_PROP_HINTS,
  pickFrogLine,
} from '../src/lib/lore';

describe('Cathexis Interactive Lore & Sequence', () => {
  it('detects twilight and night periods accurately', () => {
    expect(isTwilightOrNight('dawn')).toBe(false);
    expect(isTwilightOrNight('morning')).toBe(false);
    expect(isTwilightOrNight('afternoon')).toBe(false);
    expect(isTwilightOrNight('dusk')).toBe(true);
    expect(isTwilightOrNight('evening')).toBe(true);
    expect(isTwilightOrNight('midnight')).toBe(true);
  });

  it('picks non-repeating frog lines from ambient and lore pools', () => {
    const allLines = new Set([...FROG_AMBIENT_LINES, ...FROG_LORE_LINES]);
    const prev = FROG_AMBIENT_LINES[0];
    for (let i = 0; i < 20; i++) {
      const next = pickFrogLine('evening', prev);
      expect(allLines.has(next)).toBe(true);
      expect(next).not.toBe(prev);
    }
  });

  it('completes the 4-step lore sequence during dusk/evening/midnight', () => {
    let step = 0;
    let res = advanceLoreSequence(step, 'frog', 'morning');
    expect(res).toEqual({ nextStep: 1, matched: true, unlocked: false });
    step = res.nextStep;

    res = advanceLoreSequence(step, 'campfire', 'morning');
    expect(res).toEqual({ nextStep: 2, matched: true, unlocked: false });
    step = res.nextStep;

    res = advanceLoreSequence(step, 'cottage', 'morning');
    expect(res).toEqual({ nextStep: 3, matched: true, unlocked: false });
    step = res.nextStep;

    // Shrine during daytime does not unlock
    const dayFail = advanceLoreSequence(step, 'shrine', 'afternoon');
    expect(dayFail).toEqual({ nextStep: 0, matched: false, unlocked: false });

    // Re-walk through inkstone inside cottage for step 3, then shrine at midnight
    step = advanceLoreSequence(0, 'frog', 'midnight').nextStep;
    step = advanceLoreSequence(step, 'campfire', 'midnight').nextStep;
    step = advanceLoreSequence(step, 'inkstone', 'midnight').nextStep;
    expect(step).toBe(3);

    const unlockRes = advanceLoreSequence(step, 'shrine', 'midnight');
    expect(unlockRes).toEqual({ nextStep: 4, matched: true, unlocked: true });
  });

  it('silently resets out-of-order clicks or restarts at 1 on frog', () => {
    expect(advanceLoreSequence(1, 'waterfall', 'dusk')).toEqual({
      nextStep: 0,
      matched: false,
      unlocked: false,
    });
    expect(advanceLoreSequence(2, 'frog', 'dusk')).toEqual({
      nextStep: 1,
      matched: false,
      unlocked: false,
    });
  });

  it('returns randomized interior and outdoor prop content without repeating and has 20+ lines each', () => {
    expect(FROG_AMBIENT_LINES.length + FROG_LORE_LINES.length).toBeGreaterThanOrEqual(20);
    for (const pool of Object.values(OUTDOOR_PROP_HINTS)) {
      expect(pool.humorous.length + pool.lore.length).toBeGreaterThanOrEqual(20);
    }

    const shrine1 = getOutdoorPropContent('shrine', 'morning').text;
    const shrine2 = getOutdoorPropContent('shrine', 'morning', shrine1).text;
    expect(shrine2).not.toBe(shrine1);

    expect(getInteriorPropContent('door', 'morning').actionKind).toBe('exit-cottage');
    const first = getInteriorPropContent('inkstone', 'morning').text;
    const second = getInteriorPropContent('inkstone', 'morning', first).text;
    expect(second).not.toBe(first);

    const draftFirst = getInteriorPropContent('drafts', 'evening').text;
    expect(draftFirst.length).toBeGreaterThan(0);
    const draftSecond = getInteriorPropContent('drafts', 'evening', draftFirst).text;
    expect(draftSecond.length).toBeGreaterThan(0);
    expect(draftSecond).not.toBe(draftFirst);
  });

  it('exhausts all lines in a pool before repeating', () => {
    const seen = new Set<string>();
    const campfirePool = OUTDOOR_PROP_HINTS.campfire;
    const total = campfirePool.humorous.length + campfirePool.lore.length;

    let prev: string | null = null;
    const seenHumor = new Set<string>();
    const seenLore = new Set<string>();

    for (let i = 0; i < total * 2; i++) {
      const text: string = getOutdoorPropContent('campfire', 'morning', prev, seen).text;
      if (campfirePool.humorous.includes(text)) {
        if (seenHumor.size < campfirePool.humorous.length) {
          expect(seenHumor.has(text)).toBe(false);
        }
        seenHumor.add(text);
      } else {
        if (seenLore.size < campfirePool.lore.length) {
          expect(seenLore.has(text)).toBe(false);
        }
        seenLore.add(text);
      }
      prev = text;
    }
  });
});
