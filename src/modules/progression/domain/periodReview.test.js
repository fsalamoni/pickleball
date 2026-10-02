import { describe, it, expect } from 'vitest';
import {
  periodWindow, buildPeriodReview, reviewHighlights, reviewHeadline, MIN_GAMES_FOR_WIN_RATE,
} from './periodReview.js';
import { buildActivityFacts, FACT_SOURCES } from './activityFacts.js';

const NOW = new Date('2026-10-02T15:00:00Z'); // sexta, semana de 28/09
const ms = (iso) => new Date(iso).getTime();
const jogo = (iso, won = true, extra = {}) => ({ at: ms(iso), won, ...extra });

describe('periodWindow', () => {
  it('semana: segunda a domingo, com rótulo legível', () => {
    const w = periodWindow('week', 0, NOW);
    expect(w.key).toBe('2026-09-28');
    expect(w.label).toBe('28 de setembro a 4 de outubro');
    expect(w.inProgress).toBe(true);
    const p = periodWindow('week', -1, NOW);
    expect(p.key).toBe('2026-09-21');
    expect(p.inProgress).toBe(false);
    expect(p.endMs).toBe(w.startMs);
  });

  it('mês: vira o ano certo para trás', () => {
    const w = periodWindow('month', -1, new Date('2026-01-15T15:00:00Z'));
    expect(w.key).toBe('2025-12');
    expect(w.label).toBe('Dezembro de 2025');
  });
});

describe('buildPeriodReview', () => {
  const records = [
    jogo('2026-09-29T15:00:00Z', true, { partner: 'Ana', opponents: ['Bia', 'Caio'] }),
    jogo('2026-09-30T15:00:00Z', true, { partner: 'Dudu', opponents: ['Bia'] }),
    jogo('2026-10-01T15:00:00Z', false, { partner: 'Ana' }),
    jogo('2026-09-22T15:00:00Z', true), // semana passada
  ];

  it('conta só o período e compara com o anterior', () => {
    const r = buildPeriodReview({ kind: 'week', now: NOW, records });
    expect(r.games).toBe(3);
    expect(r.gamesPrev).toBe(1);
    expect(r.gamesDelta).toBe(2);
    expect(r.wins).toBe(2);
    expect(r.activeDays).toBe(3);
    expect(r.partners).toBe(2);
    expect(r.opponents).toBe(2);
  });

  it('aproveitamento só com amostra mínima', () => {
    const r = buildPeriodReview({ kind: 'week', now: NOW, records });
    expect(r.winRate).toBe(67);
    const poucos = buildPeriodReview({ kind: 'week', now: NOW, records: records.slice(0, MIN_GAMES_FOR_WIN_RATE - 1) });
    expect(poucos.winRate).toBeNull();
  });

  it('dia 23h em Brasília não escorrega para o dia seguinte', () => {
    const r = buildPeriodReview({ kind: 'week', now: NOW, records: [jogo('2026-10-05T02:30:00Z')] });
    expect(r.games).toBe(1); // domingo 23h30 em Brasília ainda é a semana de 28/09
  });

  it('conquistas, missões e rating do período', () => {
    const r = buildPeriodReview({
      kind: 'week', now: NOW, records,
      achievements: [
        { achievementId: 'career_first_win', unlockedAt: ms('2026-09-30T12:00:00Z'), rarity: 'common' },
        { achievementId: 'velha', unlockedAt: ms('2026-08-01T12:00:00Z') },
      ],
      missionDocs: [
        { scope: 'daily', date: '2026-09-30', missions: [{ current: 1, target: 1 }, { current: 0, target: 3 }] },
        { scope: 'daily', date: '2026-09-10', missions: [{ current: 1, target: 1 }] },
        { scope: 'weekly', date: '2026-09-28', missions: [{ current: 3, target: 3 }] },
      ],
      ratingPoints: [{ at: ms('2026-09-20T12:00:00Z'), rating: 1000 }, { at: ms('2026-10-01T12:00:00Z'), rating: 1018 }],
    });
    expect(r.newAchievements).toHaveLength(1);
    expect(r.missionsDone).toBe(2);
    expect(r.ratingDelta).toBe(18);
  });

  it('marco cruzado: o 25º jogo dentro da semana', () => {
    const r = buildPeriodReview({ kind: 'week', now: NOW, records, totals: { games: 25, wins: 10 } });
    const textos = r.milestones.map((m) => m.text);
    expect(textos).toContain('Seu 25º jogo!');
    expect(textos).toContain('10 vitórias na carreira!');
  });

  it('dados dos fatos entram (kudos, reservas, aulas)', () => {
    const base = Object.fromEntries(FACT_SOURCES.map((n) => [n, []]));
    const facts = buildActivityFacts({
      ...base,
      sentKudos: [{ createdAt: ms('2026-10-01T12:00:00Z') }, { createdAt: ms('2026-08-01T12:00:00Z') }],
    }, { now: NOW });
    const r = buildPeriodReview({ kind: 'week', now: NOW, records: [], facts });
    expect(r.kudosGiven).toBe(1);
    expect(r.isEmpty).toBe(false);
  });

  it('período sem nada é vazio, e a mensagem não cobra', () => {
    const r = buildPeriodReview({ kind: 'week', now: NOW, records: [] });
    expect(r.isEmpty).toBe(true);
    expect(reviewHeadline(r)).toMatch(/jogo já muda isso/);
    const passada = buildPeriodReview({ kind: 'week', offset: -1, now: NOW, records: [] });
    expect(reviewHeadline(passada)).not.toMatch(/deveria|falhou|perdeu/i);
  });
});

describe('reviewHighlights', () => {
  it('não lista zero e usa o singular quando é 1', () => {
    const r = buildPeriodReview({ kind: 'week', now: NOW, records: [jogo('2026-09-30T15:00:00Z', true)] });
    const textos = reviewHighlights(r).map((h) => h.text);
    expect(textos).toContain('1 jogo');
    expect(textos).toContain('1 vitória');
    expect(textos.some((t) => /^0 /.test(t))).toBe(false);
  });

  it('compara com o período anterior em palavras', () => {
    const r = buildPeriodReview({
      kind: 'week', now: NOW,
      records: [jogo('2026-09-29T15:00:00Z'), jogo('2026-09-30T15:00:00Z'), jogo('2026-09-22T15:00:00Z')],
    });
    expect(reviewHighlights(r)[0].text).toBe('2 jogos (+1 que a semana passada)');
  });
});
