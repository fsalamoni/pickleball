import { describe, it, expect } from 'vitest';
import { myLeaguePending } from './leaguePending.js';

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
