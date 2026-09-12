/**
 * A seleção de reserva — o que a pessoa escolheu no calendário.
 *
 * O que estes testes protegem:
 *  1. ⭐ **várias quadras e vários horários no mesmo dia**, que era o caso que
 *     o fluxo antigo não sabia expressar;
 *  2. ⭐ o agrupamento: quadras com os MESMOS horários viram uma reserva só;
 *     com horários diferentes, viram reservas separadas;
 *  3. ⭐ "qualquer quadra" (`court_id: null`) nunca se mistura com quadra
 *     escolhida — são pedidos de natureza diferente;
 *  4. a recorrência repete o que foi escolhido, e o metadado `recurrence` só é
 *     gravado quando é VERDADE.
 */
import { describe, it, expect } from 'vitest';
import {
  RECURRENCE_MAX_WEEKS, cellKey, isCellSelected, toggleSelectionCell,
  sortSelection, selectionCourtIds, groupSelectionByCourt, expandSelectionWeeks,
  addDays, selectionMinutes, summarizeSelection, describableRecurrence,
} from './bookingSelection.js';

const cel = (court_id, start, date = '2026-10-02') => ({
  court_id, date, start, end: `${String(Number(start.slice(0, 2)) + 1).padStart(2, '0')}:00`,
});

/* ============================================================== básico === */

describe('ligar e desligar células', () => {
  it('adiciona, reconhece e remove', () => {
    let sel = [];
    sel = toggleSelectionCell(sel, cel('c1', '19:00'));
    expect(sel).toHaveLength(1);
    expect(isCellSelected(sel, cel('c1', '19:00'))).toBe(true);
    sel = toggleSelectionCell(sel, cel('c1', '19:00'));
    expect(sel).toEqual([]);
  });

  it('⭐ a mesma hora em quadras diferentes são células diferentes', () => {
    let sel = toggleSelectionCell([], cel('c1', '19:00'));
    sel = toggleSelectionCell(sel, cel('c2', '19:00'));
    expect(sel).toHaveLength(2);
  });

  it('a mesma quadra em horas diferentes também', () => {
    let sel = toggleSelectionCell([], cel('c1', '19:00'));
    sel = toggleSelectionCell(sel, cel('c1', '20:00'));
    expect(sel).toHaveLength(2);
  });

  it('"qualquer quadra" é uma célula legítima', () => {
    const sel = toggleSelectionCell([], cel(null, '19:00'));
    expect(sel[0].court_id).toBeNull();
    expect(isCellSelected(sel, cel(null, '19:00'))).toBe(true);
  });

  it('nunca depende da ordem do clique', () => {
    const a = [cel('c2', '20:00'), cel('c1', '19:00')].reduce(toggleSelectionCell, []);
    const b = [cel('c1', '19:00'), cel('c2', '20:00')].reduce(toggleSelectionCell, []);
    expect(a).toEqual(b);
  });

  it('não muda a lista recebida', () => {
    const original = [cel('c1', '19:00')];
    const copia = JSON.parse(JSON.stringify(original));
    toggleSelectionCell(original, cel('c2', '20:00'));
    expect(original).toEqual(copia);
  });

  it('aguenta entrada nula', () => {
    expect(isCellSelected(null, cel('c1', '19:00'))).toBe(false);
    expect(sortSelection(null)).toEqual([]);
    expect(selectionCourtIds(null)).toEqual([]);
    expect(cellKey(null)).toBe('||');
  });
});

/* =========================================================== agrupar === */

