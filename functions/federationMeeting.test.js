/**
 * Reuniões e assembleias no SERVIDOR contra um Firestore falso: convocar
 * (pauta, edital do tipo certo, data não futura), mudar a convocação de
 * reunião divulgada (motivo e histórico), registrar o resultado só depois de
 * começar, sem quórum nada se decide, corrigir com motivo, e as travas no
 * `save` (tipo, data antes da convocação, data de reunião com resultado).
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ag = require('./federationAgenda.js');
const { createFakeDb } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 9, 21, 15, 0, 0); // 21/10/2026 12:00 em Brasília
const DEPOIS = Date.UTC(2026, 10, 20, 23, 0, 0); // durante a reunião
const SEC = { uid: 'sec', name: 'Secretaria' };
const COMP = { uid: 'comp', name: 'Competições' };

const doc = (type, extra = {}) => ({ federation_id: 'fpp', status: 'published', code: `${type} 1/2026`, title: `Doc ${type}`, type, visibility: 'public', ...extra });
function cenario() {
  return {
    db: createFakeDb({
      'platform_settings/global': { feature_flags: { federations: true } },
      'federations/fpp': { name: 'Federação Paulista', acronym: 'FPP', slug: 'fpp', status: 'approved', published: true, modules: { calendar: true, official_docs: true } },
      'federation_staff/fpp_sec': { federation_id: 'fpp', user_id: 'sec', role: 'secretary' },
      'federation_staff/fpp_comp': { federation_id: 'fpp', user_id: 'comp', role: 'competitions' },
      'federation_followers/fpp_ana': { federation_id: 'fpp', user_id: 'ana' },
      'federation_docs/edital': doc('convocation'),
      'federation_docs/ata': doc('minutes'),
      'federation_docs/lista': doc('attendance', { visibility: 'members' }),
      'federation_docs/votos': doc('vote_record'),
      'federation_docs/resol': doc('resolution'),
      'federation_docs/outra': doc('minutes', { federation_id: 'fxx' }),
    }),
  };
}
const ctx = ({ db }, now = NOW) => ({ db, now, Timestamp: { fromMillis: (ms) => ({ ms }) }, logger: { info() {}, warn() {} } });
const chamar = (c, actor, data, now) => ag.agenda(ctx(c, now), actor, { federationId: 'fpp', ...data });
const evento = (c, id) => c.db.store.docs.get(`federation_events/${id}`);
const avisos = (c) => [...c.db.store.docs.entries()].filter(([p]) => p.startsWith('notifications/')).map(([, d]) => d);
const ago = (extra = {}) => ({ kind: 'assembly_ordinary', title: 'AGO 2026', date: '2026-11-20', start_time: '19:00', end_time: '21:00', visibility: 'public', ...extra });
const pauta = [
  { title: 'Contas de 2025', kind: 'deliberation' },
  { title: 'Eleição do conselho fiscal', kind: 'election' },
  { title: 'Calendário 2027', kind: 'information' },
];
const convocacao = (extra = {}) => ({ convened_on: '2026-10-21', edital_doc_id: 'edital', quorum_first: 'Maioria absoluta', second_call_time: '19:30', quorum_second: 'Qualquer número', items: pauta, ...extra });
const resultado = (extra = {}) => ({
  call: 'second', opened_at: '19:35', quorum_reached: true, present: '23', eligible: '40',
  items: [
    { id: 'p1', result: 'approved', votes: { yes: '20', no: '2', abstain: '1' }, doc_id: 'resol' },
    { id: 'p2', result: 'elected', summary: 'Eleitos: A, B e C.' },
    { id: 'p3', result: 'informed', votes: { yes: '9' } },
  ],
  minutes_doc_id: 'ata', attendance_doc_id: 'lista', votes_doc_id: 'votos', ...extra,
});

async function marcada(c) {
  const r = await chamar(c, SEC, { action: 'save', event: ago() });
  return r.eventId;
}

describe('reunião: convocar', () => {
  it('grava pauta com ids, edital copiado, avisa quem segue quando pedido', async () => {
    const c = cenario();
    const id = await marcada(c);
    const r = await chamar(c, SEC, { action: 'convene', eventId: id, convocation: convocacao(), notify: true });
    expect(r.notified).toBe(1);
    const m = evento(c, id).meeting;
    expect(m).toMatchObject({ convened_on: '2026-10-21', quorum_first: 'Maioria absoluta', second_call_time: '19:30', record: null, convened_at_ms: NOW });
    expect(m.items.map((x) => x.id)).toEqual(['p1', 'p2', 'p3']);
    expect(m.edital).toEqual({ doc_id: 'edital', code: 'convocation 1/2026', title: 'Doc convocation', type: 'convocation', visibility: 'public' });
    expect(avisos(c).at(-1)).toMatchObject({ user_id: 'ana' });
  });

  it('recusa evento que não é reunião, edital do tipo errado ou de outra federação, data futura, competições', async () => {
    const c = cenario();
    const id = await marcada(c);
    const prova = await chamar(c, SEC, { action: 'save', event: { kind: 'competition', title: 'Etapa', date: '2026-11-14', all_day: true } });
    await expect(chamar(c, SEC, { action: 'convene', eventId: prova.eventId, convocation: convocacao() })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(c, SEC, { action: 'convene', eventId: id, convocation: convocacao({ edital_doc_id: 'ata' }) })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(c, SEC, { action: 'convene', eventId: id, convocation: convocacao({ edital_doc_id: 'outra' }) })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(c, SEC, { action: 'convene', eventId: id, convocation: convocacao({ convened_on: '2026-10-30' }) })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(c, SEC, { action: 'convene', eventId: id, convocation: convocacao({ items: [] }) })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(c, COMP, { action: 'convene', eventId: id, convocation: convocacao() })).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('mudar a convocação de reunião divulgada pede motivo e entra no histórico', async () => {
    const c = cenario();
    const id = await marcada(c);
    await chamar(c, SEC, { action: 'convene', eventId: id, convocation: convocacao() });
    await expect(chamar(c, SEC, { action: 'convene', eventId: id, convocation: convocacao({ items: pauta.slice(0, 2) }) })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(c, SEC, { action: 'convene', eventId: id, convocation: convocacao({ items: pauta.slice(0, 2) }), reason: 'Item 3 vai para a próxima' });
    const ev = evento(c, id);
    expect(ev.meeting.items).toHaveLength(2);
    expect(ev.meeting.convened_at_ms).toBe(NOW);
    expect(ev.history.at(-1)).toMatchObject({ kind: 'agenda_changed', reason: 'Item 3 vai para a próxima' });
  });
});

describe('reunião: resultado', () => {
  it('só depois de começar e de convocar; grava itens, votos e documentos', async () => {
    const c = cenario();
    const id = await marcada(c);
    await expect(chamar(c, SEC, { action: 'record', eventId: id, record: resultado() }, DEPOIS)).rejects.toMatchObject({ code: 'failed-precondition' });
    await chamar(c, SEC, { action: 'convene', eventId: id, convocation: convocacao() });
    await expect(chamar(c, SEC, { action: 'record', eventId: id, record: resultado() })).rejects.toMatchObject({ code: 'failed-precondition' });
    const antes = avisos(c).length;
    await chamar(c, SEC, { action: 'record', eventId: id, record: resultado() }, DEPOIS);
    expect(avisos(c).length).toBe(antes + 1);
    const rec = evento(c, id).meeting.record;
    expect(rec).toMatchObject({ call: 'second', quorum_reached: true, present: 23, eligible: 40, recorded_at_ms: DEPOIS });
    expect(rec.items[0]).toMatchObject({ result: 'approved', votes: { yes: 20, no: 2, abstain: 1 }, doc: { doc_id: 'resol', type: 'resolution' } });
    expect(rec.items[1]).toMatchObject({ result: 'elected', votes: null, summary: 'Eleitos: A, B e C.', doc: null });
    expect(rec.items[2]).toMatchObject({ result: 'informed', votes: null });
    expect(rec.attendance).toMatchObject({ doc_id: 'lista', visibility: 'members' });
    expect(evento(c, id).meeting.convened_on).toBe('2026-10-21');
  });

  it('sem quórum nada se decide; ata do tipo errado é recusada; corrigir pede motivo', async () => {
    const c = cenario();
    const id = await marcada(c);
    await chamar(c, SEC, { action: 'convene', eventId: id, convocation: convocacao() });
    await expect(chamar(c, SEC, { action: 'record', eventId: id, record: resultado({ quorum_reached: false }) }, DEPOIS)).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(c, SEC, { action: 'record', eventId: id, record: resultado({ minutes_doc_id: 'votos' }) }, DEPOIS)).rejects.toMatchObject({ code: 'failed-precondition' });
    const semQuorum = resultado({ quorum_reached: false, items: [{ id: 'p1', result: 'postponed' }, { id: 'p2', result: 'postponed' }, { id: 'p3', result: 'withdrawn' }] });
    await chamar(c, SEC, { action: 'record', eventId: id, record: semQuorum }, DEPOIS);
    await expect(chamar(c, SEC, { action: 'record', eventId: id, record: resultado() }, DEPOIS)).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(c, SEC, { action: 'record', eventId: id, record: resultado(), reason: 'Lançado o resultado errado' }, DEPOIS);
    const ev = evento(c, id);
    expect(ev.meeting.record.quorum_reached).toBe(true);
    expect(ev.history.at(-1)).toMatchObject({ kind: 'record_corrected' });
    await expect(chamar(c, SEC, { action: 'convene', eventId: id, convocation: convocacao(), reason: 'mudar depois do resultado' }, DEPOIS)).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('o save protege a reunião: tipo, data antes da convocação e data depois do resultado', async () => {
    const c = cenario();
    const id = await marcada(c);
    await chamar(c, SEC, { action: 'convene', eventId: id, convocation: convocacao() });
    await expect(chamar(c, SEC, { action: 'save', eventId: id, event: ago({ kind: 'event' }) })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(c, SEC, { action: 'save', eventId: id, event: ago({ date: '2026-10-20' }), reason: 'antecipada por erro' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await chamar(c, SEC, { action: 'record', eventId: id, record: resultado() }, DEPOIS);
    await expect(chamar(c, SEC, { action: 'save', eventId: id, event: ago({ date: '2026-11-27' }), reason: 'mudança depois' }, DEPOIS)).rejects.toMatchObject({ code: 'failed-precondition' });
    await chamar(c, SEC, { action: 'save', eventId: id, event: ago({ title: 'AGO 2026 — contas' }) }, DEPOIS);
    expect(evento(c, id).meeting.record.present).toBe(23);
  });
});
