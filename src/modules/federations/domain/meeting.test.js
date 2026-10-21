import { describe, it, expect } from 'vitest';
import {
  convocationDraft, convocationNotice, meetingActions, recordDraft, recordTally, resultsFor, todayBr, validateConvocation, validateRecord,
} from './meeting.js';

const NOW = Date.UTC(2026, 9, 21, 15, 0, 0);
const PAUTA = [{ id: 'p1', kind: 'deliberation', title: 'Contas' }, { id: 'p2', kind: 'election', title: 'Conselho' }, { id: 'p3', kind: 'information', title: 'Calendário' }];

describe('convocação', () => {
  it('dá id pela posição, ignora linha vazia e limpa o texto', () => {
    const r = validateConvocation({ convened_on: '2026-10-21', items: [{ title: ' Contas ' }, { title: '' }, { title: 'Eleição', kind: 'election' }] }, { eventDate: '2026-11-20', nowMs: NOW });
    expect(r.ok).toBe(true);
    expect(r.value.items).toEqual([{ id: 'p1', title: 'Contas', description: '', kind: 'deliberation' }, { id: 'p2', title: 'Eleição', description: '', kind: 'election' }]);
  });

  it('recusa data futura, depois da reunião, pauta vazia, item sem título e horário inválido', () => {
    expect(validateConvocation({ convened_on: '2026-10-22', items: [{ title: 'x' }] }, { nowMs: NOW }).errors.convened_on).toBeTruthy();
    expect(validateConvocation({ convened_on: '2026-10-10', items: [{ title: 'x' }] }, { eventDate: '2026-10-01', nowMs: NOW }).errors.convened_on).toBeTruthy();
    expect(validateConvocation({ convened_on: '2026-10-10', items: [] }, { nowMs: NOW }).errors.items).toBeTruthy();
    expect(validateConvocation({ convened_on: '2026-10-10', items: [{ description: 'só detalhe' }] }, { nowMs: NOW }).errors.items).toBeTruthy();
    expect(validateConvocation({ convened_on: '2026-10-10', second_call_time: '7h', items: [{ title: 'x' }] }, { nowMs: NOW }).errors.second_call_time).toBeTruthy();
  });

  it('hoje é o de Brasília (às 22h de Brasília ainda é o mesmo dia)', () => {
    expect(todayBr(Date.UTC(2026, 9, 22, 1, 0))).toBe('2026-10-21');
  });
});

describe('resultado', () => {
  const base = { call: 'first', present: '12', items: [{ id: 'p1', result: 'approved', votes: { yes: '10', no: '2' } }, { id: 'p2', result: 'elected' }, { id: 'p3', result: 'informed' }] };

  it('aceita o resultado certo para cada tipo de item e guarda votos só do que foi votado', () => {
    const r = validateRecord(base, PAUTA);
    expect(r.ok).toBe(true);
    expect(r.value.items[0].votes).toEqual({ yes: 10, no: 2, abstain: 0 });
    expect(r.value.items[2].votes).toBeNull();
    expect(validateRecord({ ...base, items: [{ id: 'p1', result: 'postponed', votes: { yes: '3' } }, base.items[1], base.items[2]] }, PAUTA).value.items[0].votes).toBeNull();
  });

  it('recusa resultado de outro tipo, sem quórum com decisão, presentes acima dos aptos e votos inválidos', () => {
    expect(validateRecord({ ...base, items: [{ id: 'p1', result: 'informed' }, base.items[1], base.items[2]] }, PAUTA).errors.item_p1).toBeTruthy();
    expect(validateRecord({ ...base, quorum_reached: false }, PAUTA).errors.item_p1).toBeTruthy();
    expect(validateRecord({ ...base, eligible: '5' }, PAUTA).errors.eligible).toBeTruthy();
    expect(validateRecord({ ...base, items: [{ id: 'p1', result: 'approved', votes: { yes: '-1' } }, base.items[1], base.items[2]] }, PAUTA).errors.item_p1).toBeTruthy();
    expect(validateRecord({ ...base, present: '' }, PAUTA).errors.present).toBeTruthy();
    expect(validateRecord(base, []).errors.items).toBeTruthy();
  });

  it('resultados oferecidos por tipo', () => {
    expect(resultsFor('information').map((r) => r.id)).toEqual(['informed', 'postponed', 'withdrawn']);
    expect(resultsFor('election').map((r) => r.id)).toEqual(['elected', 'postponed', 'withdrawn']);
  });
});

describe('para a tela', () => {
  const ev = { date: '2026-11-20', status: 'scheduled', starts_at_ms: Date.UTC(2026, 10, 20, 22), meeting: { convened_on: '2026-11-15', items: PAUTA } };

  it('antecedência da convocação contra o mínimo do estatuto', () => {
    expect(convocationNotice(ev, 8)).toEqual({ days: 5, min: 8, late: true });
    expect(convocationNotice(ev, 5)).toEqual({ days: 5, min: 5, late: false });
    expect(convocationNotice({ date: '2026-11-20' })).toBeNull();
  });

  it('convocar antes do resultado; registrar só depois de começar', () => {
    const opts = { canManage: true, isMeeting: true };
    expect(meetingActions(ev, { ...opts, nowMs: NOW })).toEqual({ convene: true, record: false });
    expect(meetingActions(ev, { ...opts, nowMs: Date.UTC(2026, 10, 21) })).toEqual({ convene: true, record: true });
    expect(meetingActions({ ...ev, meeting: { ...ev.meeting, record: {} } }, { ...opts, nowMs: Date.UTC(2026, 10, 21) })).toEqual({ convene: false, record: true });
    expect(meetingActions({ ...ev, status: 'cancelled' }, opts)).toEqual({ convene: false, record: false });
    expect(meetingActions(ev, { canManage: false, isMeeting: true })).toEqual({ convene: false, record: false });
  });

  it('rascunhos a partir do evento e contagem dos resultados', () => {
    expect(convocationDraft({}, NOW)).toMatchObject({ convened_on: '2026-10-21', items: [{ title: '', kind: 'deliberation' }] });
    const comResultado = { ...ev, meeting: { ...ev.meeting, record: { call: 'second', present: 9, items: [{ id: 'p2', result: 'elected', doc: { doc_id: 'd1' } }] } } };
    const d = recordDraft(comResultado);
    expect(d).toMatchObject({ call: 'second', present: '9', eligible: '' });
    expect(d.items.map((x) => x.result)).toEqual(['', 'elected', '']);
    expect(d.items[1].doc_id).toBe('d1');
    expect(recordTally({ items: [{ result: 'approved' }, { result: 'approved' }, { result: 'postponed' }] })).toEqual({ approved: 2, postponed: 1 });
  });
});
