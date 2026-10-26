/**
 * Assembleias e reuniões do clube no SERVIDOR (Bloco F1; Firestore falso): a convocação (data,
 * edital do acervo, quórum e pauta) e o resultado (presença, quórum, o que se decidiu, ata) passam
 * pela agenda do clube com a régua da federação. Reunião divulgada não muda calada (motivo e
 * histórico), o resultado só depois de a reunião começar e o edital/ata precisam estar publicados
 * NO ACERVO DESTE clube e ser do tipo certo.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ca = require('./clubAgenda.js');
const { createFakeDb } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2027, 2, 10, 15, 0, 0); // 10/03/2027 12:00 em Brasília
const DEPOIS = Date.UTC(2027, 3, 15, 15, 0, 0); // a assembleia (15/04, 09:00) já começou
const SEC = { uid: 'sec', name: 'Secretaria' };
const ESP = { uid: 'esp', name: 'Diretor esportivo' };

function cenario() {
  return createFakeDb({
    'platform_settings/global': { feature_flags: { club_association: true } },
    'clubs/c1': { name: 'Clube Pickle Sul', association: { enabled: true, published: true } },
    'club_members/c1_sec': { club_id: 'c1', user_id: 'sec', role: 'member' },
    'club_members/c1_esp': { club_id: 'c1', user_id: 'esp', role: 'member' },
    'club_x/c1/staff/sec': { club_id: 'c1', user_id: 'sec', perms: ['docs'], term_end_ms: 0 },
    'club_x/c1/staff/esp': { club_id: 'c1', user_id: 'esp', perms: ['sports'], term_end_ms: 0 },
    'club_x/c1/aff/ana': { club_id: 'c1', user_id: 'ana', status: 'active', plan_id: 'anual', valid_until: '2028-01-01' },
    'club_x/c1/aff/bia': { club_id: 'c1', user_id: 'bia', status: 'active', plan_id: 'anual', valid_until: '2028-01-01' },
    'club_x/c1/docs/edital': { club_id: 'c1', status: 'published', code: 'EDI 1/2027', title: 'Edital', type: 'notice', visibility: 'public' },
    'club_x/c1/docs/ata': { club_id: 'c1', status: 'published', code: 'ATA 1/2027', title: 'Ata', type: 'minutes', visibility: 'members' },
    'club_x/c1/docs/rascunho': { club_id: 'c1', status: 'draft', title: 'Rascunho', type: 'notice', visibility: 'public' },
    'club_x/outro/docs/alheio': { club_id: 'outro', status: 'published', title: 'De outro clube', type: 'notice', visibility: 'public' },
  });
}
const ctx = (db, now = NOW) => ({ db, now, Timestamp: { fromMillis: (ms) => ({ ms }) }, FieldValue: { increment: (n) => n }, logger: { info() {}, warn() {} } });
const chamar = (db, actor, data, now) => ca.agenda(ctx(db, now), actor, { clubId: 'c1', ...data });
const ev = (db, id) => db.store.docs.get(`club_x/c1/events/${id}`);
const avisosPara = (db, uid) => [...db.store.docs.entries()].filter(([p, d]) => p.startsWith('notifications/') && d.user_id === uid).map(([, d]) => d);

const assembleia = (extra = {}) => ({
  kind: 'assembly_ordinary', title: 'Assembleia geral ordinária', date: '2027-04-15', all_day: false, start_time: '09:00', end_time: '12:00',
  place: { name: 'Sede do clube', city: 'Curitiba', state: 'PR' }, visibility: 'members', ...extra,
});
const convocacao = (extra = {}) => ({
  convened_on: '2027-03-10', edital_doc_id: 'edital', quorum_first: 'Maioria dos associados em dia', second_call_time: '09:30', quorum_second: 'Qualquer número',
  items: [{ title: 'Prestação de contas', kind: 'deliberation' }, { title: 'Eleição da diretoria', kind: 'election' }, { title: 'Avisos gerais', kind: 'information' }], ...extra,
});
const resultado = (extra = {}) => ({
  call: 'first', opened_at: '09:05', quorum_reached: true, present: 31, eligible: 50,
  items: [{ id: 'p1', result: 'approved', votes: { yes: 28, no: 2, abstain: 1 }, summary: 'Contas aprovadas' }, { id: 'p2', result: 'elected', summary: 'Chapa única' }, { id: 'p3', result: 'informed' }],
  minutes_doc_id: 'ata', ...extra,
});

async function marcada(db, vis = 'members') {
  const { eventId } = await chamar(db, SEC, { action: 'save', event: assembleia({ visibility: vis }) });
  return eventId;
}

describe('assembleias do clube: convocação', () => {
  it('convoca com pauta, edital do acervo e quórum, e avisa os associados em dia quando a equipe pede', async () => {
    const db = cenario();
    const eventId = await marcada(db);
    const r = await chamar(db, SEC, { action: 'convene', eventId, convocation: convocacao(), notify: true });
    expect(r.notified).toBe(2);
    const m = ev(db, eventId).meeting;
    expect(m).toMatchObject({ convened_on: '2027-03-10', second_call_time: '09:30', record: null });
    expect(m.items.map((i) => i.id)).toEqual(['p1', 'p2', 'p3']);
    expect(m.edital).toEqual({ doc_id: 'edital', code: 'EDI 1/2027', title: 'Edital', type: 'notice', visibility: 'public' });
    expect(avisosPara(db, 'ana')[0].title).toContain('convocou');
    expect(avisosPara(db, 'sec')).toHaveLength(0);
  });

  it('só convoca quem cuida da agenda institucional e só reunião/assembleia', async () => {
    const db = cenario();
    const eventId = await marcada(db);
    await expect(chamar(db, ESP, { action: 'convene', eventId, convocation: convocacao() })).rejects.toMatchObject({ code: 'permission-denied' });
    const { eventId: torneio } = await chamar(db, SEC, { action: 'save', event: assembleia({ kind: 'competition', title: 'Torneio' }) });
    await expect(chamar(db, SEC, { action: 'convene', eventId: torneio, convocation: convocacao() })).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('valida a convocação e o edital: publicado, DESTE clube e do tipo certo', async () => {
    const db = cenario();
    const eventId = await marcada(db);
    await expect(chamar(db, SEC, { action: 'convene', eventId, convocation: convocacao({ items: [] }) })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(db, SEC, { action: 'convene', eventId, convocation: convocacao({ convened_on: '2027-03-20' }) })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(db, SEC, { action: 'convene', eventId, convocation: convocacao({ edital_doc_id: 'rascunho' }) })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(db, SEC, { action: 'convene', eventId, convocation: convocacao({ edital_doc_id: 'alheio' }) })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(db, SEC, { action: 'convene', eventId, convocation: convocacao({ edital_doc_id: 'ata' }) })).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('mudar a pauta de uma reunião já divulgada pede motivo, vai ao histórico e avisa', async () => {
    const db = cenario();
    const eventId = await marcada(db);
    await chamar(db, SEC, { action: 'convene', eventId, convocation: convocacao() });
    await expect(chamar(db, SEC, { action: 'convene', eventId, convocation: convocacao({ items: [{ title: 'Só as contas' }] }) })).rejects.toMatchObject({ code: 'invalid-argument' });
    const r = await chamar(db, SEC, { action: 'convene', eventId, convocation: convocacao({ items: [{ title: 'Só as contas' }] }), reason: 'Eleição fica para a extraordinária' });
    expect(r.notified).toBe(2);
    expect(ev(db, eventId).history[0]).toMatchObject({ kind: 'agenda_changed', reason: 'Eleição fica para a extraordinária' });
    expect(ev(db, eventId).meeting.items).toHaveLength(1);
  });

  it('evento cancelado ou adiado não se convoca', async () => {
    const db = cenario();
    const eventId = await marcada(db);
    await chamar(db, SEC, { action: 'cancel', eventId, reason: 'Sem local para a data' });
    await expect(chamar(db, SEC, { action: 'convene', eventId, convocation: convocacao() })).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});

describe('assembleias do clube: resultado', () => {
  it('só registra depois de convocar e depois de a reunião começar', async () => {
    const db = cenario();
    const eventId = await marcada(db);
    await expect(chamar(db, SEC, { action: 'record', eventId, record: resultado() }, DEPOIS)).rejects.toMatchObject({ code: 'failed-precondition' });
    await chamar(db, SEC, { action: 'convene', eventId, convocation: convocacao() });
    await expect(chamar(db, SEC, { action: 'record', eventId, record: resultado() }, NOW)).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('registra presença, quórum, decisões e ata, e avisa os associados', async () => {
    const db = cenario();
    const eventId = await marcada(db);
    await chamar(db, SEC, { action: 'convene', eventId, convocation: convocacao() });
    const r = await chamar(db, SEC, { action: 'record', eventId, record: resultado() }, DEPOIS);
    expect(r.notified).toBe(2);
    const rec = ev(db, eventId).meeting.record;
    expect(rec).toMatchObject({ call: 'first', quorum_reached: true, present: 31, eligible: 50, recorded_by_name: 'Secretaria' });
    expect(rec.items[0]).toMatchObject({ id: 'p1', result: 'approved', votes: { yes: 28, no: 2, abstain: 1 } });
    expect(rec.minutes).toMatchObject({ doc_id: 'ata', code: 'ATA 1/2027' });
    expect(avisosPara(db, 'bia')[0].title).toContain('publicou o resultado');
  });

  it('valida: sem quórum nada se decide, presentes não passam dos aptos e a ata é do tipo certo', async () => {
    const db = cenario();
    const eventId = await marcada(db);
    await chamar(db, SEC, { action: 'convene', eventId, convocation: convocacao() });
    await expect(chamar(db, SEC, { action: 'record', eventId, record: resultado({ quorum_reached: false }) }, DEPOIS)).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(db, SEC, { action: 'record', eventId, record: resultado({ present: 60 }) }, DEPOIS)).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(db, SEC, { action: 'record', eventId, record: resultado({ minutes_doc_id: 'edital' }) }, DEPOIS)).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(ev(db, eventId).meeting.record).toBeNull();
  });

  it('corrigir o resultado divulgado pede motivo e fica no histórico; depois dele a convocação e a data não mudam', async () => {
    const db = cenario();
    const eventId = await marcada(db);
    await chamar(db, SEC, { action: 'convene', eventId, convocation: convocacao() });
    await chamar(db, SEC, { action: 'record', eventId, record: resultado() }, DEPOIS);
    const corrigido = resultado({ present: 32 });
    await expect(chamar(db, SEC, { action: 'record', eventId, record: corrigido }, DEPOIS)).rejects.toMatchObject({ code: 'invalid-argument' });
    const r = await chamar(db, SEC, { action: 'record', eventId, record: corrigido, reason: 'Contagem conferida com a lista de presença' }, DEPOIS);
    expect(r.notified).toBe(2);
    expect(ev(db, eventId).meeting.record.present).toBe(32);
    expect(ev(db, eventId).history.at(-1)).toMatchObject({ kind: 'record_corrected' });
    await expect(chamar(db, SEC, { action: 'convene', eventId, convocation: convocacao() }, DEPOIS)).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(db, SEC, { action: 'save', eventId, event: assembleia({ date: '2027-04-20' }), reason: 'Tentando mudar a data depois' }, DEPOIS)).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('a reunião convocada não vira um tipo que não é reunião nem fica antes da convocação', async () => {
    const db = cenario();
    const eventId = await marcada(db);
    await chamar(db, SEC, { action: 'convene', eventId, convocation: convocacao() });
    await expect(chamar(db, SEC, { action: 'save', eventId, event: assembleia({ kind: 'competition' }) })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(db, SEC, { action: 'save', eventId, event: assembleia({ date: '2027-03-01' }), reason: 'Antecipando a reunião' })).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});
