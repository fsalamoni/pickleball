/**
 * Regras de `audit_logs` — achado P1-07 (trilha de auditoria forjável).
 *
 * A trilha é a prova em caso de incidente. Antes, `allow create: if isAuthed()`
 * não validava o ator: qualquer usuário gravava entradas em nome de outra
 * pessoa. Estes testes provam que não grava mais — e que o uso legítimo
 * (`auditService.createAuditLog`, que grava `actor_id: actor.uid`) segue
 * funcionando, além da imutabilidade, que já existia e deve ser preservada.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, addDoc, collection, getDocs, setDoc, deleteDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore';

const USER_UID = 'user_uid';
const OTHER_UID = 'other_uid';
const ADMIN_UID = 'admin_uid';
let testEnv;

/** Payload exatamente como `auditService.createAuditLog` monta. */
function auditPayload(actorId, overrides = {}) {
  return {
    log_number: Date.now(),
    action: 'user_profile_updated',
    action_label: 'Perfil atualizado',
    actor_id: actorId,
    actor_name: 'Fulano',
    actor_email: 'fulano@x.com',
    tournament_id: null,
    user_id: actorId,
    user_name: 'Fulano',
    user_email: 'fulano@x.com',
    details: { changed_fields: ['platform_name'] },
    created_at_ms: Date.now(),
    created_at: serverTimestamp(),
    ...overrides,
  };
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-audit-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', ADMIN_UID), { role: 'platform_admin', email: 'admin@x.com' });
    await setDoc(doc(db, 'users', USER_UID), { role: 'user', email: 'user@x.com' });
    await setDoc(doc(db, 'audit_logs', 'existente'), auditPayload(USER_UID));
  });
});

const asUser  = () => testEnv.authenticatedContext(USER_UID, { email: 'user@x.com' }).firestore();
const asAdmin = () => testEnv.authenticatedContext(ADMIN_UID, { email: 'admin@x.com' }).firestore();
const asAnon  = () => testEnv.unauthenticatedContext().firestore();

describe('audit_logs — escrita (P1-07)', () => {
  it('1. FLUXO REAL: usuário grava a própria ação', async () => {
    await assertSucceeds(addDoc(collection(asUser(), 'audit_logs'), auditPayload(USER_UID)));
  });
  it('2. 🔴 usuário NÃO grava uma ação em nome de outra pessoa', async () => {
    await assertFails(addDoc(collection(asUser(), 'audit_logs'), auditPayload(OTHER_UID)));
  });
  it('3. 🔴 nem forjando o ator como o admin', async () => {
    await assertFails(addDoc(collection(asUser(), 'audit_logs'), auditPayload(ADMIN_UID)));
  });
  it('4. 🔴 nem omitindo o ator', async () => {
    const p = auditPayload(USER_UID); delete p.actor_id;
    await assertFails(addDoc(collection(asUser(), 'audit_logs'), p));
  });
  it('5. 🔴 nem com o ator nulo', async () => {
    await assertFails(addDoc(collection(asUser(), 'audit_logs'), auditPayload(null)));
  });
  it('6. anônimo não grava nada', async () => {
    await assertFails(addDoc(collection(asAnon(), 'audit_logs'), auditPayload(USER_UID)));
  });
  it('7. FLUXO REAL: o admin também grava as próprias ações', async () => {
    await assertSucceeds(addDoc(collection(asAdmin(), 'audit_logs'), auditPayload(ADMIN_UID)));
  });
});

describe('audit_logs — imutabilidade (comportamento existente, preservado)', () => {
  it('8. 🔴 ninguém edita uma entrada — nem o autor', async () => {
    await assertFails(updateDoc(doc(asUser(), 'audit_logs', 'existente'), { action: 'outra' }));
  });
  it('9. 🔴 nem o admin edita', async () => {
    await assertFails(updateDoc(doc(asAdmin(), 'audit_logs', 'existente'), { action: 'outra' }));
  });
  it('10. 🔴 ninguém apaga — nem o admin', async () => {
    await assertFails(deleteDoc(doc(asAdmin(), 'audit_logs', 'existente')));
  });
});

describe('audit_logs — leitura', () => {
  it('11. o admin lê a trilha', async () => {
    await assertSucceeds(getDocs(collection(asAdmin(), 'audit_logs')));
  });
  it('12. 🔴 usuário comum NÃO lê a trilha (contém e-mails)', async () => {
    await assertFails(getDocs(collection(asUser(), 'audit_logs')));
  });
  it('13. 🔴 nem a própria entrada', async () => {
    await assertFails(getDocs(collection(asUser(), 'audit_logs')));
  });
});
