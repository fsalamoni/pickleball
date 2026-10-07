/**
 * Os grupos DENTRO da previsão e da ordem de entrada do Play.
 *
 * O contrato que importa: sem grupos (ou com grupos que ninguém ocupa) a
 * previsão é a de sempre, e com grupos ela é feita pelo MESMO sorteador que o
 * serviço usa para criar a partida.
 */
import { describe, it, expect } from 'vitest';
import {
  simulatePlaySequence, buildPlayEntryOrder, applyPlayEntryOrder, forecastPlayMatchesBalanced,
  forecastPlayByCourtBalanced, drawPlayRoundForFreeCourts, buildPlayHistory,
} from './playRotation.js';
import {
  assignPlayTeams, computePlayOrder, eligibleSwapReplacements, pickSwapReplacement,
} from './gamePlay.js';
import { normalizePlayGroupsConfig } from './playGroups.js';
import { makeGroupsDrawer } from './playGroupsDraw.js';

const cfg = (groups, policy = 'queue') => normalizePlayGroupsConfig({
  play_groups: groups, play_groups_policy: policy,
});
const mk = (id, gid = null, extra = {}) => ({
  id, name: id.toUpperCase(), play_group_id: gid, ...extra,
});
const fila = (g, n = 4) => Array.from({ length: n }, (_, i) => mk(`${g}${i + 1}`, g));
const ids = (b) => b.players.map((p) => p.id);
const drawer = (config, extras = {}) => makeGroupsDrawer(config, extras);

