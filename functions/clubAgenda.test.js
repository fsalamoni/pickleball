/**
 * Agenda oficial do clube no SERVIDOR (Firestore falso): só quem tem `docs`/`sports`/`admin`
 * grava; `sports` cuida só da agenda esportiva; evento já divulgado exige motivo para
 * mudar de data, adiar ou cancelar, fica no histórico e avisa os associados em dia;
 * as marcas `pub`/`members` que a regra lê seguem a visibilidade; só o que nunca foi
 * divulgado se apaga; o ICS público leva só o público e só de clube aberto.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ca = require('./clubAgenda.js');
const { createFakeDb } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2027, 2, 10, 15, 0, 0);
const PRES = { uid: 'pres', name: 'Presidente' };
const SEC = { uid: 'sec', name: 'Secretaria' };
const ESP = { uid: 'esp', name: 'Diretor esportivo' };
const FIN = { uid: 'fin', name: 'Tesouraria' };
const EXT = { uid: 'ext', name: 'De fora' };

function cenario({ associacao = true, flag = true, publicado = true } = {}) {
  return createFakeDb({
    'platform_settings/global': { feature_flags: { club_association: flag } },
    'clubs/c1': { name: 'Clube Pickle Sul', association: { enabled: associacao, published: publicado } },
    'club_members/c1_pres': { club_id: 'c1', user_id: 'pres', role: 'admin' },
    'club_members/c1_sec': { club_id: 'c1', user_id: 'sec', role: 'member' },
    'club_members/c1_esp': { club_id: 'c1', user_id: 'esp', role: 'member' },
    'club_members/c1_fin': { club_id: 'c1', user_id: 'fin', role: 'member' },
    'club_x/c1/staff/sec': { club_id: 'c1', user_id: 'sec', perms: ['docs'], term_end_ms: 0 },
    'club_x/c1/staff/esp': { club_id: 'c1', user_id: 'esp', perms: ['sports'], term_end_ms: 0 },
    'club_x/c1/staff/fin': { club_id: 'c1', user_id: 'fin', perms: ['finance'], term_end_ms: 0 },
    'club_x/c1/aff/ana': { club_id: 'c1', user_id: 'ana', status: 'active', plan_id: 'anual', valid_until: '2028-01-01' },
    'club_x/c1/aff/bia': { club_id: 'c1', user_id: 'bia', status: 'active', plan_id: 'anual', valid_until: '2028-01-01' },
    'club_x/c1/aff/caio': { club_id: 'c1', user_id: 'caio', status: 'active', plan_id: 'anual', valid_until: '2026-01-01' }, // venceu
    'club_x/c1/docs/edital': { club_id: 'c1', status: 'published', code: 'EDI 1/2027', title: 'Edital', type: 'notice', visibility: 'public' },
    'club_x/c1/docs/rascunho': { club_id: 'c1', status: 'draft', title: 'Rascunho', type: 'notice', visibility: 'public' },
  });
}
const ctx = (db, now = NOW) => ({ db, now, Timestamp: { fromMillis: (ms) => ({ ms }) }, FieldValue: { increment: (n) => n }, logger: { info() {}, warn() {} } });
const chamar = (db, actor, data, now) => ca.agenda(ctx(db, now), actor, { clubId: 'c1', ...data });
const ev = (db, id) => db.store.docs.get(`club_x/c1/events/${id}`);
const avisosPara = (db, uid) => [...db.store.docs.entries()].filter(([p, d]) => p.startsWith('notifications/') && d.user_id === uid).map(([, d]) => d);

const evento = (extra = {}) => ({
  kind: 'competition', title: 'Torneio de abertura', date: '2027-04-15', all_day: false, start_time: '09:00', end_time: '18:00',
  place: { name: 'Quadras do clube', city: 'Curitiba', state: 'PR' }, visibility: 'public', ...extra,
});

describe('agenda do clube: quem pode e o que vale', () => {
  it('flag desligada, associação fechada, sem permissão e ação desconhecida são recusados', async () => {
    await expect(chamar(cenario({ flag: false }), SEC, { action: 'save', event: evento() })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(cenario({ associacao: false }), SEC, { action: 'save', event: evento() })).rejects.toMatchObject({ code: 'failed-precondition' });
    const db = cenario();
    await expect(chamar(db, FIN, { action: 'save', event: evento() })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(db, EXT, { action: 'save', event: evento() })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(chamar(db, SEC, { action: 'nada' })).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('a secretaria e a administração marcam qualquer tipo; a diretoria esportiva só a agenda esportiva', async () => {
    const db = cenario();
    const r = await chamar(db, SEC, { action: 'save', event: evento({ kind: 'assembly_ordinary', title: 'Assembleia geral' }) });
    expect(ev(db, r.eventId)).toMatchObject({ club_id: 'c1', kind: 'assembly_ordinary', group: 'institutional', status: 'scheduled', created_by: 'sec' });
    await chamar(db, PRES, { action: 'save', event: evento({ kind: 'ceremony', title: 'Premiação' }) });
    await expect(chamar(db, ESP, { action: 'save', event: evento({ kind: 'assembly_ordinary' }) })).rejects.toMatchObject({ code: 'permission-denied' });
    const e = await chamar(db, ESP, { action: 'save', event: evento() });
    expect(ev(db, e.eventId).kind).toBe('competition');
    // ...e não mexe no evento institucional que já existe.
    await expect(chamar(db, ESP, { action: 'cancel', eventId: r.eventId, reason: 'Não vai acontecer mesmo' })).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('as marcas que a regra lê seguem a visibilidade', async () => {
    const db = cenario();
    const pub = await chamar(db, SEC, { action: 'save', event: evento({ visibility: 'public' }) });
    const mem = await chamar(db, SEC, { action: 'save', event: evento({ visibility: 'members' }) });
    const eqp = await chamar(db, SEC, { action: 'save', event: evento({ visibility: 'staff' }) });
    expect(ev(db, pub.eventId)).toMatchObject({ pub: true, members: true, ever_visible: true });
    expect(ev(db, mem.eventId)).toMatchObject({ pub: false, members: true, ever_visible: true });
    expect(ev(db, eqp.eventId)).toMatchObject({ pub: false, members: false, ever_visible: false });
  });

  it('valida o evento (título, data, horário) e o documento ligado precisa estar publicado no acervo do clube', async () => {
    const db = cenario();
    await expect(chamar(db, SEC, { action: 'save', event: evento({ title: '' }) })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(db, SEC, { action: 'save', event: evento({ date: '' }) })).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(chamar(db, SEC, { action: 'save', event: evento({ related_docs: [{ doc_id: 'rascunho' }] }) })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(db, SEC, { action: 'save', event: evento({ related_docs: [{ doc_id: 'naoexiste' }] }) })).rejects.toMatchObject({ code: 'failed-precondition' });
    const r = await chamar(db, SEC, { action: 'save', event: evento({ related_docs: [{ doc_id: 'edital' }] }) });
    expect(ev(db, r.eventId).related_docs).toEqual([{ doc_id: 'edital', code: 'EDI 1/2027', title: 'Edital', type: 'notice', visibility: 'public' }]);
  });
});

describe('agenda do clube: evento divulgado não muda calado', () => {
  it('remarcar exige motivo, vai ao histórico e avisa só os associados em dia (menos quem agiu)', async () => {
    const db = cenario();
    const { eventId } = await chamar(db, SEC, { action: 'save', event: evento() });
    await expect(chamar(db, SEC, { action: 'save', eventId, event: evento({ date: '2027-04-22' }) })).rejects.toMatchObject({ code: 'invalid-argument' });
    const r = await chamar(db, SEC, { action: 'save', eventId, event: evento({ date: '2027-04-22' }), reason: 'Chuva forte prevista para o dia' });
    expect(r.notified).toBe(2);
    expect(ev(db, eventId).date).toBe('2027-04-22');
    expect(ev(db, eventId).history).toHaveLength(1);
    expect(ev(db, eventId).history[0]).toMatchObject({ kind: 'rescheduled', from_date: '2027-04-15', to_date: '2027-04-22', by_name: 'Secretaria' });
    expect(avisosPara(db, 'ana')).toHaveLength(1);
    expect(avisosPara(db, 'ana')[0].link).toBe(`/clubes/c1?tab=agenda&evento=${eventId}`);
    expect(avisosPara(db, 'caio')).toHaveLength(0); // filiação vencida
    expect(avisosPara(db, 'sec')).toHaveLength(0);
  });

  it('editar sem mudar a data não pede motivo nem avisa', async () => {
    const db = cenario();
    const { eventId } = await chamar(db, SEC, { action: 'save', event: evento() });
    const r = await chamar(db, SEC, { action: 'save', eventId, event: evento({ title: 'Torneio de abertura 2027' }) });
    expect(r.notified).toBe(0);
    expect(ev(db, eventId).title).toBe('Torneio de abertura 2027');
    expect(ev(db, eventId).history).toHaveLength(0);
  });

  it('adiar e cancelar pedem motivo, ficam no histórico, avisam e o evento continua na agenda', async () => {
    const db = cenario();
    const { eventId } = await chamar(db, SEC, { action: 'save', event: evento() });
    await expect(chamar(db, SEC, { action: 'postpone', eventId, reason: 'curto' })).rejects.toMatchObject({ code: 'invalid-argument' });
    const adiado = await chamar(db, SEC, { action: 'postpone', eventId, reason: 'Quadra em reforma até maio' });
    expect(adiado.notified).toBe(2);
    expect(ev(db, eventId)).toMatchObject({ status: 'postponed', status_reason: 'Quadra em reforma até maio' });
    await expect(chamar(db, SEC, { action: 'postpone', eventId, reason: 'Quadra em reforma até maio' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await chamar(db, SEC, { action: 'cancel', eventId, reason: 'Sem inscritos suficientes' });
    expect(ev(db, eventId)).toMatchObject({ status: 'cancelled' });
    expect(ev(db, eventId).history.map((h) => h.kind)).toEqual(['postponed', 'cancelled']);
    await expect(chamar(db, SEC, { action: 'cancel', eventId, reason: 'Sem inscritos suficientes' })).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('reabrir um cancelado marca a data de novo, com motivo, e volta a confirmado', async () => {
    const db = cenario();
    const { eventId } = await chamar(db, SEC, { action: 'save', event: evento() });
    await chamar(db, SEC, { action: 'cancel', eventId, reason: 'Sem inscritos suficientes' });
    await expect(chamar(db, SEC, { action: 'save', eventId, event: evento() })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(db, SEC, { action: 'save', eventId, event: evento({ date: '2027-05-06' }), reason: 'Inscrições reabertas' });
    expect(ev(db, eventId)).toMatchObject({ status: 'scheduled', status_reason: '', date: '2027-05-06' });
    expect(ev(db, eventId).history.map((h) => h.kind)).toEqual(['cancelled', 'reopened']);
  });

  it('só o que nunca foi divulgado se apaga; o resto se cancela', async () => {
    const db = cenario();
    const privado = await chamar(db, SEC, { action: 'save', event: evento({ visibility: 'staff' }) });
    const publico = await chamar(db, SEC, { action: 'save', event: evento() });
    await chamar(db, SEC, { action: 'delete', eventId: privado.eventId });
    expect(ev(db, privado.eventId)).toBeUndefined();
    await expect(chamar(db, SEC, { action: 'delete', eventId: publico.eventId })).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(ev(db, publico.eventId)).toBeDefined();
  });

  it('o aviso da marcação só sai quando a equipe pede; "só a equipe" nunca avisa', async () => {
    const db = cenario();
    const sem = await chamar(db, SEC, { action: 'save', event: evento() });
    expect(sem.notified).toBe(0);
    const com = await chamar(db, SEC, { action: 'save', event: evento({ title: 'Clínica de saque', kind: 'course' }), notify: true });
    expect(com.notified).toBe(2);
    const eqp = await chamar(db, SEC, { action: 'save', event: evento({ visibility: 'staff' }), notify: true });
    expect(eqp.notified).toBe(0);
  });
});

describe('agenda do clube: assinável (ICS)', () => {
  const lista = async (db, key = 'c1') => ca.feed(ctx(db), key);

  it('leva só os eventos públicos, com o prefixo de cancelado, e o endereço da vitrine', async () => {
    const db = cenario();
    await chamar(db, SEC, { action: 'save', event: evento({ title: 'Aberto ao público' }) });
    await chamar(db, SEC, { action: 'save', event: evento({ title: 'Só associados', visibility: 'members' }) });
    await chamar(db, SEC, { action: 'save', event: evento({ title: 'Só equipe', visibility: 'staff' }) });
    const cancelado = await chamar(db, SEC, { action: 'save', event: evento({ title: 'Cancelado', date: '2027-06-01' }) });
    await chamar(db, SEC, { action: 'cancel', eventId: cancelado.eventId, reason: 'Sem inscritos suficientes' });
    const ics = await lista(db);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('Aberto ao público');
    expect(ics).toContain('CANCELADO: Cancelado');
    expect(ics).not.toContain('Só associados');
    expect(ics).not.toContain('Só equipe');
    expect(ics).toContain('https://picklerush.web.app/c/c1?evento=');
  });

  it('não serve clube fechado ao público, com a associação desligada, flag desligada ou chave inválida', async () => {
    expect(await lista(cenario({ publicado: false }))).toBeNull();
    expect(await lista(cenario({ associacao: false }))).toBeNull();
    expect(await lista(cenario({ flag: false }))).toBeNull();
    expect(await lista(cenario(), '../x')).toBeNull();
    expect(await lista(cenario(), 'naoexiste')).toBeNull();
  });
});
