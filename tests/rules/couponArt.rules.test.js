/**
 * Regras da ARTE do cupom (Onda CD) — zero regra nova.
 *
 * A arte mora no próprio cupom (`arena_coupons.art`, campo opcional) e os
 * modelos da arena em `arena_settings.coupon_templates`. Estas asserções
 * provam, contra as regras de sempre, que:
 *
 *  1. ⭐ a ARENA cria e edita cupom com arte (desenho ou imagem) — e só a dela;
 *  2. ⭐ o atleta lê o cupom com a arte (é para ser visto) e não mexe nela;
 *  3. ⭐ os modelos de cupom da arena: só quem gere a arena lê e grava.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where,
} from 'firebase/firestore';

const GESTOR = 'gestor_uid';
const GESTOR_B = 'gestor_b_uid';
const ANA = 'ana_uid';
const ARENA = 'arena_1';
const ARENA_B = 'arena_2';

const ARTE = {
  source: 'design',
  template_id: 'neon',
  design: { style: 'neon', kicker: 'Só pelo app', title: '', subtitle: '', bg: '#0b0b0c', fg: '#ffffff', accent: '#d4f631' },
};
const cupom = (over = {}) => ({
  id: 'c1', arena_id: ARENA, kind: 'discount', code: 'VERAO10', type: 'percent', value: 10,
  active: true, show_public: true, show_home: false, used_count: 0, art: ARTE, ...over,
});

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-coupon-art-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(async () => { await testEnv?.cleanup(); });

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', GESTOR), { uid: GESTOR, role: 'user' });
    await setDoc(doc(db, 'users', GESTOR_B), { uid: GESTOR_B, role: 'user' });
    await setDoc(doc(db, 'users', ANA), { uid: ANA, role: 'user' });
    await setDoc(doc(db, 'arena_managers', `${ARENA}_${GESTOR}`), { arena_id: ARENA, user_id: GESTOR });
    await setDoc(doc(db, 'arena_managers', `${ARENA_B}_${GESTOR_B}`), { arena_id: ARENA_B, user_id: GESTOR_B });
    await setDoc(doc(db, 'arena_coupons', 'existente'), cupom({ id: 'existente', art: null }));
    await setDoc(doc(db, 'arena_settings', ARENA), { arena_id: ARENA });
  });
});

const como = (uid) => testEnv.authenticatedContext(uid).firestore();

describe('⭐ a arena cria e edita cupom com arte', () => {
  it('cria com desenho', async () => {
    await assertSucceeds(setDoc(doc(como(GESTOR), 'arena_coupons', 'c1'), cupom()));
  });

  it('cria com imagem enviada', async () => {
    await assertSucceeds(setDoc(doc(como(GESTOR), 'arena_coupons', 'c2'), cupom({
      id: 'c2',
      art: {
        source: 'upload', image_url: 'https://firebasestorage.googleapis.com/v0/b/x/o/c.jpg',
        image_path: `uploads/${GESTOR}/arena-coupons/c.jpg`, width: 1200, height: 600, alt: 'Terça 10%',
      },
    })));
  });

  it('põe, troca e tira a arte de um cupom antigo', async () => {
    const db = como(GESTOR);
    await assertSucceeds(updateDoc(doc(db, 'arena_coupons', 'existente'), { art: ARTE }));
    await assertSucceeds(updateDoc(doc(db, 'arena_coupons', 'existente'), { art: { ...ARTE, template_id: 'festa' } }));
    await assertSucceeds(updateDoc(doc(db, 'arena_coupons', 'existente'), { art: null }));
  });

  it('outra arena não cria nem edita a arte do cupom desta', async () => {
    await assertFails(setDoc(doc(como(GESTOR_B), 'arena_coupons', 'c3'), cupom({ id: 'c3' })));
    await assertFails(updateDoc(doc(como(GESTOR_B), 'arena_coupons', 'existente'), { art: ARTE }));
  });
});

describe('⭐ o atleta vê e não mexe', () => {
  it('lê o cupom (com a arte) e lista as promoções da arena', async () => {
    await assertSucceeds(getDoc(doc(como(ANA), 'arena_coupons', 'existente')));
    await assertSucceeds(getDocs(query(collection(como(ANA), 'arena_coupons'), where('arena_id', '==', ARENA))));
  });

  it('não troca a arte nem cria cupom', async () => {
    await assertFails(updateDoc(doc(como(ANA), 'arena_coupons', 'existente'), { art: ARTE }));
    await assertFails(setDoc(doc(como(ANA), 'arena_coupons', 'c9'), cupom({ id: 'c9' })));
  });
});

describe('⭐ os modelos de cupom da arena (`arena_settings.coupon_templates`)', () => {
  const modelos = [{ id: 'arena:m1', name: 'Vale da recepção', design: ARTE.design, created_at_ms: 1, updated_at_ms: 1 }];

  it('quem gere a arena grava e lê', async () => {
    const db = como(GESTOR);
    await assertSucceeds(updateDoc(doc(db, 'arena_settings', ARENA), { coupon_templates: modelos }));
    await assertSucceeds(getDoc(doc(db, 'arena_settings', ARENA)));
  });

  it('o atleta e outra arena não leem nem gravam', async () => {
    await assertFails(getDoc(doc(como(ANA), 'arena_settings', ARENA)));
    await assertFails(updateDoc(doc(como(ANA), 'arena_settings', ARENA), { coupon_templates: modelos }));
    await assertFails(getDoc(doc(como(GESTOR_B), 'arena_settings', ARENA)));
    await assertFails(updateDoc(doc(como(GESTOR_B), 'arena_settings', ARENA), { coupon_templates: [] }));
  });
});