describe('groupSelectionByCourt', () => {
  it('uma quadra com vários horários: UM pedido', () => {
    const sel = [cel('c1', '19:00'), cel('c1', '20:00')];
    const grupos = groupSelectionByCourt(sel);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].courtIds).toEqual(['c1']);
    expect(grupos[0].slots.map((s) => s.start)).toEqual(['19:00', '20:00']);
  });

  it('⭐ duas quadras nos MESMOS horários: um pedido só, com as duas', () => {
    const sel = [cel('c1', '19:00'), cel('c2', '19:00'), cel('c1', '20:00'), cel('c2', '20:00')];
    const grupos = groupSelectionByCourt(sel);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].courtIds.sort()).toEqual(['c1', 'c2']);
    expect(grupos[0].slots).toHaveLength(2);
  });

  it('⭐ duas quadras em horários DIFERENTES: dois pedidos', () => {
    const sel = [cel('c1', '19:00'), cel('c2', '20:00')];
    const grupos = groupSelectionByCourt(sel);
    expect(grupos).toHaveLength(2);
    const c1 = grupos.find((g) => g.courtIds.includes('c1'));
    const c2 = grupos.find((g) => g.courtIds.includes('c2'));
    expect(c1.slots[0].start).toBe('19:00');
    expect(c2.slots[0].start).toBe('20:00');
  });

  it('⭐ "qualquer quadra" não se mistura com quadra escolhida', () => {
    // Mesmo horário: ainda assim são dois pedidos diferentes.
    const sel = [cel('c1', '19:00'), cel(null, '19:00')];
    const grupos = groupSelectionByCourt(sel);
    expect(grupos).toHaveLength(2);
    expect(grupos.some((g) => g.courtIds[0] === null)).toBe(true);
    expect(grupos.some((g) => g.courtIds[0] === 'c1')).toBe(true);
  });

  it('três quadras, duas iguais e uma diferente: dois pedidos', () => {
    const sel = [
      cel('c1', '19:00'), cel('c2', '19:00'),
      cel('c3', '21:00'),
    ];
    const grupos = groupSelectionByCourt(sel);
    expect(grupos).toHaveLength(2);
    expect(grupos.find((g) => g.courtIds.length === 2).courtIds.sort()).toEqual(['c1', 'c2']);
  });

  it('seleção vazia não gera pedido', () => {
    expect(groupSelectionByCourt([])).toEqual([]);
    expect(groupSelectionByCourt(null)).toEqual([]);
  });

  it('⭐ todo horário escolhido aparece em exatamente um pedido', () => {
    const sel = [
      cel('c1', '19:00'), cel('c1', '20:00'), cel('c2', '20:00'),
      cel('c3', '19:00'), cel(null, '21:00'),
    ];
    const grupos = groupSelectionByCourt(sel);
    const pares = grupos.flatMap((g) => g.courtIds.flatMap(
      (id) => g.slots.map((s) => `${id || 'qualquer'}|${s.start}`),
    ));
    expect(pares.sort()).toEqual([
      'qualquer|21:00', 'c1|19:00', 'c1|20:00', 'c2|20:00', 'c3|19:00',
    ].sort());
    expect(new Set(pares).size).toBe(pares.length);
  });
});

/* ======================================================== recorrência === */

describe('expandSelectionWeeks', () => {
  it('uma semana é a própria seleção', () => {
    const sel = [cel('c1', '19:00')];
    expect(expandSelectionWeeks(sel, 1)).toEqual(sortSelection(sel));
    expect(expandSelectionWeeks(sel, 0)).toEqual(sortSelection(sel));
  });

  it('⭐ repete de sete em sete dias', () => {
    const out = expandSelectionWeeks([cel('c1', '19:00')], 3);
    expect(out.map((c) => c.date)).toEqual(['2026-10-02', '2026-10-09', '2026-10-16']);
  });

  it('repete TODAS as células escolhidas', () => {
    const out = expandSelectionWeeks([cel('c1', '19:00'), cel('c2', '20:00')], 2);
    expect(out).toHaveLength(4);
    expect(new Set(out.map((c) => c.date))).toEqual(new Set(['2026-10-02', '2026-10-09']));
  });

  it('atravessa a virada do mês', () => {
    const out = expandSelectionWeeks([cel('c1', '19:00', '2026-10-29')], 2);
    expect(out.map((c) => c.date)).toEqual(['2026-10-29', '2026-11-05']);
  });

  it('teto de semanas', () => {
    const out = expandSelectionWeeks([cel('c1', '19:00')], 999);
    expect(out).toHaveLength(RECURRENCE_MAX_WEEKS);
  });
});

