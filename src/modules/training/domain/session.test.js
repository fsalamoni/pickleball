import { describe, it, expect } from 'vitest';
import { normalizeSession, sessionLoad, weekSummary, sortSessions, recentWeekKeys } from './session.js';

const today = '2026-10-08'; // quinta

describe('normalizeSession', () => {
  it('registro válido com padrões', () => {
    const r = normalizeSession({ duration_min: 45 }, { today });
    expect(r.valid).toBe(true);
    expect(r.value).toMatchObject({
      date: today, week_key: '2026-10-05', title: 'Treino', kind: 'quadra', status: 'feito',
      item_ids: [], plan_id: null, duration_min: 45, rpe: null, notes: '', skills: [], shared_coach_id: null,
    });
  });

  it('aceita até amanhã; recusa depois disso', () => {
    expect(normalizeSession({ date: '2026-10-09', duration_min: 30 }, { today }).valid).toBe(true);
    const r = normalizeSession({ date: '2026-10-10', duration_min: 30 }, { today });
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/ainda não chegou/);
  });

  it('duração precisa ser maior que zero', () => {
    expect(normalizeSession({}, { today }).valid).toBe(false);
    expect(normalizeSession({ duration_min: 0 }, { today }).error).toMatch(/minutos/);
    expect(normalizeSession({ duration_min: -10 }, { today }).valid).toBe(false);
  });

  it('limites e listas', () => {
    const v = normalizeSession({
      duration_min: 900, rpe: 14, kind: 'yoga', status: 'parcial', title: 't'.repeat(200), notes: 'n'.repeat(2500),
      item_ids: [...Array.from({ length: 20 }, (_, i) => `i${i}`), 'i0'], skills: ['kitchen', 'inventada', 'kitchen'],
    }, { today }).value;
    expect(v.duration_min).toBe(600);
    expect(v.rpe).toBe(10);
    expect(v.kind).toBe('quadra');
    expect(v.status).toBe('parcial');
    expect(v.title).toHaveLength(120);
    expect(v.notes).toHaveLength(2000);
    expect(v.item_ids).toHaveLength(12);
    expect(v.skills).toEqual(['kitchen']);
  });

  it('data inválida vira hoje', () => {
    expect(normalizeSession({ date: '08/10', duration_min: 10 }, { today }).value.date).toBe(today);
  });
});

describe('sessionLoad', () => {
  it('minutos × esforço; sem esforço é desconhecido, não zero', () => {
    expect(sessionLoad({ duration_min: 60, rpe: 7 })).toBe(420);
    expect(sessionLoad({ duration_min: 60, rpe: 0 })).toBe(0);
    expect(sessionLoad({ duration_min: 60, rpe: null })).toBeNull();
    expect(sessionLoad({ rpe: 5 })).toBeNull();
  });
});

describe('weekSummary', () => {
  const weekKey = '2026-10-05';
  const sessions = [
    { date: '2026-10-05', week_key: weekKey, status: 'feito', duration_min: 60, rpe: 6 },
    { date: '2026-10-06', week_key: weekKey, status: 'parcial', duration_min: 30, rpe: null },
    { date: '2026-10-07', week_key: weekKey, status: 'parcial', duration_min: 20, rpe: 4 },
    { date: '2026-10-07', week_key: weekKey, status: 'feito', duration_min: 10, rpe: 2 },
    { date: '2026-09-30', week_key: '2026-09-28', status: 'feito', duration_min: 99, rpe: 9 },
  ];
  const plannedByDate = {
    '2026-10-06': [{}], '2026-10-08': [{}], '2026-10-09': [{}], '2026-10-10': [{}, {}], '2026-10-20': [{}],
  };

  it('estado por dia: feito, parcial, hoje, planejado, vazio — e nunca "falha"', () => {
    const s = weekSummary({ weekKey, sessions, plannedByDate, today });
    expect(s.days.map((d) => d.state)).toEqual(['feito', 'parcial', 'feito', 'hoje', 'planejado', 'planejado', 'vazio']);
  });

  it('planejado no passado sem registro fica "depois"', () => {
    const s = weekSummary({ weekKey, sessions: [], plannedByDate: { '2026-10-06': [{}] }, today });
    expect(s.days[1].state).toBe('depois');
  });

  it('totais da semana: só as sessões da semana; carga ignora esforço desconhecido', () => {
    const s = weekSummary({ weekKey, sessions, plannedByDate, today });
    expect(s.sessionsCount).toBe(4);
    expect(s.minutes).toBe(120);
    expect(s.load).toBe(60 * 6 + 20 * 4 + 10 * 2);
    expect(s.plannedCount).toBe(5);
    expect(s.doneDays).toBe(3);
  });

  it('carga desconhecida quando nenhuma sessão tem esforço', () => {
    const s = weekSummary({ weekKey, sessions: [{ date: '2026-10-05', status: 'feito', duration_min: 30 }], today });
    expect(s.load).toBeNull();
    expect(s.sessionsCount).toBe(1); // sem week_key, a data decide a semana
  });
});

describe('sortSessions', () => {
  it('data mais recente primeiro; no mesmo dia, criada por último primeiro', () => {
    const list = [
      { id: 'a', date: '2026-10-01', created_at: { seconds: 1 } },
      { id: 'b', date: '2026-10-08', created_at: { seconds: 1 } },
      { id: 'c', date: '2026-10-08', created_at: { seconds: 5 } },
    ];
    expect(sortSessions(list).map((s) => s.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('recentWeekKeys', () => {
  it('semana atual primeiro, de 7 em 7 dias, entre 1 e 30 chaves', () => {
    expect(recentWeekKeys(3, today)).toEqual(['2026-10-05', '2026-09-28', '2026-09-21']);
    expect(recentWeekKeys(100, today)).toHaveLength(30);
    expect(recentWeekKeys(0, today)).toEqual(['2026-10-05']);
  });
});
