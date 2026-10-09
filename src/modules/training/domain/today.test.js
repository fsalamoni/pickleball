import { describe, it, expect } from 'vitest';
import { todaySession, TODAY_SOURCE } from './today.js';

const today = '2026-10-08'; // quinta (4)
const plan = {
  id: 'p1', title: 'Plano da cozinha', status: 'ativo', start_date: '2026-10-05', weeks: 4, minutes: 50,
  slots: [{ week: 1, day: 4, title: 'Dinks', item_ids: ['x1', 'x2'], duration_min: 40 }],
};
const share = (over) => ({ id: 's', kind: 'aluno', item_id: 'i', from_name: 'Prof. Ana', done_at: null, due_date: null, ...over });
const items = [
  { id: 'aq', kind: 'fisico', skills: ['physical.aquecimento'], duration_min: 10 },
  ...Array.from({ length: 8 }, (_, i) => ({ id: `k${i}`, kind: 'drill', skills: ['kitchen'], duration_min: 10 })),
  { id: 'sv', kind: 'drill', skills: ['serve'], duration_min: 10 },
  { id: 'est', kind: 'estudo', skills: ['kitchen'] },
  { id: 'ses', kind: 'treino', skills: ['kitchen'] },
  { id: 'old', kind: 'drill', skills: ['kitchen'], legacy: true },
  { id: 'pro', kind: 'drill', skills: ['kitchen'], level_min: 6 },
];
const pick = (...ids) => items.filter((it) => ids.includes(it.id));

describe('todaySession — ordem de prioridade', () => {
  it('1) o dia do plano ativo vence tudo', () => {
    const r = todaySession({ today, uid: 'u', plan, inbox: [share({ id: 's1' })], items });
    expect(r).toMatchObject({ source: TODAY_SOURCE.PLANO, title: 'Dinks', itemIds: ['x1', 'x2'], minutes: 40 });
    expect(r.note).toContain('Plano da cozinha');
  });

  it('2) sem slot hoje: o que o professor mandou e ainda não foi feito (prazo mais perto antes, até 3)', () => {
    const inbox = [
      share({ id: 'sem_prazo', item_id: 'a' }),
      share({ id: 'futuro', item_id: 'b', due_date: '2026-10-20' }),
      share({ id: 'atrasado', item_id: 'c', due_date: '2026-10-01' }),
      share({ id: 'hoje', item_id: 'd', due_date: today }),
      share({ id: 'feito', item_id: 'e', done_at: { seconds: 1 } }),
      share({ id: 'ind', item_id: 'f', kind: 'indicacao' }),
      share({ id: 'antigo', item_id: 'g', due_date: '2026-09-01', from_name: 'Prof. Bia' }),
    ];
    const r = todaySession({ today, uid: 'u', plan: { ...plan, status: 'pausado' }, inbox, items });
    expect(r.source).toBe(TODAY_SOURCE.PROFESSOR);
    expect(r.shareIds).toEqual(['antigo', 'atrasado', 'hoje']);
    expect(r.itemIds).toEqual(['g', 'c', 'd']);
    expect(r.note).toBe('Prof. Bia mandou para você treinar.');
  });

  it('3) fora dos dias da rotina é descanso — a menos que a pessoa force', () => {
    const routine = { days: [1, 3], minutes: 30, focus: ['kitchen'] };
    expect(todaySession({ today, uid: 'u', routine, items }).source).toBe(TODAY_SOURCE.DESCANSO);
    // o professor ainda vem antes do descanso
    expect(todaySession({ today, uid: 'u', routine, items, inbox: [share({})] }).source).toBe(TODAY_SOURCE.PROFESSOR);
    expect(todaySession({ today, uid: 'u', routine, items, force: true }).source).toBe(TODAY_SOURCE.RECOMENDACAO);
  });

  it('4) recomendação: aquecimento + itens do foco, no nível, até 4 e no tempo', () => {
    const r = todaySession({ today, uid: 'u', items, routine: { days: [4], minutes: 40, focus: ['kitchen'] }, level: 3 });
    expect(r.source).toBe(TODAY_SOURCE.RECOMENDACAO);
    expect(r.title).toBe('Treino do seu foco');
    expect(r.minutes).toBe(40);
    expect(r.itemIds[0]).toBe('aq');
    expect(r.itemIds.length).toBeLessThanOrEqual(4);
    for (const id of r.itemIds.slice(1)) expect(id).toMatch(/^k\d$/);
  });

  it('5) nada que sirva: vazio, sem inventar', () => {
    const r = todaySession({ today, uid: 'u', level: 3, items: pick('est', 'ses', 'old', 'pro') });
    expect(r).toMatchObject({ source: TODAY_SOURCE.VAZIO, itemIds: [], minutes: 45 });
  });
});

describe('todaySession — estável', () => {
  const run = (t, uid) => todaySession({ today: t, uid, items, routine: { focus: ['kitchen'], minutes: 60 } }).itemIds;

  it('mesma data e pessoa ⇒ mesma resposta ao recarregar', () => {
    expect(run(today, 'u1')).toEqual(run(today, 'u1'));
  });

  it('a semente muda com a data (e com a pessoa)', () => {
    const dias = ['2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12'].map((d) => run(d, 'u1').join());
    expect(new Set(dias).size).toBeGreaterThan(1);
    const pessoas = ['u1', 'u2', 'u3', 'u4', 'u5'].map((u) => run(today, u).join());
    expect(new Set(pessoas).size).toBeGreaterThan(1);
  });

  it('nível desconhecido não esconde nada', () => {
    const r = todaySession({ today, uid: 'u', items: pick('pro'), level: null });
    expect(r.itemIds).toEqual(['pro']);
  });
});
