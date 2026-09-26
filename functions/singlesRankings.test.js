/**
 * JOGO SIMPLES de dia de jogo, no servidor (Onda CF).
 *
 * O dia de jogo passou a criar jogo simples, e o espelho em
 * `club_event_games` grava `kind: 'singles'` com UM uid por lado. Estes
 * testes provam que os motores que já existiam levam esse jogo para o lugar
 * certo — sem nenhuma linha nova no servidor:
 *
 *  1. ⭐ entra na normalização (dia de jogo não depende de torneio);
 *  2. ⭐ rating 2.0–8.0: vai para o bloco de SIMPLES, não para o de duplas;
 *  3. ⭐ ranking de duplas: NÃO entra;
 *  4. ELO / ranking nacional: entra (ele sempre juntou simples e duplas);
 *  5. um dia com os dois tipos alimenta cada rating com o seu.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalizeMatches } = require('./platformRankings.js');
const { computeRatings } = require('./ranking.js');
const { computeDuprRatings } = require('./engines/dupr.js');
const { computeDoublesRanking } = require('./engines/doubles.js');

const espelho = (a, b, extra = {}) => ({
  source: 'athlete_game_day', event_id: 'gd1', status: 'finished',
  side_a_ids: a, side_b_ids: b, kind: a.length === 1 ? 'singles' : 'doubles',
  score_a: 11, score_b: 5, winner_side: 'a', created_at: '2026-09-20T12:00:00Z', ...extra,
});

const normalizar = (jogos) => normalizeMatches({
  tournamentMatches: [], clubEventMatches: jogos, regById: new Map(), eligibleTournamentIds: new Set(),
});

describe('⭐ o jogo simples de dia de jogo, no servidor', () => {
  it('entra na normalização com um uid por lado', () => {
    const [m] = normalizar([espelho(['u1'], ['u2'])]);
    expect(m.side_a).toEqual(['u1']);
    expect(m.side_b).toEqual(['u2']);
    expect(m.winner).toBe('a');
  });

  it('⭐ rating 2.0–8.0: vai para SIMPLES, e duplas fica intocado', () => {
    const r = computeDuprRatings(normalizar([espelho(['u1'], ['u2'])]), { seeds: {} });
    const u1 = r.find((p) => p.player_id === 'u1');
    expect(u1.singles.games).toBe(1);
    expect(u1.singles.wins).toBe(1);
    expect(u1.doubles.games).toBe(0);
  });

  it('⭐ ranking de duplas: o simples NÃO entra', () => {
    expect(computeDoublesRanking(normalizar([espelho(['u1'], ['u2'])]))).toEqual([]);
  });

  it('ELO / ranking nacional: o simples entra, como sempre entrou o de torneio', () => {
    const r = computeRatings(normalizar([espelho(['u1'], ['u2'])]), {});
    expect(r.map((p) => p.player_id).sort()).toEqual(['u1', 'u2']);
  });

  it('⭐ um dia com os dois tipos alimenta cada rating com o seu', () => {
    const jogos = normalizar([
      espelho(['u1', 'u2'], ['u3', 'u4']),
      espelho(['u1'], ['u5']),
    ]);
    const u1 = computeDuprRatings(jogos, { seeds: {} }).find((p) => p.player_id === 'u1');
    expect(u1.doubles.games).toBe(1);
    expect(u1.singles.games).toBe(1);
    const duplas = computeDoublesRanking(jogos);
    expect(duplas).toHaveLength(2);
    expect(duplas.every((d) => d.games === 1)).toBe(true);
  });
});
