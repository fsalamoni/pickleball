/**
 * Avisos por e-mail e celular (docs/49) — o que o cliente NÃO pode forjar.
 * O servidor decide se o aviso sai da plataforma pela origem (`origin`,
 * `sent_by`, `broadcast`); se o cliente pudesse escrever isso, qualquer conta
 * mandaria e-mail "da plataforma", ou SMS pago para o número de outra pessoa.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc } from 'firebase/firestore';

let testEnv;
const USER = 'user_uid';
const OTHER = 'other_uid';
const ADMIN = 'admin_uid';

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });
beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', ADMIN), { uid: ADMIN, role: 'platform_admin' });
    await setDoc(doc(db, 'users', USER), { uid: USER, role: 'user' });
    await setDoc(doc(db, 'notifications', 'n1'), { user_id: USER, title: 'Oi', type: 'generic', read: false, origin: 'server' });
    await setDoc(doc(db, 'message_outbox', 'n1_email'), { user_id: USER, channel: 'email', status: 'sent' });
    await setDoc(doc(db, 'message_outbox', 'n2_email'), { user_id: OTHER, channel: 'email', status: 'sent' });
    await setDoc(doc(db, 'platform_secrets', 'messaging'), { resend: { api_key: 're_x' } });
    await setDoc(doc(db, 'message_suppressions', 'h1'), { address: 'a@x.com' });
    await setDoc(doc(db, 'phone_verifications', USER), { code_hash: 'x' });
    await setDoc(doc(db, 'message_reports', 'r1'), { reporter_uid: USER, sender_uid: OTHER });
  });
});
const as = (uid) => testEnv.authenticatedContext(uid, { email: `${uid}@x.com`, email_verified: true }).firestore();
const aviso = (extra = {}) => ({ user_id: OTHER, title: 'Oi', message: 'x', type: 'generic', link: '/torneios', read: false, ...extra });

describe('notifications: origem que o servidor confere', () => {
  it('o aviso comum segue funcionando, com e sem `sent_by` próprio', async () => {
    await assertSucceeds(setDoc(doc(as(USER), 'notifications', 'a1'), aviso()));
    await assertSucceeds(setDoc(doc(as(USER), 'notifications', 'a2'), aviso({ sent_by: USER })));
  });
  it('🔴 não se assina como outra pessoa', async () => {
    await assertFails(setDoc(doc(as(USER), 'notifications', 'a3'), aviso({ sent_by: ADMIN })));
  });
  it('🔴 não se passa pelo servidor nem marca como essencial', async () => {
    await assertFails(setDoc(doc(as(USER), 'notifications', 'a4'), aviso({ origin: 'server' })));
    await assertFails(setDoc(doc(as(USER), 'notifications', 'a5'), aviso({ essential: true })));
    await assertFails(setDoc(doc(as(ADMIN), 'notifications', 'a6'), aviso({ sent_by: ADMIN, origin: 'server' })));
  });
  it('🔴 canais do aviso em massa só do admin', async () => {
    const b = { broadcast: { kind: 'servico', channels: ['email'] } };
    await assertFails(setDoc(doc(as(USER), 'notifications', 'a7'), aviso({ sent_by: USER, ...b })));
    await assertSucceeds(setDoc(doc(as(ADMIN), 'notifications', 'a8'), aviso({ sent_by: ADMIN, ...b })));
  });
  it('o titular marca lida; não troca a origem depois', async () => {
    await assertSucceeds(updateDoc(doc(as(USER), 'notifications', 'n1'), { read: true, read_at: null }));
    await assertFails(updateDoc(doc(as(USER), 'notifications', 'n1'), { essential: true }));
    await assertFails(updateDoc(doc(as(USER), 'notifications', 'n1'), { sent_by: ADMIN }));
  });
});

describe('users: celular confirmado', () => {
  it('🔴 o dono não grava o número confirmado', async () => {
    await assertFails(updateDoc(doc(as(USER), 'users', USER), { phone_verified_number: '+5551999998888' }));
    await assertFails(setDoc(doc(as(OTHER), 'users', OTHER), { uid: OTHER, phone_verified_at: 1 }));
  });
  it('as escolhas de canal são do dono', async () => {
    await assertSucceeds(updateDoc(doc(as(USER), 'users', USER), { notification_channels: { email: { on: false } } }));
  });
});

describe('coleções do servidor', () => {
  it('🔴 ninguém lê chaves, bloqueios nem códigos — nem o admin', async () => {
    await assertFails(getDoc(doc(as(ADMIN), 'platform_secrets', 'messaging')));
    await assertFails(getDoc(doc(as(ADMIN), 'message_suppressions', 'h1')));
    await assertFails(getDoc(doc(as(USER), 'phone_verifications', USER)));
    await assertFails(setDoc(doc(as(ADMIN), 'platform_secrets', 'messaging'), { x: 1 }));
  });
  it('o registro de envios: a pessoa lê o dela, o admin lê tudo, ninguém escreve', async () => {
    await assertSucceeds(getDocs(query(collection(as(USER), 'message_outbox'), where('user_id', '==', USER))));
    await assertFails(getDoc(doc(as(USER), 'message_outbox', 'n2_email')));
    await assertSucceeds(getDocs(collection(as(ADMIN), 'message_outbox')));
    await assertFails(setDoc(doc(as(ADMIN), 'message_outbox', 'x'), { user_id: USER }));
  });
  it('denúncias: só o admin lê', async () => {
    await assertFails(getDoc(doc(as(USER), 'message_reports', 'r1')));
    await assertSucceeds(getDoc(doc(as(ADMIN), 'message_reports', 'r1')));
  });
});
