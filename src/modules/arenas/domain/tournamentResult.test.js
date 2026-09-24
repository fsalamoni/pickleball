import { describe, it, expect } from 'vitest';
import {
  tournamentStandings, applyPodium, suggestedPodium, classificationForLadder, PODIUM_SIZE,
} from './tournamentResult.js';

const p = (id, uid, name) => ({ id, user_id: uid, name });
const jogo = (a, b, sa, sb) => ({
  side_a: a.map((id) => ({ id })), side_b: b.map((id) => ({ id })), score_a: sa, score_b: sb,
});

const participantes = [p('p1', 'u1', 'Ana'), p('p2', 'u2', 'Bia'), p('p3', 'u3', 'Caio'), p('p4', 'u4', 'Duda'), p('p5', 'u5', 'Enzo')];
const jogos = [
  jogo(['p1', 'p2'], ['p3', 'p4'], 11, 5),
  jogo(['p1', 'p3'], ['p2', 'p4'], 11, 9),
];

describe('tournamentStandings — do ranking do dia à classificação', () => {
  const r = tournamentStandings({ participants: participantes, games: jogos, hasScores: true });

  it('⭐ a ordem é a do ranking do dia, com o uid de cada um', () => {
    expect(r[0]).toMatchObject({ user_id: 'u1', position: 1, won: 2, played: 2 });
    expect(r.map((x) => x.user_id).slice(0, 4)).toEqual(['u1', 'u2', 'u3', 'u4']);
  });

  it('quem não jogou nenhuma partida fica sem posição (leva a presença)', () => {
    expect(r.find((x) => x.user_id === 'u5')).toMatchObject({ position: null, played: 0 });
  });

  it('participante sem conta (convidado) não entra — o ladder é de quem tem conta', () => {
    const comConvidado = tournamentStandings({
      participants: [...participantes, { id: 'px', name: 'Convidado' }], games: jogos, hasScores: true,
    });
    expect(comConvidado.some((x) => x.name === 'Convidado')).toBe(false);
  });

  it('sem placar (Play), ninguém tem posição — a arena escolhe o pódio', () => {
    const play = tournamentStandings({ participants: participantes, games: jogos, hasScores: false });
    expect(play.every((x) => x.position === null)).toBe(true);
    expect(play.map((x) => x.name)).toEqual(['Ana', 'Bia', 'Caio', 'Duda', 'Enzo']);
  });

  it('sem dia de jogo carregado, vale o roster do torneio', () => {
    const r2 = tournamentStandings({ roster: [{ user_id: 'u9', name: 'Zé' }], hasScores: true });
    expect(r2).toEqual([{ user_id: 'u9', name: 'Zé', photo_url: null, position: null, won: 0, played: 0 }]);
  });

  it('a mesma pessoa duas vezes no dia de jogo vira uma linha só', () => {
    const dup = tournamentStandings({ participants: [p('p1', 'u1', 'Ana'), p('p1b', 'u1', 'Ana')], hasScores: false });
    expect(dup).toHaveLength(1);
  });
});

describe('pódio', () => {
  const base = tournamentStandings({ participants: participantes, games: jogos, hasScores: true });

  it('⭐ o pódio sugerido são os 4 primeiros do ranking do dia', () => {
    expect(suggestedPodium(base)).toEqual(['u1', 'u2', 'u3', 'u4']);
  });

  it('sem ranking, o pódio sugerido vem vazio (a arena escolhe)', () => {
    const play = tournamentStandings({ participants: participantes, hasScores: false });
    expect(suggestedPodium(play)).toEqual(Array(PODIUM_SIZE).fill(null));
  });

  it('⭐ o pódio escolhido manda; quem ficou de fora leva a presença', () => {
    const r = applyPodium(base, ['u3', 'u1', null, null]);
    expect(r.slice(0, 2).map((x) => [x.user_id, x.position])).toEqual([['u3', 1], ['u1', 2]]);
    expect(r.find((x) => x.user_id === 'u2').position).toBeNull();
  });

  it('a mesma pessoa em duas posições conta só na primeira', () => {
    const r = applyPodium(base, ['u1', 'u1', 'u2']);
    expect(r.find((x) => x.user_id === 'u1').position).toBe(1);
    expect(r.find((x) => x.user_id === 'u2').position).toBe(3);
  });
});

describe('classificationForLadder — o que vai para o ladder', () => {
  it('⭐ mostra os pontos de cada um antes de confirmar (100/70/50/35, presença 10)', () => {
    const r = classificationForLadder(applyPodium(
      tournamentStandings({ participants: participantes, games: jogos, hasScores: true }),
      ['u1', 'u2', 'u3', 'u4'],
    ));
    expect(r.map((x) => x.points)).toEqual([100, 70, 50, 35, 10]);
    expect(r[0]).toMatchObject({ user_id: 'u1', position: 1, won: 2 });
  });
});
