import { describe, it, expect } from 'vitest';
import {
  GAME_ASPECTS, debriefSourceKey, debriefId, debriefEnabledFor, debriefSince, normalizeDebrief,
  pendingDebriefs, answeredDebriefs, debriefFocus, needsLightWeek, suggestWeek, debriefPlanChange, debriefTrends,
} from './debrief.js';
import { isValidSkill } from './taxonomy.js';
import { normalizePlan } from './plan.js';
import { weekdayOf } from './dates.js';

const today = '2026-10-08'; // quinta
const src = (over = {}) => ({ type: 'dia_de_jogo', ref_id: 'gd1', title: 'Sábado na arena', date: '2026-10-07', ...over });
const answered = (over = {}) => ({
  source: src(), status: 'respondido', rating: 3, strengths: [], weaknesses: [], evolution: 'igual', ...over,
});

const item = (id, skills, over = {}) => ({ id, title: id, kind: 'drill', skills, duration_min: 15, ...over });
const library = [
  item('aq1', ['physical.aquecimento'], { kind: 'fisico', duration_min: 10 }),
  item('aq2', ['physical.aquecimento'], { kind: 'fisico', duration_min: 10 }),
  item('dink1', ['kitchen.dink_cruzado']),
  item('dink2', ['kitchen.dink_paralelo']),
  item('dink3', ['kitchen']),
  item('saque1', ['serve.saque_profundo']),
  item('saque2', ['serve.consistencia']),
  item('volei1', ['net.voleio']),
  item('forte', ['groundstrokes.drive']),
  item('pesado', ['kitchen.dink_cruzado'], { intensity: 4 }),
  item('avancado', ['kitchen.dink_cruzado'], { level_min: 5 }),
  item('estudo', ['kitchen'], { kind: 'estudo' }),
  item('velho', ['kitchen'], { legacy: true }),
];

describe('aspectos', () => {
  it('ids únicos e toda habilidade existe na taxonomia', () => {
    expect(new Set(GAME_ASPECTS.map((a) => a.id)).size).toBe(GAME_ASPECTS.length);
    GAME_ASPECTS.forEach((a) => a.skills.forEach((s) => expect(isValidSkill(s), s).toBe(true)));
  });
});

describe('ids e opção da pessoa', () => {
  it('um balanço por pessoa por jogo, com o uid no começo', () => {
    expect(debriefSourceKey(src())).toBe('dia_de_jogo_gd1');
    expect(debriefId('u1', src())).toBe('u1_dia_de_jogo_gd1');
    expect(debriefId('u1', { type: 'reserva', ref_id: 'b/1 x' })).toBe('u1_reserva_b1x');
    expect(debriefId('', src())).toBe('');
    expect(debriefId('u1', { type: 'x' })).toBe('');
  });

  it('ligado só quando a pessoa ligou; "desde" só com data válida', () => {
    expect(debriefEnabledFor(null)).toBe(false);
    expect(debriefEnabledFor({ debrief: { enabled: true } })).toBe(true);
    expect(debriefSince({ debrief: { since: '2026-10-01' } })).toBe('2026-10-01');
    expect(debriefSince({ debrief: { since: 'ontem' } })).toBeNull();
  });
});

describe('normalizeDebrief', () => {
  it('exige jogo, data e nota', () => {
    expect(normalizeDebrief({ rating: 3 }).valid).toBe(false);
    expect(normalizeDebrief({ source: src(), rating: 0 }).error).toMatch(/como foi/);
  });

  it('limita aspectos a 3, tira desconhecidos e o que está nos dois lados', () => {
    const { value } = normalizeDebrief({
      source: { ...src(), games: '4', wins: 9.4, title: '' },
      rating: 4.6,
      strengths: ['dink', 'saque', 'nada'],
      weaknesses: ['dink', 'devolucao', 'drive', 'mental', 'fisico'],
      evolution: 'talvez',
      body: 7,
      mind: 2,
      note: 'x'.repeat(600),
    });
    expect(value).toMatchObject({
      rating: 5, strengths: ['dink', 'saque'], weaknesses: ['devolucao', 'drive'], evolution: 'nao_sei',
      body: null, mind: 2, status: 'respondido',
    });
    expect(value.source).toMatchObject({ games: 4, wins: 9, title: 'Dia de jogo' });
    expect(value.note).toHaveLength(500);
  });
});

