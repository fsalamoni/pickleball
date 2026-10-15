/**
 * ⭐ O contato no perfil público só com a permissão da pessoa (princípio 10).
 *
 * `athlete_profiles/{uid}` é lido por qualquer conta logada. Até 2026-10-15
 * só o APP garantia que telefone, e-mail e endereço chegassem ali com a marca
 * `*_public` ligada — a regra aceitava qualquer coisa do dono e do admin. Um
 * defeito num caminho de sincronização (a re-sincronização do admin não
 * apagava o contato desligado) publicava o dado para a plataforma inteira.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteField, writeBatch } from 'firebase/firestore';

const ADMIN = 'admin_uid';
const EU = 'eu_uid';
let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-athlete-contacts-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

/** `users/{EU}` com as marcas dadas; o espelho com o que vier em `espelho`. */
async function semear({ marcas = {}, espelho = { uid: EU, name: 'Eu' } } = {}) {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', ADMIN), { uid: ADMIN, role: 'platform_admin' });
    await setDoc(doc(db, 'users', EU), { uid: EU, role: 'user', phone: '51999', ...marcas });
    if (espelho) await setDoc(doc(db, 'athlete_profiles', EU), espelho);
  });
}
beforeEach(() => semear());

const como = (uid) => testEnv.authenticatedContext(uid).firestore();
const perfil = (uid, db) => doc(db, 'athlete_profiles', uid);

describe('o dono', () => {
  it('sincroniza sem contato (o caso de quase todo mundo)', async () => {
    await assertSucceeds(setDoc(perfil(EU, como(EU)),
      { uid: EU, name: 'Eu', phone_public: false, email_public: false, address_public: false }, { merge: true }));
  });

  it('publica o telefone quando ligou a permissão (no cadastro e no espelho)', async () => {
    await semear({ marcas: { phone_public: true } });
    await assertSucceeds(setDoc(perfil(EU, como(EU)), { phone_public: true, phone: '51999' }, { merge: true }));
  });

  it('⭐ NÃO publica o telefone com a permissão desligada no cadastro', async () => {
    await assertFails(setDoc(perfil(EU, como(EU)), { phone_public: true, phone: '51999' }, { merge: true }));
  });

  it('⭐ NÃO publica o telefone sem a marca no próprio espelho', async () => {
    await semear({ marcas: { phone_public: true } });
    await assertFails(setDoc(perfil(EU, como(EU)), { phone_public: false, phone: '51999' }, { merge: true }));
  });

  it('⭐ NÃO cria o espelho já com e-mail ou endereço sem permissão', async () => {
    await semear({ espelho: null });
    await assertFails(setDoc(perfil(EU, como(EU)), { uid: EU, email: 'eu@x.com' }));
    await assertFails(setDoc(perfil(EU, como(EU)), { uid: EU, address: 'Rua A' }));
    await assertSucceeds(setDoc(perfil(EU, como(EU)), { uid: EU, name: 'Eu' }));
  });

  it('⭐ espelho antigo com telefone: a sincronização que o apaga passa, a que o mantém não', async () => {
    await semear({ espelho: { uid: EU, name: 'Eu', phone: '51999', phone_public: false } });
    await assertFails(setDoc(perfil(EU, como(EU)), { name: 'Eu 2' }, { merge: true }));
    await assertSucceeds(setDoc(perfil(EU, como(EU)), { name: 'Eu 2', phone: deleteField() }, { merge: true }));
  });
});

describe('o admin', () => {
  it('oculta um perfil antigo que ainda guarda contato (moderação não trava)', async () => {
    await semear({ espelho: { uid: EU, name: 'Eu', phone: '51999', phone_public: false } });
    await assertSucceeds(updateDoc(perfil(EU, como(ADMIN)), { hidden: true, hidden_by: ADMIN }));
  });

  it('⭐ NÃO grava contato sem a marca no espelho', async () => {
    await assertFails(setDoc(perfil(EU, como(ADMIN)), { phone: '51999', phone_public: false }, { merge: true }));
    await assertFails(setDoc(perfil(EU, como(ADMIN)), { phone: '51999' }, { merge: true }));
  });

  it('⭐ a re-sincronização em lote limpa contatos antigos de 30 perfis (sem estourar o limite de leituras)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      for (let i = 0; i < 30; i += 1) {
        await setDoc(doc(db, 'athlete_profiles', `a${i}`), { uid: `a${i}`, phone: '51', phone_public: false });
      }
    });
    const db = como(ADMIN);
    const lote = writeBatch(db);
    for (let i = 0; i < 30; i += 1) {
      lote.set(perfil(`a${i}`, db), { name: `A${i}`, phone_public: false, phone: deleteField(), email: 'a@x.com', email_public: true }, { merge: true });
    }
    await assertSucceeds(lote.commit());
  });
});
