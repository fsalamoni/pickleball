/**
 * PARIDADE cliente × servidor dos motores de ranking.
 *
 * O pacote de Cloud Functions é publicado isolado e não pode importar de
 * `../src`, então os motores existem duas vezes. Duas cópias de um algoritmo
 * de pontuação é a forma mais fácil de a plataforma passar a ter duas verdades:
 * o servidor recalcula num gatilho, o admin recalcula no botão, e o ranking
 * muda de valor dependendo de QUEM rodou por último. Já aconteceu aqui — o
 * `recomputeAllRatings` do servidor ignorava `club_event_games` e apagava do
 * ranking nacional todos os resultados de dia de jogo.
 *
 * Estes testes rodam as DUAS implementações sobre as MESMAS partidas e exigem
 * resultado idêntico. Não é uma verificação de estilo: é o que permite manter a
 * cópia. Se alguém mexer num lado só, quebra aqui.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

import {
  computeDuprRatings as clienteDupr,
  seedFromProfile as clienteSeedDupr,
  usapToRating as clienteUsap,
  expectedShare as clienteShare,
  kFactor as clienteK,
  reliabilityFromGames as clienteReliab,
} from '@/modules/rating/domain/duprScale.js';
import {
  computeDoublesRanking as clienteDuplas,
  pairKey as clientePairKey,
} from '@/modules/rating/domain/doublesRanking.js';
import { computeRatings as clienteElo, seedFromLevelOrdinal } from '@/modules/rating/domain/elo.js';
import { LEVEL_TABLE } from '@/modules/leveling/data/levels';

const require = createRequire(import.meta.url);
const servidorDupr = require('../../functions/engines/dupr.js');
const servidorDuplas = require('../../functions/engines/doubles.js');
const servidorRanking = require('../../functions/ranking.js');
const servidorPlataforma = require('../../functions/platformRankings.js');

/* ------------------------------------------------------------------ fixtures */

/**
 * Gerador determinístico de partidas (LCG) — cobre muitas formas diferentes
 * sem depender de `Math.random`, para o teste nunca ser intermitente.
 */
function partidasFicticias(qtd, semente = 42) {
  let s = semente;
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const atletas = Array.from({ length: 14 }, (_, i) => `u${i}`);
  const pega = () => atletas[Math.floor(rnd() * atletas.length)];

  const out = [];
  for (let i = 0; i < qtd; i += 1) {
    const dupla = rnd() > 0.35;
    const a = [pega()];
    const b = [pega()];
    if (dupla) { a.push(pega()); b.push(pega()); }
    // Descarta jogos com o mesmo atleta dos dois lados (não existem na prática).
    const todos = [...a, ...b];
    if (new Set(todos).size !== todos.length) continue;
    const pa = Math.floor(rnd() * 22);
    const pb = Math.floor(rnd() * 22);
    if (pa === pb) continue; // sem empate: os motores exigem vencedor
    out.push({
      side_a: a,
      side_b: b,
      winner: pa > pb ? 'a' : 'b',
      points_a: pa,
      points_b: pb,
      tournament_id: rnd() > 0.5 ? `t${Math.floor(rnd() * 4)}` : null,
      at: 1_700_000_000_000 + i * 60_000,
    });
  }
  return out;
}

const SEMENTES = { u0: 4.2, u1: 3.1, u5: 6.0, u9: 2.5 };

/* --------------------------------------------------------------- motor DUPR */