describe('pendingDebriefs', () => {
  const events = [
    src({ ref_id: 'a', date: '2026-10-07' }),
    src({ ref_id: 'b', date: '2026-09-25' }), // antes de ligar
    src({ ref_id: 'c', date: '2026-09-29' }), // fora dos 7 dias
    src({ ref_id: 'd', date: '2026-10-08', ends_at_ms: 2000 }), // ainda não terminou
    src({ ref_id: 'e', date: '2026-10-06', type: 'torneio' }),
    src({ ref_id: 'a', date: '2026-10-07' }), // repetido
    src({ ref_id: 'f', date: '2026-10-05' }), // já respondido
    { type: 'x', ref_id: 'g', date: '2026-10-07' },
  ];
  it('só o que terminou, depois de ligar, nos últimos 7 dias e ainda sem balanço', () => {
    const r = pendingDebriefs({
      events, debriefs: [answered({ source: src({ ref_id: 'f' }) })], since: '2026-09-28', today, nowMs: 1000,
    });
    expect(r.map((e) => e.ref_id)).toEqual(['a', 'e']);
  });
  it('desligado (sem "desde") não pede nada; dispensado também conta como resolvido', () => {
    expect(pendingDebriefs({ events, debriefs: [], since: null, today })).toEqual([]);
    const r = pendingDebriefs({ events, debriefs: [{ source: src({ ref_id: 'a' }), status: 'dispensado' }], since: '2026-10-01', today, nowMs: 1000 });
    expect(r.map((e) => e.ref_id)).toEqual(['e', 'f']);
  });
});

describe('answeredDebriefs', () => {
  it('só os respondidos, do mais recente', () => {
    const r = answeredDebriefs([
      answered({ source: src({ date: '2026-10-01' }) }),
      { source: src(), status: 'dispensado' },
      answered({ source: src({ date: '2026-10-05' }) }),
    ]);
    expect(r.map((d) => d.source.date)).toEqual(['2026-10-05', '2026-10-01']);
  });
});

describe('debriefFocus', () => {
  it('o que faltou hoje vem antes; o repetido no histórico ganha peso; o forte de hoje sai', () => {
    const hoje = answered({ weaknesses: ['saque'], strengths: ['dink'] });
    const hist = [
      answered({ source: src({ ref_id: 'x' }), weaknesses: ['dink', 'devolucao'] }),
      answered({ source: src({ ref_id: 'y' }), weaknesses: ['devolucao'] }),
    ];
    const { focus, maintain } = debriefFocus(hoje, hist);
    expect(focus.map((f) => f.id)).toEqual(['saque', 'devolucao']);
    expect(focus[1].reason).toMatch(/2 dos seus balanços/);
    expect(maintain).toEqual({ id: 'dink', label: 'Dink e jogo curto' });
  });
  it('o próprio balanço no histórico não conta duas vezes', () => {
    const hoje = answered({ weaknesses: ['saque'] });
    expect(debriefFocus(hoje, [hoje]).focus[0].reason).toMatch(/neste jogo/);
  });
});

describe('needsLightWeek', () => {
  it('corpo ou cabeça no limite, ou caiu num jogo ruim', () => {
    expect(needsLightWeek({ body: 2 })).toBe(true);
    expect(needsLightWeek({ mind: 1 })).toBe(true);
    expect(needsLightWeek({ evolution: 'piorou', rating: 2 })).toBe(true);
    expect(needsLightWeek({ evolution: 'piorou', rating: 4, body: 4 })).toBe(false);
  });
});

describe('suggestWeek', () => {
  const debrief = answered({ weaknesses: ['dink', 'saque'], strengths: ['drive'], body: 4, mind: 4 });

  it('três dias espaçados sem rotina, com aquecimento e o foco, respeitando nível e tipo', () => {
    const s = suggestWeek({ debrief, items: library, level: 3, today });
    expect(s.days.map((d) => d.date)).toEqual(['2026-10-09', '2026-10-11', '2026-10-13']);
    expect(s.focus.map((f) => f.id)).toEqual(['dink', 'saque']);
    expect(s.empty).toBe(false);
    s.days.forEach((d) => {
      expect(['aq1', 'aq2']).toContain(d.item_ids[0]);
      expect(d.item_ids.length).toBeLessThanOrEqual(4);
      expect(d.item_ids).not.toContain('avancado');
      expect(d.item_ids).not.toContain('estudo');
      expect(d.item_ids).not.toContain('velho');
    });
    // o ponto forte entra no último dia, para manter
    expect(s.days[2].item_ids).toContain('forte');
    expect(s.skills).toContain('kitchen.dink_cruzado');
  });

  it('é determinística', () => {
    expect(suggestWeek({ debrief, items: library, today })).toEqual(suggestWeek({ debrief, items: [...library].reverse(), today }));
  });

  it('segue os dias da rotina (até 4) e o tempo dela', () => {
    const s = suggestWeek({ debrief, items: library, today, routine: { days: [1, 2, 3, 4, 5, 6], minutes: 30 } });
    expect(s.days).toHaveLength(4);
    s.days.forEach((d) => expect([1, 2, 3, 4, 5, 6]).toContain(weekdayOf(d.date)));
    expect(s.minutes).toBe(30);
  });

  it('semana leve: dois dias, menos tempo e nada intenso', () => {
    const s = suggestWeek({ debrief: { ...debrief, body: 1 }, items: library, today });
    expect(s.light).toBe(true);
    expect(s.days).toHaveLength(2);
    expect(s.minutes).toBe(31);
    s.days.forEach((d) => expect(d.item_ids).not.toContain('pesado'));
    expect(s.message).toMatch(/mais leve/);
  });

  it('sem nada a melhorar: treino geral; biblioteca sem itens do foco: avisa', () => {
    expect(suggestWeek({ debrief: answered(), items: library, today }).message).toMatch(/manter o ritmo/);
    const s = suggestWeek({ debrief: answered({ weaknesses: ['lob_smash'] }), items: library, today });
    expect(s.empty).toBe(true);
  });
});

