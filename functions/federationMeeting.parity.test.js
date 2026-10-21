/**
 * PARIDADE cliente × servidor das reuniões e assembleias: a tela valida a
 * convocação e o resultado com a mesma régua que o servidor aplica (pauta,
 * datas, quórum, resultados por tipo de item, votos, documentos).
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import * as c from '@/modules/federations/domain/meeting.js';

const require = createRequire(import.meta.url);
const s = require('./federationMeetingPolicy.js');

const NOW = Date.UTC(2026, 9, 21, 15, 0, 0);
const PAUTA = [{ id: 'p1', kind: 'deliberation' }, { id: 'p2', kind: 'election' }, { id: 'p3', kind: 'information' }];

const CONVOCACOES = [
  [{ convened_on: '2026-10-21', edital_doc_id: 'abc', quorum_first: '  maioria   absoluta ', second_call_time: '19:30', items: [{ title: 'Contas', kind: 'deliberation' }, { title: '', description: '' }, { title: 'Eleição', kind: 'election', description: 'a\r\n\n\n\nb' }] }, { eventDate: '2026-11-20' }],
  [{ convened_on: '2026-10-22', items: [{ title: 'x' }] }, { eventDate: '2026-11-20' }],
  [{ convened_on: '2026-10-10', items: [{ title: 'x' }] }, { eventDate: '2026-10-05' }],
  [{ convened_on: 'ontem', second_call_time: '25:00', items: [{ description: 'sem título' }], edital_doc_id: 'x/y' }, {}],
  [{ convened_on: '2026-10-01', items: Array.from({ length: 41 }, (_, i) => ({ title: `i${i}` })) }, {}],
];

const RESULTADOS = [
  { call: 'first', opened_at: '19:05', present: '10', eligible: '20', items: [{ id: 'p1', result: 'approved', votes: { yes: '8', no: '1', abstain: '' } }, { id: 'p2', result: 'elected', summary: 'A e B' }, { id: 'p3', result: 'informed', votes: { yes: '3' } }], minutes_doc_id: 'ata1', notes: 'ok' },
  { call: 'second', quorum_reached: false, present: '3', items: [{ id: 'p1', result: 'approved' }, { id: 'p2', result: 'postponed' }, { id: 'p3', result: 'withdrawn' }] },
  { call: 'third', present: '-1', eligible: 'x', items: [{ id: 'p1', result: 'informed' }, { id: 'p2', result: 'approved', votes: { yes: '1.5' } }] },
  { call: 'first', present: '30', eligible: '20', items: [{ result: 'rejected', votes: { yes: '1', no: '9' } }, { result: 'withdrawn' }, { result: 'informed' }] },
  {},
];

describe('paridade: reuniões e assembleias', () => {
  it('os mesmos tetos e listas', () => {
    expect(s.MEETING_ITEMS_MAX).toBe(c.MEETING_ITEMS_MAX);
    expect(s.MEETING_ITEM_TITLE_MAX).toBe(c.MEETING_ITEM_TITLE_MAX);
    expect(s.MEETING_ITEM_TEXT_MAX).toBe(c.MEETING_ITEM_TEXT_MAX);
    expect(s.MEETING_QUORUM_MAX).toBe(c.MEETING_QUORUM_MAX);
    expect(s.MEETING_NOTES_MAX).toBe(c.MEETING_NOTES_MAX);
    expect(s.MEETING_VOTES_MAX).toBe(c.MEETING_VOTES_MAX);
    expect(s.CONVOCATION_DAYS_DEFAULT).toBe(c.CONVOCATION_DAYS_DEFAULT);
    expect(s.ITEM_KIND_IDS).toEqual(c.ITEM_KINDS.map((k) => k.id));
    expect(s.CALL_IDS).toEqual(c.MEETING_CALLS.map((k) => k.id));
    expect(Object.fromEntries(Object.entries(c.ITEM_RESULTS).map(([id, r]) => [id, r.kinds]))).toEqual(s.ITEM_RESULTS);
    expect(s.MEETING_DOC_TYPES).toEqual(c.MEETING_DOC_TYPES);
    expect(s.todayBr(NOW)).toBe(c.todayBr(NOW));
  });

  it('a mesma convocação (resultado, campos com erro e valor)', () => {
    CONVOCACOES.forEach(([input, opts]) => {
      const a = c.validateConvocation(input, { ...opts, nowMs: NOW });
      const b = s.validateConvocation(input, { ...opts, nowMs: NOW });
      expect(a.ok).toBe(b.ok);
      expect(Object.keys(a.errors).sort()).toEqual(Object.keys(b.errors).sort());
      expect(a.value).toEqual(b.value);
    });
  });

  it('o mesmo resultado (resultado, campos com erro e valor)', () => {
    RESULTADOS.forEach((input) => {
      const a = c.validateRecord(input, PAUTA);
      const b = s.validateRecord(input, PAUTA);
      expect(a.ok).toBe(b.ok);
      expect(Object.keys(a.errors).sort()).toEqual(Object.keys(b.errors).sort());
      expect(a.value).toEqual(b.value);
    });
  });
});
