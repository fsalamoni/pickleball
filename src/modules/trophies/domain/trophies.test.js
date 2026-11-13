import { describe, expect, it } from 'vitest';
import * as trofeus from './trophies.js';
import { groupTrophies, leagueTrophies, tournamentTrophies, trophyContextId, TROPHY_KIND } from './trophies.js';

const jogo = (id, round, a, b, winner, position = 1, extra = {}) => ({
  id, round, position, stage_index: 0, stage_type: 'knockout', status: 'finished', modality_id: 'm1',
  side_a_ids: [a], side_b_ids: [b], winner_side: winner, score_a: winner === 'a' ? 11 : 5, score_b: winner === 'b' ? 11 : 5, ...extra,
});

describe('tournamentTrophies', () => {
  const regs = [
    { id: 'r1', tournament_id: 't1', modality_id: 'm1', player_a_name: 'Ana', player_a_user_id: 'ua', player_b_name: 'Bia', player_b_user_id: 'ub' },
    { id: 'r2', tournament_id: 't1', modality_id: 'm1', player_a_name: 'Caio', player_a_user_id: 'uc' },
    { id: 'r3', tournament_id: 't1', modality_id: 'm1', player_a_name: 'Eva', player_a_user_id: 'ue' },
    { id: 'r4', tournament_id: 't1', modality_id: 'm1', player_a_name: 'Fê', player_a_user_id: 'uf' },
  ];
  const matches = [jogo('s1', 1, 'r1', 'r3', 'a'), jogo('s2', 1, 'r2', 'r4', 'a', 2), jogo('f', 2, 'r1', 'r2', 'a')];
  const ctx = (status = 'finished') => ({
    registrations: regs.filter((r) => r.id === 'r1' || r.id === 'r3'),
    tournamentById: new Map([['t1', { id: 't1', name: 'Open', status, starts_at: '2026-10-10', arena_id: 'ar1' }]]),
    modalityById: new Map([['m1', { id: 'm1', name: 'Mistas', stages: [{ type: 'knockout' }] }]]),
    matchesByModality: new Map([['m1', matches]]),
    registrationsByModality: new Map([['m1', regs]]),
  });

  it('a pessoa leva o troféu da inscrição dela, com a dupla, só em torneio encerrado', () => {
    const t = tournamentTrophies('ua', ctx());
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ kind: 'torneio', position: 1, placeLabel: 'Campeões', title: 'Open', subtitle: 'Mistas', arenaId: 'ar1' });
    expect(t[0].people.map((p) => p.name)).toEqual(['Ana', 'Bia']);
    expect(trophyContextId(t[0])).toBe('trofeu:t1:m1:1');
    expect(tournamentTrophies('ua', ctx('in_progress'))).toEqual([]);
  });

  it('3º dividido: cada semifinalista perde a final e leva bronze marcado como dividido', () => {
    const t = tournamentTrophies('ue', ctx());
    expect(t[0]).toMatchObject({ position: 3, shared: true });
  });
});

describe('dia de jogo não é torneio', () => {
  it('⭐ não tem troféu nem medalha (decisão do dono, 2026-11-05)', () => {
    expect(Object.values(TROPHY_KIND)).toEqual(['torneio', 'liga']);
    expect(trofeus.gameDayTrophies).toBeUndefined();
  });
});

describe('groupTrophies', () => {
  it('conta por metal e marca a fonte que faltou sem virar zero', () => {
    const g = groupTrophies({ torneios: [{ position: 1, date: 2 }, { position: 3, date: 1 }], ligas: [{ position: 3, date: 9 }] });
    expect(g.contagem).toMatchObject({ ouro: 1, prata: 0, bronze: 2, total: 3 });
    expect(g.ligas).toHaveLength(1);
    expect(g.faltou).toEqual([]);
    expect(g.destaque.position).toBe(1);
    const falhou = groupTrophies({ torneios: undefined, ligas: [] });
    expect(falhou.faltou).toEqual(['os torneios']);
    expect(groupTrophies({ torneios: [], ligas: undefined }).faltou).toEqual(['as ligas']);
    expect(falhou.contagem.total).toBe(0);
  });
});

describe('leagueTrophies', () => {
  const dupla = (id) => ({
    id, name: `Dupla ${id}`, division_id: 'd1', status: 'active', players: [{ uid: `${id}-a`, name: `${id} A` }, { uid: `${id}-b`, name: `${id} B` }],
  });
  const jogo = (a, b, quando) => ({
    id: `${a}x${b}`, division_id: 'd1', phase: 'season', side_a: a, side_b: b, games: [{ a: 11, b: 5 }], status: 'done', recorded_at: quando,
  });
  const entries = ['e1', 'e2', 'e3', 'e4'].map(dupla);
  // e1 vence todos; e2 vence e3 e e4; e3 vence e4.
  const matches = [jogo('e1', 'e2', 10), jogo('e1', 'e3', 20), jogo('e1', 'e4', 30), jogo('e2', 'e3', 40), jogo('e2', 'e4', 50), jogo('e3', 'e4', 60)];
  const fonte = (status = 'finished', nome = 'Ouro') => [{
    league: { id: 'l1', name: 'Liga de Outono', status, format: 'doubles_round_robin', season: {}, city: 'Porto Alegre', state: 'RS' },
    division: { id: 'd1', name: nome }, entries, matches,
  }];

  it('⭐ os três primeiros da divisão levam o troféu, a dupla inteira, só com a liga encerrada', () => {
    const [tr] = leagueTrophies('e2-b', fonte());
    expect(tr).toMatchObject({
      id: 'l:l1:d1:2', kind: 'liga', position: 2, placeLabel: 'Vice-campeões', title: 'Liga de Outono', subtitle: 'Ouro', date: 60,
      link: '/ligas/l1', publicLink: null, leagueId: 'l1', divisionId: 'd1', shared: false,
    });
    expect(tr.people.map((p) => p.user_id)).toEqual(['e2-a', 'e2-b']);
    expect(trophyContextId(tr)).toBe('trofeu:liga:l1:d1:2');
    expect(leagueTrophies('e3-a', fonte())[0].position).toBe(3);
    expect(leagueTrophies('e2-b', fonte('running'))).toEqual([]);
  });

  it('o 4º não leva troféu; liga de uma divisão só usa "Liga" no lugar do nome dela', () => {
    expect(leagueTrophies('e4-a', fonte())).toEqual([]);
    expect(leagueTrophies('e1-a', fonte('finished', ''))[0]).toMatchObject({ position: 1, placeLabel: 'Campeões', subtitle: 'Liga' });
  });
});
