import { describe, it, expect } from 'vitest';
import { tonesFor, tonesDuration, CALL_TONES } from './alertTones';

describe('alertTones', () => {
  it('cada lance que toca tem um desenho próprio e curto', () => {
    const sigs = ['out', 'fault', 'review', 'in'].map((c) => JSON.stringify(CALL_TONES[c]));
    expect(new Set(sigs).size).toBe(4);
    for (const c of ['out', 'fault', 'review']) expect(tonesDuration(tonesFor(c))).toBeLessThanOrEqual(400);
  });

  it('o "dentro" só toca se a pessoa pedir; lance desconhecido não toca', () => {
    expect(tonesFor('in')).toEqual([]);
    expect(tonesFor('in', { playIn: true }).length).toBe(1);
    expect(tonesFor('x')).toEqual([]);
  });
});
