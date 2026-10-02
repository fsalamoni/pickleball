import { describe, it, expect } from 'vitest';
import { arenaMetrics, coachMetrics, clubMetrics, monthWindow } from './supplyMetrics.js';
import { computeArenaHealth, computeCoachHealth } from './supplyHealth.js';

// 15/10/2026, meio-dia em Brasília (UTC-3)
const NOW = new Date('2026-10-15T15:00:00Z');
const dia = (n) => {
  const d = new Date(NOW.getTime() - n * 86_400_000);
  return d.toISOString().slice(0, 10);
};
const reserva = (over = {}) => ({ status: 'completed', user_id: 'u1', slots: [{ date: dia(1), start: '19:00', end: '20:00' }], created_at_ms: NOW.getTime() - 3 * 86_400_000, ...over });

describe('monthWindow', () => {
  it('é o mês de Brasília, de meia-noite a meia-noite', () => {
    const w = monthWindow(NOW);
    expect(w.key).toBe('2026-10');
    expect(new Date(w.startMs).toISOString()).toBe('2026-10-01T03:00:00.000Z');
    expect(new Date(w.endMs).toISOString()).toBe('2026-11-01T03:00:00.000Z');
  });
});

describe('arenaMetrics', () => {
  it('conta reservas jogadas por semana e o mês corrente', () => {
    const r = arenaMetrics({
      bookings: [reserva(), reserva({ slots: [{ date: dia(2) }] }), reserva({ slots: [{ date: dia(9) }] }), reserva({ no_show: true, slots: [{ date: dia(3) }] })],
      reviews: [], gameDays: [], openSlots: [], now: NOW,
    });
    expect(r.health.bookings7).toBe(2);
    expect(r.health.bookingsPrev7).toBe(1);
    expect(r.actuals.bookings).toBe(3); // no_show não é jogo
  });

  it('pedido sem resposta há mais de 24 h aparece; recente não', () => {
    const r = arenaMetrics({
      bookings: [
        reserva({ status: 'requested', created_at_ms: NOW.getTime() - 3 * 86_400_000 }),
        reserva({ status: 'requested', created_at_ms: NOW.getTime() - 2 * 3_600_000 }),
      ],
      reviews: [], gameDays: [], openSlots: [], now: NOW,
    });
    expect(r.health.pendingOver24h).toBe(1);
  });

  it('falta só é taxa com amostra mínima (não afirma 100% com 1 reserva)', () => {
    const poucas = arenaMetrics({ bookings: [reserva({ no_show: true })], reviews: [], gameDays: [], openSlots: [], now: NOW });
    expect(poucas.health.noShowRate).toBeNull();
    const muitas = arenaMetrics({
      bookings: Array.from({ length: 10 }, (_, i) => reserva({ user_id: `c${i}`, no_show: i < 2 })), reviews: [], gameDays: [], openSlots: [], now: NOW,
    });
    expect(muitas.health.noShowRate).toBe(20);
  });

  it('fonte que não carregou vira "não deu para medir", nunca zero', () => {
    const r = arenaMetrics({ bookings: undefined, reviews: undefined, gameDays: undefined, openSlots: undefined, now: NOW });
    expect(r.unknown).toEqual(['reservas', 'avaliações', 'eventos']);
    expect(r.actuals).toEqual({ bookings: null, events: null, reviews: null, new_customers: null });
    expect(r.health.bookings7).toBeUndefined();
    expect(computeArenaHealth(r.health).score).toBeNull();
  });

  it('nota média e avaliações do mês; eventos somam dia de jogo e jogo aberto', () => {
    const r = arenaMetrics({
      bookings: [], now: NOW,
      reviews: [{ rating: 5, created_at_ms: NOW.getTime() - 86_400_000 }, { rating: 4, created_at_ms: NOW.getTime() - 40 * 86_400_000 }, { rating: 3, type: 'comment' }],
      gameDays: [{ date: dia(2) }, { date: dia(1), status: 'archived' }],
      openSlots: [{ starts_at: NOW.getTime() - 86_400_000 }],
    });
    expect(r.health.rating).toBe(4.5);
    expect(r.health.reviewsCount).toBe(2);
    expect(r.actuals.reviews).toBe(1);
    expect(r.health.eventsLast30).toBe(2);
    expect(r.actuals.events).toBe(2);
  });

  it('cliente que voltou e cliente que sumiu', () => {
    const bookings = [
      ...Array.from({ length: 5 }, (_, i) => reserva({ user_id: `a${i}`, slots: [{ date: dia(1) }] })),
      ...Array.from({ length: 5 }, (_, i) => reserva({ user_id: `a${i}`, slots: [{ date: dia(3) }] })),
      reserva({ user_id: 'sumido', slots: [{ date: dia(80) }] }), reserva({ user_id: 'sumido', slots: [{ date: dia(70) }] }),
    ];
    const r = arenaMetrics({ bookings, reviews: [], gameDays: [], openSlots: [], now: NOW });
    expect(r.health.lapsedCustomers).toBe(1);
    expect(r.health.repeatRate).toBe(100);
  });
});

