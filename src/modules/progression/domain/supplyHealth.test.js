import { describe, it, expect } from 'vitest';
import {
  healthBand, combineHealth, computeArenaHealth, arenaSuggestions, computeCoachHealth, coachBadges,
  coachSuggestions, computeClubActivity, evaluateClubGoals, normalizeGoals, evaluateGoals, goalsDocId,
} from './supplyHealth.js';

describe('combineHealth', () => {
  it('só pondera o que foi medido — dimensão sem dado não vira zero', () => {
    const r = combineHealth([
      { id: 'a', label: 'A', weight: 50, score: 80 },
      { id: 'b', label: 'B', weight: 50, score: null },
    ]);
    expect(r.score).toBe(80);
    expect(r.measured).toBe(1);
    expect(r.confidence).toBe('low');
  });

  it('nada medido: sem nota (não 0)', () => {
    const r = combineHealth([{ id: 'a', label: 'A', weight: 1, score: null }]);
    expect(r.score).toBeNull();
    expect(r.band.id).toBe('unknown');
  });

  it('faixas', () => {
    expect(healthBand(90).id).toBe('excellent');
    expect(healthBand(72).id).toBe('good');
    expect(healthBand(55).id).toBe('growing');
    expect(healthBand(20).id).toBe('attention');
  });
});

describe('arena', () => {
  const saudavel = { bookings7: 30, bookingsPrev7: 25, noShowRate: 2, pendingOver24h: 0, rating: 4.7, reviewsCount: 20, repeatRate: 70, eventsLast30: 4 };

  it('arena saudável fica na faixa alta e com 5 dimensões medidas', () => {
    const r = computeArenaHealth(saudavel);
    expect(r.score).toBeGreaterThanOrEqual(85);
    expect(r.measured).toBe(5);
    expect(r.confidence).toBe('high');
  });

  it('arena nova (sem nada) não leva nota 0', () => {
    const r = computeArenaHealth({});
    expect(r.score).toBeNull();
  });

  it('pedido sem resposta e falta derrubam a confiabilidade', () => {
    const boa = computeArenaHealth(saudavel).dimensions.find((d) => d.id === 'reliability').score;
    const ruim = computeArenaHealth({ ...saudavel, noShowRate: 12, pendingOver24h: 3 }).dimensions.find((d) => d.id === 'reliability').score;
    expect(ruim).toBeLessThan(boa - 30);
  });

  it('satisfação só conta com 3+ avaliações', () => {
    const d = computeArenaHealth({ ...saudavel, reviewsCount: 2 }).dimensions.find((x) => x.id === 'satisfaction');
    expect(d.score).toBeNull();
  });

  it('sugestões trazem o número que as motivou', () => {
    const s = arenaSuggestions({ pendingOver24h: 2, noShowRate: 15, lapsedCustomers: 5, eventsLast30: 0, reviewsCount: 1, repeatRate: 10 });
    expect(s.map((x) => x.id)).toEqual(['pending', 'noshow', 'lapsed', 'events', 'reviews', 'repeat']);
    expect(s[0].text).toContain('2 pedidos');
    expect(arenaSuggestions(saudavel)).toEqual([]);
  });
});

describe('professor', () => {
  const ativo = { lessons30: 22, lessonsPrev30: 18, activeStudents30: 16, totalStudents: 18, newStudents30: 4, pendingOver24h: 0, respondedRate: 95, offers: 3, validatedStudents: 6, responseSample: 20 };

  it('professor ativo vai bem; sem alunos a retenção não é medida', () => {
    expect(computeCoachHealth(ativo).score).toBeGreaterThanOrEqual(85);
    const novo = computeCoachHealth({ totalStudents: 0, offers: 0 });
    expect(novo.dimensions.find((d) => d.id === 'retention').score).toBeNull();
  });

  it('selos com critério à vista, só quando merecidos', () => {
    expect(coachBadges(ativo).map((b) => b.id)).toEqual(['mentor', 'fast', 'veteran']);
    expect(coachBadges({ validatedStudents: 2 })).toEqual([]);
    coachBadges(ativo).forEach((b) => expect(b.criterion.length).toBeGreaterThan(10));
  });

  it('sugestões: pendentes, alunos parados, sem oferta', () => {
    const s = coachSuggestions({ pendingOver24h: 2, totalStudents: 10, activeStudents30: 4, offers: 0, newStudents30: 0 });
    expect(s.map((x) => x.id)).toEqual(['pending', 'inactive', 'offer', 'growth']);
  });
});

describe('clube', () => {
  const dia = 86_400_000;
  const base = Date.UTC(2026, 9, 5);
  const membros = [
    { user_id: 'a', joined_at_ms: base + dia },
    { user_id: 'b', joined_at_ms: 1 },
    { user_id: 'c', joined_at_ms: 1 },
    { user_id: 'd', joined_at_ms: 1 },
  ];
  const jogos = [
    { at: base + 1, side_a_ids: ['a', 'x'], side_b_ids: ['b', 'y'], winner_side: 'a' },
    { at: base + 2, side_a_ids: ['a', 'b'], side_b_ids: ['x', 'y'], winner_side: 'a' },
    { at: base - dia, side_a_ids: ['c', 'd'], side_b_ids: ['x', 'y'], winner_side: 'b' }, // fora
  ];

  it('conta só o período e só membros como contribuintes', () => {
    const r = computeClubActivity({ games: jogos, members: membros, startMs: base, endMs: base + 7 * dia });
    expect(r.games).toBe(2);
    expect(r.activeMembers).toBe(2); // a e b — x e y não são do clube
    expect(r.newMembers).toBe(1);
    expect(r.topContributors[0]).toMatchObject({ uid: 'a', games: 2, wins: 2 });
    expect(r.activeRate).toBe(50);
  });

  it('conquistas coletivas por escopo', () => {
    const r = computeClubActivity({ games: jogos, members: membros, startMs: base, endMs: base + 7 * dia });
    const semana = evaluateClubGoals(r, 'week');
    expect(semana.find((g) => g.id === 'week_10_games')).toMatchObject({ done: false, value: 2 });
    expect(semana.find((g) => g.id === 'week_half_active').done).toBe(true);
    expect(evaluateClubGoals(r, 'month').length).toBe(2);
  });
});

describe('metas do mês', () => {
  it('normaliza: só medida do catálogo, sem repetir, alvo válido', () => {
    expect(normalizeGoals('coach', [
      { metric: 'lessons', target: '20' }, { metric: 'lessons', target: 5 },
      { metric: 'invento', target: 5 }, { metric: 'clinics', target: 0 },
    ])).toEqual([{ metric: 'lessons', target: 20 }]);
  });

  it('medida desconhecida não vira zero; meta cumprida é marcada', () => {
    const r = evaluateGoals('arena', [{ metric: 'bookings', target: 60 }, { metric: 'reviews', target: 5 }], { bookings: 61, reviews: null });
    expect(r[0]).toMatchObject({ done: true, progress: 1, remaining: 0 });
    expect(r[1]).toMatchObject({ known: false, done: false, remaining: null });
  });

  it('um documento por dono e por mês', () => {
    expect(goalsDocId('coach', 'u1', '2026-10')).toBe('coach_u1_2026-10');
  });
});
