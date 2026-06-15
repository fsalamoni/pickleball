import { describe, it, expect } from 'vitest';
import { scheduleMatches, estimateScheduleDurationMinutes } from './schedule.js';

const courts = (n) => Array.from({ length: n }, (_, i) => ({ id: `c${i + 1}`, name: `Quadra ${i + 1}` }));

describe('scheduleMatches', () => {
  it('aloca jogos em quadras paralelas sem conflito de jogadores', () => {
    const matches = [
      { id: 'm1', round: 1, position: 1, player_ids: ['a', 'b'] },
      { id: 'm2', round: 1, position: 2, player_ids: ['c', 'd'] },
      { id: 'm3', round: 1, position: 3, player_ids: ['e', 'f'] },
    ];
    const res = scheduleMatches(matches, { courts: courts(2), restSlots: 0 });
    expect(res.assignments).toHaveLength(3);
    // 3 jogos em 2 quadras → pelo menos slot 1 deve ser usado
    expect(res.totalSlots).toBeGreaterThanOrEqual(2);
    expect(res.warnings).toEqual([]);
  });

  it('respeita descanso mínimo entre jogos do mesmo jogador', () => {
    const matches = [
      { id: 'm1', round: 1, position: 1, player_ids: ['a', 'b'] },
      { id: 'm2', round: 2, position: 1, player_ids: ['a', 'c'] },
    ];
    const res = scheduleMatches(matches, { courts: courts(4), restSlots: 2 });
    const slotA = res.assignments.find((x) => x.match_id === 'm1').slot;
    const slotB = res.assignments.find((x) => x.match_id === 'm2').slot;
    expect(slotB - slotA).toBeGreaterThanOrEqual(2);
  });

  it('jogos com jogadores em comum nunca acontecem no mesmo slot', () => {
    const matches = [
      { id: 'm1', round: 1, position: 1, player_ids: ['a', 'b'] },
      { id: 'm2', round: 1, position: 2, player_ids: ['a', 'c'] },
    ];
    const res = scheduleMatches(matches, { courts: courts(2), restSlots: 0 });
    const s1 = res.assignments.find((x) => x.match_id === 'm1').slot;
    const s2 = res.assignments.find((x) => x.match_id === 'm2').slot;
    expect(s1).not.toBe(s2);
  });

  it('avisa quando não há quadras', () => {
    const res = scheduleMatches([{ id: 'm1', round: 1, position: 1, player_ids: ['a', 'b'] }], { courts: [] });
    expect(res.warnings.length).toBeGreaterThan(0);
  });

  it('gera horários ISO quando startAt é fornecido', () => {
    const matches = [{ id: 'm1', round: 1, position: 1, player_ids: ['a', 'b'] }];
    const res = scheduleMatches(matches, {
      courts: courts(1),
      slotMinutes: 30,
      startAt: '2026-06-01T13:00:00.000Z',
    });
    expect(res.assignments[0].start_at).toBe('2026-06-01T13:00:00.000Z');
  });

  it('estima duração em minutos', () => {
    expect(estimateScheduleDurationMinutes({ totalSlots: 4 }, 30)).toBe(120);
  });

  it('maxSlots limita a janela e avisa sobre jogos que não cabem', () => {
    const matches = [
      { id: 'm1', round: 1, position: 1, player_ids: ['a', 'b'] },
      { id: 'm2', round: 2, position: 1, player_ids: ['a', 'c'] },
      { id: 'm3', round: 3, position: 1, player_ids: ['a', 'd'] },
    ];
    // 1 quadra, descanso 0, janela de apenas 2 slots → cabem 2 jogos do jogador "a"
    const res = scheduleMatches(matches, { courts: courts(1), restSlots: 0, maxSlots: 2 });
    expect(res.assignments).toHaveLength(2);
    expect(res.warnings.length).toBe(1);
    expect(res.assignments.every((a) => a.slot < 2)).toBe(true);
  });
});