describe('coachMetrics', () => {
  const aula = (over = {}) => ({ status: 'completed', student_id: 's1', slots: [{ date: dia(5) }], created_at_ms: NOW.getTime() - 10 * 86_400_000, ...over });
  it('aulas dadas em 30 dias, alunos ativos e pedidos sem resposta', () => {
    const r = coachMetrics({
      lessons: [aula(), aula({ student_id: 's2', slots: [{ date: dia(10) }] }), aula({ slots: [{ date: dia(40) }] }), aula({ status: 'requested', created_at_ms: NOW.getTime() - 3 * 86_400_000 })],
      students: [{ status: 'active', created_at_ms: NOW.getTime() - 5 * 86_400_000 }, { status: 'active', created_at_ms: NOW.getTime() - 100 * 86_400_000 }, { status: 'paused' }],
      packages: [{ active: true }, { active: false }], clinics: [], contents: [{ status: 'draft' }, {}], validations: [{ student_id: 'a', created_at_ms: NOW.getTime() - 86_400_000 }],
      now: NOW,
    });
    expect(r.health.lessons30).toBe(2);
    expect(r.health.lessonsPrev30).toBe(1);
    expect(r.health.activeStudents30).toBe(2);
    expect(r.health.pendingOver24h).toBe(1);
    expect(r.health.totalStudents).toBe(2); // pausado não conta
    expect(r.health.newStudents30).toBe(1);
    expect(r.health.offers).toBe(2);
    expect(r.health.validatedStudents).toBe(1);
    expect(r.actuals.validations).toBe(1);
    expect(computeCoachHealth(r.health).score).not.toBeNull();
  });
  it('sem a lista de aulas, a atividade não é zero — é desconhecida', () => {
    const r = coachMetrics({ lessons: undefined, students: [], now: NOW });
    expect(r.unknown).toContain('aulas');
    expect(r.actuals.lessons).toBeNull();
  });
});

describe('clubMetrics', () => {
  const jogo = (dias, a, b, w = 'a') => ({ result_recorded_at: NOW.getTime() - dias * 86_400_000, side_a_ids: a, side_b_ids: b, winner_side: w });
  it('semana, mês, metas coletivas e a taxa de membros ativos', () => {
    const members = [{ user_id: 'a', created_at_ms: NOW.getTime() - 3 * 86_400_000 }, { user_id: 'b' }, { user_id: 'c' }, { user_id: 'd' }];
    const games = [jogo(1, ['a', 'b'], ['x', 'y']), jogo(2, ['a'], ['c'], 'b'), jogo(40, ['d'], ['x'])];
    const r = clubMetrics({ games, members, events: [{ date: dia(2) }, { date: dia(60) }], now: NOW });
    expect(r.week.games).toBe(2);
    expect(r.week.activeMembers).toBe(3);
    expect(r.month.games).toBe(2);
    expect(r.actuals.new_members).toBe(1);
    expect(r.actuals.active_rate).toBe(75);
    expect(r.actuals.events).toBe(1);
    expect(r.goalsWeek.length).toBeGreaterThan(0);
  });
  it('sem jogos carregados, nada é afirmado', () => {
    const r = clubMetrics({ games: undefined, members: [], events: [], now: NOW });
    expect(r.week).toBeNull();
    expect(r.actuals.games).toBeNull();
    expect(r.unknown).toEqual(['jogos']);
  });
});
