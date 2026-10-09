import { describe, it, expect } from 'vitest';
import {
  PLAN_LIMITS, normalizePlan, slotDate, plannedByDate, planEndDate, currentPlanWeek, planProgress,
  stableHash, seededOrder, buildPlanSlots, slotForDate,
} from './plan.js';

const today = '2026-10-08';

function emFuso(tz, fn) {
  const antes = process.env.TZ;
  process.env.TZ = tz;
  try { fn(); } finally {
    if (antes === undefined) delete process.env.TZ; else process.env.TZ = antes;
  }
}

describe('normalizePlan', () => {
  it('exige nome e pelo menos um dia', () => {
    expect(normalizePlan({ title: 'ab', days: [1] }, { today }).valid).toBe(false);
    expect(normalizePlan({ title: 'Plano', days: [] }, { today }).error).toMatch(/dia da semana/);
  });

  it('padrões e limites', () => {
    const { value } = normalizePlan({
      title: 'Plano da cozinha', days: [5, 1, 1, 'x'], weeks: 40, minutes: 5, focus: ['kitchen', 'nada'],
      status: 'raro', source: 'professor',
    }, { today });
    expect(value).toMatchObject({
      weeks: PLAN_LIMITS.weeks, days: [1, 5], minutes: 10, focus: ['kitchen'], status: 'ativo', source: 'manual',
      start_date: '2026-10-05', slots: [],
    });
    expect(normalizePlan({ title: 'Plano', days: [1] }, { today }).value).toMatchObject({ weeks: 4, minutes: 60 });
  });

  it('o início é sempre a segunda da semana escolhida', () => {
    expect(normalizePlan({ title: 'Plano', days: [1], start_date: '2026-10-11' }, { today }).value.start_date).toBe('2026-10-05');
  });

  it('slots: dentro das semanas, um por dia, até 4 itens cada', () => {
    const { value } = normalizePlan({
      title: 'Plano', days: [1], weeks: 2,
      slots: [
        { week: 1, day: 1, item_ids: ['a', 'b', 'c', 'd', 'e', 'a'] },
        { week: 1, day: 1, item_ids: ['dup'] },
        { week: 3, day: 1, item_ids: ['fora'] },
        { week: 'x', day: 1 },
        { week: 2, day: 3, title: 'Quarta', duration_min: 500 },
      ],
    }, { today });
    expect(value.slots).toEqual([
      { week: 1, day: 1, title: '', item_ids: ['a', 'b', 'c', 'd'], duration_min: 0 },
      { week: 2, day: 3, title: 'Quarta', item_ids: [], duration_min: 240 },
    ]);
  });

  it(`no máximo ${PLAN_LIMITS.slots} slots`, () => {
    const slots = [];
    for (let w = 1; w <= 16; w += 1) for (let d = 0; d < 7; d += 1) slots.push({ week: w, day: d });
    slots.push({ week: 16, day: 6 });
    expect(normalizePlan({ title: 'Plano', days: [0, 1, 2, 3, 4, 5, 6], weeks: 16, slots }, { today }).value.slots)
      .toHaveLength(PLAN_LIMITS.slots);
  });
});

describe('datas do plano', () => {
  const plan = {
    id: 'p1', title: 'Plano', start_date: '2026-10-05', weeks: 4, status: 'ativo', minutes: 45,
    slots: [{ week: 1, day: 1, item_ids: ['a'] }, { week: 1, day: 0 }, { week: 2, day: 3 }, { week: 4, day: 0 }],
  };

  it('slotDate: semana 1 começa na segunda; domingo é o último dia', () => {
    expect(slotDate(plan, { week: 1, day: 1 })).toBe('2026-10-05');
    expect(slotDate(plan, { week: 1, day: 0 })).toBe('2026-10-11');
    expect(slotDate(plan, { week: 2, day: 3 })).toBe('2026-10-14');
  });

  it('plannedByDate e planEndDate', () => {
    expect(Object.keys(plannedByDate(plan))).toEqual(['2026-10-05', '2026-10-11', '2026-10-14', '2026-11-01']);
    expect(plannedByDate(null)).toEqual({});
    expect(planEndDate(plan)).toBe('2026-11-01');
  });

  it('currentPlanWeek: 1…weeks dentro do plano, null fora', () => {
    expect(currentPlanWeek(plan, '2026-10-04')).toBeNull();
    expect(currentPlanWeek(plan, '2026-10-05')).toBe(1);
    expect(currentPlanWeek(plan, '2026-10-11')).toBe(1);
    expect(currentPlanWeek(plan, '2026-10-12')).toBe(2);
    expect(currentPlanWeek(plan, '2026-11-01')).toBe(4);
    expect(currentPlanWeek(plan, '2026-11-02')).toBeNull();
    expect(currentPlanWeek({}, today)).toBeNull();
  });

  it('currentPlanWeek não volta uma semana no horário de verão', () => {
    emFuso('America/New_York', () => {
      const p = { start_date: '2026-03-02', weeks: 4 };
      expect(currentPlanWeek(p, '2026-03-09')).toBe(2); // 08/03: relógio adiantado
      expect(currentPlanWeek(p, '2026-03-16')).toBe(3);
    });
  });

  it('planProgress: só sessões DESTE plano, até hoje', () => {
    const sessions = [
      { plan_id: 'p1', date: '2026-10-05' },
      { plan_id: 'outro', date: '2026-10-11' },
      { plan_id: 'p1', date: '2026-10-07' }, // dia sem slot não conta
    ];
    expect(planProgress(plan, sessions, '2026-10-12')).toEqual({ done: 1, due: 2, total: 4, pct: 25 });
    expect(planProgress({ ...plan, slots: [] }, sessions, today)).toEqual({ done: 0, due: 0, total: 0, pct: 0 });
  });

  it('slotForDate: só do plano ATIVO', () => {
    expect(slotForDate(plan, '2026-10-05').item_ids).toEqual(['a']);
    expect(slotForDate(plan, '2026-10-06')).toBeNull();
    expect(slotForDate({ ...plan, status: 'pausado' }, '2026-10-05')).toBeNull();
    expect(slotForDate(null, today)).toBeNull();
  });
});

