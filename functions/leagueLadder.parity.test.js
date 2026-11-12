/**
 * PARIDADE cliente × servidor da ESCADA: tamanhos das quadras, rodadas do
 * Americano na quadra e a escada derivada sessão a sessão — a tela mostra a
 * mesma escada com que o servidor monta a próxima sessão.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import {
  AMERICANO_COURT_ROUNDS, americanoGroupSizes, splitIntoGroups,
} from '@/core/domain/americanoGroups.js';
import {
  LADDER_RULES, LADDER_DEFAULT_ORDER, LADDER_TIEBREAK_KEYS, buildSessionGroups, computeLadder, ladderGroupSizes,
} from '@/modules/leagues/domain/leagueLadder.js';
import { TIEBREAK_CRITERIA } from '@/core/domain/tiebreak.js';

const require = createRequire(import.meta.url);
const s = require('./leagueLadder.js');

/** Gerador reproduzível (mulberry32). */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

describe('paridade da escada', () => {
  it('regras, ordem padrão e critérios (todos existem no desempate do torneio)', () => {
    expect(s.LADDER_RULES).toEqual(JSON.parse(JSON.stringify(LADDER_RULES)));
    expect(s.LADDER_DEFAULT_ORDER).toEqual([...LADDER_DEFAULT_ORDER]);
    expect(s.LADDER_TIEBREAK_KEYS).toEqual([...LADDER_TIEBREAK_KEYS]);
    const conhecidos = TIEBREAK_CRITERIA.map((c) => c.key);
    LADDER_TIEBREAK_KEYS.forEach((k) => expect(conhecidos).toContain(k));
  });

  it('tamanhos das quadras e rodadas do Americano iguais', () => {
    expect(s.AMERICANO_COURT_ROUNDS).toEqual(JSON.parse(JSON.stringify(AMERICANO_COURT_ROUNDS)));
    for (let n = 0; n <= 40; n += 1) {
      expect(s.americanoGroupSizes(n, 4)).toEqual(americanoGroupSizes(n, 4));
      expect(s.splitIntoGroups(n, { sizes: [3, 4, 5], target: 4 })).toEqual(splitIntoGroups(n, { sizes: [3, 4, 5], target: 4 }));
      Object.keys(LADDER_RULES).forEach((f) => expect(s.ladderGroupSizes(f, n)).toEqual(ladderGroupSizes(f, n)));
    }
  });

  it('a escada derivada é a mesma, sessão a sessão (faltas, W.O., inscrição no meio, desistência)', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const r = rng(seed);
      const format = seed % 2 ? 'ladder_individual' : 'ladder_pairs';
      const jogadores = format === 'ladder_pairs' ? 2 : 1;
      let relogio = 1000;
      const entries = [];
      const novo = () => {
        relogio += 10;
        const i = entries.length;
        entries.push({
          id: `e${i}`, name: `E${i}`, status: 'active', created_at: { seconds: relogio, nanoseconds: 0 },
          players: Array.from({ length: jogadores }, () => ({ dupr: r() < 0.3 ? null : Math.round((2.5 + r() * 3) * 1000) / 1000 })),
        });
      };
      const total = 8 + Math.floor(r() * 10);
      for (let i = 0; i < total; i += 1) novo();
      const matches = [];
      const config = { tiebreak_order: r() < 0.5 ? [] : ['balance', 'head_to_head', 'wins'] };
      for (let sessao = 1; sessao <= 5; sessao += 1) {
        if (r() < 0.3) novo();
        if (r() < 0.15) entries[Math.floor(r() * entries.length)].status = 'withdrawn';
        const ordem = s.computeLadder(entries, matches, config).order;
        const presentes = ordem.filter((id) => entries.find((e) => e.id === id).status === 'active' && r() > 0.15);
        const g = buildSessionGroups(format, presentes);
        expect(s.buildSessionGroups(format, presentes)).toEqual(g);
        if (!g.ok) continue;
        relogio += 10;
        s.sessionMatches(format, g.groups).forEach((m, k) => {
          const wo = r() < 0.08;
          const games = wo ? [] : [r() < 0.5 ? { a: 11, b: Math.floor(r() * 10) } : { a: Math.floor(r() * 10), b: 11 }];
          matches.push({
            id: `m${sessao}_${k}`, phase: 'ladder', session: sessao, group: m.group, round: m.round,
            team_a: m.team_a, team_b: m.team_b, games, wo_winner: wo ? (r() < 0.5 ? 'a' : 'b') : null,
            created_at: { seconds: relogio, nanoseconds: 0 },
          });
        });
        // A última sessão às vezes fica sem um placar (em andamento).
        if (sessao === 5 && r() < 0.5) matches[matches.length - 1].games = [];
        const cli = computeLadder(entries, matches, config);
        const srv = s.computeLadder(entries, matches, config);
        expect(srv.order).toEqual(cli.order);
        expect(srv.rows).toEqual(cli.rows);
        expect(srv.pending).toBe(cli.pending);
        expect(JSON.stringify(srv.sessions)).toBe(JSON.stringify(cli.sessions));
      }
    }
  });
});
