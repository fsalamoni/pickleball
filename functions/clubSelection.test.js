/**
 * Seleção do clube no SERVIDOR (Firestore falso): só a diretoria esportiva monta e convoca; o
 * convite tem prazo; a TRAVA DE PROTEÇÃO recusa menor sem responsável autorizando e comissão de
 * convocação com menores sem a proteção em dia; a lista pública não leva uid e o menor aparece só
 * com a inicial; a varredura vence convites e encerra o que já passou.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cs = require('./clubSelection.js');
const m = require('./federationMembership.js');
const { createFakeDb } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2027, 2, 10, 15, 0, 0);
const DIA = 86400000;
const hoje = m.isoDateBR(NOW);
const PRES = { uid: 'pres', name: 'Presidente' };
const ESP = { uid: 'esp', name: 'Esportes' };
const FIN = { uid: 'fin', name: 'Tesouraria' };
const ANA = { uid: 'ana', name: 'Ana' };
const BIA = { uid: 'bia', name: 'Bia' };
const TEO = { uid: 'teo', name: 'Teo' };
const FORA = { uid: 'fora', name: 'Fora do clube' };
const amanha = m.isoDateBR(NOW + 10 * DIA);

function cenario({ flag = true, associacao = true } = {}) {
  return createFakeDb({
    'platform_settings/global': { feature_flags: { club_association: flag } },
    'clubs/c1': { name: 'Clube Pickle Sul', association: { enabled: associacao, published: true } },
    'club_members/c1_pres': { club_id: 'c1', user_id: 'pres', role: 'admin' },
    'club_members/c1_esp': { club_id: 'c1', user_id: 'esp', role: 'member' },
    'club_members/c1_fin': { club_id: 'c1', user_id: 'fin', role: 'member' },
    'club_members/c1_ana': { club_id: 'c1', user_id: 'ana', role: 'member' },
    'club_members/c1_bia': { club_id: 'c1', user_id: 'bia', role: 'member' },
    'club_members/c1_teo': { club_id: 'c1', user_id: 'teo', role: 'member' },
    'club_x/c1/staff/esp': { club_id: 'c1', user_id: 'esp', perms: ['sports'], term_end_ms: 0 },
    'club_x/c1/staff/fin': { club_id: 'c1', user_id: 'fin', perms: ['finance'], term_end_ms: 0 },
    'users/pres': { platform_name: 'Presidente', birth_date: '1975-01-01' },
    'users/esp': { platform_name: 'Esportes', birth_date: '1980-05-05' },
    'users/ana': { platform_name: 'Ana Souza Lima', birth_date: '1990-04-04' },
    'users/bia': { platform_name: 'Bia Costa Alves', birth_date: '2013-06-01' },
    'users/teo': { platform_name: 'Teo', birth_date: '1988-02-02' },
  });
}

const ctx = (db, now = NOW) => ({ db, bucket: null, now, Timestamp: { fromMillis: (ms) => ({ ms }) }, FieldValue: { delete: () => undefined, increment: (n) => n }, logger: { info() {}, warn() {} } });
const chamar = (db, actor, data, now) => cs.selection(ctx(db, now), actor, { clubId: 'c1', ...data });
const doc = (db, path) => db.store.docs.get(path);
const avisosPara = (db, uid) => [...db.store.docs.entries()].filter(([p, d]) => p.startsWith('notifications/') && d.user_id === uid).map(([, d]) => d);

const BASE = { title: 'Seleção Interclubes', event_name: 'Interclubes 2027', place: 'Florianópolis', starts_at: amanha, accept_days: 7 };

async function aberta(db, extra = {}) {
  const { callupId } = await chamar(db, ESP, { action: 'save', ...BASE, ...extra });
  await chamar(db, ESP, { action: 'publish', callupId });
  return callupId;
}

describe('seleção do clube: quem pode', () => {
  it('flag desligada, associação fechada, ação desconhecida e papel sem a diretoria esportiva são recusados', async () => {
    await expect(chamar(cenario({ flag: false }), ESP, { action: 'list' })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(chamar(cenario({ associacao: false }), ESP, { action: 'list' })).rejects.toMatchObject({ code: 'failed-precondition' });
    const db = cenario();
    await expect(chamar(db, ESP, { action: 'nada' })).rejects.toMatchObject({ code: 'invalid-argument' });
    for (const acao of ['list', 'save', 'publish', 'add']) {
      // eslint-disable-next-line no-await-in-loop
      await expect(chamar(db, FIN, { action: acao, ...BASE })).rejects.toMatchObject({ code: 'permission-denied' });
      // eslint-disable-next-line no-await-in-loop
      await expect(chamar(db, ANA, { action: acao, ...BASE })).rejects.toMatchObject({ code: 'permission-denied' });
    }
    await expect(chamar(db, ESP, { action: 'list' })).resolves.toMatchObject({ ok: true });
    await expect(chamar(db, PRES, { action: 'list' })).resolves.toMatchObject({ ok: true });
  });

  it('quem não é do clube não tem convite (a tela some) e não responde', async () => {
    const db = cenario();
    await expect(chamar(db, FORA, { action: 'mine' })).resolves.toMatchObject({ ok: true, member: false, rows: [] });
    await expect(chamar(db, FORA, { action: 'answer', memberId: 'x', accept: true })).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});

describe('a convocação: rascunho, publicação e convite', () => {
  it('⭐ o caminho todo: cria, publica, convoca, a pessoa aceita e entra na lista pública sem uid', async () => {
    const db = cenario();
    const id = await aberta(db, { collect_uniform: true });
    expect(doc(db, `club_x/c1/callups/${id}`)).toMatchObject({ status: 'open', pub: true, club_id: 'c1' });
    const r = await chamar(db, ESP, { action: 'add', callupId: id, userId: 'ana', role: 'athlete', label: 'Duplas 4.0' });
    expect(doc(db, `club_x/c1/callup_members/${r.memberId}`)).toMatchObject({ status: 'invited', user_id: 'ana', role: 'athlete', is_minor: false });
    expect(avisosPara(db, 'ana')[0].title).toContain('Seleção Interclubes');
    const minha = await chamar(db, ANA, { action: 'mine' });
    expect(minha.rows[0]).toMatchObject({ status: 'invited', open: true, collect_uniform: true });
    await expect(chamar(db, ANA, { action: 'answer', memberId: r.memberId, accept: true })).rejects.toMatchObject({ code: 'invalid-argument' }); // falta o tamanho
    await chamar(db, ANA, { action: 'answer', memberId: r.memberId, accept: true, uniform_size: 'M' });
    const cu = doc(db, `club_x/c1/callups/${id}`);
    expect(cu.counts).toMatchObject({ accepted: 1, athletes: 1 });
    expect(cu.roster).toHaveLength(1);
    expect(cu.roster[0]).toMatchObject({ name: 'Ana Souza Lima', role: 'athlete', label: 'Duplas 4.0' });
    expect(JSON.stringify(cu.roster)).not.toContain('ana"'); // sem uid
    expect(Object.keys(cu.roster[0]).sort()).toEqual(['key', 'label', 'name', 'role']);
    expect(avisosPara(db, 'esp').some((a) => a.title.includes('confirmou'))).toBe(true);
  });

  it('rascunho não convoca; data passada não publica; duplicidade e vagas são conferidas', async () => {
    const db = cenario();
    const { callupId } = await chamar(db, ESP, { action: 'save', ...BASE, slots: 1 });
    await expect(chamar(db, ESP, { action: 'add', callupId, userId: 'ana', role: 'athlete' })).rejects.toMatchObject({ code: 'failed-precondition' });
    const velha = (await chamar(db, ESP, { action: 'save', ...BASE, starts_at: m.isoDateBR(NOW - 3 * DIA) })).callupId;
    await expect(chamar(db, ESP, { action: 'publish', callupId: velha })).rejects.toMatchObject({ code: 'failed-precondition' });
    await chamar(db, ESP, { action: 'publish', callupId });
    await chamar(db, ESP, { action: 'add', callupId, userId: 'ana', role: 'athlete' });
    await expect(chamar(db, ESP, { action: 'add', callupId, userId: 'ana', role: 'athlete' })).rejects.toMatchObject({ code: 'already-exists' });
    await expect(chamar(db, ESP, { action: 'add', callupId, userId: 'teo', role: 'athlete' })).rejects.toMatchObject({ code: 'failed-precondition' }); // 1 vaga só
    await expect(chamar(db, ESP, { action: 'add', callupId, userId: 'fora', role: 'athlete' })).rejects.toMatchObject({ code: 'failed-precondition' }); // não é do clube
    await expect(chamar(db, ESP, { action: 'add', callupId, userId: 'teo', role: 'staff' })).resolves.toMatchObject({ ok: true }); // a comissão não ocupa vaga de atleta
  });

  it('recusar, retirar e cancelar liberam a vaga, avisam e saem da lista pública', async () => {
    const db = cenario();
    const id = await aberta(db);
    const a = await chamar(db, ESP, { action: 'add', callupId: id, userId: 'ana', role: 'athlete' });
    const t = await chamar(db, ESP, { action: 'add', callupId: id, userId: 'teo', role: 'athlete' });
    await chamar(db, ANA, { action: 'answer', memberId: a.memberId, accept: false });
    expect(doc(db, `club_x/c1/callup_members/${a.memberId}`).status).toBe('declined');
    await expect(chamar(db, ANA, { action: 'answer', memberId: a.memberId, accept: true })).rejects.toMatchObject({ code: 'failed-precondition' }); // já respondeu
    await expect(chamar(db, TEO, { action: 'answer', memberId: a.memberId, accept: true })).rejects.toMatchObject({ code: 'permission-denied' }); // convite de outra pessoa
    await expect(chamar(db, ESP, { action: 'remove', memberId: t.memberId, reason: '' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await chamar(db, ESP, { action: 'remove', memberId: t.memberId, reason: 'Lesão' });
    expect(doc(db, `club_x/c1/callup_members/${t.memberId}`)).toMatchObject({ status: 'cancelled', removed_reason: 'Lesão' });
    const r = await chamar(db, ESP, { action: 'add', callupId: id, userId: 'teo', role: 'athlete' }); // pode voltar a ser chamado
    await chamar(db, TEO, { action: 'answer', memberId: r.memberId, accept: true });
    expect(doc(db, `club_x/c1/callups/${id}`).roster).toHaveLength(1);
    const c = await chamar(db, ESP, { action: 'cancel', callupId: id, reason: 'Evento adiado' });
    expect(c.notified).toBe(1);
    expect(doc(db, `club_x/c1/callups/${id}`)).toMatchObject({ status: 'cancelled', pub: false });
  });

  it('o convite vencido não pode mais ser respondido', async () => {
    const db = cenario();
    const id = await aberta(db);
    const a = await chamar(db, ESP, { action: 'add', callupId: id, userId: 'ana', role: 'athlete' });
    await expect(chamar(db, ANA, { action: 'answer', memberId: a.memberId, accept: true }, NOW + 8 * DIA)).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('aberta, o que foi anunciado (vagas, menores, prazo) não muda; a logística sim', async () => {
    const db = cenario();
    const id = await aberta(db, { slots: 5, involves_minors: false });
    await chamar(db, ESP, { action: 'save', callupId: id, ...BASE, title: 'Novo nome', slots: 99, involves_minors: true, accept_days: 1 });
    expect(doc(db, `club_x/c1/callups/${id}`)).toMatchObject({ title: 'Novo nome', slots: 5, involves_minors: false, accept_days: 7 });
  });

  it('a conferência dos documentos de viagem só vale para os exigidos', async () => {
    const db = cenario();
    const id = await aberta(db, { travel_docs: ['id_doc', 'medical'] });
    const a = await chamar(db, ESP, { action: 'add', callupId: id, userId: 'ana', role: 'athlete' });
    await chamar(db, ESP, { action: 'member_update', memberId: a.memberId, docs_ok: { id_doc: true, passport: true }, staff_note: 'Falta o atestado' });
    expect(doc(db, `club_x/c1/callup_members/${a.memberId}`)).toMatchObject({ docs_ok: { id_doc: true, medical: false }, staff_note: 'Falta o atestado' });
  });
});

describe('a trava de proteção', () => {
  it('⭐ menor de idade só é convocado com o responsável registrado e autorizando', async () => {
    const db = cenario();
    const id = await aberta(db, { involves_minors: true });
    await expect(chamar(db, ESP, { action: 'add', callupId: id, userId: 'bia', role: 'athlete' })).rejects.toThrow(/responsável legal/);
    db.store.docs.set('club_x/c1/minors/bia', { club_id: 'c1', user_id: 'bia', guardian: { name: 'Maria', consent: false } });
    await expect(chamar(db, ESP, { action: 'add', callupId: id, userId: 'bia', role: 'athlete' })).rejects.toThrow(/não autorizou/);
    db.store.docs.set('club_x/c1/minors/bia', { club_id: 'c1', user_id: 'bia', guardian: { name: 'Maria', consent: true } });
    const r = await chamar(db, ESP, { action: 'add', callupId: id, userId: 'bia', role: 'athlete' });
    expect(doc(db, `club_x/c1/callup_members/${r.memberId}`).is_minor).toBe(true);
    await chamar(db, { uid: 'bia', name: 'Bia' }, { action: 'answer', memberId: r.memberId, accept: true });
    // Na lista pública o menor aparece só com o primeiro nome e a inicial.
    expect(doc(db, `club_x/c1/callups/${id}`).roster[0].name).toBe('Bia A.');
  });

  it('⭐ comissão de convocação com menores só entra com a proteção de menores em dia', async () => {
    const db = cenario();
    const comMenores = await aberta(db, { involves_minors: true });
    await expect(chamar(db, ESP, { action: 'add', callupId: comMenores, userId: 'teo', role: 'staff' })).rejects.toThrow(/proteção de menores em dia/);
    db.store.docs.set('club_x/c1/safeguard/teo', { club_id: 'c1', user_id: 'teo', pledge_version: 1, background: { status: 'valid', valid_until: '2028-12-31' } });
    await expect(chamar(db, ESP, { action: 'add', callupId: comMenores, userId: 'teo', role: 'staff' })).resolves.toMatchObject({ ok: true });
    // Sem menores na convocação, a comissão não precisa da proteção.
    const semMenores = await aberta(db, { involves_minors: false });
    await expect(chamar(db, ESP, { action: 'add', callupId: semMenores, userId: 'ana', role: 'staff' })).resolves.toMatchObject({ ok: true });
  });
});

describe('a varredura', () => {
  it('vence o convite sem resposta e encerra a convocação cujo evento já passou', async () => {
    const db = cenario();
    const id = await aberta(db);
    const a = await chamar(db, ESP, { action: 'add', callupId: id, userId: 'ana', role: 'athlete' });
    await chamar(db, ESP, { action: 'add', callupId: id, userId: 'teo', role: 'athlete' });
    await chamar(db, ANA, { action: 'answer', memberId: a.memberId, accept: true });
    const depois = NOW + 8 * DIA;
    expect(await cs.sweep(ctx(db, depois))).toMatchObject({ expired: 1, closed: 0 });
    expect(doc(db, `club_x/c1/callup_members/${id}_teo`).status).toBe('expired');
    const bem = NOW + 20 * DIA;
    expect(await cs.sweep(ctx(db, bem))).toMatchObject({ closed: 1 });
    expect(doc(db, `club_x/c1/callups/${id}`)).toMatchObject({ status: 'closed', pub: true });
    expect(await cs.sweep(ctx(db, bem))).toMatchObject({ expired: 0, closed: 0 });
  });

  it('sem a flag não faz nada', async () => {
    expect(await cs.sweep(ctx(cenario({ flag: false })))).toMatchObject({ skipped: 'flag' });
  });
});

describe('encerrar', () => {
  it('encerrar vence quem ainda não respondeu e mantém a lista pública', async () => {
    const db = cenario();
    const id = await aberta(db);
    const a = await chamar(db, ESP, { action: 'add', callupId: id, userId: 'ana', role: 'athlete' });
    const t = await chamar(db, ESP, { action: 'add', callupId: id, userId: 'teo', role: 'athlete' });
    await chamar(db, ANA, { action: 'answer', memberId: a.memberId, accept: true });
    await chamar(db, ESP, { action: 'close', callupId: id });
    expect(doc(db, `club_x/c1/callup_members/${t.memberId}`).status).toBe('expired');
    expect(doc(db, `club_x/c1/callups/${id}`)).toMatchObject({ status: 'closed', pub: true });
    expect(doc(db, `club_x/c1/callups/${id}`).roster).toHaveLength(1);
    await expect(chamar(db, ESP, { action: 'close', callupId: id })).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});
