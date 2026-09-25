/**
 * Regras dos BANNERS DE CAMPANHA (Onda CC) — zero regra nova.
 *
 * O banner mora em `arena_campaigns` (campos opcionais `banner`,
 * `destination`, `show_on_arena`, `show_home`, `banner_until`,
 * `banner_active`) e os modelos da arena em `arena_settings.banner_templates`.
 * As regras são as de sempre; estas asserções provam que:
 *
 *  1. ⭐ a ARENA publica, edita, pausa e retoma o banner dela — e só dela;
 *  2. ⭐ o atleta LÊ (é para ser visto) e não escreve nada — nem pausar;
 *  3. ⭐ as duas consultas das telas são aceitas: a da página da arena
 *     (`arena_id` + `show_on_arena`) e a da tela inicial (`show_home` +
 *     `banner_active`) — consulta recusada viraria banner que nunca aparece;
 *  4. ⭐ os modelos da arena: só quem gere a arena lê e grava; outra arena e
 *     o atleta, não (o modelo pode ter promoção que ainda não foi ao ar).
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

const BANNER = {
  source: 'design',
  template_id: 'oferta',
  design: { layout: 'oferta', title: 'Terça com 20%', highlight: '20% OFF', bg: '#d4f631', fg: '#0b0b0c', accent: '#0b0b0c' },
};
const campanha = (over = {}) => ({
  id: 'k1',
  arena_id: ARENA,
  name: 'Terça barata',
  message: '',
  channel: 'banner',
  status: 'sent',
  sent_count: 0,
  destination: { type: 'booking', target_id: '', target_label: '' },
  banner: BANNER,
  show_on_arena: true,
  show_home: true,
  banner_until: '2026-10-09',
  banner_active: true,
  created_by: GESTOR,
  ...over,
});

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'picklerush-campaign-banners-test',
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
    await setDoc(doc(db, 'arena_campaigns', 'existente'), campanha({ id: 'existente' }));
    await setDoc(doc(db, 'arena_settings', ARENA), { arena_id: ARENA });
  });
});

const como = (uid) => testEnv.authenticatedContext(uid).firestore();

describe('⭐ a arena publica e cuida do banner dela', () => {
  it('publica uma campanha com banner, destino e lugar', async () => {
    await assertSucceeds(setDoc(doc(como(GESTOR), 'arena_campaigns', 'k1'), campanha()));
  });

  it('publica com imagem ENVIADA', async () => {
    await assertSucceeds(setDoc(doc(como(GESTOR), 'arena_campaigns', 'k2'), campanha({
      id: 'k2',
      banner: {
        source: 'upload', image_url: 'https://firebasestorage.googleapis.com/v0/b/x/o/a.jpg',
        image_path: `uploads/${GESTOR}/arena-banners/a.jpg`, width: 1600, height: 800, alt: 'Terça com 20%',
      },
    })));
  });

  it('pausa, retoma e troca o banner', async () => {
    const db = como(GESTOR);
    await assertSucceeds(updateDoc(doc(db, 'arena_campaigns', 'existente'), { banner_active: false }));
    await assertSucceeds(updateDoc(doc(db, 'arena_campaigns', 'existente'), { banner_active: true }));
    await assertSucceeds(updateDoc(doc(db, 'arena_campaigns', 'existente'), {
      banner: { ...BANNER, design: { ...BANNER.design, title: 'Quarta com 20%' } },
      destination: { type: 'tournament', target_id: 't1', target_label: 'Open' },
      show_home: false, banner_until: '2026-10-20',
    }));
  });

  it('não leva a campanha para outra arena', async () => {
    await assertFails(updateDoc(doc(como(GESTOR), 'arena_campaigns', 'existente'), { arena_id: ARENA_B, banner_active: true }));
  });

  it('outra arena não publica em nome desta, nem pausa o banner dela', async () => {
    await assertFails(setDoc(doc(como(GESTOR_B), 'arena_campaigns', 'k3'), campanha({ id: 'k3' })));
    await assertFails(updateDoc(doc(como(GESTOR_B), 'arena_campaigns', 'existente'), { banner_active: false }));
  });
});

describe('⭐ o atleta vê e não mexe', () => {
  it('não publica, não pausa, não troca o destino', async () => {
    const db = como(ANA);
    await assertFails(setDoc(doc(db, 'arena_campaigns', 'k9'), campanha({ id: 'k9', created_by: ANA })));
    await assertFails(updateDoc(doc(db, 'arena_campaigns', 'existente'), { banner_active: false }));
    await assertFails(updateDoc(doc(db, 'arena_campaigns', 'existente'), { destination: { type: 'details' } }));
  });

  it('lê a campanha (a página "saiba mais")', async () => {
    await assertSucceeds(getDoc(doc(como(ANA), 'arena_campaigns', 'existente')));
  });

  it('⭐ a consulta da página da arena é aceita', async () => {
    await assertSucceeds(getDocs(query(
      collection(como(ANA), 'arena_campaigns'),
      where('arena_id', '==', ARENA), where('show_on_arena', '==', true),
    )));
  });

  it('⭐ a consulta da tela inicial é aceita', async () => {
    await assertSucceeds(getDocs(query(
      collection(como(ANA), 'arena_campaigns'),
      where('show_home', '==', true), where('banner_active', '==', true),
    )));
  });

  it('sem conta, nada', async () => {
    await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'arena_campaigns', 'existente')));
  });
});

describe('⭐ os modelos de banner da arena (`arena_settings.banner_templates`)', () => {
  const modelos = [{ id: 'arena:m1', name: 'Terças', design: BANNER.design, created_at_ms: 1, updated_at_ms: 1 }];

  it('quem gere a arena grava e lê', async () => {
    const db = como(GESTOR);
    await assertSucceeds(updateDoc(doc(db, 'arena_settings', ARENA), { banner_templates: modelos }));
    await assertSucceeds(getDoc(doc(db, 'arena_settings', ARENA)));
  });

  it('a primeira vez (sem o documento de configurações) também grava', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(ctx.firestore(), 'arena_settings', ARENA));
    });
    await assertSucceeds(setDoc(doc(como(GESTOR), 'arena_settings', ARENA), { arena_id: ARENA, banner_templates: modelos }));
  });

  it('o atleta não lê nem grava os modelos', async () => {
    const db = como(ANA);
    await assertFails(getDoc(doc(db, 'arena_settings', ARENA)));
    await assertFails(updateDoc(doc(db, 'arena_settings', ARENA), { banner_templates: modelos }));
  });

  it('outra arena não lê nem grava os modelos desta', async () => {
    const db = como(GESTOR_B);
    await assertFails(getDoc(doc(db, 'arena_settings', ARENA)));
    await assertFails(updateDoc(doc(db, 'arena_settings', ARENA), { banner_templates: [] }));
  });
});
