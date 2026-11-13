/**
 * LIGAS NO RANKING E NO DUPR: os jogos que valem, com as regras do torneio.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  isLeagueRankingEligible, leagueDuprBucket, leagueMatchGames, leagueMatchChanged, loadLeagueGames, LEAGUE_FORA,
} = require('./leagueRanking.js');
const { normalizeMatches } = require('./platformRankings.js');
const { buildCandidates } = require('./duprSubmissions.js');
const { DUPR_BUCKET } = require('./duprPolicy.js');
const { createFakeDb } = require('../tests/fakes/fakeFirestore.cjs');

const entradas = new Map([
  ['e1', { player_uids: ['ana', 'bia'] }],
  ['e2', { player_uids: ['cau', 'duda'] }],
  ['e3', { player_uids: ['edu', null] }],
  ['t1', { player_uids: ['ana', 'bia', 'cau', 'duda'] }],
  ['t2', { player_uids: ['edu', 'fred', 'gil', 'hel'] }],
  ['i1', { player_uids: ['ana'] }], ['i2', { player_uids: ['bia'] }], ['i3', { player_uids: ['cau'] }], ['i4', { player_uids: ['duda'] }],
]);
const duplas = { id: 'L1', format: 'divisional_pairs', status: 'running' };
const equipes = { id: 'L2', format: 'team_milp', status: 'running' };

describe('quais ligas e jogos valem', () => {
  it('a liga vale fora do rascunho e do cancelamento, como o torneio', () => {
    expect(['draft', 'open', 'running', 'finished', 'cancelled'].map((status) => isLeagueRankingEligible({ status })))
      .toEqual([false, true, true, true, false]);
    expect(isLeagueRankingEligible(null)).toBe(false);
  });

  it('duplas: o jogo decidido vale; placar a confirmar e lado sem conta não', () => {
    const jogo = { id: 'm1', status: 'done', side_a: 'e1', side_b: 'e2', games: [{ a: 11, b: 7 }, { a: 8, b: 11 }, { a: 11, b: 9 }] };
    expect(leagueMatchGames(duplas, jogo, entradas).jogos).toEqual([
      { key: 'm1', side_a: ['ana', 'bia'], side_b: ['cau', 'duda'], winner: 'a', games: jogo.games, wo: false, line: null },
    ]);
    expect(leagueMatchGames(duplas, { ...jogo, status: 'reported' }, entradas)).toEqual({ jogos: [], fora: [] });
    expect(leagueMatchGames(duplas, { ...jogo, side_b: 'e3' }, entradas).fora).toEqual([LEAGUE_FORA.SEM_CONTA]);
  });

  it('W.O. vale no ranking sem pontos (marcado para não ir ao DUPR)', () => {
    const r = leagueMatchGames(duplas, { id: 'm2', status: 'done', side_a: 'e1', side_b: 'e2', games: [], wo_winner: 'b' }, entradas);
    expect(r.jogos[0]).toMatchObject({ winner: 'b', wo: true, games: [] });
  });

  it('escada individual: os quatro da quadra pelas inscrições de cada lado', () => {
    const r = leagueMatchGames({ format: 'ladder_individual' }, { id: 'm3', status: 'done', phase: 'ladder', team_a: ['i1', 'i3'], team_b: ['i2', 'i4'], games: [{ a: 9, b: 11 }] }, entradas);
    expect(r.jogos[0]).toMatchObject({ side_a: ['ana', 'cau'], side_b: ['bia', 'duda'], winner: 'b' });
  });

  it('equipes: uma partida por linha COM escalação; o resto fica dito', () => {
    const jogo = {
      id: 'm4', status: 'done', side_a: 't1', side_b: 't2',
      games: [{ a: 21, b: 15 }, { a: 18, b: 21 }, { a: 21, b: 19 }, { a: 12, b: 21 }], dreambreaker: { a: 21, b: 17 },
      lineups: [{ a: ['ana', 'bia'], b: ['edu', 'fred'] }, null, { a: ['ana', 'gil'], b: ['edu', 'fred'] }, { a: ['cau', 'duda'], b: ['gil', 'hel'] }],
    };
    const r = leagueMatchGames(equipes, jogo, entradas);
    expect(r.jogos.map((j) => [j.key, j.winner, j.line])).toEqual([['m4_1', 'a', 0], ['m4_4', 'b', 3]]);
    // Linha 2 sem escalação e linha 3 com atleta de fora da equipe.
    expect(r.fora).toEqual([LEAGUE_FORA.SEM_ESCALACAO, LEAGUE_FORA.SEM_ESCALACAO]);
    expect(leagueMatchGames(equipes, { ...jogo, wo_winner: 'a', games: [] }, entradas)).toEqual({ jogos: [], fora: [] });
  });

  it('o grupo do DUPR é o do torneio', () => {
    expect(leagueDuprBucket('divisional_pairs')).toBe(DUPR_BUCKET.TOURNAMENT_FIXED);
    expect(leagueDuprBucket('ladder_pairs')).toBe(DUPR_BUCKET.TOURNAMENT_FIXED);
    expect(leagueDuprBucket('ladder_individual')).toBe(DUPR_BUCKET.TOURNAMENT_ROTATION);
    expect(leagueDuprBucket('team_milp_v3')).toBe(DUPR_BUCKET.TOURNAMENT_TEAM);
  });

  it('o gatilho só recalcula quando um resultado que vale mudou', () => {
    const feito = { status: 'done', games: [{ a: 11, b: 3 }] };
    expect(leagueMatchChanged({ status: 'scheduled' }, { status: 'reported', games: [{ a: 11, b: 3 }] })).toBe(false);
    expect(leagueMatchChanged({ status: 'reported' }, feito)).toBe(true);
    expect(leagueMatchChanged(feito, { ...feito, court: '2', updated_at: 5 })).toBe(false);
    expect(leagueMatchChanged(feito, { ...feito, games: [{ a: 11, b: 5 }] })).toBe(true);
    expect(leagueMatchChanged(feito, null)).toBe(true);
  });
});

describe('ranking e DUPR leem a liga', () => {
  function banco() {
    return createFakeDb({
      'leagues/L1': { name: 'Liga Sol', format: 'divisional_pairs', status: 'running', creator_uid: 'ana', city: 'Porto Alegre', state: 'RS', dupr_submit: null },
      'leagues/L1/divisions/d1': { name: 'Série A' },
      'leagues/L1/entries/e1': { player_uids: ['ana', 'bia'] },
      'leagues/L1/entries/e2': { player_uids: ['cau', 'duda'] },
      'leagues/L1/matches/m1': { status: 'done', division_id: 'd1', side_a: 'e1', side_b: 'e2', games: [{ a: 11, b: 7 }], scheduled_date: '2026-11-10' },
      'leagues/L1/matches/m2': { status: 'reported', division_id: 'd1', side_a: 'e2', side_b: 'e1', games: [{ a: 11, b: 2 }] },
      'leagues/L9': { name: 'Cancelada', format: 'divisional_pairs', status: 'cancelled' },
      'leagues/L9/entries/e1': { player_uids: ['ana', 'bia'] },
      'leagues/L9/entries/e2': { player_uids: ['cau', 'duda'] },
      'leagues/L9/matches/m1': { status: 'done', side_a: 'e1', side_b: 'e2', games: [{ a: 11, b: 0 }] },
    });
  }

  it('só a liga que vale, só o jogo decidido', async () => {
    const r = await loadLeagueGames(banco());
    expect(r).toMatchObject({ leagues: 1, lidos: 1, fora: [], signature: 'L1:running' });
    expect(r.games).toHaveLength(1);
    expect(r.games[0]).toMatchObject({ key: 'm1', match_id: 'm1', division_name: 'Série A', played_date: '2026-11-10' });
  });

  it('o recálculo soma a liga aos jogos e ao relatório', async () => {
    const league = await loadLeagueGames(banco());
    const report = { torneio: { lidas: 0, usadas: 0, por_motivo: {}, torneio_fora: {} }, dia_de_jogo: { lidas: 0, usadas: 0, por_motivo: {} }, liga: { lidas: 0, usadas: 0, por_motivo: {} }, sem_placar: 0, torneios: [] };
    const jogos = normalizeMatches({ tournamentMatches: [], clubEventMatches: [], regById: new Map(), eligibleTournamentIds: new Set(), report, league });
    expect(jogos).toEqual([expect.objectContaining({ side_a: ['ana', 'bia'], side_b: ['cau', 'duda'], winner: 'a', points_a: 11, points_b: 7, league_id: 'L1', source: 'league', tournament_id: null })]);
    expect(report.liga).toEqual({ lidas: 1, usadas: 1, por_motivo: {} });
  });

  it('o DUPR recebe o jogo de liga como de torneio, com a data jogada', async () => {
    const league = await loadLeagueGames(banco());
    const [c] = buildCandidates({ leagueGames: league.games });
    expect(c).toMatchObject({
      identifier: 'pr:lg:L1_m1', ref: 'leagues/L1/matches/m1', origin: 'league', bucket: DUPR_BUCKET.TOURNAMENT_FIXED,
      creatorChoice: null, date: '2026-11-10', event: 'Liga Sol', bracket: 'Série A', playType: 'TOURNAMENT', grace: true,
      league_id: 'L1', organizer_uid: 'ana', location: 'Porto Alegre, RS',
    });
    expect(buildCandidates({ leagueGames: [{ ...league.games[0], wo: true }] })).toEqual([]);
  });
});