describe('addDays', () => {
  it('soma sem fuso', () => {
    expect(addDays('2026-10-02', 7)).toBe('2026-10-09');
    expect(addDays('2026-12-28', 7)).toBe('2027-01-04');
    expect(addDays('2026-02-25', 7)).toBe('2026-03-04');
  });
  it('data inválida volta como veio', () => {
    expect(addDays('02/10/2026', 7)).toBe('02/10/2026');
    expect(addDays(null, 7)).toBeNull();
  });
});

describe('describableRecurrence', () => {
  it('sem recorrência, não há metadado', () => {
    expect(describableRecurrence([cel('c1', '19:00')], 1)).toBeNull();
  });

  it('⭐ um horário só, repetido: metadado verdadeiro', () => {
    const r = describableRecurrence([cel('c1', '19:00')], 4);
    expect(r).toEqual({
      weekday: 5, start: '19:00', end: '20:00', weeks: 4, fromDate: '2026-10-02',
    });
  });

  it('⭐ com VÁRIOS horários, não inventa um start/end só', () => {
    // O campo `recurrence` tem um horário só; com dois, ele seria mentira.
    // A verdade completa vai na lista de horários de qualquer jeito.
    expect(describableRecurrence([cel('c1', '19:00'), cel('c1', '20:00')], 4)).toBeNull();
    expect(describableRecurrence([cel('c1', '19:00'), cel('c2', '19:00')], 4)).toBeNull();
  });

  it('data inválida não vira recorrência', () => {
    expect(describableRecurrence([{ court_id: 'c1', date: 'xx', start: '19:00', end: '20:00' }], 4)).toBeNull();
  });
});

/* ============================================================ resumo === */

describe('summarizeSelection', () => {
  const nomes = new Map([['c1', 'Quadra 1'], ['c2', 'Quadra 2']]);

  it('conta horários, quadras e minutos', () => {
    const r = summarizeSelection([cel('c1', '19:00'), cel('c1', '20:00'), cel('c2', '19:00')], nomes);
    expect(r.total).toBe(3);
    expect(r.quadras).toBe(2);
    expect(r.minutos).toBe(180);
    expect(r.datas).toEqual(['2026-10-02']);
  });

  it('agrupa por quadra com o nome de verdade', () => {
    const r = summarizeSelection([cel('c1', '19:00'), cel('c2', '20:00')], nomes);
    expect(r.porQuadra.map((q) => q.nome).sort()).toEqual(['Quadra 1', 'Quadra 2']);
  });

  it('"qualquer quadra" se identifica e não conta como quadra escolhida', () => {
    const r = summarizeSelection([cel(null, '19:00')], nomes);
    expect(r.qualquerQuadra).toBe(true);
    expect(r.quadras).toBe(0);
    expect(r.porQuadra[0].nome).toBe('Qualquer quadra');
  });

  it('aceita mapa de nomes como objeto simples, ou nenhum', () => {
    expect(summarizeSelection([cel('c1', '19:00')], { c1: 'Central' }).porQuadra[0].nome).toBe('Central');
    expect(summarizeSelection([cel('c1', '19:00')]).porQuadra[0].nome).toBe('Quadra');
  });

  it('várias datas (recorrência) aparecem todas', () => {
    const r = summarizeSelection(expandSelectionWeeks([cel('c1', '19:00')], 3), nomes);
    expect(r.datas).toHaveLength(3);
  });

  it('seleção vazia não quebra', () => {
    const r = summarizeSelection([]);
    expect(r).toMatchObject({ total: 0, minutos: 0, quadras: 0, qualquerQuadra: false });
    expect(r.porQuadra).toEqual([]);
  });
});

describe('selectionMinutes', () => {
  it('soma as faixas', () => {
    expect(selectionMinutes([cel('c1', '19:00'), cel('c1', '20:00')])).toBe(120);
  });
  it('ignora faixa inválida em vez de somar lixo', () => {
    expect(selectionMinutes([{ start: '20:00', end: '19:00' }, { start: 'x', end: 'y' }])).toBe(0);
  });
});
