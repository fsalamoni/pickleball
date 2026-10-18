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
const ctx = (db) => ({ db, now: NOW, Timestamp: { fromMillis: (ms) => ({ ms }) }, logger: { info() {} } });
const ANA = { uid: 'ana' };
const SEC = { uid: 'sec' };
const TES = { uid: 'tes' };
const ADMIN = { uid: 'admin', isPlatformAdmin: true };

function cenario({ flag = true } = {}) {
  return createFakeDb({
    'platform_settings/global': { feature_flags: { federations: flag } },
    'federations/fpp': { name: 'Federação Paulista de Pickleball', acronym: 'FPP', slug: 'fpp', status: 'approved', member_counter: 0, created_by: 'pres' },
    'federations/nova': { name: 'Federação Nova', acronym: 'FN', slug: 'fn', status: 'pending', created_by: 'bia', created_by_name: 'Bia' },
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
    expect(await fed.sweep(c)).toEqual({ vencidas: 1, avisos: 1 });
    expect(doc(db, 'federation_members/fpp_ana').status).toBe('expired');
    expect(doc(db, 'federation_members/fpp_bia').expiry_notified).toEqual({ '30': true });
    expect(doc(db, 'federations/fpp').member_count).toBe(1);
    expect(await fed.sweep(c)).toEqual({ vencidas: 0, avisos: 0 }); // o mesmo marco não avisa duas vezes
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
});
