import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { leagueSeasonsOfPlayer, leagueUpcomingOfPlayer } from './leagueActivity.js';

const dupla = (id, uids, extra = {}) => ({
  id, name: `Dupla ${id}`, division_id: 'd1', status: 'active', player_uids: uids.filter(Boolean),
  players: uids.map((uid, i) => ({ uid, name: `${id} ${'AB'[i]}` })), ...extra,
});
const ENTRIES = [dupla('e1', ['eu', 'par']), dupla('e2', ['x', 'y']), dupla('e3', ['z', null])];
const LIGA = {
  id: 'l1', name: 'Liga de Outono', status: 'running', format: 'doubles_round_robin', city: 'Porto Alegre', state: 'RS',
  season: { start_date: '2026-11-02', round_days: 7, play_time: '19:30' },
};
const marcado = (id, a, b, extra = {}) => ({ id, division_id: 'd1', phase: 'season', round: 1, side_a: a, side_b: b, games: [], status: 'scheduled', ...extra });
const feito = (id, a, b, vence, quando) => ({
  ...marcado(id, a, b), games: [vence === 'a' ? { a: 11, b: 4 } : { a: 4, b: 11 }], status: 'done', recorded_at: Timestamp.fromMillis(quando),
});

describe('jogos de liga que ainda vêm ("Próximos")', () => {
  it('⭐ só o jogo SEM placar, com a dupla, o adversário e a data da rodada', () => {
    const jogos = [marcado('m1', 'e1', 'e2'), feito('m0', 'e3', 'e1', 'b', 1), marcado('m2', 'e3', 'e1', { round: 2 })];
    const prox = leagueUpcomingOfPlayer('eu', LIGA, ENTRIES, jogos);
    expect(prox.map((j) => j.matchId)).toEqual(['m1', 'm2']);
    expect(prox[0]).toMatchObject({
      id: 'lg_l1_m1', leagueId: 'l1', leagueName: 'Liga de Outono', round: 1, date: '2026-11-02', time: '19:30', partner: 'e1 B', opponent: 'e2 A / e2 B', team: '',
    });
    expect(prox[1].date > prox[0].date).toBe(true);
  });

  it('a data marcada no jogo vence a da rodada; playoff sem data fica "a combinar" e por último', () => {
    const jogos = [
      marcado('po', 'e1', 'e2', { phase: 'playoff', round: 1 }),
      marcado('m1', 'e1', 'e3', { scheduled_date: '2026-12-01' }),
    ];
    const prox = leagueUpcomingOfPlayer('eu', LIGA, ENTRIES, jogos);
    expect(prox.map((j) => [j.matchId, j.date])).toEqual([['m1', '2026-12-01'], ['po', null]]);
  });

  it('liga encerrada, rascunho ou cancelada não tem próximo jogo; quem saiu também não', () => {
    const jogos = [marcado('m1', 'e1', 'e2')];
    ['finished', 'draft', 'cancelled'].forEach((status) => {
      expect(leagueUpcomingOfPlayer('eu', { ...LIGA, status }, ENTRIES, jogos)).toEqual([]);
    });
    const sai = ENTRIES.map((e) => (e.id === 'e1' ? { ...e, status: 'withdrawn' } : e));
    expect(leagueUpcomingOfPlayer('eu', LIGA, sai, jogos)).toEqual([]);
    expect(leagueUpcomingOfPlayer('', LIGA, ENTRIES, jogos)).toEqual([]);
  });

  it('jogo contra quem saiu da liga não vai acontecer: fica de fora', () => {
    const sai = ENTRIES.map((e) => (e.id === 'e2' ? { ...e, status: 'withdrawn' } : e));
    expect(leagueUpcomingOfPlayer('eu', LIGA, sai, [marcado('m1', 'e1', 'e2'), marcado('m2', 'e1', 'e3')]).map((j) => j.matchId)).toEqual(['m2']);
  });

  it('nas equipes o meu lado é a equipe', () => {
    const liga = { ...LIGA, format: 'team_milp' };
    const [j] = leagueUpcomingOfPlayer('eu', liga, ENTRIES, [marcado('m1', 'e1', 'e2')]);
    expect(j).toMatchObject({ team: 'Dupla e1', partner: '', opponent: 'Dupla e2' });
  });
});

describe('a participação na liga (linha do tempo da Carreira)', () => {
  const DIVS = [{ id: 'd1', name: 'Ouro' }, { id: 'd2', name: 'Prata' }];
  const jogos = [feito('a', 'e1', 'e2', 'a', 1_000), feito('b', 'e3', 'e1', 'a', 5_000), marcado('c', 'e1', 'e3')];

  it('⭐ uma por inscrição, com a divisão, o começo e a campanha', () => {
    const [s] = leagueSeasonsOfPlayer('eu', LIGA, DIVS, ENTRIES, jogos);
    expect(s).toMatchObject({
      id: 'l1:e1', leagueId: 'l1', divisionId: 'd1', name: 'Liga de Outono', divisionName: 'Ouro', status: 'running', withdrawn: false,
      startDate: '2026-11-02', endedAt: null, city: 'Porto Alegre', state: 'RS', wins: 1, losses: 1,
    });
  });

  it('encerrada: o fim é o último placar lançado; uma divisão só não repete o nome', () => {
    const [s] = leagueSeasonsOfPlayer('eu', { ...LIGA, status: 'finished' }, [DIVS[0]], ENTRIES, jogos);
    expect(s).toMatchObject({ status: 'finished', endedAt: 5_000, divisionName: '' });
  });

  it('rascunho e cancelada não entram; quem saiu sem jogar não tem história, quem jogou e saiu tem', () => {
    expect(leagueSeasonsOfPlayer('eu', { ...LIGA, status: 'draft' }, DIVS, ENTRIES, jogos)).toEqual([]);
    expect(leagueSeasonsOfPlayer('eu', { ...LIGA, status: 'cancelled' }, DIVS, ENTRIES, jogos)).toEqual([]);
    const sai = ENTRIES.map((e) => (e.id === 'e1' ? { ...e, status: 'withdrawn' } : e));
    expect(leagueSeasonsOfPlayer('eu', LIGA, DIVS, sai, [])).toEqual([]);
    expect(leagueSeasonsOfPlayer('eu', LIGA, DIVS, sai, jogos)[0]).toMatchObject({ withdrawn: true, wins: 1, losses: 1 });
  });
});
