/**
 * PLACAR POR SETS de ponta a ponta: o jogo lançado por sets chega certo a
 * todo leitor — ranking do dia, ranking do clube, publicação (espelho),
 * meus jogos, exportação ao DUPR e o servidor.
 *
 * O caso que separa: 11-0, 9-11, 9-11 — o lado A fez MAIS pontos (29 × 22) e
 * PERDEU por sets (1 × 2). Quem decidisse o vencedor por pontos erraria.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { resultFromSets } from './gameSets.js';
import { buildGameDayMatch, mirrorDecisionChanged } from './gameDayRanking.js';
import { mirrorGameToMyGame } from './myGames.js';
import { computeGameDayLeaderboard } from '@/modules/clubs/domain/gameDayLeaderboard.js';
import { computeClubRanking } from '@/modules/clubs/domain/clubRanking.js';
import { buildPublishableMatch } from '@/modules/clubs/domain/rankingPublishing.js';
import { normalizeExportMatches } from '@/modules/rating/domain/duprMatchExport.js';

const require = createRequire(import.meta.url);
const { __test: servidor } = require('../../../../functions/clubRanking.js');

const participants = [
  { id: 'p1', name: 'Ana', user_id: 'u1' },
  { id: 'p2', name: 'Bia', user_id: 'u2' },
  { id: 'p3', name: 'Caio', user_id: 'u3' },
  { id: 'p4', name: 'Duda', user_id: 'u4' },
];
const { fields } = resultFromSets([{ a: 11, b: 0 }, { a: 9, b: 11 }, { a: 9, b: 11 }]);
const jogo = {
  id: 'g1',
  side_a: [{ id: 'p1', name: 'Ana' }, { id: 'p2', name: 'Bia' }],
  side_b: [{ id: 'p3', name: 'Caio' }, { id: 'p4', name: 'Duda' }],
  ...fields,
};

describe('placar por sets nos leitores', () => {
  it('ranking do dia: vence quem ganhou os sets; o saldo é de pontos', () => {
    const rows = computeGameDayLeaderboard(participants, [jogo]);
    const ana = rows.find((r) => r.id === 'p1');
    const caio = rows.find((r) => r.id === 'p3');
    expect(caio.wins).toBe(1);
    expect(ana.losses).toBe(1);
    expect(ana.pointsFor).toBe(29);
    expect(ana.diff).toBe(7);
  });

  it('ranking interno do clube: mesma regra', () => {
    const rows = computeClubRanking([jogo]);
    expect(rows.find((r) => r.id === 'p3').wins).toBe(1);
    expect(rows.find((r) => r.id === 'p1').points_for).toBe(29);
  });

  it('espelho do dia de jogo: pontos em score_*, sets em sets_* e o detalhe', () => {
    const { payload } = buildGameDayMatch({ gameDay: { id: 'gd1' }, gameId: 'g1', game: jogo, participants, clubIdsByUid: {} });
    expect(payload.winner_side).toBe('b');
    expect(payload).toMatchObject({ score_a: 29, score_b: 22, sets_a: 1, sets_b: 2 });
    expect(payload.set_scores).toEqual(fields.sets);
  });

  it('espelho do evento de clube (legado): mesma regra', () => {
    const r = buildPublishableMatch({
      event: { id: 'ev1' }, dateId: 'd1', clubId: 'c1', gameId: 'g1', game: jogo, participants,
    });
    expect(r.payload).toMatchObject({ winner_side: 'b', score_a: 29, score_b: 22, sets_a: 1, sets_b: 2 });
  });

  it('um set só: espelho idêntico ao de sempre (sem set_scores)', () => {
    const umSet = { ...jogo, ...resultFromSets([{ a: 11, b: 7 }]).fields };
    const { payload } = buildGameDayMatch({ gameDay: { id: 'gd1' }, gameId: 'g1', game: umSet, participants, clubIdsByUid: {} });
    expect(payload).toMatchObject({ score_a: 11, score_b: 7, sets_a: 11, sets_b: 7, winner_side: 'a' });
    expect(payload).not.toHaveProperty('set_scores');
  });

  it('corrigir um set (mesmo total e vencedor) regrava o espelho', () => {
    const { payload } = buildGameDayMatch({ gameDay: { id: 'gd1' }, gameId: 'g1', game: jogo, participants, clubIdsByUid: {} });
    const corrigido = { ...payload, set_scores: [{ a: 11, b: 1 }, { a: 9, b: 11 }, { a: 9, b: 10 }] };
    expect(mirrorDecisionChanged(payload, corrigido)).toBe(true);
    expect(mirrorDecisionChanged(payload, { ...payload })).toBe(false);
  });

  it('meus jogos: perdeu por 1 × 2 (sets), não 29 × 22', () => {
    const { payload } = buildGameDayMatch({ gameDay: { id: 'gd1' }, gameId: 'g1', game: jogo, participants, clubIdsByUid: {} });
    const meu = mirrorGameToMyGame('u1', { ...payload, source: 'athlete_game_day' }, new Map());
    expect(meu).toMatchObject({ myScore: 1, oppScore: 2, won: false });
  });

  it('DUPR: cada set vira um jogo', () => {
    const { payload } = buildGameDayMatch({ gameDay: { id: 'gd1' }, gameId: 'g1', game: jogo, participants, clubIdsByUid: {} });
    const [m] = normalizeExportMatches({ clubEventMatches: [{ ...payload, source: 'athlete_game_day' }] });
    expect(m.games).toEqual(fields.sets);
  });

  it('servidor (ranking do clube a partir do jogo cru): vencedor por sets, pontos do total', () => {
    const n = servidor.normalizeClubGame({
      ...jogo,
      side_a: [{ user_id: 'u1' }, { user_id: 'u2' }],
      side_b: [{ user_id: 'u3' }, { user_id: 'u4' }],
    }, new Map());
    expect(n).toMatchObject({ winner: 'b', points_a: 29, points_b: 22 });
  });
});
