import { describe, expect, it } from 'vitest';
import { modalityPodium, registrationAllPeople } from './podium.js';

const jogo = (id, round, a, b, winner, extra = {}, position = 1) => ({
  id, round, position, stage_index: 0, stage_type: 'knockout', status: 'finished',
  side_a_ids: [a], side_b_ids: [b], side_a: a, side_b: b, winner_side: winner, score_a: winner === 'a' ? 11 : 5, score_b: winner === 'b' ? 11 : 5,
  ...extra,
});
const modality = { id: 'm1', stages: [{ type: 'knockout' }] };
const comTerceiro = { id: 'm1', stages: [{ type: 'knockout', third_place: true }] };
const regs = [
  { id: 'r1', player_a_name: 'Ana', player_a_user_id: 'ua', player_b_name: 'Bia', player_b_user_id: 'ub' },
  { id: 'r2', player_a_name: 'Caio', player_a_user_id: 'uc', player_b_name: 'Dudu' },
  { id: 'r3', player_a_name: 'Eva', player_a_user_id: 'ue' },
  { id: 'r4', player_a_name: 'Fê', player_a_user_id: 'uf' },
];

describe('modalityPodium', () => {
  it('mata-mata: campeão pela final, vice quem perdeu, 3º pela disputa', () => {
    const matches = [
      jogo('s1', 1, 'r1', 'r3', 'a'), jogo('s2', 1, 'r2', 'r4', 'a', {}, 2),
      jogo('f', 2, 'r1', 'r2', 'a'), jogo('t', 2, 'r3', 'r4', 'b', { third_place: true }, 2),
    ];
    const p = modalityPodium({ modality: comTerceiro, matches, registrations: regs });
    expect(p.complete).toBe(true);
    expect(p.places.map((x) => [x.position, x.entries.map((e) => e.registrationId)])).toEqual([[1, ['r1']], [2, ['r2']], [3, ['r4']]]);
    expect(p.places[0].label).toBe('Campeões');
    expect(p.places[2].label).toBe('3º lugar');
    expect(p.places[0].entries[0].people.map((x) => x.name)).toEqual(['Ana', 'Bia']);
  });

  it('sem disputa de 3º os dois semifinalistas dividem o degrau; quem não tem conta aparece no cartão', () => {
    const matches = [jogo('s1', 1, 'r1', 'r3', 'a'), jogo('s2', 1, 'r2', 'r4', 'a', {}, 2), jogo('f', 2, 'r1', 'r2', 'b')];
    const p = modalityPodium({ modality, matches, registrations: regs });
    expect(p.places.find((x) => x.position === 3).entries.map((e) => e.registrationId)).toEqual(['r3', 'r4']);
    expect(p.places.find((x) => x.position === 1).entries[0].people).toEqual([
      { user_id: 'uc', name: 'Caio', photo_url: null }, { user_id: null, name: 'Dudu', photo_url: null },
    ]);
  });

  it('final sem resultado: ninguém é campeão', () => {
    const matches = [jogo('s1', 1, 'r1', 'r3', 'a'), { id: 'f', round: 2, stage_index: 0, stage_type: 'knockout', status: 'scheduled', side_a_ids: ['r1'], side_b_ids: ['r2'] }];
    const p = modalityPodium({ modality, matches, registrations: regs });
    expect(p.complete).toBe(false);
  });

  it('registrationAllPeople: equipe lista o elenco inteiro', () => {
    expect(registrationAllPeople({ kind: 'team', members: [{ name: 'A' }, { name: 'B', user_id: 'x' }] }).map((p) => p.name)).toEqual(['A', 'B']);
  });
});
