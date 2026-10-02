/**
 * Paridade cliente × servidor da gamificação.
 *
 * O pacote de Functions é publicado ISOLADO (não importa de `../src`), então as
 * poucas regras que os dois lados precisam dizer igual são cópias. Cópia que
 * diverge em silêncio é o pior defeito deste tipo: a tela mostra a semana de
 * uma forma e o servidor fecha o duelo noutra; a nota que a pessoa vê não é a
 * que o servidor publica. Este teste roda as DUAS implementações sobre as mesmas
 * entradas e exige o mesmo resultado — mexer num lado só quebra a CI.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  platformWeekKey, platformMonthKey, scopeWindowBR, dayStartMs, missionDateKey,
} from './missionDay.js';
import { aggregateReviews, suspiciousPairs, REVIEW_TAGS } from './matchReviews.js';
import { rankEntries } from './challenges.js';
import { XP_WEIGHTS_V2 } from './progressionV2.js';
import { TIER_NAMES } from './tiers.js';
import { ONBOARDING_STEPS } from './onboarding.js';

const requerer = createRequire(import.meta.url);
const core = requerer('../../../../functions/gamificationCore.js');

// Instantes espalhados por dois anos (de 7 em 7 h, para cair em todo horário e dia da semana),
// mais as bordas que costumam quebrar: virada de dia/mês/ano e de semana em Brasília.
const INSTANTES = (() => {
  const base = Date.UTC(2025, 0, 1, 0, 0, 0);
  const lista = [];
  for (let i = 0; i < 24 * 365 * 2 / 7; i += 1) lista.push(base + i * 7 * 3_600_000);
  [
    '2026-10-01T02:59:59Z', '2026-10-01T03:00:00Z', '2026-10-12T02:59:59Z', '2026-10-12T03:00:00Z',
    '2026-12-31T23:59:59-03:00', '2027-01-01T00:00:00-03:00', '2026-03-01T02:59:59Z', '2026-03-01T03:00:00Z',
  ].forEach((t) => lista.push(Date.parse(t)));
  return lista;
})();

describe('tempo: o mesmo dia, semana e mês nos dois lados', () => {
  it('dia civil de Brasília', () => {
    INSTANTES.forEach((ms) => expect(core.brDay(ms)).toBe(missionDateKey(new Date(ms))));
  });

  it('segunda-feira da semana', () => {
    INSTANTES.forEach((ms) => expect(core.weekKey(ms)).toBe(platformWeekKey(new Date(ms))));
  });

  it('mês', () => {
    INSTANTES.forEach((ms) => expect(core.monthKey(ms)).toBe(platformMonthKey(new Date(ms))));
  });

  it('meia-noite de Brasília de uma data civil', () => {
    ['2025-01-01', '2026-02-28', '2026-10-12', '2026-12-31', '2027-01-01'].forEach((k) => {
      expect(core.dayStartMs(k)).toBe(dayStartMs(k));
    });
  });

  it('janela da semana e do mês (início e fim exclusivo)', () => {
    INSTANTES.filter((_, i) => i % 11 === 0).forEach((ms) => {
      const sem = scopeWindowBR('weekly', new Date(ms));
      expect(core.weekWindow(sem.key)).toEqual({ startMs: sem.startMs, endMs: sem.endMs });
      const mes = scopeWindowBR('monthly', new Date(ms));
      expect(core.monthWindow(mes.key.slice(0, 7))).toEqual({ startMs: mes.startMs, endMs: mes.endMs });
    });
  });
});

describe('reputação: a nota que a pessoa vê é a que o servidor publica', () => {
  const rnd = (seed) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; };
  const casos = (n, seed) => {
    const r = rnd(seed);
    const tags = Object.keys(REVIEW_TAGS);
    return Array.from({ length: n }, () => ({
      rating: 1 + Math.floor(r() * 5), tags: tags.filter(() => r() < 0.4), issues: [],
    }));
  };

  it('mesma média, contagem, 5★ e elogios mais votados, com amostras pequenas e grandes', () => {
    [0, 1, 4, 5, 6, 12, 40].forEach((n, i) => {
      const lista = casos(n, 100 + i);
      const cliente = aggregateReviews(lista);
      const servidor = core.aggregateReputation(lista);
      expect({ count: servidor.count, average: servidor.average, publicScore: servidor.publicScore, fiveStarCount: servidor.fiveStarCount, topTags: servidor.topTags })
        .toEqual({ count: cliente.count, average: cliente.average, publicScore: cliente.publicScore, fiveStarCount: cliente.fiveStarCount, topTags: cliente.topTags });
    });
  });

  it('o limiar de nota pública configurável vale igual', () => {
    const lista = casos(8, 7);
    [3, 8, 9, 20].forEach((min) => {
      expect(core.aggregateReputation(lista, { minForPublicScore: min }).publicScore)
        .toBe(aggregateReviews(lista, { minForPublicScore: min }).publicScore);
    });
  });

  it('os elogios conhecidos são os mesmos', () => {
    expect([...core.REVIEW_TAGS].sort()).toEqual(Object.keys(REVIEW_TAGS).sort());
  });

  it('o par de vingança (1–2★ × 5★ no mesmo jogo) é o mesmo', () => {
    const rev = [
      { matchKey: 'g1', fromUid: 'a', toUid: 'b', rating: 1 }, { matchKey: 'g1', fromUid: 'b', toUid: 'a', rating: 5 },
      { matchKey: 'g2', fromUid: 'a', toUid: 'c', rating: 5 }, { matchKey: 'g2', fromUid: 'c', toUid: 'a', rating: 5 },
      { matchKey: 'g3', fromUid: 'd', toUid: 'e', rating: 2 }, { matchKey: 'g3', fromUid: 'e', toUid: 'd', rating: 5 },
      { matchKey: 'g4', fromUid: 'x', toUid: 'y', rating: 3 },
    ];
    const chave = (p) => `${p.matchKey}:${[p.a, p.b].sort().join('+')}`;
    expect(core.suspiciousReviewPairs(rev).map(chave).sort()).toEqual(suspiciousPairs(rev).map(chave).sort());
  });
});

describe('desafio: a posição é a mesma ("1224")', () => {
  it('empates, desempate pela entrada e quem não é elegível', () => {
    const entradas = [
      { subjectId: 'a', value: 10, joinedAt: 3 }, { subjectId: 'b', value: 10, joinedAt: 1 },
      { subjectId: 'c', value: 7, joinedAt: 2 }, { subjectId: 'd', value: 7, joinedAt: 9 },
      { subjectId: 'e', value: 1, joinedAt: 4 }, { subjectId: 'f', value: 99, joinedAt: 5, eligible: false },
    ];
    const pos = (l) => Object.fromEntries(l.map((e) => [e.subjectId, e.position]));
    expect(pos(core.rankEntries(entradas))).toEqual(pos(rankEntries(entradas)));
  });
});

describe('vocabulário e pesos', () => {
  it('o XP verificado pelo servidor usa os pesos do cliente', () => {
    expect(core.verifiedActivityXp({ games: 3, wins: 2 })).toBe(3 * XP_WEIGHTS_V2.game_played + 2 * XP_WEIGHTS_V2.game_won);
  });

  it('a ordem dos tiers do placar público é a do cliente', () => {
    const fonte = readFileSync('functions/seasonRanking.js', 'utf8');
    const m = /const TIER_ORDEM = \[([^\]]+)\]/.exec(fonte);
    const servidor = m[1].split(',').map((s) => s.trim().replace(/['"]/g, ''));
    expect(servidor).toEqual([...TIER_NAMES]);
  });
});

describe('primeiros passos: o funil das métricas conta as mesmas etapas do roteiro', () => {
  it('os ids que o servidor conta são os do catálogo do cliente, na mesma ordem', () => {
    const servidor = requerer('../../../../functions/gamification.js').ONBOARDING_STEP_IDS;
    expect([...servidor]).toEqual(ONBOARDING_STEPS.map((p) => p.id));
  });
});