describe('stableHash / seededOrder', () => {
  it('hash estável e sem sinal', () => {
    expect(stableHash('abc')).toBe(stableHash('abc'));
    expect(stableHash('abc')).not.toBe(stableHash('abd'));
    expect(stableHash('')).toBe(2166136261);
    expect(stableHash('x')).toBeGreaterThanOrEqual(0);
  });

  it('mesma semente, mesma ordem; não altera a lista', () => {
    const list = Array.from({ length: 10 }, (_, i) => ({ id: `i${i}` }));
    expect(seededOrder(list, 's')).toEqual(seededOrder([...list].reverse(), 's'));
    expect(list[0].id).toBe('i0');
  });
});

describe('buildPlanSlots', () => {
  const drill = (id, over = {}) => ({ id, kind: 'drill', skills: ['kitchen.dink_cruzado'], duration_min: 15, level_min: 3, intensity: 5, ...over });
  const items = [
    ...Array.from({ length: 10 }, (_, i) => drill(`d${i}`)),
    { id: 'aq1', kind: 'fisico', skills: ['physical.aquecimento'], duration_min: 10 },
    { id: 'aq2', kind: 'fisico', skills: ['physical.aquecimento'], duration_min: 10 },
    drill('legado', { legacy: true }),
    drill('sessao', { kind: 'treino' }),
    drill('estudo', { kind: 'estudo' }),
    drill('avancado', { level_min: 6, level_max: 8 }),
    drill('parede', { place: ['parede'] }),
    drill('saque', { skills: ['serve'] }),
  ];
  const opts = { weeks: 3, days: [4, 1], minutes: 60, focus: ['kitchen'], level: 3.5, place: 'quadra', items };

  it('um slot por semana × dia, na ordem, com o tempo do dia', () => {
    const slots = buildPlanSlots(opts);
    expect(slots.map((s) => `${s.week}-${s.day}`)).toEqual(['1-1', '1-4', '2-1', '2-4', '3-1', '3-4']);
    for (const s of slots) {
      expect(s.duration_min).toBe(60);
      expect(s.title).toBe('Treino do foco');
      expect(s.item_ids.length).toBeLessThanOrEqual(PLAN_LIMITS.itemsPerSlot);
      expect(new Set(s.item_ids).size).toBe(s.item_ids.length);
    }
  });

  it('aquecimento primeiro e só itens que servem (nível, local, foco, tipo)', () => {
    const slots = buildPlanSlots(opts);
    const usados = new Set(slots.flatMap((s) => s.item_ids));
    for (const s of slots) expect(s.item_ids[0]).toMatch(/^aq/);
    for (const fora of ['legado', 'sessao', 'estudo', 'avancado', 'parede', 'saque']) expect(usados.has(fora)).toBe(false);
  });

  it('cabe no tempo: 40 min = aquecimento (10) + 2 drills (15 + 15)', () => {
    const slots = buildPlanSlots({ ...opts, minutes: 40 });
    for (const s of slots) expect(s.item_ids).toHaveLength(3);
  });

  it('determinístico pela semente; semente diferente, plano diferente', () => {
    expect(buildPlanSlots({ ...opts, seed: 'x' })).toEqual(buildPlanSlots({ ...opts, seed: 'x' }));
    const planos = ['a', 'b', 'c', 'd'].map((seed) => JSON.stringify(buildPlanSlots({ ...opts, seed })));
    expect(new Set(planos).size).toBeGreaterThan(1);
  });

  it('progride: as semanas finais pegam os itens mais desafiadores', () => {
    const escada = Array.from({ length: 8 }, (_, i) => drill(`n${i}`, { level_min: 2 + i * 0.5, level_max: 8 }));
    const slots = buildPlanSlots({ weeks: 4, days: [1], minutes: 15, focus: [], level: null, items: escada });
    const nivel = (id) => escada.find((x) => x.id === id).level_min;
    const niveis = slots.map((s) => nivel(s.item_ids[0]));
    expect(niveis).toEqual([...niveis].sort((a, b) => a - b));
    expect(niveis[3]).toBeGreaterThan(niveis[0]);
  });

  it('sem foco correspondente usa os outros; sem itens, dias vazios (nunca inventa)', () => {
    const outros = buildPlanSlots({ ...opts, focus: ['mental'] });
    expect(outros.every((s) => s.item_ids.length > 1)).toBe(true);
    const vazio = buildPlanSlots({ weeks: 2, days: [1], items: [] });
    expect(vazio).toEqual([
      { week: 1, day: 1, title: 'Treino', item_ids: [], duration_min: 60 },
      { week: 2, day: 1, title: 'Treino', item_ids: [], duration_min: 60 },
    ]);
  });
});