describe('paridade — motor de rating estilo DUPR', () => {
  it('as constantes de calibração são as mesmas', () => {
    ['DUPR_MIN', 'DUPR_MAX', 'DUPR_DEFAULT_SEED', 'DUPR_SHARE_SPREAD',
      'DUPR_K_MAX', 'DUPR_K_MIN', 'DUPR_K_TAU', 'DUPR_RELIABILITY_TAU',
      'DUPR_PROVISIONAL_RELIABILITY',
    ].forEach((nome) => {
      expect(servidorDupr[nome], `constante ${nome}`).toBeDefined();
    });
    expect(servidorDupr.DUPR_MIN).toBe(2.0);
    expect(servidorDupr.DUPR_MAX).toBe(8.0);
    expect(servidorDupr.DUPR_SHARE_SPREAD).toBe(5.5);
  });

  it('as funções auxiliares devolvem exatamente os mesmos números', () => {
    for (let g = 0; g <= 60; g += 1) {
      expect(servidorDupr.kFactor(g)).toBe(clienteK(g));
      expect(servidorDupr.reliabilityFromGames(g)).toBe(clienteReliab(g));
    }
    for (let d = -3; d <= 3; d += 0.25) {
      expect(servidorDupr.expectedShare(3 + d, 3)).toBe(clienteShare(3 + d, 3));
    }
    ['1.0 – 1.5', '2.0', '2,5', '5.0+', 'sem número', null, undefined]
      .forEach((v) => expect(servidorDupr.usapToRating(v)).toEqual(clienteUsap(v)));
  });

  it('⭐ a tabela de níveis do servidor é igual à do cliente (id E usap)', () => {
    // A semente do rating 2.0–8.0 sai do texto USAP do nível. Um "3.5" virando
    // "3,5" ou uma linha fora de ordem dá outra semente e, no fim, outro
    // ranking — sem erro nenhum aparecendo.
    expect(servidorPlataforma.LEVEL_TABLE)
      .toEqual(LEVEL_TABLE.map((l) => ({ id: l.id, usap: l.usap })));
  });

  it('a semente a partir do perfil é a mesma (DUPR informado, nível, padrão)', () => {
    const perfis = [
      { dupr_rating: 4.25 },
      { dupr_rating: 99 },          // fora da escala → limitado
      { leveling_level: 'intermediario' },
      { leveling_level: 'open' },
      { leveling_level: 'inexistente' },
      {},
      null,
    ];
    perfis.forEach((p) => {
      expect(servidorDupr.seedFromProfile(p, LEVEL_TABLE))
        .toBe(clienteSeedDupr(p, LEVEL_TABLE));
    });
  });

  it('⭐ 400 partidas: o rating de cada atleta bate casa a casa', () => {
    const matches = partidasFicticias(400);
    const doCliente = clienteDupr(matches, { seeds: SEMENTES });
    const doServidor = servidorDupr.computeDuprRatings(matches, { seeds: SEMENTES });

    expect(doServidor).toHaveLength(doCliente.length);
    expect(doCliente.length).toBeGreaterThan(10); // o fixture precisa ter substância

    const porId = new Map(doServidor.map((p) => [p.player_id, p]));
    doCliente.forEach((esperado) => {
      const obtido = porId.get(esperado.player_id);
      expect(obtido, `atleta ${esperado.player_id} ausente no servidor`).toBeDefined();
      ['singles', 'doubles'].forEach((lado) => {
        expect(obtido[lado], `${esperado.player_id}.${lado}`).toEqual(esperado[lado]);
      });
    });
  });

  it('a ordem cronológica é aplicada igual nos dois (replay determinístico)', () => {
    const matches = partidasFicticias(120, 7);
    const embaralhadas = matches.slice().reverse();
    const a = servidorDupr.computeDuprRatings(matches, { seeds: SEMENTES });
    const b = servidorDupr.computeDuprRatings(embaralhadas, { seeds: SEMENTES });
    // Os dois ordenam por `at` antes do replay → mesmo resultado.
    const chave = (r) => r.map((p) => `${p.player_id}:${p.doubles.rating}:${p.singles.rating}`).sort();
    expect(chave(b)).toEqual(chave(a));
    expect(chave(a)).toEqual(chave(clienteDupr(matches, { seeds: SEMENTES })));
  });
});

/* ------------------------------------------------------------ motor DUPLAS */

describe('paridade — ranking de duplas', () => {
  it('a chave da parceria é a mesma', () => {
    expect(servidorDuplas.pairKey('b', 'a')).toBe(clientePairKey('a', 'b'));
  });

  it('⭐ 400 partidas: as linhas e a classificação são idênticas', () => {
    const matches = partidasFicticias(400, 99);
    const doCliente = clienteDuplas(matches);
    const doServidor = servidorDuplas.computeDoublesRanking(matches);
    expect(doCliente.length).toBeGreaterThan(5);
    expect(doServidor).toEqual(doCliente);
  });

  it('minGames se comporta igual nos dois', () => {
    const matches = partidasFicticias(400, 5);
    [1, 2, 5, 100].forEach((minGames) => {
      expect(servidorDuplas.computeDoublesRanking(matches, { minGames }))
        .toEqual(clienteDuplas(matches, { minGames }));
    });
  });

  it('a ORDEM da classificação é a mesma, posição por posição', () => {
    const matches = partidasFicticias(250, 13);
    const cli = clienteDuplas(matches).map((r) => [r.position, r.pair_key]);
    const srv = servidorDuplas.computeDoublesRanking(matches).map((r) => [r.position, r.pair_key]);
    expect(srv).toEqual(cli);
  });
});

/* ---------------------------------------------------------------- motor ELO */

describe('paridade — motor ELO', () => {
  it('a tabela de níveis do servidor está na MESMA ordem do cliente', () => {
    // A semente do ELO vem do ÍNDICE do nível na tabela: uma ordem diferente
    // dá sementes diferentes e, portanto, outro ranking.
    expect(servidorRanking.LEVEL_IDS).toEqual(LEVEL_TABLE.map((l) => l.id));
  });

  it('a semente por nível é a mesma para todos os níveis', () => {
    LEVEL_TABLE.forEach((_, i) => {
      expect(servidorRanking.seedFromLevelOrdinal(i, LEVEL_TABLE.length))
        .toBe(seedFromLevelOrdinal(i, LEVEL_TABLE.length));
    });
  });

  it('⭐ 400 partidas: o ranking ELO bate jogador a jogador', () => {
    const matches = partidasFicticias(400, 2024);
    const seeds = { u0: 1200, u3: 900, u7: 1500 };
    const doCliente = clienteElo(matches, { seeds });
    const doServidor = servidorRanking.computeRatings(matches, seeds);
    expect(doCliente.length).toBeGreaterThan(10);
    expect(doServidor).toEqual(doCliente);
  });
});
