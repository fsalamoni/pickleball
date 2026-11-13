/**
 * Os jogos de liga de uma pessoa (Meu desempenho, perfil, confronto direto) e
 * a paridade da régua com o servidor (`functions/leagueRanking.js`).
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { Timestamp } from 'firebase/firestore';
import {
  LEAGUE_RANKING_STATUSES, LEAGUE_FORA, LEAGUE_OUT_REASON, isLeagueRankingEligible, leagueMatchGames, leagueGamesOfPlayer,
} from './leagueRankingGames.js';

const require = createRequire(import.meta.url);
const servidor = require('../../../../functions/leagueRanking.js');

const p = (uid, name) => ({ uid, name });
const entries = [
  { id: 'e1', division_id: 'd1', player_uids: ['ana', 'bia'], players: [p('ana', 'Ana Lima'), p('bia', 'Bia Reis')] },
  { id: 'e2', division_id: 'd1', player_uids: ['cau', 'duda'], players: [p('cau', 'Cauã'), p('duda', 'Duda')] },
  { id: 'e3', division_id: 'd1', player_uids: ['edu', null], players: [p('edu', 'Edu'), p(null, 'Convidado')] },
  { id: 't1', division_id: 'd2', player_uids: ['ana', 'bia', 'cau', 'duda'], players: [p('ana', 'Ana Lima'), p('bia', 'Bia Reis'), p('cau', 'Cauã'), p('duda', 'Duda')] },
  { id: 't2', division_id: 'd2', player_uids: ['edu', 'fred', 'gil', 'hel'], players: [p('edu', 'Edu'), p('fred', 'Fred'), p('gil', 'Gil'), p('hel', 'Hel')] },
  { id: 'i1', division_id: 'd3', player_uids: ['ana'], players: [p('ana', 'Ana Lima')] },
  { id: 'i2', division_id: 'd3', player_uids: ['bia'], players: [p('bia', 'Bia Reis')] },
  { id: 'i3', division_id: 'd3', player_uids: ['cau'], players: [p('cau', 'Cauã')] },
  { id: 'i4', division_id: 'd3', player_uids: ['duda'], players: [p('duda', 'Duda')] },
];
const porId = new Map(entries.map((e) => [e.id, e]));
const duplas = { id: 'L1', name: 'Liga de Inverno', format: 'divisional_pairs', status: 'running' };
const equipes = { id: 'L2', name: 'MiLP', format: 'team_milp', status: 'running' };
const escada = { id: 'L3', name: 'Escada', format: 'ladder_individual', status: 'finished' };
const quando = Timestamp.fromMillis(1_700_000_000_000);

const jogos = [
  { id: 'm1', status: 'done', side_a: 'e1', side_b: 'e2', games: [{ a: 11, b: 7 }, { a: 8, b: 11 }, { a: 11, b: 9 }], recorded_at: quando },
  { id: 'm2', status: 'reported', side_a: 'e1', side_b: 'e2', games: [{ a: 11, b: 2 }] },
  { id: 'm3', status: 'done', side_a: 'e1', side_b: 'e3', games: [{ a: 5, b: 11 }], recorded_at: quando },
  { id: 'm4', status: 'done', side_a: 'e2', side_b: 'e1', wo_winner: 'b', games: [], recorded_at: quando },
  { id: 'm5', status: 'done', side_a: 'e1', side_b: 'e2', games: [{ a: 11, b: 9 }, { a: 9, b: 11 }] },
];
const confronto = {
  id: 'c1', status: 'done', side_a: 't1', side_b: 't2', recorded_at: quando,
  games: [{ a: 11, b: 4 }, { a: 7, b: 11 }, { a: 11, b: 9 }, { a: 3, b: 11 }], dreambreaker: { a: 15, b: 12 },
  lineups: [{ a: ['ana', 'bia'], b: ['edu', 'fred'] }, null, { a: ['cau', 'duda'], b: ['gil', 'hel'] }, { a: ['ana', 'x'], b: ['edu', 'gil'] }],
};
const sessao = { id: 's1', status: 'done', phase: 'ladder', team_a: ['i1', 'i3'], team_b: ['i2', 'i4'], games: [{ a: 11, b: 6 }], recorded_at: quando };

describe('paridade com o servidor', () => {
  it('as situações que valem e os motivos são os mesmos', () => {
    expect(LEAGUE_RANKING_STATUSES).toEqual(servidor.LEAGUE_RANKING_STATUSES);
    expect(LEAGUE_FORA).toEqual(servidor.LEAGUE_FORA);
    ['draft', 'open', 'running', 'finished', 'cancelled', undefined].forEach((status) => {
      expect(isLeagueRankingEligible({ status })).toBe(servidor.isLeagueRankingEligible({ status }));
    });
  });

  it('⭐ cada jogo dá o mesmo resultado nos dois lados', () => {
    const casos = [
      ...jogos.map((m) => [duplas, m]),
      [equipes, confronto], [equipes, { ...confronto, wo_winner: 'a' }], [equipes, { ...confronto, lineups: null }],
      [escada, sessao], [escada, { ...sessao, games: [{ a: 7, b: 7 }] }],
      [duplas, null],
    ];
    casos.forEach(([liga, m]) => {
      expect(leagueMatchGames(liga, m, porId)).toEqual(servidor.leagueMatchGames(liga, m, porId));
    });
  });
});

describe('os jogos de liga de uma pessoa', () => {
  it('⭐ duplas: o decidido entra com parceiro, adversários, placar e data', () => {
    const meus = leagueGamesOfPlayer('ana', duplas, entries, jogos);
    expect(meus.map((g) => g.id).sort()).toEqual(['lg_L1_m1', 'lg_L1_m3', 'lg_L1_m4']);
    const m1 = meus.find((g) => g.id === 'lg_L1_m1');
    expect(m1).toMatchObject({
      at: 1_700_000_000_000, kind: 'doubles', label: 'Liga de Inverno', source: 'league', leagueId: 'L1',
      partner: 'Bia Reis', opponent: 'Cauã / Duda', opponents: ['Cauã', 'Duda'],
      partnerUids: ['bia'], opponentUids: ['cau', 'duda'],
      myScore: 2, oppScore: 1, won: true, walkover: false, ranked: true, outReason: null, matchKey: null,
    });
  });

  it('⭐ jogo com atleta sem conta é meu, mas fora do ranking, com o motivo', () => {
    const m3 = leagueGamesOfPlayer('ana', duplas, entries, jogos).find((g) => g.id === 'lg_L1_m3');
    expect(m3).toMatchObject({ won: false, myScore: 5, oppScore: 11, opponent: 'Edu / Convidado', opponentUids: ['edu'], ranked: false, outReason: LEAGUE_OUT_REASON.NO_ACCOUNT });
  });

  it('W.O. conta como jogo, sem placar; placar a confirmar e empate não entram', () => {
    const meus = leagueGamesOfPlayer('ana', duplas, entries, jogos);
    expect(meus.find((g) => g.id === 'lg_L1_m4')).toMatchObject({ walkover: true, won: true, ranked: true });
    expect(meus.some((g) => /m2|m5/.test(g.id))).toBe(false);
  });

  it('liga cancelada: os jogos seguem meus, fora do ranking', () => {
    const meus = leagueGamesOfPlayer('ana', { ...duplas, status: 'cancelled' }, entries, jogos);
    expect(meus).toHaveLength(3);
    expect(meus.every((g) => g.ranked === false && g.outReason === LEAGUE_OUT_REASON.LEAGUE_OFF)).toBe(true);
  });

  it('⭐ equipes: só a linha com escalação em que a pessoa jogou; o placar é o do game', () => {
    const daAna = leagueGamesOfPlayer('ana', equipes, entries, [confronto]);
    expect(daAna).toHaveLength(1);
    expect(daAna[0]).toMatchObject({ id: 'lg_L2_c1_1', partner: 'Bia Reis', opponent: 'Edu / Fred', myScore: 11, oppScore: 4, won: true, ranked: true });
    expect(leagueGamesOfPlayer('gil', equipes, entries, [confronto])[0]).toMatchObject({ id: 'lg_L2_c1_3', partner: 'Hel', won: false, myScore: 9, oppScore: 11 });
    // escalada em nenhuma linha válida: nenhum jogo é dela
    expect(leagueGamesOfPlayer('fred', equipes, entries, [{ ...confronto, lineups: null }])).toEqual([]);
  });

  it('escada individual: a dupla da vez', () => {
    const meus = leagueGamesOfPlayer('duda', escada, entries, [sessao]);
    expect(meus[0]).toMatchObject({ partner: 'Bia Reis', opponent: 'Ana Lima / Cauã', won: false, kind: 'doubles' });
  });

  it('quem não jogou não ganha jogo nenhum', () => {
    expect(leagueGamesOfPlayer('zeca', duplas, entries, jogos)).toEqual([]);
    expect(leagueGamesOfPlayer('', duplas, entries, jogos)).toEqual([]);
  });
});