/** Gerador determinístico (mulberry32) para os testes de propriedade. */
function semente(a) {
  return () => {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('simulatePlaySequence com grupos', () => {
  it('cada quadra livre recebe a partida de um grupo, e o bloco diz qual', () => {
    const config = cfg([{ id: 'a', name: 'Alfa', color: 'rose' }, { id: 'b', name: 'Beta' }]);
    const pool = [...fila('a'), ...fila('b')];
    const { blocks } = simulatePlaySequence(pool, { courts: 2, games: [], groups: drawer(config) });
    expect(blocks).toHaveLength(2);
    expect(ids(blocks[0])).toEqual(['a1', 'a2', 'a3', 'a4']);
    expect(blocks[0].group).toEqual({ id: 'a', name: 'Alfa', color: 'rose' });
    expect(ids(blocks[1])).toEqual(['b1', 'b2', 'b3', 'b4']);
    expect(blocks[1].group.id).toBe('b');
  });

  it('o revezamento avança de grupo a cada quadra da MESMA previsão', () => {
    const config = cfg([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }], 'rotate');
    const pool = [...fila('a'), ...fila('b'), ...fila('c')];
    const games = [{ order: 1, group_id: 'a', status: 'finished', court: 1, side_a: [], side_b: [] }];
    const { blocks } = simulatePlaySequence(pool, {
      courts: 3, games, groups: drawer(config, { games }),
    });
    expect(blocks.map((b) => b.group.id)).toEqual(['b', 'c', 'a']);
  });

  it('uma quadra que nenhum grupo preenche não para a previsão das outras', () => {
    const config = cfg([{ id: 'a', name: 'A', courts: [1] }, { id: 'b', name: 'B', courts: [2] }]);
    const pool = fila('b');
    const { blocks } = simulatePlaySequence(pool, { courts: 2, games: [], groups: drawer(config) });
    const q1 = blocks.find((b) => b.court === 1);
    const q2 = blocks.find((b) => b.court === 2);
    expect(q1.full).toBe(false);
    expect(q1.players).toEqual([]);
    expect(q2.full).toBe(true);
    expect(q2.group.id).toBe('b');
  });

  it('quem volta de uma quadra ocupada volta PARA O SEU GRUPO', () => {
    const config = cfg([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]);
    const emQuadra = fila('a');
    const jogo = {
      id: 'g1', status: 'open', court: 1, order: 1, group_id: 'a',
      side_a: [{ id: 'a1' }, { id: 'a2' }], side_b: [{ id: 'a3' }, { id: 'a4' }],
    };
    const { blocks } = simulatePlaySequence([], {
      courts: 1, games: [jogo],
      groups: drawer(config, { games: [jogo], participants: emQuadra }),
    });
    expect(blocks).toHaveLength(1);
    expect(blocks[0].conditional).toBe(true);
    expect(blocks[0].group.id).toBe('a');
    expect(ids(blocks[0]).sort()).toEqual(['a1', 'a2', 'a3', 'a4']);
  });

  it('o grupo escolhido à mão para uma quadra vale na previsão', () => {
    const config = cfg([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], 'priority');
    const pool = [...fila('a'), ...fila('b')];
    const { blocks } = simulatePlaySequence(pool, {
      courts: 2, games: [], groups: drawer(config, { courtGroups: { 1: 'b' } }),
    });
    expect(blocks.find((b) => b.court === 1).group.id).toBe('b');
    expect(blocks.find((b) => b.court === 2).group.id).toBe('a');
  });

  it('quadra de simples leva 2 do grupo', () => {
    const config = cfg([{ id: 'a', name: 'A' }]);
    const { blocks } = simulatePlaySequence(fila('a', 3), {
      courts: 1, games: [], courtKinds: { 1: 'singles' }, groups: drawer(config),
    });
    expect(ids(blocks[0])).toEqual(['a1', 'a2']);
    expect(blocks[0].kind).toBe('singles');
  });

  it('sem grupos, os blocos NÃO ganham o campo `group` (formato antigo intacto)', () => {
    const { blocks } = simulatePlaySequence(fila('a', 4), { courts: 1, games: [] });
    expect('group' in blocks[0]).toBe(false);
  });
});

describe('PROPRIEDADE — grupos que ninguém ocupa = o Play de sempre', () => {
  it('em 200 cenários aleatórios, quem entra em cada quadra é o mesmo', () => {
    const rng = semente(20261007);
    for (let n = 0; n < 200; n += 1) {
      const total = 4 + Math.floor(rng() * 12);
      const courts = 1 + Math.floor(rng() * 3);
      const comRodizio = rng() < 0.5;
      const pool = Array.from({ length: total }, (_, i) => mk(`p${i}`, null, { available_since: i }));
      // algumas duplas fixas e algumas partidas abertas
      if (rng() < 0.5 && total >= 6) {
        pool[1].partner_id = pool[4].id; pool[4].partner_id = pool[1].id;
      }
      const games = [];
      if (rng() < 0.5) {
        games.push({
          id: 'g', status: 'open', court: 1, order: 1,
          side_a: [{ id: 'x1' }, { id: 'x2' }], side_b: [{ id: 'x3' }, { id: 'x4' }],
        });
      }
      const history = comRodizio ? buildPlayHistory([]) : null;
      const base = simulatePlaySequence(pool, { courts, games, history });
      // grupos configurados, mas NINGUÉM com `play_group_id`
      const config = cfg([{ id: 'a', name: 'A' }, { id: 'b', name: 'B', formation: 'mixed' }], n % 2 ? 'rotate' : 'queue');
      const com = simulatePlaySequence(pool, { courts, games, history, groups: drawer(config, { games }) });

      // Só quem entra AGORA, nas quadras livres — que é o que o serviço cria.
      // Sem grupos a simulação PARA na primeira quadra livre que não fecha (a
      // fila acabou) e nem olha as ocupadas; com grupos ela segue, porque a
      // próxima quadra pode ser de outro grupo, e por isso também prevê, de
      // forma CONDICIONAL, quem voltaria de uma quadra ocupada. Essa previsão
      // condicional a mais é informação, não um sorteio diferente.
      const norm = (r) => r.blocks.filter((b) => b.free && b.full).map((b) => ({
        court: b.court, set: ids(b).slice().sort(),
      }));
      expect(norm(com)).toEqual(norm(base));
    }
  });
});

describe('buildPlayEntryOrder / applyPlayEntryOrder com grupos', () => {
  const config = cfg([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], 'priority');

  it('mesmo SEM histórico, a ordem de entrada passa a seguir os grupos', () => {
    // a espera cru põe b1 na frente; a política de prioridade põe o grupo a primeiro
    const pool = [mk('b1', 'b'), mk('b2', 'b'), mk('b3', 'b'), mk('b4', 'b'), ...fila('a')];
    const ordem = buildPlayEntryOrder(pool, { courts: 1, games: [], groups: drawer(config) });
    expect(ordem.slice(0, 4).map((p) => p.id)).toEqual(['a1', 'a2', 'a3', 'a4']);
    expect(ordem.map((p) => p.orderNo)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('sem histórico e sem grupos devolve a fila só renumerada (como antes)', () => {
    const pool = fila('a', 5);
    expect(buildPlayEntryOrder(pool, { courts: 1, games: [] }).map((p) => p.id)).toEqual(pool.map((p) => p.id));
  });

  it('applyPlayEntryOrder: com grupos reescreve a view; sem nada, devolve a MESMA', () => {
    const participants = [mk('b1', 'b', { available_since: 1 }), mk('b2', 'b', { available_since: 2 }),
      mk('b3', 'b', { available_since: 3 }), mk('b4', 'b', { available_since: 4 }),
      ...fila('a').map((p, i) => ({ ...p, available_since: 10 + i }))];
    const view = computePlayOrder({ participants, games: [] });
    expect(applyPlayEntryOrder(view, { courts: 1, games: [] })).toBe(view);
    const nova = applyPlayEntryOrder(view, { courts: 1, games: [], groups: drawer(config) });
    expect(nova).not.toBe(view);
    expect(nova.order[0].id).toBe('a1');
    expect(nova.all.find((p) => p.id === 'a1').orderNo).toBe(1);
  });
});

describe('previsões e sorteio da rodada com grupos', () => {
  const config = cfg([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]);
  const pool = [...fila('a'), ...fila('b')];

  it('forecastPlayMatchesBalanced entrega o grupo de cada bloco', () => {
    const blocks = forecastPlayMatchesBalanced(pool, { courts: 2, games: [], groups: drawer(config) });
    expect(blocks.map((b) => b.group.id)).toEqual(['a', 'b']);
  });

  it('forecastPlayByCourtBalanced preenche as quadras que sobram sem gente, sem grupo', () => {
    const r = forecastPlayByCourtBalanced(fila('a'), { courts: 2, games: [], groups: drawer(config) });
    expect(r).toHaveLength(2);
    expect(r[0].group.id).toBe('a');
    expect(r[1].players).toEqual([]);
    expect(r[1].full).toBe(false);
  });

  it('drawPlayRoundForFreeCourts devolve o grupo de cada quadra — e é a MESMA conta da previsão', () => {
    const groups = drawer(config);
    const rodada = drawPlayRoundForFreeCourts(pool, { courts: 2, games: [], groups });
    const previsao = forecastPlayMatchesBalanced(pool, { courts: 2, games: [], groups: drawer(config) });
    expect(rodada.map((r) => r.groupId)).toEqual(['a', 'b']);
    expect(rodada.map((r) => r.ids)).toEqual(previsao.map(ids));
  });

  it('sem grupos a rodada continua sem o campo groupId', () => {
    const rodada = drawPlayRoundForFreeCourts(fila('a', 8), { courts: 2, games: [] });
    expect(rodada.every((r) => !('groupId' in r))).toBe(true);
  });
});

describe('assignPlayTeams com `pairing` (a formação do grupo)', () => {
  const quatro = [
    { id: 'h1', play_gender: 'male', level_value: 3 }, { id: 'h2', play_gender: 'male', level_value: 3 },
    { id: 'f1', play_gender: 'female', level_value: 3 }, { id: 'f2', play_gender: 'female', level_value: 3 },
  ];
  const rng = () => 0.5;
  const sexoDe = (id) => quatro.find((p) => p.id === id).play_gender;

  it('padrão (e "default"): prefere duplas mistas, como sempre', () => {
    const a = assignPlayTeams(quatro, { rng });
    const b = assignPlayTeams(quatro, { rng, pairing: 'default' });
    expect(b).toEqual(a);
    expect(new Set(a.side_a.map(sexoDe)).size).toBe(2);
    expect(new Set(a.side_b.map(sexoDe)).size).toBe(2);
  });

  it('"mixed" mantém duplas mistas', () => {
    const r = assignPlayTeams(quatro, { rng, pairing: 'mixed' });
    expect(new Set(r.side_a.map(sexoDe)).size).toBe(2);
  });

  it('"same_sex" inverte: cada dupla com o mesmo sexo', () => {
    const r = assignPlayTeams(quatro, { rng, pairing: 'same_sex' });
    expect(new Set(r.side_a.map(sexoDe)).size).toBe(1);
    expect(new Set(r.side_b.map(sexoDe)).size).toBe(1);
  });

  it('"same_sex" com quatro do mesmo sexo continua equilibrando por nível', () => {
    const four = [
      { id: 'a', play_gender: 'male', level_value: 5 }, { id: 'b', play_gender: 'male', level_value: 5.2 },
      { id: 'c', play_gender: 'male', level_value: 3 }, { id: 'd', play_gender: 'male', level_value: 3.1 },
    ];
    const r = assignPlayTeams(four, { rng, pairing: 'same_sex' });
    const nivel = (id) => four.find((p) => p.id === id).level_value;
    const soma = (s) => s.reduce((acc, id) => acc + nivel(id), 0);
    expect(Math.abs(soma(r.side_a) - soma(r.side_b))).toBeLessThan(0.5);
  });

  it('a dupla fixa continua mandando sobre a formação', () => {
    const fixa = [
      { id: 'h1', play_gender: 'male', partner_id: 'f1' }, { id: 'f1', play_gender: 'female', partner_id: 'h1' },
      { id: 'h2', play_gender: 'male' }, { id: 'f2', play_gender: 'female' },
    ];
    const r = assignPlayTeams(fixa, { rng, pairing: 'same_sex' });
    const lado = [r.side_a, r.side_b].find((s) => s.includes('h1'));
    expect(lado).toContain('f1');
  });
});

describe('eligibleSwapReplacements com preferGroupId', () => {
  const fila2 = [
    mk('b1', 'b'), mk('a5', 'a'), mk('b2', 'b'), mk('a6', 'a'),
  ];
  it('sem preferência, a ordem de sempre', () => {
    expect(eligibleSwapReplacements(fila2, {}).map((p) => p.id)).toEqual(['b1', 'a5', 'b2', 'a6']);
  });
  it('com preferência, os do grupo primeiro — cada um na sua ordem de espera', () => {
    expect(eligibleSwapReplacements(fila2, { preferGroupId: 'a' }).map((p) => p.id))
      .toEqual(['a5', 'a6', 'b1', 'b2']);
  });
  it('quem tem dupla esperando continua por último, mesmo sendo do grupo', () => {
    const f = [
      mk('a5', 'a', { partner_id: 'a6' }), mk('a6', 'a', { partner_id: 'a5' }), mk('b1', 'b'), mk('a7', 'a'),
    ];
    expect(eligibleSwapReplacements(f, { preferGroupId: 'a' }).map((p) => p.id))
      .toEqual(['a7', 'b1', 'a5', 'a6']);
  });
  it('pickSwapReplacement continua sendo o primeiro da lista', () => {
    const ctx = { preferGroupId: 'a', inGameIds: ['x'] };
    expect(pickSwapReplacement(fila2, ctx)).toBe(eligibleSwapReplacements(fila2, ctx)[0]);
  });
});
