import { describe, it, expect } from 'vitest';
import {
  ASSESSMENT_EVERY_DAYS, weeklySeries, weekMonotony, monotonyHint, minutesByArea, assessmentDue,
  normalizeAssessment, assessmentDelta, masteryCounts,
} from './evolution.js';
import { weekDates } from './dates.js';

describe('weeklySeries', () => {
  it('uma linha por semana; semana sem registro = 0 minutos, carga desconhecida', () => {
    const sessions = [
      { week_key: '2026-10-05', duration_min: 60, rpe: 5 },
      { week_key: '2026-10-05', duration_min: 30, rpe: null },
      { week_key: '2026-09-28', duration_min: 20 },
    ];
    expect(weeklySeries(sessions, ['2026-10-05', '2026-09-28', '2026-09-21'])).toEqual([
      { weekKey: '2026-10-05', count: 2, minutes: 90, load: 300 },
      { weekKey: '2026-09-28', count: 1, minutes: 20, load: null },
      { weekKey: '2026-09-21', count: 0, minutes: 0, load: null },
    ]);
  });
});

describe('weekMonotony', () => {
  const week = '2026-10-05';
  const dias = weekDates(week);
  const s = (date, duration_min, rpe = 5) => ({ date, duration_min, rpe });

  it('null com menos de 2 dias de carga ou carga igual todos os dias', () => {
    expect(weekMonotony([s(dias[0], 60)], week)).toBeNull();
    expect(weekMonotony(dias.map((d) => s(d, 20)), week)).toBeNull();
    expect(weekMonotony([s(dias[0], 60, null), s(dias[1], 60, null)], week)).toBeNull();
  });

  it('média ÷ desvio-padrão da carga diária (Foster), duas casas', () => {
    // 6 dias com 100 de carga e 1 dia parado
    const m = weekMonotony(dias.slice(0, 6).map((d) => s(d, 20)), week);
    expect(m).toBe(2.45);
    expect(monotonyHint(m)).toMatch(/muito parecida/);
    const variada = weekMonotony([s(dias[0], 60, 8), s(dias[2], 20, 3)], week);
    expect(variada).toBeLessThan(2);
    expect(monotonyHint(variada)).toMatch(/Boa variação/);
  });

  it('ignora sessões de outra semana', () => {
    expect(weekMonotony([s('2026-09-30', 60), s('2026-10-01', 30)], week)).toBeNull();
  });

  it('sem medida, sem frase', () => {
    expect(monotonyHint(null)).toBe('');
    expect(monotonyHint(undefined)).toBe('');
  });
});

describe('minutesByArea', () => {
  it('soma por área, juntando as habilidades da sessão e dos itens; divide o tempo entre as áreas', () => {
    const itemsById = { i1: { skills: ['kitchen.dink_cruzado'] }, i2: { skills: ['net.reset', 'kitchen'] } };
    const sessions = [
      { duration_min: 60, skills: ['serve'], item_ids: ['i1'] }, // serve 30, kitchen 30
      { duration_min: 45, item_ids: ['i2', 'sumiu'] }, // kitchen 22,5, net 22,5
      { duration_min: 99 }, // sem habilidade: fica de fora
    ];
    const out = minutesByArea(sessions, itemsById);
    expect(out).toMatchObject({ serve: 30, kitchen: 53, net: 23, mental: 0 });
    expect(Object.keys(out)).toHaveLength(10);
    // sem os itens, só as habilidades da própria sessão contam
    expect(minutesByArea(sessions)).toMatchObject({ serve: 60, kitchen: 0, net: 0 });
  });
});

describe('autoavaliação', () => {
  it(`devida a cada ${ASSESSMENT_EVERY_DAYS} dias; a primeira é devida já`, () => {
    expect(assessmentDue([], '2026-10-08')).toEqual({ due: true, last: null, next: '2026-10-08' });
    const hist = [{ date: '2026-08-01' }, { date: '2026-09-10' }];
    expect(assessmentDue(hist, '2026-10-07')).toEqual({ due: false, last: '2026-09-10', next: '2026-10-08' });
    expect(assessmentDue(hist, '2026-10-08').due).toBe(true);
    expect(assessmentDue(hist, '2026-11-20').due).toBe(true);
  });

  it('normalizeAssessment: notas 1–5 inteiras; área sem nota fica de fora', () => {
    expect(normalizeAssessment({ serve: 4.4, kitchen: 0, net: 6, mental: '3', inventada: 5 }, '2026-10-08'))
      .toEqual({ date: '2026-10-08', scores: { serve: 4, mental: 3 } });
  });

  it('assessmentDelta: últimas duas por data, só áreas avaliadas nas duas', () => {
    const list = [
      { date: '2026-10-01', scores: { serve: 4, kitchen: 2, net: 3 } },
      { date: '2026-08-01', scores: { serve: 1 } },
      { date: '2026-09-01', scores: { serve: 2, kitchen: 3 } },
    ];
    expect(assessmentDelta(list)).toEqual({ serve: 2, kitchen: -1 });
    expect(assessmentDelta([list[0]])).toEqual({});
  });
});

describe('masteryCounts', () => {
  it('conta só os estados conhecidos', () => {
    expect(masteryCounts({ a: 'aprendendo', b: 'dominado', c: 'dominado', d: 'outro' }))
      .toEqual({ aprendendo: 1, consistente: 0, dominado: 2 });
    expect(masteryCounts(null)).toEqual({ aprendendo: 0, consistente: 0, dominado: 0 });
  });
});
