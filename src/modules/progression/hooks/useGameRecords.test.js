import { describe, it, expect } from 'vitest';
import { toGameRecords } from './useGameRecords';

describe('toGameRecords', () => {
  it('junta torneio e dia de jogo, do mais novo ao mais antigo, com as contas de quem jogou', () => {
    const r = toGameRecords({
      tournamentRecords: [{ opponent: 'Bia / Caio', won: true, at: 100, matchKey: 'tm:1', partnerUids: ['p'], opponentUids: ['b', 'c'] }],
      gameDayGames: [{ at: 200, won: false, partner: 'Ana', opponents: ['Dedé'], partnerUids: ['a'], opponentUids: ['d'], matchKey: 'gd:x', label: 'Dia de jogo X' }],
    });
    expect(r.map((x) => x.at)).toEqual([200, 100]);
    expect(r[0]).toMatchObject({ source: 'game_day', partnerUids: ['a'], matchKey: 'gd:x', won: false });
    expect(r[1]).toMatchObject({ source: 'tournament', opponents: ['Bia', 'Caio'], opponentUids: ['b', 'c'] });
  });

  it('descarta o jogo sem data e aceita resultado desconhecido', () => {
    const r = toGameRecords({ tournamentRecords: [{ opponent: 'X', at: 0 }, { opponent: 'Y', at: 5 }] });
    expect(r).toHaveLength(1);
    expect(r[0].won).toBeNull();
  });

  it('sem nada, lista vazia', () => {
    expect(toGameRecords()).toEqual([]);
  });
});