describe('debriefPlanChange', () => {
  const days = [
    { date: '2026-10-09', title: 'Balanço: dink', item_ids: ['aq1', 'dink1'], minutes: 45 },
    { date: '2026-10-13', title: 'Balanço: dink', item_ids: ['aq2', 'dink2'], minutes: 45 },
    { date: '2026-10-11', title: 'nada', item_ids: [], minutes: 45 },
  ];

  it('sem plano em curso: plano novo, curto, que passa pela validação de sempre', () => {
    const r = debriefPlanChange({ days, plans: [], focus: ['dink'], skills: ['kitchen.dink_cruzado'], today });
    expect(r.mode).toBe('novo');
    expect(r.pauses).toBeNull();
    const { valid, value } = normalizePlan(r.input, { today });
    expect(valid).toBe(true);
    expect(value).toMatchObject({ start_date: '2026-10-05', weeks: 2, days: [2, 5], source: 'balanco', focus: ['kitchen.dink_cruzado'] });
    expect(value.slots).toEqual([
      { week: 1, day: 5, title: 'Balanço: dink', item_ids: ['aq1', 'dink1'], duration_min: 45 },
      { week: 2, day: 2, title: 'Balanço: dink', item_ids: ['aq2', 'dink2'], duration_min: 45 },
    ]);
  });

  it('plano ativo que ainda não começou é avisado (ele seria pausado)', () => {
    const futuro = { id: 'p1', status: 'ativo', start_date: '2026-10-19', weeks: 4, days: [1], slots: [] };
    expect(debriefPlanChange({ days, plans: [futuro], today }).pauses).toBe(futuro);
  });

  it('plano em curso: entra nele, junta no dia que já tem treino e estica as semanas', () => {
    const ativo = {
      id: 'p1', title: 'Meu plano', status: 'ativo', start_date: '2026-10-05', weeks: 1, days: [5],
      slots: [{ week: 1, day: 5, title: 'Sexta', item_ids: ['x1', 'x2', 'x3'], duration_min: 60 }],
    };
    const r = debriefPlanChange({ days, plans: [ativo], today });
    expect(r.mode).toBe('plano');
    expect(r.planId).toBe('p1');
    expect(r.added).toBe(2);
    expect(r.patch.weeks).toBe(2);
    expect(r.patch.days).toEqual([2, 5]);
    expect(r.patch.slots[0].item_ids).toEqual(['x1', 'x2', 'x3', 'aq1']);
    expect(r.patch.slots[1]).toMatchObject({ week: 2, day: 2, item_ids: ['aq2', 'dink2'] });
    expect(ativo.slots[0].item_ids).toHaveLength(3); // não muda o original
  });

  it('dia cheio é avisado', () => {
    const ativo = {
      id: 'p1', status: 'ativo', start_date: '2026-10-05', weeks: 4, days: [5],
      slots: [{ week: 1, day: 5, item_ids: ['a', 'b', 'c', 'd'] }],
    };
    expect(debriefPlanChange({ days: [days[0]], plans: [ativo], today }).full).toEqual(['2026-10-09']);
  });

  it('nada escolhido: nada a fazer', () => {
    expect(debriefPlanChange({ days: [days[2]], plans: [], today })).toBeNull();
  });
});

describe('debriefTrends', () => {
  it('média, o que mais falta e como a pessoa sente a evolução', () => {
    const lista = [
      answered({ rating: 2, weaknesses: ['dink'], evolution: 'piorou', source: src({ date: '2026-10-01' }) }),
      answered({ rating: 4, weaknesses: ['dink', 'saque'], strengths: ['drive'], evolution: 'melhorou', source: src({ date: '2026-10-05' }) }),
      { status: 'dispensado', source: src() },
    ];
    const t = debriefTrends(lista);
    expect(t).toMatchObject({ total: 2, average: 3, evolution: { piorou: 1, melhorou: 1 } });
    expect(t.weaknesses[0]).toEqual({ id: 'dink', label: 'Dink e jogo curto', count: 2 });
    expect(t.strengths[0].id).toBe('drive');
    expect(debriefTrends([])).toBeNull();
  });
});
