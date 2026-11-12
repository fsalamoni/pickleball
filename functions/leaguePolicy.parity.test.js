/**
 * PARIDADE cliente × servidor das LIGAS: formatos, flag de cada grupo,
 * situações, temporada, regra e faixa da divisão e placar — a tela e o
 * servidor aplicam a mesma régua.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { LEAGUE_FORMAT_META, LEAGUE_STATUS_NEXT } from '@/modules/leagues/domain/leagueFormats.js';
import { LEAGUE_FLAG_BY_ORGANIZER } from '@/modules/leagues/domain/leagueAccess.js';
import { normalizeSeason, roundsFor } from '@/modules/leagues/domain/leagueSeason.js';
import { normalizeDivisionRule, divisionEligibility, DIVISION_GENDER } from '@/modules/leagues/domain/leagueDivisions.js';
import { validateResult, MAX_GAMES } from '@/modules/leagues/domain/leagueResults.js';

const require = createRequire(import.meta.url);
const s = require('./leaguePolicy.js');

describe('paridade das ligas', () => {
  it('formatos: inscrição, atletas e disponibilidade iguais', () => {
    const cliente = Object.fromEntries(Object.entries(LEAGUE_FORMAT_META)
      .map(([id, m]) => [id, { entry: m.entry, players: m.players, available: m.available }]));
    expect(s.FORMATS).toEqual(cliente);
  });

  it('flag por grupo, situações, gêneros e limite de games', () => {
    expect(s.ORGANIZER_FLAG).toEqual(LEAGUE_FLAG_BY_ORGANIZER);
    expect(s.STATUS_NEXT).toEqual(LEAGUE_STATUS_NEXT);
    expect(s.GENDERS).toEqual(Object.values(DIVISION_GENDER));
    expect(s.MAX_GAMES).toBe(MAX_GAMES);
  });

  it('temporada normalizada igual', () => {
    const casos = [
      undefined, {}, { start_date: '2026-03-03', cadence: 'biweekly', skip_dates: ['2026-03-17', 'x'], legs: 2 },
      { cadence: 'custom', custom_dates: ['2026-05-02', '2026-04-01', '2026-04-01'], round_window_days: 40 },
      { start_date: '2026-02-30', play_time: '19:30', playoff: { enabled: true, size: 8, third_place: true } },
      { cadence: 'monthly', play_time: '25:00', playoff: { size: '2' } },
    ];
    casos.forEach((c) => expect(s.normalizeSeason(c)).toEqual(normalizeSeason(c)));
  });

  it('regra, faixa e soma da divisão iguais', () => {
    const divs = [
      {}, { rule: { kind: 'x' } }, { rule: { kind: 'dupr_range', min: 4, max: 3.5 } },
      { rule: { kind: 'dupr_range', min: 3.5, allow_unrated: false } },
      { rule: { kind: 'dupr_sum', cap: 16.3, individual_cap: 4.6, unrated_value: 4 } },
      { gender: 'mixed' }, { gender: 'female', rule: { kind: 'dupr_range', max: 4 } },
    ];
    const elencos = [
      [{ dupr: 3.6, gender: 'male' }, { dupr: 4.2, gender: 'female' }],
      [{ dupr: null, gender: 'female' }, { dupr: 3.9, gender: 'female' }],
      [{ dupr: 4.7 }, { dupr: 3 }, { dupr: 3 }, { dupr: null }],
      [{ dupr: 4.5, gender: null }],
      [],
    ];
    divs.forEach((d) => {
      expect(s.normalizeDivisionRule(d.rule)).toEqual(normalizeDivisionRule(d.rule));
      elencos.forEach((e) => expect(s.divisionEligibility(d, e)).toEqual(divisionEligibility(d, e)));
    });
  });

  it('placar validado igual', () => {
    const casos = [
      {}, { wo_winner: 'a' }, { wo_winner: 'x', games: [{ a: 11, b: 3 }] },
      { games: [{ a: 11, b: 11 }] }, { games: [{ a: 11, b: 5 }, { a: 3, b: 11 }] },
      { games: [{ a: 11, b: 5 }, { a: 3, b: 11 }, { a: 15, b: 13 }] }, { games: [{ a: '7', b: 1.5 }] },
      { games: Array.from({ length: 6 }, () => ({ a: 11, b: 0 })) },
    ];
    casos.forEach((c) => expect(s.validateResult(c)).toEqual(validateResult(c)));
  });

  it('pontos corridos: todos se enfrentam uma vez por turno, sem jogo duplicado na rodada', () => {
    [2, 5, 8].forEach((n) => {
      const ids = Array.from({ length: n }, (_, i) => `e${i}`);
      const jogos = s.roundRobin(ids, 2);
      const pares = new Map();
      jogos.forEach((j) => {
        const k = [j.side_a, j.side_b].sort().join('-');
        pares.set(k, (pares.get(k) || 0) + 1);
      });
      expect(pares.size).toBe((n * (n - 1)) / 2);
      expect(Math.max(...jogos.map((j) => j.round))).toBe(roundsFor(n, 2));
      expect([...pares.values()].every((v) => v === 2)).toBe(true);
      const porRodada = new Map();
      jogos.forEach((j) => {
        const set = porRodada.get(j.round) || new Set();
        expect(set.has(j.side_a) || set.has(j.side_b)).toBe(false);
        set.add(j.side_a); set.add(j.side_b);
        porRodada.set(j.round, set);
      });
    });
  });
});
