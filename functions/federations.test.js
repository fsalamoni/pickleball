/**
 * Federações — o ciclo no SERVIDOR contra o Firestore falso: a flag barra,
 * o pedido nasce pendente e avisa a secretaria, aprovar em plano pago gera a
 * cobrança, só o financeiro confirma, confirmar emite número e código, a
 * verificação pública devolve o mínimo, suspender gira o código (o antigo
 * deixa de verificar) e só o admin da plataforma revisa a federação.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const fed = require('./federations.js');
const { createFakeDb } = require('../tests/fakes/fakeFirestore.cjs');

const NOW = Date.UTC(2026, 9, 18, 15, 0, 0); // 2026-10-18 12:00 em Brasília
const ctx = (db, now = NOW) => ({ db, now, Timestamp: { fromMillis: (ms) => ({ ms }) }, logger: { info() {} } });
const ANA = { uid: 'ana' };
const SEC = { uid: 'sec' };
const TES = { uid: 'tes' };
const ADMIN = { uid: 'admin', isPlatformAdmin: true };

function cenario({ flag = true } = {}) {
  return createFakeDb({
    'platform_settings/global': { feature_flags: { federations: flag } },
    'federations/fpp': { name: 'Federação Paulista de Pickleball', acronym: 'FPP', slug: 'fpp', status: 'approved', published: true, member_counter: 0, created_by: 'pres' },
    'federations/nova': { name: 'Federação Nova', acronym: 'FN', slug: 'fn', status: 'pending', created_by: 'bia', created_by_name: 'Bia' },
    'federations/clone': { name: 'Federação Clone', acronym: 'FC', slug: 'fpp', status: 'pending', created_by: 'bia', created_by_name: 'Bia' },
    'federations/semdono': { name: 'Federação Sem Dono', acronym: 'FSD', slug: 'fsd', status: 'pending', created_by: 'zed', created_by_name: 'Zed' },
    'users/bia': { full_name: 'Bia' },
    'federation_staff/fpp_sec': { federation_id: 'fpp', user_id: 'sec', role: 'secretary' },
    'federation_staff/fpp_tes': { federation_id: 'fpp', user_id: 'tes', role: 'treasurer' },
    'federation_plans/anual': { federation_id: 'fpp', name: 'Atleta federado', person_type: 'athlete', tier: 'federated', billing: 'annual', validity: 'rolling', price_cents: 12000, active: true },
    'users/ana': { full_name: 'Ana Souza', birth_date: '1990-05-01', photo_url: 'https://x/ana.png' },
  });
}
const doc = (db, path) => db.store.docs.get(path);
const avisosPara = (db, uid) => [...db.store.docs.entries()].filter(([p, d]) => p.startsWith('notifications/') && d.user_id === uid).map(([, d]) => d);

describe('federações no servidor', () => {
  it('com a flag desligada nada se filia', async () => {
    const db = cenario({ flag: false });
    await expect(fed.membership(ctx(db), ANA, { federationId: 'fpp', action: 'request', planId: 'anual' })).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('aprovada mas OCULTA (o admin ainda não publicou): ninguém se filia', async () => {
    const db = cenario();
    db.store.docs.set('federations/fpp', { ...doc(db, 'federations/fpp'), published: false });
    await expect(fed.membership(ctx(db), ANA, { federationId: 'fpp', action: 'request', planId: 'anual' })).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(fed.publicada({ status: 'approved' })).toBe(false);
    expect(fed.publicada({ status: 'suspended', published: true })).toBe(false);
    expect(fed.publicada({ status: 'approved', published: true })).toBe(true);
  });

  it('pedido → aprovação → cobrança → confirmação → carteirinha verificável → suspensão gira o código', async () => {
    const db = cenario();
    const c = ctx(db);

    const pedido = await fed.membership(c, ANA, { federationId: 'fpp', action: 'request', planId: 'anual', publicBadge: true });
    expect(pedido.memberId).toBe('fpp_ana');
    let m = doc(db, 'federation_members/fpp_ana');
    expect(m.status).toBe('pending');
    expect(m.user_name).toBe('Ana Souza');
    expect(Object.keys(m)).not.toEqual(expect.arrayContaining(['email', 'phone', 'birth_date']));
    expect(avisosPara(db, 'sec')).toHaveLength(1); // a secretaria é avisada; o financeiro não
    expect(avisosPara(db, 'tes')).toHaveLength(0);

    // Quem não tem `members` não aprova.
    await expect(fed.membership(c, TES, { federationId: 'fpp', action: 'approve', userId: 'ana' })).rejects.toMatchObject({ code: 'permission-denied' });
    const ap = await fed.membership(c, SEC, { federationId: 'fpp', action: 'approve', userId: 'ana' });
    m = doc(db, 'federation_members/fpp_ana');
    expect(m.status).toBe('awaiting_payment');
    const charge = doc(db, `federation_charges/${ap.chargeId}`);
    expect(charge).toMatchObject({ status: 'open', amount_cents: 12000, payer_uid: 'ana', origin: 'membership', due_date: '2026-10-28' });

    // Só o financeiro confirma.
    await expect(fed.chargeConfirm(c, SEC, { chargeId: ap.chargeId, action: 'confirm' })).rejects.toMatchObject({ code: 'permission-denied' });
    await fed.chargeConfirm(c, TES, { chargeId: ap.chargeId, action: 'confirm' });
    m = doc(db, 'federation_members/fpp_ana');
    expect(m.status).toBe('active');
    expect(m.member_number).toBe('FPP-2026-000001');
    expect(m.valid_from).toBe('2026-10-18');
    expect(m.valid_until).toBe('2027-10-18');
    expect(m.card_code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/);
    expect(doc(db, `federation_charges/${ap.chargeId}`).status).toBe('paid');
    expect(doc(db, 'federations/fpp').member_counter).toBe(1);
    expect(doc(db, `federation_card_index/${m.card_code}`)).toMatchObject({ member_id: 'fpp_ana', federation_id: 'fpp' });
    // A cobrança fechada não confirma de novo.
    await expect(fed.chargeConfirm(c, TES, { chargeId: ap.chargeId, action: 'confirm' })).rejects.toMatchObject({ code: 'failed-precondition' });

    // Verificação pública: o mínimo, e só isso.
    const v = await fed.verify(c, { code: m.card_code.toLowerCase() });
    expect(v).toEqual({
      found: true, name: 'Ana Souza', photo_url: 'https://x/ana.png',
      federation: { name: 'Federação Paulista de Pickleball', acronym: 'FPP', slug: 'fpp' },
      tier: 'federated', person_type: 'athlete', member_number: 'FPP-2026-000001', status: 'active', valid_until: '2027-10-18',
    });
    expect(await fed.verify(c, { code: 'NAOEXISTE1' })).toEqual({ found: false });

    // Suspender exige motivo, gira o código e a carteirinha antiga deixa de verificar.
    const antigo = m.card_code;
    await expect(fed.membership(c, SEC, { federationId: 'fpp', action: 'suspend', userId: 'ana' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await fed.membership(c, SEC, { federationId: 'fpp', action: 'suspend', userId: 'ana', reason: 'Anuidade estornada' });
    m = doc(db, 'federation_members/fpp_ana');
    expect(m.status).toBe('suspended');
    expect(m.card_code).not.toBe(antigo);
    expect(await fed.verify(c, { code: antigo })).toEqual({ found: false });
    expect((await fed.verify(c, { code: m.card_code })).status).toBe('suspended');

    await fed.membership(c, SEC, { federationId: 'fpp', action: 'reinstate', userId: 'ana' });
    expect(doc(db, 'federation_members/fpp_ana').status).toBe('active');
  });

  it('plano gratuito com aprovação automática ativa na hora, sem cobrança', async () => {
    const db = cenario();
    db.store.docs.set('federation_plans/gratis', { federation_id: 'fpp', name: 'Cadastro', person_type: 'athlete', tier: 'registered', billing: 'annual', price_cents: 0, auto_approve: true, active: true });
    const r = await fed.membership(ctx(db), ANA, { federationId: 'fpp', action: 'request', planId: 'gratis' });
    expect(r.chargeId).toBeNull();
    expect(doc(db, 'federation_members/fpp_ana')).toMatchObject({ status: 'active', member_number: 'FPP-2026-000001' });
    // Filiação viva barra um segundo pedido.
    await expect(fed.membership(ctx(db), ANA, { federationId: 'fpp', action: 'request', planId: 'gratis' })).rejects.toMatchObject({ code: 'already-exists' });
  });

  it('cancelar a cobrança devolve o pedido à secretaria', async () => {
    const db = cenario();
    const c = ctx(db);
    await fed.membership(c, ANA, { federationId: 'fpp', action: 'request', planId: 'anual' });
    const ap = await fed.membership(c, SEC, { federationId: 'fpp', action: 'approve', userId: 'ana' });
    await fed.chargeConfirm(c, TES, { chargeId: ap.chargeId, action: 'cancel', note: 'Pix não chegou' });
    expect(doc(db, `federation_charges/${ap.chargeId}`).status).toBe('cancelled');
    expect(doc(db, 'federation_members/fpp_ana').status).toBe('pending');
  });

  it('a varredura vence quem venceu e avisa quem vai vencer uma vez só', async () => {
    const db = cenario();
    db.store.docs.set('federation_members/fpp_ana', { federation_id: 'fpp', user_id: 'ana', status: 'active', valid_until: '2026-10-01', expiry_notified: {} });
    db.store.docs.set('federation_members/fpp_bia', { federation_id: 'fpp', user_id: 'bia', status: 'active', valid_until: '2026-11-10', expiry_notified: {} });
    const c = ctx(db);
    expect(await fed.sweep(c)).toEqual({ vencidas: 1, avisos: 1, lembretes: 0 });
    expect(doc(db, 'federation_members/fpp_ana').status).toBe('expired');
    expect(doc(db, 'federation_members/fpp_bia').expiry_notified).toEqual({ '30': true });
    expect(doc(db, 'federations/fpp').member_count).toBe(1);
    expect(await fed.sweep(c)).toEqual({ vencidas: 0, avisos: 0, lembretes: 0 }); // o mesmo marco não avisa duas vezes
  });

  it('só o admin da plataforma revisa; aprovar cria o presidente', async () => {
    const db = cenario();
    const c = ctx(db);
    await expect(fed.review(c, SEC, { federationId: 'nova', action: 'approve' })).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(fed.review(c, ADMIN, { federationId: 'nova', action: 'reject' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await fed.review(c, ADMIN, { federationId: 'nova', action: 'approve' });
    expect(doc(db, 'federations/nova')).toMatchObject({ status: 'approved', review: { action: 'approve', by: 'admin' } });
    expect(doc(db, 'federation_staff/nova_bia')).toMatchObject({ role: 'president', user_id: 'bia' });
    expect(avisosPara(db, 'bia')).toHaveLength(1);
    // Marcar oficial só em federação aprovada; suspender exige motivo.
    await expect(fed.review(c, ADMIN, { federationId: 'nova', action: 'suspend' })).rejects.toMatchObject({ code: 'invalid-argument' });
    await fed.review(c, ADMIN, { federationId: 'nova', action: 'official' });
    expect(doc(db, 'federations/nova').official).toBe(true);
  });

  it('revisão: endereço repetido entre as aprovadas não aprova; criador sem conta não vira presidente; flag desligada barra', async () => {
    const db = cenario();
    const c = ctx(db);
    await expect(fed.review(c, ADMIN, { federationId: 'clone', action: 'approve' })).rejects.toMatchObject({ code: 'already-exists' });
    expect(doc(db, 'federations/clone').status).toBe('pending');
    await fed.review(c, ADMIN, { federationId: 'semdono', action: 'approve' });
    expect(doc(db, 'federations/semdono').status).toBe('approved');
    expect(doc(db, 'federation_staff/semdono_zed')).toBeUndefined();
    const off = cenario({ flag: false });
    await expect(fed.review(ctx(off), ADMIN, { federationId: 'nova', action: 'approve' })).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(await fed.verify(ctx(off), { code: 'ABCDEFGHJK' })).toEqual({ found: false });
  });

  it('a varredura lembra a cobrança vencida no vencimento e 7 dias depois, a quem paga, uma vez por marco', async () => {
    const db = cenario();
    const DIA = 86400000;
    db.store.docs.set('federation_charges/c1', { federation_id: 'fpp', payer_uid: 'mae', status: 'open', due_date: '2026-10-18', plan_name: 'Anual' });
    db.store.docs.set('federation_charges/c2', { federation_id: 'fpp', payer_uid: 'bia', status: 'declared', due_date: '2026-10-01' });
    db.store.docs.set('federation_charges/c3', { federation_id: 'fpp', payer_uid: 'zed', status: 'open', due_date: '2026-11-30' });
    expect((await fed.sweep(ctx(db))).lembretes).toBe(1);
    expect(avisosPara(db, 'mae')[0].title).toMatch(/vence hoje/);
    expect(avisosPara(db, 'bia')).toHaveLength(0);
    expect((await fed.sweep(ctx(db))).lembretes).toBe(0);
    expect((await fed.sweep(ctx(db, NOW + 7 * DIA))).lembretes).toBe(1);
    expect(avisosPara(db, 'mae')[1].title).toMatch(/vencida há 7 dias/);
    expect((await fed.sweep(ctx(db, NOW + 9 * DIA))).lembretes).toBe(0);
  });

  it('a varredura vence pela DATA mesmo com sanção em vigor, e não avisa "vence em 0 dias" de quem já venceu', async () => {
    const db = cenario();
    db.store.docs.set('federation_members/fpp_ana', { federation_id: 'fpp', user_id: 'ana', status: 'active', valid_until: '2026-10-01', discipline_until_ms: NOW + 86400000, expiry_notified: {} });
    db.store.docs.set('federation_members/fpp_bia', { federation_id: 'fpp', user_id: 'bia', status: 'active', valid_until: '2026-10-18', expiry_notified: {} });
    expect(await fed.sweep(ctx(db))).toEqual({ vencidas: 1, avisos: 1, lembretes: 0 });
    expect(doc(db, 'federation_members/fpp_ana').status).toBe('expired');
    expect(avisosPara(db, 'bia')[0].title).toMatch(/vence hoje/);
  });

  it('cancelar a filiação apaga o código do documento (a carteirinha não mostra código morto)', async () => {
    const db = cenario();
    db.store.docs.set('federation_members/fpp_ana', { federation_id: 'fpp', user_id: 'ana', status: 'active', valid_until: '2027-01-01', card_code: 'ABCDEFGHJK' });
    db.store.docs.set('federation_card_index/ABCDEFGHJK', { member_id: 'fpp_ana', federation_id: 'fpp' });
    await fed.membership(ctx(db), ANA, { federationId: 'fpp', action: 'cancel' });
    expect(doc(db, 'federation_members/fpp_ana')).toMatchObject({ status: 'cancelled', card_code: null });
    expect(doc(db, 'federation_card_index/ABCDEFGHJK')).toBeUndefined();
  });
  it('desistir e pedir de novo não apaga a suspensão disciplinar em vigor', async () => {
    const db = cenario();
    const ate = NOW + 30 * 86400000;
    db.store.docs.set('federation_members/fpp_ana', { federation_id: 'fpp', user_id: 'ana', status: 'active', valid_until: '2027-01-01', discipline_until_ms: ate, discipline_sanction_id: 's1' });
    await fed.membership(ctx(db), ANA, { federationId: 'fpp', action: 'cancel' });
    await fed.membership(ctx(db), ANA, { federationId: 'fpp', action: 'request', planId: 'anual' });
    expect(doc(db, 'federation_members/fpp_ana')).toMatchObject({ status: 'pending', discipline_until_ms: ate, discipline_sanction_id: 's1' });
  });
});

describe('convite para filiar', () => {
  it('a secretaria convida; quem já é filiado ou já convidado fica de fora; ninguém vira filiado sem aceitar', async () => {
    const db = cenario();
    db.store.docs.set('users/beto', { full_name: 'Beto Lima' });
    db.store.docs.set('federation_members/fpp_beto', { federation_id: 'fpp', user_id: 'beto', status: 'active' });
    const c = ctx(db);
    // Sem a permissão `members`, não convida.
    await expect(fed.membership(c, TES, { federationId: 'fpp', action: 'invite', userIds: ['ana'], planId: 'anual' })).rejects.toMatchObject({ code: 'permission-denied' });
    const r = await fed.membership(c, SEC, { federationId: 'fpp', action: 'invite', userIds: ['ana', 'beto', 'fantasma', 'ana'], planId: 'anual', note: 'Venha!' });
    expect(r.invited).toBe(1);
    expect(r.skipped.map((s) => s.uid).sort()).toEqual(['beto', 'fantasma']);
    expect(doc(db, 'federation_invites/fpp_ana')).toMatchObject({ status: 'pending', plan_id: 'anual', user_name: 'Ana Souza', invited_by: 'sec', expires_at_ms: NOW + 30 * 86400000 });
    expect(doc(db, 'federation_members/fpp_ana')).toBeUndefined();
    expect(avisosPara(db, 'ana')).toHaveLength(1);
    expect(avisosPara(db, 'ana')[0].link).toBe('/federacoes/fpp/filiar');
    // Convite em aberto não se repete.
    const de2 = await fed.membership(c, SEC, { federationId: 'fpp', action: 'invite', userIds: ['ana'], planId: 'anual' });
    expect(de2).toMatchObject({ invited: 0, skipped: [{ uid: 'ana', reason: 'Já tem convite em aberto' }] });
  });

  it('federação oculta não convida', async () => {
    const db = cenario();
    db.store.docs.set('federations/fpp', { ...doc(db, 'federations/fpp'), published: false });
    await expect(fed.membership(ctx(db), SEC, { federationId: 'fpp', action: 'invite', userIds: ['ana'], planId: 'anual' })).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('aceitar = pedir no plano do convite: entra sem esperar a secretaria (pago gera a cobrança)', async () => {
    const db = cenario();
    const c = ctx(db);
    await fed.membership(c, SEC, { federationId: 'fpp', action: 'invite', userIds: ['ana'], planId: 'anual' });
    const r = await fed.membership(c, ANA, { federationId: 'fpp', action: 'request', planId: 'anual' });
    expect(r.chargeId).toBeTruthy();
    expect(doc(db, 'federation_members/fpp_ana')).toMatchObject({ status: 'awaiting_payment', invited: true });
    expect(doc(db, 'federation_invites/fpp_ana')).toMatchObject({ status: 'accepted', member_id: 'fpp_ana' });
    expect(avisosPara(db, 'sec')).toHaveLength(0); // não entrou na fila de pedidos
  });

  it('pedido em OUTRO plano segue o caminho normal; recusar e cancelar fecham o convite', async () => {
    const db = cenario();
    db.store.docs.set('federation_plans/outro', { federation_id: 'fpp', name: 'Outro', person_type: 'athlete', tier: 'federated', billing: 'annual', price_cents: 5000, active: true });
    const c = ctx(db);
    await fed.membership(c, SEC, { federationId: 'fpp', action: 'invite', userIds: ['ana'], planId: 'anual' });
    await fed.membership(c, ANA, { federationId: 'fpp', action: 'request', planId: 'outro' });
    expect(doc(db, 'federation_members/fpp_ana').status).toBe('pending');
    expect(doc(db, 'federation_invites/fpp_ana').status).toBe('pending');
    await fed.membership(c, ANA, { federationId: 'fpp', action: 'invite_decline' });
    expect(doc(db, 'federation_invites/fpp_ana')).toMatchObject({ status: 'declined', decided_by: 'ana' });
    await expect(fed.membership(c, SEC, { federationId: 'fpp', action: 'invite_cancel', userId: 'ana' })).rejects.toMatchObject({ code: 'not-found' });
  });

  it('convite vencido não dispensa a aprovação', async () => {
    const db = cenario();
    db.store.docs.set('federation_invites/fpp_ana', { federation_id: 'fpp', user_id: 'ana', plan_id: 'anual', status: 'pending', expires_at_ms: NOW - 1 });
    await fed.membership(ctx(db), ANA, { federationId: 'fpp', action: 'request', planId: 'anual' });
    expect(doc(db, 'federation_members/fpp_ana').status).toBe('pending');
  });
});
