import { describe, it, expect } from 'vitest';
import { categorizeBoardMatches } from './tournamentBoard.js';

const matches = [
  { id: 'm1', status: 'in_progress', court: 2 },
  { id: 'm2', status: 'in_progress', court: 1 },
  { id: 'm3', status: 'scheduled', scheduled_at: '2026-08-01T18:00:00Z' },
  { id: 'm4', status: 'scheduled', scheduled_at: '2026-08-01T17:00:00Z' },
  { id: 'm5', status: 'finished', result_recorded_at: '2026-08-01T16:00:00Z' },
  { id: 'm6', status: 'walkover', result_recorded_at: '2026-08-01T16:30:00Z' },
  { id: 'm7', status: 'cancelled' },
];

describe('categorizeBoardMatches', () => {
  it('em andamento ordenado por quadra', () => {
    const { inProgress } = categorizeBoardMatches(matches);
    expect(inProgress.map((m) => m.id)).toEqual(['m2', 'm1']);
  });

  it('próximos ordenados por horário ascendente', () => {
    const { upcoming } = categorizeBoardMatches(matches);
    expect(upcoming.map((m) => m.id)).toEqual(['m4', 'm3']);
  });

  it('recentes ordenados por resultado descendente (inclui WO)', () => {
    const { recent } = categorizeBoardMatches(matches);
    expect(recent.map((m) => m.id)).toEqual(['m6', 'm5']);
  });

  it('ignora cancelados e respeita limites', () => {
    const { upcoming } = categorizeBoardMatches(matches, { upcomingLimit: 1 });
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].id).toBe('m4');
  });

  it('lida com lista vazia', () => {
    expect(categorizeBoardMatches([])).toEqual({ inProgress: [], upcoming: [], recent: [] });
  });
});
