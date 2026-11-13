import { describe, it, expect } from 'vitest';
import { homeLeagueRows, myLeaguePending } from './leaguePending.js';

describe('myLeaguePending', () => {
  it('não carregou não vira zero', () => {
    expect(myLeaguePending(undefined, 'u')).toBeUndefined();
  });
  it('soma só as ligas em andamento e aponta a liga quando é uma só', () => {
    const ligas = [
      { id: 'a', status: 'running', pending_confirm: { u: 2, x: 1 } },
      { id: 'b', status: 'finished', pending_confirm: { u: 1 } },
      { id: 'c', status: 'running', pending_confirm: { x: 1 } },
    ];
    expect(myLeaguePending(ligas, 'u')).toEqual({ count: 2, leagueId: 'a' });
    expect(myLeaguePending([...ligas, { id: 'd', status: 'running', pending_confirm: { u: 1 } }], 'u')).toEqual({ count: 3, leagueId: null });
    expect(myLeaguePending(ligas, 'y')).toEqual({ count: 0, leagueId: null });
  });
});

describe('homeLeagueRows', () => {
  it('não carregou não vira lista vazia', () => {
    expect(homeLeagueRows(undefined, 'u')).toBeUndefined();
  });
  it('só em andamento ou abertas; a que espera confirmação vem primeiro; até 3', () => {
    const ligas = [
      { id: 'a', name: 'Bravo', status: 'open', season: { start_date: '2026-12-01' } },
      { id: 'b', name: 'Alfa', status: 'running' },
      { id: 'c', name: 'Zulu', status: 'running', pending_confirm: { u: 2 } },
      { id: 'd', name: 'Delta', status: 'finished' },
      { id: 'e', name: 'Eco', status: 'draft' },
      { id: 'f', name: 'Fox', status: 'open' },
    ];
    const r = homeLeagueRows(ligas, 'u');
    expect(r.map((x) => x.id)).toEqual(['c', 'b', 'a']);
    expect(r[0].pending).toBe(2);
    expect(r[2].startDate).toBe('2026-12-01');
    expect(homeLeagueRows(ligas, 'u', 10).map((x) => x.id)).toEqual(['c', 'b', 'a', 'f']);
  });
});
