import { describe, expect, it } from 'vitest';
import {
  addItemToSlot, courtBlocks, formatClock, masteryGroups, minutesFromSeconds, nextPlanSlot, normalizeRoutine,
  pickItems, planWeekView, planWeeksSummary, sessionsByWeek, setSlotItems, totalMinutes, weekRangeLabel,
} from './treinar.js';

// 2026-10-05 é segunda-feira. Plano de 2 semanas, terças (2) e quintas (4).
const plan = {
  id: 'p1', start_date: '2026-10-05', weeks: 2, days: [2, 4], minutes: 60,
  slots: [{ week: 1, day: 2, title: 'Treino', item_ids: ['a'], duration_min: 60 }],
};

describe('pickItems / totalMinutes', () => {
  it('separa os itens visíveis dos que ficaram de fora, na ordem pedida', () => {
    const r = pickItems(['b', 'x', 'a'], { a: { id: 'a' }, b: { id: 'b' } });
    expect(r.items.map((i) => i.id)).toEqual(['b', 'a']);
    expect(r.missingIds).toEqual(['x']);
  });
  it('o tempo do dia vence a soma dos itens; sem nenhum, é desconhecido', () => {
    expect(totalMinutes(45, [{ duration_min: 10 }])).toBe(45);
    expect(totalMinutes(null, [{ duration_min: 10 }, { duration_min: 15 }])).toBe(25);
    expect(totalMinutes(null, [{}])).toBeNull();
  });
});

describe('courtBlocks', () => {
  it('item sem duração divide o tempo que sobra (mínimo de 5 min)', () => {
    const b = courtBlocks([{ id: 'a', duration_min: 20 }, { id: 'b' }, { id: 'c' }], 60);
    expect(b.map((x) => x.minutes)).toEqual([20, 20, 20]);
    expect(courtBlocks([{ id: 'a', duration_min: 58 }, { id: 'b' }], 60)[1].minutes).toBe(5);
  });
  it('um treino vira passos a partir dos blocos', () => {
    const [b] = courtBlocks([{ id: 't', kind: 'treino', blocks: [{ type: 'aquecimento', title: 'Mini', duration_min: 10 }] }]);
    expect(b.steps[0]).toMatch(/Mini \(10 min\)/);
  });
});

describe('relógio', () => {
  it('formata minutos e horas', () => {
    expect(formatClock(425)).toBe('07:05');
    expect(formatClock(3723)).toBe('1:02:03');
    expect(formatClock(-3)).toBe('00:00');
  });
  it('quem treinou nunca registra 0 minuto', () => {
    expect(minutesFromSeconds(20)).toBe(1);
    expect(minutesFromSeconds(0)).toBe(0);
    expect(minutesFromSeconds(150)).toBe(3);
  });
});

describe('normalizeRoutine', () => {
  it('exige um dia, limita minutos e descarta local e foco inválidos', () => {
    expect(normalizeRoutine({ days: [] }).valid).toBe(false);
    const r = normalizeRoutine({ days: [4, 2, 2, 9], minutes: 999, place: 'lua', focus: ['kitchen', 'inventado'] });
    expect(r.valid).toBe(true);
    expect(r.value).toEqual({ days: [2, 4], minutes: 240, place: '', focus: ['kitchen'] });
  });
});

describe('plano dia a dia', () => {
  it('rótulo da semana', () => {
    expect(weekRangeLabel('2026-10-05')).toBe('05/10 a 11/10');
  });
  it('o dia que passou sem registro "ficou para depois" — nunca falha', () => {
    const sessions = [{ plan_id: 'p1', date: '2026-10-06' }];
    const v = planWeekView(plan, sessions, 1, '2026-10-08');
    expect(v.map((d) => [d.day, d.date, d.state])).toEqual([[2, '2026-10-06', 'feito'], [4, '2026-10-08', 'hoje']]);
    expect(planWeekView(plan, [], 1, '2026-10-09').map((d) => d.state)).toEqual(['depois', 'depois']);
    expect(planWeekView(plan, [{ plan_id: 'outro', date: '2026-10-06' }], 1, '2026-10-05')[0].state).toBe('planejado');
  });
  it('resume feito × total por semana', () => {
    expect(planWeeksSummary(plan, [{ plan_id: 'p1', date: '2026-10-13' }])).toEqual([
      { week: 1, done: 0, total: 2 }, { week: 2, done: 1, total: 2 },
    ]);
  });
  it('troca os itens de um dia, cria o dia e recusa fora do plano ou acima do limite', () => {
    expect(setSlotItems(plan, { week: 1, day: 2 }, ['b', 'b']).slots[0].item_ids).toEqual(['b']);
    const novo = setSlotItems(plan, { week: 2, day: 4 }, ['c']);
    expect(novo.ok).toBe(true);
    expect(novo.slots).toHaveLength(2);
    expect(novo.slots[1]).toMatchObject({ week: 2, day: 4, item_ids: ['c'], duration_min: 60 });
    expect(setSlotItems(plan, { week: 1, day: 3 }, ['c']).ok).toBe(false);
    expect(setSlotItems(plan, { week: 3, day: 2 }, ['c']).ok).toBe(false);
    expect(setSlotItems(plan, { week: 1, day: 2 }, ['1', '2', '3', '4', '5']).ok).toBe(false);
    expect(plan.slots[0].item_ids).toEqual(['a']); // não muda o plano original
  });
  it('acrescentar não repete', () => {
    expect(addItemToSlot(plan, { week: 1, day: 2 }, 'a').ok).toBe(false);
    expect(addItemToSlot(plan, { week: 1, day: 2 }, 'b').slots[0].item_ids).toEqual(['a', 'b']);
  });
  it('o próximo dia do plano a partir de hoje (hoje inclusive)', () => {
    expect(nextPlanSlot(plan, '2026-10-06')).toEqual({ week: 1, day: 2, date: '2026-10-06' });
    expect(nextPlanSlot(plan, '2026-10-09')).toEqual({ week: 2, day: 2, date: '2026-10-13' });
    expect(nextPlanSlot(plan, '2026-12-01')).toEqual({ week: 1, day: 2, date: '2026-10-06' });
    expect(nextPlanSlot({ ...plan, days: [] }, '2026-10-06')).toBeNull();
  });
});

describe('sessionsByWeek / masteryGroups', () => {
  it('agrupa por semana, da mais recente', () => {
    const g = sessionsByWeek([{ id: 1, date: '2026-10-06' }, { id: 2, date: '2026-10-13' }, { id: 3, date: '2026-10-11', week_key: '2026-10-05' }]);
    expect(g.map((x) => [x.weekKey, x.sessions.map((s) => s.id)])).toEqual([['2026-10-12', [2]], ['2026-10-05', [1, 3]]]);
  });
  it('item que não está visível aparece como indisponível, nunca some', () => {
    const g = masteryGroups({ a: 'dominado', z: 'aprendendo', q: 'inventado' }, { a: { title: 'Dink' } });
    expect(g.dominado).toEqual([{ id: 'a', title: 'Dink', available: true }]);
    expect(g.aprendendo).toEqual([{ id: 'z', title: 'Item indisponível', available: false }]);
    expect(g.consistente).toEqual([]);
  });
});
